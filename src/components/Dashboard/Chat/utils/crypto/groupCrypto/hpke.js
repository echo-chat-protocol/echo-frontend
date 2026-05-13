import init, * as protocol from '@mascaro101/echo-protocol'

const KEM_SUITE_ID = new Uint8Array([0x4b, 0x45, 0x4d, 0x00, 0x20])
const HPKE_SUITE_ID = new Uint8Array([0x48, 0x50, 0x4b, 0x45, 0x00, 0x20, 0x00, 0x01, 0x00, 0x02])

const NK = 32
const NN = 12
const NSECRET = 32

const TEXT_ENCODER = new TextEncoder()

// Concatenate small byte arrays without extra allocations from callers.
function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

// Encode one integer as big-endian bytes.
function i2osp(n, len) {
  const buf = new Uint8Array(len)
  for (let i = len - 1; i >= 0; i--) {
    buf[i] = n & 0xff
    n >>>= 8
  }
  return buf
}

// Generate random bytes for an ephemeral private key seed.
function randomBytes(len) {
  const b = new Uint8Array(len)
  globalThis.crypto.getRandomValues(b)
  return b
}

// Run HPKE labeled extract for one input.
function labeledExtract(salt, label, ikm, suiteId) {
  // HPKE treats an empty salt as an all-zero hash-length buffer.
  const effectiveSalt = salt instanceof Uint8Array && salt.length === 0 ? new Uint8Array(32) : salt
  const labeledIkm = concat(
    TEXT_ENCODER.encode('HPKE-v1'),
    suiteId,
    TEXT_ENCODER.encode(label),
    ikm
  )
  return protocol.hkdf_extract(effectiveSalt, labeledIkm)
}

// Run HPKE labeled expand for one input.
function labeledExpand(prk, label, info, length, suiteId) {
  const labeledInfo = concat(
    i2osp(length, 2),
    TEXT_ENCODER.encode('HPKE-v1'),
    suiteId,
    TEXT_ENCODER.encode(label),
    info
  )
  return protocol.hkdf_expand(prk, labeledInfo, length)
}

// Turn a DH shared secret into the HPKE shared secret.
function extractAndExpand(dh, kemContext) {
  const prk = labeledExtract(new Uint8Array(0), 'shared_secret', dh, KEM_SUITE_ID)
  return labeledExpand(prk, 'key', kemContext, NSECRET, KEM_SUITE_ID)
}

// Generate an ephemeral keypair and derive the sender-side shared secret.
function encap(pkR) {
  const skE = protocol.generate_private_ephemeral_key(randomBytes(32))
  const pkE = protocol.generate_public_ephemeral_key(skE)
  const dh = protocol.diffie_hellman(skE, pkR)
  const kemContext = concat(pkE, pkR)
  const sharedSecret = extractAndExpand(dh, kemContext)
  return { sharedSecret, enc: pkE }
}

// Rebuild the same shared secret from the recipient side.
function decap(enc, skR) {
  const pkR = protocol.generate_public_ephemeral_key(skR)
  const dh = protocol.diffie_hellman(skR, enc)
  const kemContext = concat(enc, pkR)
  return extractAndExpand(dh, kemContext)
}

// Derive the AEAD key and nonce for one HPKE context.
function keySchedule(sharedSecret, info) {
  const empty = new Uint8Array(0)
  const pskIdHash = labeledExtract(empty, 'psk_id_hash', empty, HPKE_SUITE_ID)
  const infoHash = labeledExtract(empty, 'info_hash', info, HPKE_SUITE_ID)
  const ksContext = concat(new Uint8Array([0x00]), pskIdHash, infoHash)
  const secret = labeledExtract(sharedSecret, 'secret', empty, HPKE_SUITE_ID)
  const key = labeledExpand(secret, 'key', ksContext, NK, HPKE_SUITE_ID)
  const nonce = labeledExpand(secret, 'base_nonce', ksContext, NN, HPKE_SUITE_ID)
  return { key, nonce }
}

// Seal returns the ephemeral public key plus the ciphertext body.
export async function hpkeSeal(pkR, info, aad, plaintext) {
  await init()
  const { sharedSecret, enc } = encap(pkR)
  const { key, nonce } = keySchedule(sharedSecret, info)
  const ct = protocol.encrypt_aad_bytes(plaintext, key, nonce, aad)
  return { enc, ct }
}

// Open one HPKE ciphertext with the recipient private key.
export async function hpkeOpen(enc, skR, info, aad, ct) {
  await init()
  const sharedSecret = decap(enc, skR)
  const { key, nonce } = keySchedule(sharedSecret, info)
  return protocol.decrypt_aad_bytes(ct, key, nonce, aad)
}
