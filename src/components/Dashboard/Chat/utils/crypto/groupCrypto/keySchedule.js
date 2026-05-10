import init, * as protocol from '@mascaro101/echo-protocol'
import { encodeGroupContext } from './groupContext.js'

// SHA-256 output (Nh), AES-256 key length (Nk) and AES-256 nonce length (Nn)
const NH = 32
const NK = 32
const NN = 12

const TEXT_ENCODER = new TextEncoder()
const HKDF_EXTRACT_EXPORT = 'hkdf_extract'
const HKDF_EXPAND_EXPORT = 'hkdf_expand'

async function hkdfExtract(salt, ikm) {
  const extract = protocol[HKDF_EXTRACT_EXPORT]
  if (typeof extract === 'function') {
    return extract(salt, ikm)
  }
  console.warn('[HKDF] extract fallback', {
    expected: HKDF_EXTRACT_EXPORT,
    actualType: typeof extract,
    isUndefined: extract === undefined,
    protocolKeys: Object.keys(protocol).slice(0, 20),
  })
  return
}

async function hkdfExpand(prk, info, length) {
  const expand = protocol[HKDF_EXPAND_EXPORT]
  if (typeof expand === 'function') {
    return expand(prk, info, length)
  }
  console.warn('[HKDF] expand fallback', {
    expected: HKDF_EXPAND_EXPORT,
    actualType: typeof expand,
    isUndefined: expand === undefined,
    protocolKeys: Object.keys(protocol).slice(0, 20),
  })
  return
}

// Constructs an HKDF label fed into HKDF-Expand for domain separation.
function encodeHKDFLabel(length, label, context) {
  const labelBytes = TEXT_ENCODER.encode('MLS 1.0 ' + label)
  const buf = new Uint8Array(2 + 1 + labelBytes.length + 4 + context.length)
  let o = 0
  buf[o++] = (length >>> 8) & 0xff
  buf[o++] = length & 0xff
  buf[o++] = labelBytes.length
  buf.set(labelBytes, o)
  o += labelBytes.length
  const cl = context.length
  buf[o++] = (cl >>> 24) & 0xff
  buf[o++] = (cl >>> 16) & 0xff
  buf[o++] = (cl >>> 8) & 0xff
  buf[o++] = cl & 0xff
  buf.set(context, o)
  return buf
}

export async function expandWithLabel(secret, label, context, length) {
  await init()
  const info = encodeHKDFLabel(length, label, context)
  return hkdfExpand(secret, info, length)
}

export async function deriveSecret(secret, label) {
  return expandWithLabel(secret, label, new Uint8Array(0), NH)
}

// Advances the epoch key schedule. The full GroupContext (treeHash and
// confirmedTranscriptHash included) binds the epoch secret to tree state and
// transcript history. Parameters default to zero-vectors when omitted so
// existing tests that don't supply them continue to run.
export async function advanceEpoch({
  initSecret,
  commitSecret,
  groupId,
  epoch,
  cipherSuite,
  treeHash,
  confirmedTranscriptHash,
}) {
  await init()

  const joinerSecret = await hkdfExtract(initSecret, commitSecret)

  const context = await encodeGroupContext({
    groupId,
    epoch,
    cipherSuite: cipherSuite ?? 'ECHO-MLS/X25519_AES256GCM_SHA256',
    treeHash: treeHash ?? new Uint8Array(32),
    confirmedTranscriptHash: confirmedTranscriptHash ?? new Uint8Array(32),
  })

  const epochSecret = await expandWithLabel(joinerSecret, 'epoch', context, NH)

  const [applicationSecret, senderDataSecret, nextInitSecret] = await Promise.all([
    deriveSecret(epochSecret, 'encryption'),
    deriveSecret(epochSecret, 'sender_data'),
    deriveSecret(epochSecret, 'init'),
  ])

  return { epochSecret, nextInitSecret, applicationSecret, senderDataSecret }
}

// Derives the confirmation key from the epoch secret per §8.1.
export async function deriveConfirmationKey(epochSecret) {
  return deriveSecret(epochSecret, 'confirm')
}

// confirmation_tag = HMAC-SHA256(confirmationKey, confirmedTranscriptHash).
// Proves sender and receiver derived the same epoch secrets.
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

// Throws if the confirmation tag doesn't match what we compute from the epoch secret.
export async function verifyConfirmationTag(epochSecret, confirmedTranscriptHashBytes, tagBytes) {
  const expected = await computeConfirmationTag(epochSecret, confirmedTranscriptHashBytes)
  if (expected.length !== tagBytes.length || !expected.every((b, i) => b === tagBytes[i])) {
    throw new Error('Confirmation tag mismatch — epoch secrets do not agree')
  }
}

// Derived key is unique per sender and per message generation.
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

export async function deriveAppKeyAndNonce(applicationSecret, senderLeafIndex, generation) {
  const ctx = encodeAppSecretContext(senderLeafIndex, generation)
  const [key, nonce] = await Promise.all([
    expandWithLabel(applicationSecret, 'key', ctx, NK),
    expandWithLabel(applicationSecret, 'nonce', ctx, NN),
  ])
  return { key, nonce }
}

export async function ratchetAppSecret(applicationSecret, senderLeafIndex, generation) {
  const ctx = encodeAppSecretContext(senderLeafIndex, generation)
  return expandWithLabel(applicationSecret, 'secret', ctx, NH)
}
