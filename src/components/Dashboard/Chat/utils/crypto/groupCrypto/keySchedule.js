import init, * as protocol from '@mascaro101/echo-protocol'
import { encodeGroupContext } from './groupContext.js'
import {
  LABEL_EPOCH,
  LABEL_ENCRYPTION,
  LABEL_SENDER_DATA,
  LABEL_EXTERNAL,
  LABEL_MEMBERSHIP,
  LABEL_RESUMPTION,
  LABEL_INIT,
  LABEL_WELCOME,
  LABEL_KEY,
  LABEL_NONCE,
  LABEL_CONFIRM,
  LABEL_SECRET,
} from './labels.js'

const NH = 32
const NK = 32
const NN = 12

const TEXT_ENCODER = new TextEncoder()
const HKDF_EXTRACT_EXPORT = 'hkdf_extract'
const HKDF_EXPAND_EXPORT = 'hkdf_expand'

// Read the WASM HKDF export by name so tests can stub it cleanly.
async function hkdfExtract(salt, ikm) {
  const extract = protocol[HKDF_EXTRACT_EXPORT]
  if (typeof extract === 'function') return extract(salt, ikm)
  console.warn('[HKDF] extract fallback — expected', HKDF_EXTRACT_EXPORT)
  return
}

// Expand HKDF output using the WASM helper when available.
async function hkdfExpand(prk, info, length) {
  const expand = protocol[HKDF_EXPAND_EXPORT]
  if (typeof expand === 'function') return expand(prk, info, length)
  console.warn('[HKDF] expand fallback — expected', HKDF_EXPAND_EXPORT)
  return
}

// Encode one MLS HKDFLabel structure.
function encodeHKDFLabel(length, label, context) {
  const labelBytes = TEXT_ENCODER.encode('MLS 1.0 ' + label)
  const buf = new Uint8Array(2 + 1 + labelBytes.length + 4 + context.length)
  let o = 0
  buf[o++] = (length >>> 8) & 0xff
  buf[o++] = length & 0xff
  buf[o++] = labelBytes.length
  buf.set(labelBytes, o)
  o += labelBytes.length
  buf[o++] = (context.length >>> 24) & 0xff
  buf[o++] = (context.length >>> 16) & 0xff
  buf[o++] = (context.length >>> 8) & 0xff
  buf[o++] = context.length & 0xff
  buf.set(context, o)
  return buf
}

// Expand one MLS-labeled value from a secret.
export async function expandWithLabel(secret, label, context, length) {
  await init()
  // MLS expands from a structured label, not raw caller bytes.
  const info = encodeHKDFLabel(length, label, context)
  return hkdfExpand(secret, info, length)
}

// Derive one named MLS secret with an empty context.
export async function deriveSecret(secret, label) {
  return expandWithLabel(secret, label, new Uint8Array(0), NH)
}

// Derive the joiner secret from init and commit secrets.
export async function deriveJoinerSecret(initSecret, commitSecret) {
  await init()
  return hkdfExtract(initSecret, commitSecret)
}

// Derive the full epoch secret set for one group context.
export async function deriveEpochSecrets(
  joinerSecret,
  { groupId, epoch, cipherSuite, treeHash, confirmedTranscriptHash }
) {
  await init()
  // GroupContext binds the epoch secrets to this exact tree and transcript state.
  const context = encodeGroupContext({
    groupId,
    epoch,
    cipherSuite,
    treeHash,
    confirmedTranscriptHash,
  })
  const epochSecret = await expandWithLabel(joinerSecret, LABEL_EPOCH, context, NH)

  const [
    applicationSecret,
    senderDataSecret,
    externalSecret,
    membershipSecret,
    resumptionPsk,
    nextInitSecret,
  ] = await Promise.all([
    deriveSecret(epochSecret, LABEL_ENCRYPTION),
    deriveSecret(epochSecret, LABEL_SENDER_DATA),
    deriveSecret(epochSecret, LABEL_EXTERNAL),
    deriveSecret(epochSecret, LABEL_MEMBERSHIP),
    deriveSecret(epochSecret, LABEL_RESUMPTION),
    deriveSecret(epochSecret, LABEL_INIT),
  ])

  return {
    epochSecret,
    applicationSecret,
    senderDataSecret,
    externalSecret,
    membershipSecret,
    resumptionPsk,
    nextInitSecret,
  }
}

// Advance from one epoch secret set to the next.
export async function advanceEpoch({
  initSecret,
  commitSecret,
  groupId,
  epoch,
  cipherSuite,
  treeHash,
  confirmedTranscriptHash,
  psks = [],
}) {
  await init()

  let joinerSecret = await deriveJoinerSecret(initSecret, commitSecret)

  // Mix in any PSKs before deriving epoch-scoped secrets.
  for (const psk of psks) {
    joinerSecret = await hkdfExtract(joinerSecret, psk)
  }

  const epochSecrets = await deriveEpochSecrets(joinerSecret, {
    groupId,
    epoch,
    cipherSuite: cipherSuite ?? 'ECHO-MLS/X25519_AES256GCM_SHA256',
    treeHash: treeHash ?? new Uint8Array(32),
    confirmedTranscriptHash: confirmedTranscriptHash ?? new Uint8Array(32),
  })

  return { joinerSecret, ...epochSecrets }
}

// Derive the welcome secret from the joiner secret.
export async function deriveWelcomeSecret(joinerSecret) {
  return deriveSecret(joinerSecret, LABEL_WELCOME)
}

// Derive the AEAD key and nonce used for GroupInfo.
export async function deriveWelcomeKeyAndNonce(welcomeSecret) {
  const [key, nonce] = await Promise.all([
    expandWithLabel(welcomeSecret, LABEL_KEY, new Uint8Array(0), NK),
    expandWithLabel(welcomeSecret, LABEL_NONCE, new Uint8Array(0), NN),
  ])
  return { key, nonce }
}

// Derive the confirmation MAC key for one epoch.
export async function deriveConfirmationKey(epochSecret) {
  return deriveSecret(epochSecret, LABEL_CONFIRM)
}

// Compute the confirmation tag for one confirmed transcript hash.
export async function computeConfirmationTag(epochSecret, confirmedTranscriptHashBytes) {
  const confirmationKey = await deriveConfirmationKey(epochSecret)
  const key = await crypto.subtle.importKey(
    'raw',
    confirmationKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const tag = await crypto.subtle.sign('HMAC', key, confirmedTranscriptHashBytes)
  return new Uint8Array(tag)
}

// Compare a claimed confirmation tag with the derived one.
export async function verifyConfirmationTag(epochSecret, confirmedTranscriptHashBytes, tagBytes) {
  const expected = await computeConfirmationTag(epochSecret, confirmedTranscriptHashBytes)
  if (expected.length !== tagBytes.length || !expected.every((b, i) => b === tagBytes[i])) {
    throw new Error('Confirmation tag mismatch — epoch secrets do not agree')
  }
}

// Encode the sender leaf and generation for app-secret derivation.
function encodeAppSecretContext(leafIndex, generation) {
  const buf = new Uint8Array(8)
  buf[0] = (leafIndex >>> 24) & 0xff
  buf[1] = (leafIndex >>> 16) & 0xff
  buf[2] = (leafIndex >>> 8) & 0xff
  buf[3] = leafIndex & 0xff
  buf[4] = (generation >>> 24) & 0xff
  buf[5] = (generation >>> 16) & 0xff
  buf[6] = (generation >>> 8) & 0xff
  buf[7] = generation & 0xff
  return buf
}

// App keys are unique per sender leaf and generation.
export async function deriveAppKeyAndNonce(applicationSecret, senderLeafIndex, generation) {
  const ctx = encodeAppSecretContext(senderLeafIndex, generation)
  const [key, nonce] = await Promise.all([
    expandWithLabel(applicationSecret, LABEL_KEY, ctx, NK),
    expandWithLabel(applicationSecret, LABEL_NONCE, ctx, NN),
  ])
  return { key, nonce }
}

// Ratchet one sender application secret forward.
export async function ratchetAppSecret(applicationSecret, senderLeafIndex, generation) {
  const ctx = encodeAppSecretContext(senderLeafIndex, generation)
  return expandWithLabel(applicationSecret, LABEL_SECRET, ctx, NH)
}

// Derive the sender-data key pair for one ciphertext prefix.
export async function deriveSenderDataKeyAndNonce(senderDataSecret, ciphertextPrefix4) {
  // Sender-data keys are tied to the first four ciphertext bytes.
  const ctx = ciphertextPrefix4.slice(0, 4)
  const [key, nonce] = await Promise.all([
    expandWithLabel(senderDataSecret, LABEL_KEY, ctx, NK),
    expandWithLabel(senderDataSecret, LABEL_NONCE, ctx, NN),
  ])
  return { key, nonce }
}
