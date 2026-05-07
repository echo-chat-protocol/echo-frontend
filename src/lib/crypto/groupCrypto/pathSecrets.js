import { base64ToBytes, bytesToBase64 } from '../../helpers.js';

// Protocol Imports
import init, {
  decrypt_aad_bytes,
  diffie_hellman,
  encrypt_aad_bytes,
  generate_private_ephemeral_key,
  generate_public_ephemeral_key,
  hkdf_derive,
} from '@mascaro101/echo-protocol';

// Constants for HKDF expand labels, these are used to derive different keys from the same secret
export const MLS_HEADER_VERSION = 1;
// Helper functions for converting js strings to UTF-8 bytes, crypto use bytes not strings
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });
// HKDF info domain-seperation label for wrapping welcome messages
const WRAP_INFO = TEXT_ENCODER.encode('EchoMLS/v1/WelcomeWrap');
// HKDF info domain-seperation label for wrapping path secrets in the update path
const PATH_SECRET_WRAP_INFO = TEXT_ENCODER.encode('EchoMLS/v1/PathSecretWrap');

// Crypto functions require consistant byte format -- Uint8Array
export function normalizeBytes(value, fieldName) {
  // If Uint8Array return as is
  if (value instanceof Uint8Array) return value;
  // If ArrayBuffer wrap in Uint8Array
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  // If plainJs byte array wrap in Uint8Array
  if (Array.isArray(value)) return new Uint8Array(value);
  // Any other typed array create Uint8Array view using same buffer, offset and length
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  // error out if not a recognized byte format
  throw new Error(`Invalid ${fieldName}; expected byte array input`);
}

// Utility function to generate secure random bytes, used for generating secrets and nonces
export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

// turn the header object into raw bytes to feed into crypto functions
export function makeHeaderBytes(header) {
  return TEXT_ENCODER.encode(JSON.stringify(header));
}

// turn the header object into base64 string to feed into MLS message fields
export function makeHeaderB64(header) {
  return bytesToBase64(makeHeaderBytes(header));
}

// Turn incoming header bytes into an object, this is used when parsing incoming messages
export function parseHeader(header) {
  if (typeof header === 'string') {
    return JSON.parse(TEXT_DECODER.decode(base64ToBytes(header)));
  }
  if (header && typeof header === 'object') return header;
  throw new Error('Missing MLS header');
}

// This encodes the label, context and length into a byte array to be fed into HKDF
// if already bytes return the normalized bytes
export function normalizePlaintextBytes(plaintextBytes) {
  if (typeof plaintextBytes === 'string') {
    return TEXT_ENCODER.encode(plaintextBytes);
  }
  return normalizeBytes(plaintextBytes, 'plaintextBytes');
}

// Creates the AAD bytes for commit-related encryption
export function makeCommitAadBytes(groupId, epoch) {
  return TEXT_ENCODER.encode(`EchoMLS/v1/Commit|${groupId}|${epoch}`);
}

// Creates the AAD bytes for path secret encryption
export function makePathSecretAadBytes(nodeIndex) {
  return TEXT_ENCODER.encode(`EchoMLS/v1/PathSecret|nodeIndex:${nodeIndex}`);
}

// encrypts a group secret so only one recipient can decrypt it
export async function wrapGroupKey(groupKeyB64, recipientInitKeyB64, aadBytes) {

  // initialize crypto, this will load the WASM module
  await init();

  // Decode inputs from base64 to bytes
  const groupKeyBytes = base64ToBytes(groupKeyB64);
  const recipientPub = base64ToBytes(recipientInitKeyB64);

  // Generate an ephemeral key pair for this encryption
  const ephPriv = generate_private_ephemeral_key(randomBytes(32));
  const ephPub = generate_public_ephemeral_key(ephPriv);

  // Derive a shared secret using Diffie-Hellman between the ephemeral sk and the peers pk
  const sharedSecret = diffie_hellman(ephPriv, recipientPub);
  const wrapKey = hkdf_derive(sharedSecret, new Uint8Array(0), WRAP_INFO, 32);
  const nonce = randomBytes(12);
  const encryptedBytes = encrypt_aad_bytes(groupKeyBytes, wrapKey, nonce, aadBytes);

  // Return the encrypted bytes, the eph pk and the nonce
  return {
    encryptedB64: bytesToBase64(encryptedBytes),
    ephPubB64: bytesToBase64(ephPub),
    nonceB64: bytesToBase64(nonce),
  };
}

// decrypts a group secret that was encrypted for this recipient
export async function unwrapGroupKey({ encryptedB64, ephPubB64, nonceB64 }, myInitPrivKeyB64, aadBytes) {
  // initialize crypto, this will load the WASM module
  await init();

   // Decode inputs from base64 to bytes
  const encryptedBytes = base64ToBytes(encryptedB64);
  const ephPub = base64ToBytes(ephPubB64);
  const nonce = base64ToBytes(nonceB64);
  const myPriv = base64ToBytes(myInitPrivKeyB64);

  // derive shared secret using Diffe-Hellman and the ephemeral pk and own init sk
  const sharedSecret = diffie_hellman(myPriv, ephPub);
  const wrapKey = hkdf_derive(sharedSecret, new Uint8Array(0), WRAP_INFO, 32);

  // decrypt the group key using the derived shared secret
  const groupKeyBytes = decrypt_aad_bytes(encryptedBytes, wrapKey, nonce, aadBytes);
  return bytesToBase64(groupKeyBytes);
}

// encrypts a path secret for a recipient public key, used in the update path
export async function wrapPathSecret(pathSecretBytes, recipientPubB64, aadBytes) {

  // initialize crypto, this will load the WASM module
  await init();

  // Decode recipient public key from base64 to bytes
  const recipientPub = base64ToBytes(recipientPubB64);

  // Generate an ephemeral key pair for this encryption
  const ephPriv = generate_private_ephemeral_key(randomBytes(32));
  const ephPub = generate_public_ephemeral_key(ephPriv);

  // Derive shared secret using Diffie-Hellman between the ephemeral sk and the peers pk
  const sharedSecret = diffie_hellman(ephPriv, recipientPub);
  const wrapKey = hkdf_derive(sharedSecret, new Uint8Array(0), PATH_SECRET_WRAP_INFO, 32);
  const nonce = randomBytes(12);

  // encrypt the path secret using the derived shared secret, the nonce and the provided AAD
  const encryptedBytes = encrypt_aad_bytes(pathSecretBytes, wrapKey, nonce, aadBytes);

  return {
    encryptedB64: bytesToBase64(encryptedBytes),
    ephPubB64: bytesToBase64(ephPub),
    nonceB64: bytesToBase64(nonce),
  };
}

// decrypts a path secret that was encrypted for this recipient, used in the update path
export async function unwrapPathSecret({ encryptedB64, ephPubB64, nonceB64 }, myPrivKeyB64, aadBytes) {
  // initialize crypto, this will load the WASM module
  await init();

  // Decode inputs from base64 to bytes
  const encryptedBytes = base64ToBytes(encryptedB64);
  const ephPub = base64ToBytes(ephPubB64);
  const nonce = base64ToBytes(nonceB64);
  const myPriv = base64ToBytes(myPrivKeyB64);

  // derive shared secret using Diffe-Hellman and the ephemeral pk and own init sk
  const sharedSecret = diffie_hellman(myPriv, ephPub);
  const wrapKey = hkdf_derive(sharedSecret, new Uint8Array(0), PATH_SECRET_WRAP_INFO, 32);

  // decrypt the path secret using the derived shared secret, the nonce and the provided AAD
  return decrypt_aad_bytes(encryptedBytes, wrapKey, nonce, aadBytes);
}
