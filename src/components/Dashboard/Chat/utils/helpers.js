const normalizeBase64 = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Expected a non-empty base64 string')
  }
  const compact = value.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  return compact.padEnd(compact.length + ((4 - (compact.length % 4)) % 4), '=')
}

const base64ToArrayBuffer = (base64String) => {
  const binaryString = atob(normalizeBase64(base64String))
  const byteArray = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i)
  }
  return byteArray
}

const hexToUint8Array = (hex) => {
  const bytes = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16))
  }
  return new Uint8Array(bytes)
}

const arrayBufferToBase64 = (buffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function bytesToBase64(u8) {
  const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function base64ToBytes(b64) {
  const normalized = normalizeBase64(b64)
  const bin = atob(normalized)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export { base64ToArrayBuffer, arrayBufferToBase64, hexToUint8Array }
