// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

// ── Module mocks ──────────────────────────────────────────────────────────────
//
// QRGenerator was redesigned: it no longer encrypts a typed message into a QR.
// It now auto-creates a DH pairing session on mount, renders the ephemeral-key
// QR for the phone to scan, then derives a shared secret and uploads an
// encrypted chat-history package. These tests cover that current behaviour.

const cryptoMocks = vi.hoisted(() => ({
  getOrCreateDeviceIK: vi.fn(),
  generatePairingEphemeralDebug: vi.fn(),
  encodeKeyBase64: vi.fn(),
  generatePairingCode: vi.fn(),
  derivePairingDhDebug: vi.fn(),
  decodeKeyInput: vi.fn(),
  encryptHistoryPackageChunks: vi.fn(),
}))

const deviceServiceMocks = vi.hoisted(() => ({
  createDhSession: vi.fn(),
  getDhSession: vi.fn(),
  transferDhChunkToServer: vi.fn(),
}))

const qrcodeMock = vi.hoisted(() => ({ toDataURL: vi.fn() }))

vi.mock('../qrCrypto', () => ({
  getOrCreateDeviceIK: (...a) => cryptoMocks.getOrCreateDeviceIK(...a),
  generatePairingEphemeralDebug: (...a) => cryptoMocks.generatePairingEphemeralDebug(...a),
  encodeKeyBase64: (...a) => cryptoMocks.encodeKeyBase64(...a),
  generatePairingCode: (...a) => cryptoMocks.generatePairingCode(...a),
  derivePairingDhDebug: (...a) => cryptoMocks.derivePairingDhDebug(...a),
  decodeKeyInput: (...a) => cryptoMocks.decodeKeyInput(...a),
  encryptHistoryPackageChunks: (...a) => cryptoMocks.encryptHistoryPackageChunks(...a),
  hexBytes: (u8, limit = 16) => {
    if (!u8) return '(null)'
    const slice = Array.from(u8).slice(0, limit)
    return slice.map((b) => b.toString(16).padStart(2, '0')).join(' ') + ` (${u8.length}B)`
  },
}))

vi.mock('../deviceService', () => ({
  deviceService: {
    createDhSession: (...a) => deviceServiceMocks.createDhSession(...a),
    getDhSession: (...a) => deviceServiceMocks.getDhSession(...a),
    transferDhChunkToServer: (...a) => deviceServiceMocks.transferDhChunkToServer(...a),
  },
}))

vi.mock('@/utils/network/apiBase', () => ({
  resolvePairingServerUrl: () => 'https://pairing.example.test',
}))

vi.mock('../historyPackage', () => ({
  buildHistoryPackage: vi.fn().mockResolvedValue({ chats: [], groups: [], messages: [] }),
}))

vi.mock('qrcode', () => ({
  default: { toDataURL: (...a) => qrcodeMock.toDataURL(...a) },
}))

import QRGenerator from '../QRGenerator'

const flush = () => new Promise((r) => setTimeout(r, 0))

// ── Setup / teardown ──────────────────────────────────────────────────────────

let container, root

const fakeEphemeral = { ekPub: new Uint8Array(32).fill(3), ekPriv: new Uint8Array(32).fill(4) }
const fakeSession = {
  sessionId: 'sess-1',
  targetAccessToken: 'tok-1',
  // Far-future expiry so the countdown effect never auto-resets during a test.
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  cryptoMocks.getOrCreateDeviceIK.mockResolvedValue({
    pub: new Uint8Array(32).fill(1),
    source: 'local',
  })
  cryptoMocks.generatePairingEphemeralDebug.mockResolvedValue(fakeEphemeral)
  cryptoMocks.encodeKeyBase64.mockReturnValue('EKPUB_B64')
  cryptoMocks.generatePairingCode.mockReturnValue('123456')
  // Polling never returns a scanner key during these tests (no scan happens).
  deviceServiceMocks.createDhSession.mockResolvedValue(fakeSession)
  deviceServiceMocks.getDhSession.mockResolvedValue({ session: { status: 'active' } })
  qrcodeMock.toDataURL.mockResolvedValue('data:image/png;base64,FAKE_QR')
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QRGenerator', () => {
  it('shows a loading placeholder before the DH session is created', async () => {
    // Session creation never resolves during this test.
    deviceServiceMocks.createDhSession.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    expect(container.querySelector('img[alt="Ephemeral key pairing QR"]')).toBeNull()
    expect(container.textContent).toMatch(/QR/i)
  })

  it('auto-creates a DH session and renders the pairing QR image on mount', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
      await flush()
    })

    expect(cryptoMocks.getOrCreateDeviceIK).toHaveBeenCalled()
    expect(deviceServiceMocks.createDhSession).toHaveBeenCalledTimes(1)

    const img = container.querySelector('img[alt="Ephemeral key pairing QR"]')
    expect(img).not.toBeNull()
    expect(img.src).toContain('data:image/png')
  })

  it('encodes the session and ephemeral public key into the scanned QR payload', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
      await flush()
    })

    expect(qrcodeMock.toDataURL).toHaveBeenCalled()
    const payloadArg = qrcodeMock.toDataURL.mock.calls[0][0]
    const payload = JSON.parse(payloadArg)
    expect(payload).toMatchObject({
      type: 'echo_dh_pairing',
      sessionId: 'sess-1',
      targetAccessToken: 'tok-1',
      ekPub: 'EKPUB_B64',
      serverUrl: 'https://pairing.example.test',
    })
  })

  it('shows an error and a "Try again" button when session creation fails', async () => {
    deviceServiceMocks.createDhSession.mockRejectedValue(new Error('backend offline'))

    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
      await flush()
    })

    expect(container.textContent).toContain('backend offline')
    const retry = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Try again')
    )
    expect(retry).toBeTruthy()
  })

  it('retries session creation when the "Try again" button is clicked', async () => {
    deviceServiceMocks.createDhSession.mockRejectedValueOnce(new Error('backend offline'))

    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
      await flush()
    })

    const retry = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Try again')
    )
    expect(retry).toBeTruthy()

    await act(async () => {
      retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flush()
      await flush()
    })

    // First (failed) attempt + retry = 2 calls; the retry renders the QR.
    expect(deviceServiceMocks.createDhSession.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('img[alt="Ephemeral key pairing QR"]')).not.toBeNull()
  })
})
