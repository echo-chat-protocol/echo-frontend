import { generateLeafSigningKeypair, signBytes, verifyBytes } from './commitSigning.js'
import { issueCredential, verifyCredential } from './credential.js'

const TEXT_ENCODER = new TextEncoder()
const KP_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Deterministic canonical encoding of a KeyPackage for signing.
// All fields except `signature` are included so the self-signature covers them all.
export function encodeKeyPackageForSigning(kp) {
  return TEXT_ENCODER.encode(
    `EchoMLS/v1/KeyPackage` +
      `|${kp.version}` +
      `|${kp.cipherSuite}` +
      `|${kp.userId}` +
      `|${kp.initKeyB64}` +
      `|${kp.leafSigningPubKeyB64}` +
      `|${kp.credential.signature}` +
      `|${kp.createdAt}` +
      `|${kp.expiresAt}`
  )
}

// Generate a fresh signed KeyPackage.
// initKeyB64 is the X25519 public key (the existing one from ELD).
// Returns { keyPackage, leafSigningPrivKeyB64 } — caller stores the private key in ELD.
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

// Verify a received KeyPackage before extracting its initKeyB64.
// Throws on any failure: bad signature, expired, credential mismatch.
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
