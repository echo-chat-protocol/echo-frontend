import init, { encrypt as wasmEncrypt, decrypt as wasmDecrypt, encrypt_aad_bytes, decrypt_aad_bytes } from '@mascaro101/echo-protocol';
import { base64ToBytes, bytesToBase64 } from '../helpers';
const normalizeAesKey = (key) => {
  if (key instanceof Uint8Array) return key;
  if (key instanceof ArrayBuffer) return new Uint8Array(key);
  if (Array.isArray(key)) return new Uint8Array(key);
  if (key && typeof key === 'object' && ArrayBuffer.isView(key)) {
    return new Uint8Array(key.buffer, key.byteOffset, key.byteLength);
  }
  throw new Error(`Invalid key type for AES: ${Object.prototype.toString.call(key)}`);
};

const encrypt = async (text, derivedKey, nonceArray) => {
  await init();

  try {
    const key = normalizeAesKey(derivedKey);
    if (key.length !== 32) {
      throw new Error(`Invalid key length: ${key.length} (expected 32)`);
    }
    const encryptedText = await wasmEncrypt(text, key, nonceArray);
    return encryptedText;
  } catch (error) {
    console.error('Encryption error:', error)
    throw error
  }
}

const decrypt = async (text, derivedKey, nonceArray) => {
  await init();
  if (!derivedKey) {
    console.error('Derived key is missing')
  }
  try {
    const key = normalizeAesKey(derivedKey);
    if (key.length !== 32) {
      throw new Error(`Invalid key length: ${key.length} (expected 32)`);
    }
    return wasmDecrypt(text, key, nonceArray);
  } catch (error) {
    console.error('Decryption error:', error)
    throw error
  }
}

export const buildAadBytes = (message) => {
  const userId = String(message.userId ?? "");
  const targetUserId = String(message.targetUserId ?? "")
  const dh = String(message.publicEphemeralKey ?? "");
  const n = String(message.sendingNumber ?? 0);
  const pn = String(message.previousSendingNumber ?? 0);

  const spkId = message.spkId;
  const opkId = message.opkId;

  const useV2 = spkId != null || opkId != null;
  const aadStr = useV2
    ? `Echo/v2|${userId}|${targetUserId}|${dh}|${n}|${pn}|${String(spkId ?? "")}|${String(opkId ?? "")}`
    : `Echo/v1|${userId}|${targetUserId}|${dh}|${n}|${pn}`;
  return new TextEncoder().encode(aadStr);
}

export const encryptWithAad = async (text, in_key, nonce, aadBytes) => {
  await init();

  try {
    const key = normalizeAesKey(in_key);
    if (key.length !== 32) {
      throw new Error(`Invalid key length: ${key.length} (expected 32)`);
    }

    const textBytes = new TextEncoder().encode(text);
    const encryptedText_bytes = await encrypt_aad_bytes(textBytes, key, nonce, aadBytes);
    const encryptedText = bytesToBase64(encryptedText_bytes);

    return encryptedText;
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

export const decryptWithAad = async (ciphertext, in_key, nonce, aadBytes) => {
  await init();
  if (!in_key) {
    console.error('Derived key is missing');
  }
  try {
    const key = normalizeAesKey(in_key);
    if (key.length !== 32) {
      throw new Error(`Invalid key length: ${key.length} (expected 32)`);
    }
    const ciphertextBytes = base64ToBytes(ciphertext);
    const decryptedBytes = await decrypt_aad_bytes(ciphertextBytes, key, nonce, aadBytes);
    const decryptedText = new TextDecoder().decode(decryptedBytes);
    return decryptedText;

  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

export { encrypt, decrypt };
