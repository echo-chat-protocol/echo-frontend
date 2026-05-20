import { base64ToBytes, bytesToBase64 } from '../../helpers.js'

import init, { decrypt_aad_bytes, diffie_hellman, hkdf_derive } from '@mascaro101/echo-protocol'

import { hpkeSeal, hpkeOpen } from './hpke.js'
import {
  HPKE_WELCOME_WRAP_INFO,
  HPKE_PATH_SECRET_WRAP_INFO,
  AAD_COMMIT_PREFIX,
  AAD_PATH_SECRET_PREFIX,
} from './labels.js'

export const MLS_HEADER_VERSION = 1

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true })

// Legacy non-HPKE wrap infos kept only for backwards-compat decryption.
const WRAP_INFO = TEXT_ENCODER.encode('EchoMLS/v1/WelcomeWrap')
const PATH_SECRET_WRAP_INFO = TEXT_ENCODER.encode('EchoMLS/v1/PathSecretWrap')

const HPKE_WRAP_INFO = TEXT_ENCODER.encode(HPKE_WELCOME_WRAP_INFO)
const HPKE_PATH_SECRET_INFO = TEXT_ENCODER.encode(HPKE_PATH_SECRET_WRAP_INFO)

// Normalize arbitrary byte-like input into a Uint8Array.
export function normalizeBytes(value, fieldName) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (Array.isArray(value)) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  throw new Error(`Invalid ${fieldName}; expected byte array input`)
}

// Generate cryptographically random bytes.
export function randomBytes(length) {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

// Serialize an MLS header object to bytes.
export function makeHeaderBytes(header) {
  return TEXT_ENCODER.encode(JSON.stringify(header))
}

// Serialize an MLS header object to base64.
export function makeHeaderB64(header) {
  return bytesToBase64(makeHeaderBytes(header))
}

// Parse either a header object or a base64 header string.
export function parseHeader(header) {
  if (typeof header === 'string') {
    return JSON.parse(TEXT_DECODER.decode(base64ToBytes(header)))
  }
  if (header && typeof header === 'object') return header
  throw new Error('Missing MLS header')
}

// Normalize plaintext input for encryption helpers.
export function normalizePlaintextBytes(plaintextBytes) {
  if (typeof plaintextBytes === 'string') {
    return TEXT_ENCODER.encode(plaintextBytes)
  }
  return normalizeBytes(plaintextBytes, 'plaintextBytes')
}

// Build the AAD used for commit and welcome wrapping.
export function makeCommitAadBytes(groupId, epoch) {
  return TEXT_ENCODER.encode(`${AAD_COMMIT_PREFIX}|${groupId}|${epoch}`)
}

// Build the AAD used for one encrypted path secret.
export function makePathSecretAadBytes(nodeIndex) {
  return TEXT_ENCODER.encode(`${AAD_PATH_SECRET_PREFIX}|nodeIndex:${nodeIndex}`)
}

// Wrap one group secret for a single init key.
export async function wrapGroupKey(groupKeyB64, recipientInitKeyB64, aadBytes) {
  const plaintext = base64ToBytes(groupKeyB64)
  const pkR = base64ToBytes(recipientInitKeyB64)
  const { enc, ct } = await hpkeSeal(pkR, HPKE_WRAP_INFO, aadBytes, plaintext)
  return {
    encryptedB64: bytesToBase64(ct),
    ephPubB64: bytesToBase64(enc),
  }
}

// Unwrap one group secret using either legacy or HPKE format.
export async function unwrapGroupKey(
  { encryptedB64, ephPubB64, nonceB64 },
  myInitPrivKeyB64,
  aadBytes
) {
  if (typeof nonceB64 === 'string' && nonceB64.length > 0) {
    // Older envelopes carry an explicit nonce and use the legacy unwrap path.
    await init()
    const encryptedBytes = base64ToBytes(encryptedB64)
    const ephPub = base64ToBytes(ephPubB64)
    const nonce = base64ToBytes(nonceB64)
    const myPriv = base64ToBytes(myInitPrivKeyB64)
    const sharedSecret = diffie_hellman(myPriv, ephPub)
    const wrapKey = hkdf_derive(sharedSecret, new Uint8Array(0), WRAP_INFO, 32)
    const groupKeyBytes = decrypt_aad_bytes(encryptedBytes, wrapKey, nonce, aadBytes)
    return bytesToBase64(groupKeyBytes)
  }

  const ct = base64ToBytes(encryptedB64)
  const enc = base64ToBytes(ephPubB64)
  const skR = base64ToBytes(myInitPrivKeyB64)
  const plaintext = await hpkeOpen(enc, skR, HPKE_WRAP_INFO, aadBytes, ct)
  return bytesToBase64(plaintext)
}

// Wrap one TreeKEM path secret for a recipient leaf key.
export async function wrapPathSecret(pathSecretBytes, recipientPubB64, aadBytes) {
  const pkR = base64ToBytes(recipientPubB64)
  const { enc, ct } = await hpkeSeal(pkR, HPKE_PATH_SECRET_INFO, aadBytes, pathSecretBytes)
  return {
    encryptedB64: bytesToBase64(ct),
    ephPubB64: bytesToBase64(enc),
  }
}

// Unwrap one TreeKEM path secret using the local private key.
export async function unwrapPathSecret(
  { encryptedB64, ephPubB64, nonceB64 },
  myPrivKeyB64,
  aadBytes
) {
  if (typeof nonceB64 === 'string' && nonceB64.length > 0) {
    // Older path-secret envelopes use the same legacy format.
    await init()
    const encryptedBytes = base64ToBytes(encryptedB64)
    const ephPub = base64ToBytes(ephPubB64)
    const nonce = base64ToBytes(nonceB64)
    const myPriv = base64ToBytes(myPrivKeyB64)
    const sharedSecret = diffie_hellman(myPriv, ephPub)
    const wrapKey = hkdf_derive(sharedSecret, new Uint8Array(0), PATH_SECRET_WRAP_INFO, 32)
    return decrypt_aad_bytes(encryptedBytes, wrapKey, nonce, aadBytes)
  }

  const ct = base64ToBytes(encryptedB64)
  const enc = base64ToBytes(ephPubB64)
  const skR = base64ToBytes(myPrivKeyB64)
  return hpkeOpen(enc, skR, HPKE_PATH_SECRET_INFO, aadBytes, ct)
}
