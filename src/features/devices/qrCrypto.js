import init, {
  generate_private_ephemeral_key,
  generate_public_ephemeral_key,
  diffie_hellman,
  hkdf_derive,
  encrypt as wasmEncrypt,
  decrypt as wasmDecrypt,
} from '@mascaro101/echo-protocol'
import eld from '@/utils/storage/EncryptedLocalDatabase'

const QR_VERSION = 'echo-qr-v1'
const QR_INFO = new TextEncoder().encode(QR_VERSION)
const LS_IK_KEY = 'echo_device_ik'

// ── Base64 helpers ──────────────────────────────────────────────────────────

function b64enc(u8) {
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin)
}

export function encodeKeyBase64(u8) {
  return b64enc(u8)
}

function b64dec(str) {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ── IK resolution ───────────────────────────────────────────────────────────
// Each device holds its own X25519 identity key in localStorage and NEVER
// imports a sibling's IK private. The primary writes its IK to localStorage at
// registration; secondaries generate fresh on first open.
//
// One-time bootstrap path: existing primary installations registered before
// per-device IKs were enforced kept their IK only in ELD. If localStorage is
// empty and ELD already has identity keys, we copy ELD → localStorage exactly
// once; from then on localStorage is authoritative and ELD is never read here.

export async function getOrCreateDeviceIK() {
  await init()

  const stored = localStorage.getItem(LS_IK_KEY)
  if (stored) {
    try {
      const { priv, pub } = JSON.parse(stored)
      return { priv: b64dec(priv), pub: b64dec(pub), source: 'local' }
    } catch {}
  }

  // Migration for pre-split primary installs: adopt the in-ELD account IK as
  // this device's permanent IK, then persist it to localStorage so subsequent
  // calls never need to consult ELD again.
  if (eld.isUnlocked?.()) {
    try {
      const keys = await eld.getIdentityKeys()
      if (keys?.privateKeyX25519 && keys?.publicKeyX25519) {
        localStorage.setItem(
          LS_IK_KEY,
          JSON.stringify({ priv: keys.privateKeyX25519, pub: keys.publicKeyX25519 })
        )
        return {
          priv: b64dec(keys.privateKeyX25519),
          pub: b64dec(keys.publicKeyX25519),
          source: 'local',
        }
      }
    } catch {}
  }

  // Fresh device — generate and persist a brand-new IK pair.
  const rand = crypto.getRandomValues(new Uint8Array(32))
  const priv = await generate_private_ephemeral_key(rand)
  const pub = await generate_public_ephemeral_key(priv)

  localStorage.setItem(LS_IK_KEY, JSON.stringify({ priv: b64enc(priv), pub: b64enc(pub) }))

  return { priv, pub, source: 'local' }
}

// ── Encryption ──────────────────────────────────────────────────────────────
// Returns a JSON-serialisable object safe to embed in the QR code.
//
// Protocol:
//   1. Generate ephemeral X25519 pair  (ek_priv, ek_pub)
//   2. DH: shared = X25519(ek_priv, IK_pub)         ← ek_priv × IK_priv × G
//   3. HKDF(shared, salt, info="echo-qr-v1") → 32-byte sym_key
//   4. AES-256-GCM(sym_key, nonce, message)  → ciphertext

export async function encryptQRPayload(message, ik, recipientPub = ik.pub) {
  await init()

  const rand = crypto.getRandomValues(new Uint8Array(32))
  const ekPriv = await generate_private_ephemeral_key(rand)
  const ekPub = await generate_public_ephemeral_key(ekPriv)

  const dhOut = await diffie_hellman(ekPriv, recipientPub)

  const salt = crypto.getRandomValues(new Uint8Array(32))
  const symKey = await hkdf_derive(dhOut, salt, QR_INFO, 32)

  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ct = await wasmEncrypt(message, symKey, nonce) // returns hex string

  return {
    v: QR_VERSION,
    senderIkPub: b64enc(ik.pub),
    recipientIkPub: b64enc(recipientPub),
    epk: b64enc(ekPub),
    ct, // hex ciphertext from WASM
    s: b64enc(salt),
    n: b64enc(nonce),
  }
}

// ── Decryption ──────────────────────────────────────────────────────────────
// Protocol (mirror of encryption):
//   DH: shared = X25519(IK_priv, ek_pub)   ← same scalar as above
//   HKDF(shared, salt, info) → sym_key
//   AES-256-GCM decrypt → plaintext

export async function decryptQRPayload(payload, ik) {
  await init()

  if (payload?.v !== QR_VERSION) throw new Error('Not an ECHO QR payload')

  const ekPub = b64dec(payload.epk)
  const salt = b64dec(payload.s)
  const nonce = b64dec(payload.n)

  const dhOut = await diffie_hellman(ik.priv, ekPub)
  const symKey = await hkdf_derive(dhOut, salt, QR_INFO, 32)

  return await wasmDecrypt(payload.ct, symKey, nonce) // returns plaintext string
}

// ── Payload detection ────────────────────────────────────────────────────────

export function parseQRPayload(raw) {
  try {
    const obj = JSON.parse(raw)
    if (obj?.v === QR_VERSION && obj.epk && obj.ct && obj.s && obj.n) return obj
  } catch {}
  return null
}

// ── Device sync protocol ─────────────────────────────────────────────────────
// Desktop shows QR → Mobile scans → Mobile logs in.
//
// Because this is a one-way channel (desktop→mobile), we cannot do X25519 DH:
// DH requires each party to know the other's public key in advance, which
// would need a prior key exchange in the opposite direction.  Instead, we
// generate a fresh 256-bit random key, encrypt the credentials with
// AES-256-GCM, and embed the key alongside the ciphertext in the QR.
// Security: the QR code itself is the secret channel — only the person who
// physically scans it can obtain the key and ciphertext.

const SYNC_VERSION = 'echo-sync-v1'
const HISTORY_PACKAGE_VERSION = 'echo-history-package-v1'
const HISTORY_INFO = new TextEncoder().encode(HISTORY_PACKAGE_VERSION)
const HISTORY_CHUNK_CHAR_LIMIT = 120_000

export async function generateSyncPayload(credentials) {
  await init()
  const key = crypto.getRandomValues(new Uint8Array(32))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ct = await wasmEncrypt(JSON.stringify(credentials), key, nonce)
  return { v: SYNC_VERSION, k: b64enc(key), ct, n: b64enc(nonce) }
}

export async function decryptSyncPayload(payload) {
  await init()
  if (payload?.v !== SYNC_VERSION) throw new Error('Not an ECHO sync payload')
  const pt = await wasmDecrypt(payload.ct, b64dec(payload.k), b64dec(payload.n))
  return JSON.parse(pt)
}

export async function decryptSyncPayloadDebug(payload) {
  await init()
  if (payload?.v !== SYNC_VERSION) throw new Error('Not an ECHO sync payload')

  const key = b64dec(payload.k)
  const nonce = b64dec(payload.n)
  const debug = {
    mode: 'sync',
    version: SYNC_VERSION,
    key,
    nonce,
    ct: payload.ct,
  }

  try {
    const pt = await wasmDecrypt(payload.ct, key, nonce)
    return { credentials: JSON.parse(pt), debug }
  } catch (e) {
    debug.error = e.message
    const err = new Error(e.message)
    err.debug = debug
    throw err
  }
}

export function parseSyncPayload(raw) {
  try {
    const obj = JSON.parse(raw)
    if (obj?.v === SYNC_VERSION && obj.k && obj.ct && obj.n) return obj
  } catch {}
  return null
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function normalizePairingCode(pairingCode) {
  return String(pairingCode || '').replace(/\D/g, '')
}

export function generatePairingCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000
  return value.toString().padStart(8, '0')
}

export function isValidPairingCode(pairingCode) {
  return /^\d{8}$/.test(normalizePairingCode(pairingCode))
}

export async function deriveHistoryPackageKey(dhShared, sessionId, pairingCode = '') {
  await init()
  const normalizedCode = normalizePairingCode(pairingCode)
  const salt = new TextEncoder().encode(`echo-history:${sessionId}:${normalizedCode}`)
  return hkdf_derive(dhShared, salt, HISTORY_INFO, 32)
}

export async function encryptHistoryPackageChunks(
  historyPackage,
  dhShared,
  sessionId,
  pairingCode
) {
  await init()
  const key = await deriveHistoryPackageKey(dhShared, sessionId, pairingCode)
  const json = JSON.stringify(historyPackage)
  const pieces = []

  for (let offset = 0; offset < json.length; offset += HISTORY_CHUNK_CHAR_LIMIT) {
    pieces.push(json.slice(offset, offset + HISTORY_CHUNK_CHAR_LIMIT))
  }

  const chunks = []
  for (let index = 0; index < pieces.length; index += 1) {
    const nonce = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await wasmEncrypt(pieces[index], key, nonce)
    chunks.push({
      index,
      totalCount: pieces.length,
      ciphertext,
      nonce: b64enc(nonce),
      digest: await sha256Hex(pieces[index]),
    })
  }

  return { chunks, key }
}

export async function decryptHistoryPackageChunks(chunks, dhShared, sessionId, pairingCode) {
  await init()
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('History package has no chunks yet.')
  }

  const key = await deriveHistoryPackageKey(dhShared, sessionId, pairingCode)
  const ordered = [...chunks].sort((a, b) => a.index - b.index)
  const expectedTotal = ordered[0]?.totalCount
  if (!Number.isInteger(expectedTotal) || ordered.length !== expectedTotal) {
    throw new Error('History package is incomplete.')
  }

  let json = ''
  for (const chunk of ordered) {
    const plaintext = await wasmDecrypt(chunk.ciphertext, key, b64dec(chunk.nonce))
    const digest = await sha256Hex(plaintext)
    if (digest !== chunk.digest) throw new Error('History package chunk digest mismatch.')
    json += plaintext
  }

  return { historyPackage: JSON.parse(json), key }
}

// ── Debug helpers ────────────────────────────────────────────────────────────
// Formats a Uint8Array as space-separated hex, truncated after `limit` bytes.

export function hexBytes(u8, limit = 16) {
  if (!u8) return '(null)'
  const slice = Array.from(u8).slice(0, limit)
  const hex = slice.map((b) => b.toString(16).padStart(2, '0')).join(' ')
  return u8.length > limit ? `${hex} … (${u8.length}B)` : `${hex} (${u8.length}B)`
}

export function decodeKeyInput(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) throw new Error('Missing key')

  const hex = trimmed
    .replace(/\([^)]+\)/g, '')
    .replace(/….*$/u, '')
    .replace(/[^0-9a-fA-F]/g, '')

  if (hex.length === 64) {
    const out = new Uint8Array(32)
    for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    return out
  }

  try {
    const decoded = b64dec(trimmed)
    if (decoded.length === 32) return decoded
  } catch {}

  throw new Error('Expected a 32-byte public key as hex or base64')
}

export async function generatePairingEphemeralDebug() {
  await init()
  const rand = crypto.getRandomValues(new Uint8Array(32))
  const ekPriv = await generate_private_ephemeral_key(rand)
  const ekPub = await generate_public_ephemeral_key(ekPriv)
  return { ekPriv, ekPub }
}

export async function derivePairingDhDebug(privateKey, publicKey, dhOp) {
  await init()
  const dhShared = await diffie_hellman(privateKey, publicKey)
  return { dhOp, dhShared }
}

// ── encryptQRPayloadDebug ────────────────────────────────────────────────────
// Identical to encryptQRPayload but also returns every intermediate crypto value
// so the UI can display the full computation for debugging / course demonstration.

export async function encryptQRPayloadDebug(
  message,
  ik,
  recipientPub = ik.pub,
  recipientLabel = 'own IK'
) {
  await init()

  const rand = crypto.getRandomValues(new Uint8Array(32))
  const ekPriv = await generate_private_ephemeral_key(rand)
  const ekPub = await generate_public_ephemeral_key(ekPriv)
  const dhShared = await diffie_hellman(ekPriv, recipientPub)
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const symKey = await hkdf_derive(dhShared, salt, QR_INFO, 32)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ct = await wasmEncrypt(message, symKey, nonce)

  return {
    payload: {
      v: QR_VERSION,
      senderIkPub: b64enc(ik.pub),
      recipientIkPub: b64enc(recipientPub),
      epk: b64enc(ekPub),
      ct,
      s: b64enc(salt),
      n: b64enc(nonce),
    },
    debug: {
      ikSource: ik.source,
      ikPub: ik.pub,
      senderIkPub: ik.pub,
      recipientLabel,
      recipientPub,
      ekPub,
      dhOp: 'DH(ek_priv, scanner_IK_pub)',
      dhShared,
      salt,
      hkdfInfo: QR_VERSION,
      symKey,
      nonce,
      ct,
    },
  }
}

// ── decryptQRPayloadDebug ────────────────────────────────────────────────────
// Identical to decryptQRPayload but returns every intermediate value.
// On decryption failure the error is thrown with a .debug property attached.

export async function decryptQRPayloadDebug(payload, ik) {
  await init()
  if (payload?.v !== QR_VERSION) throw new Error('Not an ECHO QR payload')

  const ekPub = b64dec(payload.epk)
  const salt = b64dec(payload.s)
  const nonce = b64dec(payload.n)
  const senderIkPub = payload.senderIkPub ? b64dec(payload.senderIkPub) : null
  const recipientIkPub = payload.recipientIkPub ? b64dec(payload.recipientIkPub) : null
  const dhShared = await diffie_hellman(ik.priv, ekPub)
  const symKey = await hkdf_derive(dhShared, salt, QR_INFO, 32)

  const debug = {
    ikSource: ik.source,
    ikPriv: ik.priv,
    ikPub: ik.pub,
    senderIkPub,
    recipientIkPub,
    ekPub,
    dhOp: 'DH(IK_priv, epk)',
    dhShared,
    salt,
    hkdfInfo: QR_VERSION,
    symKey,
    nonce,
    ct: payload.ct,
  }

  try {
    const text = await wasmDecrypt(payload.ct, symKey, nonce)
    return { text, debug }
  } catch (e) {
    debug.error = e.message
    const err = new Error(e.message)
    err.debug = debug
    throw err
  }
}
