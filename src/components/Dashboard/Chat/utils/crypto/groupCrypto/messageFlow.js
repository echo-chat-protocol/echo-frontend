import { base64ToBytes, bytesToBase64 } from '../../helpers.js'

import { decrypt_aad_bytes, encrypt_aad_bytes } from '@mascaro101/echo-protocol'

import { deriveAppKeyAndNonce, deriveSenderDataKeyAndNonce } from '../keySchedule.js'
import { normalizeGroupState, resolveApplicationKey } from './groupState.js'
import { randomBytes } from './pathSecrets.js'

export const MLS_HEADER_VERSION = 1

const TEXT_ENCODER = new TextEncoder()

// Sender data carries the sender leaf and generation in a fixed-size blob.
function encodeSenderData(leafIndex, generation, reuseGuard) {
  const buf = new Uint8Array(12)
  buf[0] = (leafIndex >>> 24) & 0xff
  buf[1] = (leafIndex >>> 16) & 0xff
  buf[2] = (leafIndex >>> 8) & 0xff
  buf[3] = leafIndex & 0xff
  buf[4] = (generation >>> 24) & 0xff
  buf[5] = (generation >>> 16) & 0xff
  buf[6] = (generation >>> 8) & 0xff
  buf[7] = generation & 0xff
  buf.set(reuseGuard, 8)
  return buf
}

// Read sender metadata back out of the fixed sender-data bytes.
function decodeSenderData(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    leafIndex: view.getUint32(0, false),
    generation: view.getUint32(4, false),
    reuseGuard: bytes.slice(8, 12),
  }
}

// Encrypt the sender metadata that rides alongside the content ciphertext.
async function encryptSenderData(senderDataSecretBytes, contentCiphertext, leafIndex, generation) {
  const reuseGuard = randomBytes(4)
  const senderDataPlaintext = encodeSenderData(leafIndex, generation, reuseGuard)
  // Sender-data keys are derived from the content ciphertext prefix.
  const { key, nonce } = await deriveSenderDataKeyAndNonce(
    senderDataSecretBytes,
    contentCiphertext.slice(0, 4)
  )
  const aad = contentCiphertext.slice(0, 4)
  const encryptedSenderData = encrypt_aad_bytes(senderDataPlaintext, key, nonce, aad)
  return { encryptedSenderDataB64: bytesToBase64(encryptedSenderData) }
}

// Decrypt the sender metadata for one application message.
async function decryptSenderData(senderDataSecretBytes, contentCiphertext, encryptedSenderDataB64) {
  const encrypted = base64ToBytes(encryptedSenderDataB64)
  const { key, nonce } = await deriveSenderDataKeyAndNonce(
    senderDataSecretBytes,
    contentCiphertext.slice(0, 4)
  )
  const aad = contentCiphertext.slice(0, 4)
  const plaintext = decrypt_aad_bytes(encrypted, key, nonce, aad)
  return decodeSenderData(plaintext)
}

// Encrypt one MLS application message and advance the sender counter.
export async function encryptApplicationMessage({ state, plaintextBytes, aadBytes }) {
  const normalizedState = normalizeGroupState(state)

  if (!normalizedState.groupId) throw new Error('Group state is missing groupId')
  if (!Number.isInteger(normalizedState.selfLeafIndex)) {
    throw new Error(`Group state is missing selfLeafIndex for group ${normalizedState.groupId}`)
  }

  const { keyBytes: appSecret } = resolveApplicationKey(normalizedState)
  const generation = normalizedState.senderGenerations[String(normalizedState.selfLeafIndex)] ?? 0
  const { key, nonce } = await deriveAppKeyAndNonce(
    appSecret,
    normalizedState.selfLeafIndex,
    generation
  )

  const plaintextInput =
    typeof plaintextBytes === 'string'
      ? TEXT_ENCODER.encode(plaintextBytes)
      : plaintextBytes instanceof Uint8Array
        ? plaintextBytes
        : new Uint8Array(plaintextBytes)

  const contentAad = aadBytes instanceof Uint8Array ? aadBytes : new Uint8Array(0)
  const ciphertextBytes = encrypt_aad_bytes(plaintextInput, key, nonce, contentAad)

  // Keep sender identity encrypted when the epoch has sender-data material.
  let encryptedSenderDataB64 = null
  if (normalizedState.senderDataSecretB64) {
    const sdSecret = base64ToBytes(normalizedState.senderDataSecretB64)
    const { encryptedSenderDataB64: esd } = await encryptSenderData(
      sdSecret,
      ciphertextBytes,
      normalizedState.selfLeafIndex,
      generation
    )
    encryptedSenderDataB64 = esd
  }

  const newState = normalizeGroupState({
    ...normalizedState,
    senderGenerations: {
      ...normalizedState.senderGenerations,
      [String(normalizedState.selfLeafIndex)]: generation + 1,
    },
  })

  return {
    encryptedSenderDataB64,
    ciphertextB64: bytesToBase64(ciphertextBytes),
    header: {
      version: MLS_HEADER_VERSION,
      groupId: normalizedState.groupId,
      epoch: normalizedState.epoch,
      senderLeafIndex: normalizedState.selfLeafIndex,
      generation,
      cipherSuite: normalizedState.cipherSuite,
    },
    headerB64: bytesToBase64(
      TEXT_ENCODER.encode(
        JSON.stringify({
          version: MLS_HEADER_VERSION,
          groupId: normalizedState.groupId,
          epoch: normalizedState.epoch,
          senderLeafIndex: normalizedState.selfLeafIndex,
          generation,
          cipherSuite: normalizedState.cipherSuite,
        })
      )
    ),
    newState: { ...newState, groupKeyB64: newState.applicationSecretB64 },
  }
}

// Decrypt one MLS application message and optionally advance local state.
export async function decryptApplicationMessage({
  state,
  encryptedSenderDataB64 = null,
  header = null,
  ciphertext,
  aadBytes,
  includeNewState = false,
}) {
  const normalizedState = normalizeGroupState(state)

  if (!normalizedState.groupId) throw new Error('Group state is missing groupId')
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    throw new Error(`MLS ciphertext is missing for group ${normalizedState.groupId}`)
  }

  const ciphertextBytes = base64ToBytes(ciphertext)
  let senderLeafIndex, generation

  if (encryptedSenderDataB64 && normalizedState.senderDataSecretB64) {
    // Prefer encrypted sender data when this epoch supports it.
    const sdSecret = base64ToBytes(normalizedState.senderDataSecretB64)
    const sd = await decryptSenderData(sdSecret, ciphertextBytes, encryptedSenderDataB64)
    senderLeafIndex = sd.leafIndex
    generation = sd.generation
  } else if (header) {
    // Fall back to the legacy plaintext header during migration.
    const parsedHeader =
      typeof header === 'string'
        ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(header)))
        : header
    senderLeafIndex = parsedHeader.senderLeafIndex
    generation = parsedHeader.generation

    if (parsedHeader.version !== MLS_HEADER_VERSION) {
      throw new Error(`Unsupported MLS header version for group ${normalizedState.groupId}`)
    }
    if (String(parsedHeader.groupId ?? '') !== String(normalizedState.groupId)) {
      throw new Error(`MLS header groupId mismatch for group ${normalizedState.groupId}`)
    }
    if (Number.isInteger(parsedHeader.epoch) && parsedHeader.epoch !== normalizedState.epoch) {
      throw new Error(`MLS epoch mismatch for group ${normalizedState.groupId}`)
    }
  } else {
    throw new Error('decryptApplicationMessage requires encryptedSenderDataB64 or header')
  }

  if (!Number.isInteger(senderLeafIndex)) {
    throw new Error(`Cannot determine senderLeafIndex for group ${normalizedState.groupId}`)
  }
  if (!Number.isInteger(generation)) {
    throw new Error(`Cannot determine generation for group ${normalizedState.groupId}`)
  }

  // Each sender advances one generation per message. Replays (gen < expected)
  // are rejected; forward jumps are accepted because app keys are derived
  // directly from (applicationSecret, senderLeafIndex, generation) with no
  // chained ratchet, so any generation is independently decryptable when an
  // earlier message is missing (e.g., dropped from the 50-message fetch window
  // after a remove + re-add).
  const expectedGeneration = normalizedState.senderGenerations[String(senderLeafIndex)] ?? 0
  if (generation < expectedGeneration) {
    throw new Error(
      `MLS generation mismatch for group ${normalizedState.groupId}: ` +
        `expected >= ${expectedGeneration}, got ${generation}`
    )
  }

  const { keyBytes: appSecret } = resolveApplicationKey(normalizedState)
  const { key, nonce } = await deriveAppKeyAndNonce(appSecret, senderLeafIndex, generation)

  const resolvedAad = aadBytes instanceof Uint8Array ? aadBytes : new Uint8Array(0)
  const plaintextBytes = decrypt_aad_bytes(ciphertextBytes, key, nonce, resolvedAad)

  if (!includeNewState) return plaintextBytes

  const newState = normalizeGroupState({
    ...normalizedState,
    senderGenerations: {
      ...normalizedState.senderGenerations,
      [String(senderLeafIndex)]: generation + 1,
    },
  })

  return { plaintextBytes, newState }
}
