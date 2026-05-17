// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

// ── Module mocks ──────────────────────────────────────────────────────────────

const cryptoMocks = vi.hoisted(() => ({
  getOrCreateDeviceIK: vi.fn(),
  encryptQRPayloadDebug: vi.fn(),
}))

vi.mock('../qrCrypto', () => ({
  getOrCreateDeviceIK: (...a) => cryptoMocks.getOrCreateDeviceIK(...a),
  encryptQRPayloadDebug: (...a) => cryptoMocks.encryptQRPayloadDebug(...a),
  hexBytes: (u8, limit = 16) => {
    if (!u8) return '(null)'
    const slice = Array.from(u8).slice(0, limit)
    return slice.map((b) => b.toString(16).padStart(2, '0')).join(' ') + ` (${u8.length}B)`
  },
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,FAKE_QR'),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

import QRGenerator from '../QRGenerator'

const flush = () => new Promise((r) => setTimeout(r, 0))

const fakeIK = { priv: new Uint8Array(32), pub: new Uint8Array(32), source: 'local' }
const fakePayload = { v: 'echo-qr-v1', epk: 'epkABC', ct: 'ctDEF', s: 'sGHI', n: 'nJKL' }
const fakeDebug = {
  ikSource: 'local',
  ikPub: new Uint8Array(32).fill(2),
  ekPub: new Uint8Array(32).fill(3),
  dhOp: 'DH(ek_priv, IK_pub)',
  dhShared: new Uint8Array(32).fill(4),
  salt: new Uint8Array(32).fill(5),
  hkdfInfo: 'echo-qr-v1',
  symKey: new Uint8Array(32).fill(6),
  nonce: new Uint8Array(12).fill(7),
  ct: 'deadbeef',
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

let container, root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  cryptoMocks.getOrCreateDeviceIK.mockResolvedValue(fakeIK)
  cryptoMocks.encryptQRPayloadDebug.mockResolvedValue({ payload: fakePayload, debug: fakeDebug })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QRGenerator', () => {
  it('shows "Loading keys…" on the button while IK is not yet resolved', async () => {
    // Never resolves during this test
    cryptoMocks.getOrCreateDeviceIK.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    const btn = container.querySelector('button')
    expect(btn.textContent).toContain('Loading keys')
    expect(btn.disabled).toBe(true)
  })

  it('renders the message input after mount', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    const input = container.querySelector('input[type="text"]')
    expect(input).not.toBeNull()
    expect(input.placeholder).toContain('encrypt')
  })

  it('button is disabled when message is empty (even after IK loads)', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    const btn = container.querySelector('button')
    expect(btn.disabled).toBe(true)
  })

  it('button becomes enabled after IK loads and message is typed', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    const input = container.querySelector('input[type="text"]')
    await act(async () => {
      setInputValue(input, 'hello world')
      await flush()
    })

    const btn = container.querySelector('button')
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('Generate QR Code')
  })

  it('clicking Generate QR Code calls encryptQRPayloadDebug and shows the QR image', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    const input = container.querySelector('input[type="text"]')
    await act(async () => {
      setInputValue(input, 'secret message')
      await flush()
    })

    const btn = container.querySelector('button')
    await act(async () => {
      btn.click()
      await flush()
    })

    expect(cryptoMocks.encryptQRPayloadDebug).toHaveBeenCalledWith('secret message', fakeIK)

    const img = container.querySelector('img[alt="QR Code"]')
    expect(img).not.toBeNull()
    expect(img.src).toContain('data:image/png')
  })

  it('shows the encrypted message label after QR generation', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    await act(async () => {
      setInputValue(container.querySelector('input'), 'my text')
      await flush()
    })

    await act(async () => {
      container.querySelector('button').click()
      await flush()
    })

    expect(container.textContent).toContain('my text')
  })

  it('"Generate new" button resets back to the input form', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    await act(async () => {
      setInputValue(container.querySelector('input'), 'reset test')
      await flush()
    })

    await act(async () => {
      container.querySelector('button').click()
      await flush()
    })

    // Find "Generate new" link/button
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Generate new')
    )
    expect(resetBtn).not.toBeNull()

    await act(async () => {
      resetBtn.click()
      await flush()
    })

    // Input form should be back
    expect(container.querySelector('input[type="text"]')).not.toBeNull()
  })

  it('shows an error message when encryptQRPayloadDebug rejects', async () => {
    cryptoMocks.encryptQRPayloadDebug.mockRejectedValue(new Error('WASM failed'))

    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    await act(async () => {
      setInputValue(container.querySelector('input'), 'bad')
      await flush()
    })

    await act(async () => {
      container.querySelector('button').click()
      await flush()
    })

    expect(container.textContent).toContain('Encryption failed')
  })

  it('shows key source note when IK is loaded', async () => {
    await act(async () => {
      root.render(<QRGenerator />)
      await flush()
    })

    expect(container.textContent).toContain('DH symmetry')
  })
})
