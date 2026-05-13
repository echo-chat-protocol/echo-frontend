import { base64ToBytes } from '../../helpers.js'
import { generateLeafSigningKeypair, signBytes, verifyBytes } from './commitSigning.js'
import { issueCredential, verifyCredential } from './credential.js'

const TEXT_ENCODER = new TextEncoder()
const KP_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Resolve the init key from either a raw entry or a KeyPackage.
export function resolveInitKeyB64(entry) {
  return entry?.keyPackage?.initKeyB64 ?? entry?.initKeyB64 ?? null
}

// Pull the roster-facing identity fields out of a KeyPackage.
export function resolveRosterIdentityFromKeyPackage(kp) {
  if (!kp) return null
  return {
    userId: String(kp.userId ?? ''),
    leafSigningPubKeyB64: kp.leafSigningPubKeyB64 ?? null,
    credential: kp.credential ?? null,
  }
}

// Prefix one byte string with its length.
function lp(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : TEXT_ENCODER.encode(String(bytes ?? ''))
  const out = new Uint8Array(4 + b.length)
  out[0] = (b.length >>> 24) & 0xff
  out[1] = (b.length >>> 16) & 0xff
  out[2] = (b.length >>> 8) & 0xff
  out[3] = b.length & 0xff
  out.set(b, 4)
  return out
}

// Encode a JS-safe integer as an 8-byte unsigned value.
function encodeUint64(n) {
  const buf = new Uint8Array(8)
  buf[4] = (n >>> 24) & 0xff
  buf[5] = (n >>> 16) & 0xff
  buf[6] = (n >>> 8) & 0xff
  buf[7] = n & 0xff
  return buf
}

// Encode the signed portion of a KeyPackage.
export function encodeKeyPackageForSigning(kp) {
  const fields = [
    lp(TEXT_ENCODER.encode('EchoMLS/v1/KeyPackage')),
    lp(TEXT_ENCODER.encode(kp.version ?? '')),
    lp(TEXT_ENCODER.encode(kp.cipherSuite ?? '')),
    lp(TEXT_ENCODER.encode(String(kp.userId ?? ''))),
    lp(kp.initKeyB64 ? base64ToBytes(kp.initKeyB64) : new Uint8Array(0)),
    lp(kp.leafSigningPubKeyB64 ? base64ToBytes(kp.leafSigningPubKeyB64) : new Uint8Array(0)),
    lp(kp.credential?.signature ? base64ToBytes(kp.credential.signature) : new Uint8Array(0)),
    lp(encodeUint64(kp.createdAt ?? 0)),
    lp(encodeUint64(kp.expiresAt ?? 0)),
  ]
  const total = fields.reduce((acc, f) => acc + f.length, 0)
  const buf = new Uint8Array(total)
  let o = 0
  for (const f of fields) {
    buf.set(f, o)
    o += f.length
  }
  return buf
}

// Create a signed KeyPackage for one user.
export async function generateKeyPackage({ userId, initKeyB64, cipherSuite }) {
  const { leafSigningPrivKeyB64, leafSigningPubKeyB64 } = await generateLeafSigningKeypair()
  const credential = await issueCredential(userId, leafSigningPrivKeyB64, leafSigningPubKeyB64)

  const now = Date.now()
  const kp = {
    version: 'EchoMLS/v1',
    cipherSuite,
    userId: String(userId),
    initKeyB64,
    leafSigningPubKeyB64,
    credential,
    createdAt: now,
    expiresAt: now + KP_TTL_MS,
    signature: null,
  }

  kp.signature = await signBytes(encodeKeyPackageForSigning(kp), leafSigningPrivKeyB64)
  return { keyPackage: kp, leafSigningPrivKeyB64 }
}

// Verify one KeyPackage and its embedded credential.
export async function verifyKeyPackage(kp) {
  if (!kp?.signature || !kp?.leafSigningPubKeyB64) {
    throw new Error('KeyPackage is missing signature or signing pubkey')
  }
  if (typeof kp.expiresAt === 'number' && Date.now() > kp.expiresAt) {
    throw new Error(`KeyPackage for ${kp.userId} has expired`)
  }
  await verifyBytes(encodeKeyPackageForSigning(kp), kp.signature, kp.leafSigningPubKeyB64)
  if (kp.credential) {
    await verifyCredential(kp.credential)
    if (kp.credential.leafSigningPubKeyB64 !== kp.leafSigningPubKeyB64) {
      throw new Error(`KeyPackage credential pubkey mismatch for ${kp.userId}`)
    }
    if (kp.credential.userId !== String(kp.userId)) {
      throw new Error(`KeyPackage credential userId mismatch for ${kp.userId}`)
    }
  }
}
