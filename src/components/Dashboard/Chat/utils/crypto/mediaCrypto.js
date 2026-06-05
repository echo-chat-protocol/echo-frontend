/**
 * Encrypted media blobs (video / large attachments).
 *
 * A file is encrypted client-side with a FRESH random 256-bit key K, chunked,
 * and each chunk sealed with the same AEAD used everywhere else in ECHO
 * (`encrypt_aad_bytes` from the wasm protocol). The resulting container is
 * uploaded to the server as opaque ciphertext; K never leaves the client
 * except inside the end-to-end-encrypted message payload (DR for DMs, MLS for
 * groups), so the server can store the blob but never read it.
 *
 * Container format — "echo-blob-v1":
 *   header (21 bytes):
 *     magic     4   "EBV1"
 *     version   1   0x01
 *     chunkSize 4   uint32 BE (plaintext bytes per chunk)
 *     totalSize 4   uint32 BE (plaintext byte length)
 *     baseNonce 8   random
 *   then, per chunk: cipherLen(4 uint32 BE) ‖ cipher
 *
 * Per chunk i:
 *   nonce = baseNonce(8) ‖ counter_i(4 BE)               → 12-byte AEAD nonce
 *   aad   = "EBV1" ‖ i(4 BE) ‖ isLast(1) ‖ totalSize(4 BE)
 *
 * The AAD binds the chunk index, the end-of-stream flag, and the total size,
 * so a tampered, reordered, or truncated blob fails to decrypt. Uniqueness of
 * K per blob prevents splicing chunks in from any other blob.
 */

import init, { encrypt_aad_bytes, decrypt_aad_bytes } from '@mascaro101/echo-protocol'
import { bytesToBase64, base64ToBytes } from '../helpers'

export const MEDIA_SCHEME = 'echo-blob-v1'
const MAGIC = new Uint8Array([0x45, 0x42, 0x56, 0x31]) // "EBV1"
const VERSION = 1
const HEADER_LEN = 21
export const DEFAULT_CHUNK_SIZE = 1024 * 1024 // 1 MiB plaintext per chunk

const u32be = (n) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n >>> 0, false)
  return b
}

function chunkAad(index, isLast, totalSize) {
  const aad = new Uint8Array(4 + 4 + 1 + 4)
  aad.set(MAGIC, 0)
  aad.set(u32be(index), 4)
  aad[8] = isLast ? 1 : 0
  aad.set(u32be(totalSize), 9)
  return aad
}

function chunkNonce(baseNonce, index) {
  const nonce = new Uint8Array(12)
  nonce.set(baseNonce, 0)
  nonce.set(u32be(index), 8)
  return nonce
}

/**
 * Encrypt raw bytes into an echo-blob-v1 container.
 * @param {Uint8Array} bytes
 * @param {{ chunkSize?: number }} [opts]
 * @returns {Promise<{ ciphertext: Uint8Array, keyB64: string, scheme: string, chunkSize: number, size: number }>}
 */
export async function encryptMediaBlob(bytes, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
  await init()
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes)
  const totalSize = bytes.length
  if (totalSize === 0) throw new Error('encryptMediaBlob: empty input')

  const key = crypto.getRandomValues(new Uint8Array(32))
  const baseNonce = crypto.getRandomValues(new Uint8Array(8))

  const header = new Uint8Array(HEADER_LEN)
  header.set(MAGIC, 0)
  header[4] = VERSION
  header.set(u32be(chunkSize), 5)
  header.set(u32be(totalSize), 9)
  header.set(baseNonce, 13)

  const chunkCount = Math.max(1, Math.ceil(totalSize / chunkSize))
  const parts = [header]
  for (let i = 0; i < chunkCount; i += 1) {
    const start = i * chunkSize
    const plain = bytes.subarray(start, Math.min(start + chunkSize, totalSize))
    const isLast = i === chunkCount - 1
    const cipher = await encrypt_aad_bytes(
      plain,
      key,
      chunkNonce(baseNonce, i),
      chunkAad(i, isLast, totalSize)
    )
    parts.push(u32be(cipher.length), cipher instanceof Uint8Array ? cipher : new Uint8Array(cipher))
  }

  const ciphertext = concatBytes(parts)
  return {
    ciphertext,
    keyB64: bytesToBase64(key),
    scheme: MEDIA_SCHEME,
    chunkSize,
    size: totalSize,
  }
}

/**
 * Decrypt an echo-blob-v1 container back into raw bytes. Throws if the key is
 * wrong or the container was tampered with / truncated / reordered.
 * @param {Uint8Array} ciphertext
 * @param {string} keyB64
 * @returns {Promise<Uint8Array>}
 */
export async function decryptMediaBlob(ciphertext, keyB64) {
  await init()
  const buf = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext)
  if (buf.length < HEADER_LEN) throw new Error('decryptMediaBlob: truncated header')
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (buf[i] !== MAGIC[i]) throw new Error('decryptMediaBlob: bad magic')
  }
  if (buf[4] !== VERSION) throw new Error(`decryptMediaBlob: unsupported version ${buf[4]}`)

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const chunkSize = dv.getUint32(5, false)
  const totalSize = dv.getUint32(9, false)
  const baseNonce = buf.subarray(13, 21)
  if (chunkSize === 0) throw new Error('decryptMediaBlob: invalid chunkSize')

  const chunkCount = Math.max(1, Math.ceil(totalSize / chunkSize))
  const key = base64ToBytes(keyB64)

  const out = new Uint8Array(totalSize)
  let outOffset = 0
  let pos = HEADER_LEN
  for (let i = 0; i < chunkCount; i += 1) {
    if (pos + 4 > buf.length) throw new Error('decryptMediaBlob: truncated chunk length')
    const cipherLen = dv.getUint32(pos, false)
    pos += 4
    if (pos + cipherLen > buf.length) throw new Error('decryptMediaBlob: truncated chunk body')
    const cipher = buf.subarray(pos, pos + cipherLen)
    pos += cipherLen
    const isLast = i === chunkCount - 1
    const plain = await decrypt_aad_bytes(
      cipher,
      key,
      chunkNonce(baseNonce, i),
      chunkAad(i, isLast, totalSize)
    )
    const plainBytes = plain instanceof Uint8Array ? plain : new Uint8Array(plain)
    out.set(plainBytes, outOffset)
    outOffset += plainBytes.length
  }

  if (outOffset !== totalSize) throw new Error('decryptMediaBlob: size mismatch (truncated blob)')
  return out
}

function concatBytes(parts) {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}
