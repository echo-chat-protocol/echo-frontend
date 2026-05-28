/**
 * Modules are lazily initialized on first use WASM is loaded only when needed.
 * Never import WASM modules directly in components; always go through this file.
 */

let _aes = null
let _dh = null
let _xeddsa = null

async function getAes() {
  if (!_aes) {
    const mod = await import('aes-wasm')
    await mod.default()
    _aes = mod
  }
  return _aes
}

async function getDh() {
  if (!_dh) {
    const mod = await import('dh-wasm')
    await mod.default()
    _dh = mod
  }
  return _dh
}

async function getXeddsa() {
  if (!_xeddsa) {
    const mod = await import('xeddsa-wasm')
    await mod.default()
    _xeddsa = mod
  }
  return _xeddsa
}

// AES-256-GCM

/**
 * Encrypts plaintext using AES-256-GCM via WASM.
 * @param {string} text - Plaintext to encrypt
 * @param {Uint8Array} key - 32-byte key
 * @param {Uint8Array} nonce - 12-byte nonce
 * @returns {Promise<string>} Base64-encoded ciphertext
 */
export async function aesEncrypt(text, key, nonce) {
  const aes = await getAes()
  return aes.encrypt(text, key, nonce)
}

/**
 * Decrypts ciphertext using AES-256-GCM via WASM.
 * @param {string} ciphertext - Base64-encoded ciphertext
 * @param {Uint8Array} key - 32-byte key
 * @param {Uint8Array} nonce - 12-byte nonce
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function aesDecrypt(ciphertext, key, nonce) {
  const aes = await getAes()
  return aes.decrypt(ciphertext, key, nonce)
}

// Diffie-Hellman / HKDF

/**
 * Generates a private ephemeral Curve25519 key.
 * @returns {Promise<Uint8Array>} 32-byte private key
 */
export async function generateEphemeralKey() {
  const dh = await getDh()
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  return dh.generate_private_ephemeral_key(randomBytes)
}

/**
 * Derives key material using HKDF.
 * @param {Uint8Array} ikm - Input key material
 * @param {Uint8Array} salt
 * @param {Uint8Array} info
 * @param {number} outputLen - Output length in bytes
 * @returns {Promise<Uint8Array>}
 */
export async function hkdfDerive(ikm, salt, info, outputLen) {
  const dh = await getDh()
  return dh.hkdf_derive(ikm, salt, info, outputLen)
}

// XEdDSA Signatures

/**
 * Computes an XEdDSA signature.
 * @param {Uint8Array} noncePoint
 * @param {Uint8Array} signatureScalar
 * @returns {Promise<Uint8Array>} 64-byte signature
 */
export async function computeSignature(noncePoint, signatureScalar) {
  const xeddsa = await getXeddsa()
  return xeddsa.compute_signature(noncePoint, signatureScalar)
}

/**
 * Verifies an XEdDSA signature.
 * @param {Uint8Array} signature
 * @param {Uint8Array} message
 * @param {Uint8Array} publicEdKey
 * @returns {Promise<boolean>}
 */
export async function verifySignature(signature, message, publicEdKey) {
  const xeddsa = await getXeddsa()
  return xeddsa.verify_signature(signature, message, publicEdKey)
}
