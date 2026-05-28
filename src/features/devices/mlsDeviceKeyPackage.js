import { generateKeyPackage } from '@/components/Dashboard/Chat/utils/crypto/groupCrypto/keyPackage'

const DEFAULT_MLS_CIPHER_SUITE = 'Echo-MLS-TreeKEM/X25519_AES256GCM_SHA256'
const STORAGE_PREFIX = 'echo-device-mls-key-package-v1'

function readLocalStorageItem(key) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function storageKey(userId, clientId) {
  return `${STORAGE_PREFIX}:${String(userId ?? '')}:${String(clientId ?? 'default')}`
}

function readRecord(userId, clientId) {
  try {
    const raw = readLocalStorageItem(storageKey(userId, clientId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeRecord(userId, clientId, record) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(storageKey(userId, clientId), JSON.stringify(record))
}

function isUsableRecord(record, { userId, clientId, initKeyB64 }) {
  if (!record?.keyPackage || !record?.leafSigningPrivKeyB64) return false
  if (String(record.userId ?? '') !== String(userId ?? '')) return false
  if (String(record.clientId ?? 'default') !== String(clientId ?? 'default')) return false
  if (initKeyB64 && record.keyPackage.initKeyB64 !== initKeyB64) return false
  if (record.keyPackage.userId && String(record.keyPackage.userId) !== String(userId ?? '')) {
    return false
  }
  if (typeof record.keyPackage.expiresAt === 'number' && Date.now() > record.keyPackage.expiresAt) {
    return false
  }
  return true
}

export async function getOrCreateDeviceMlsKeyPackage({
  userId,
  clientId = readLocalStorageItem('echo-device-id'),
  initKeyB64,
  cipherSuite = DEFAULT_MLS_CIPHER_SUITE,
}) {
  if (!userId || !initKeyB64) {
    throw new Error('Missing userId or initKeyB64 for device MLS KeyPackage')
  }

  const existing = readRecord(userId, clientId)
  if (isUsableRecord(existing, { userId, clientId, initKeyB64 })) return existing

  const { keyPackage, leafSigningPrivKeyB64 } = await generateKeyPackage({
    userId,
    initKeyB64,
    cipherSuite,
  })

  const record = {
    userId: String(userId),
    clientId: clientId ?? null,
    initKeyB64,
    keyPackage,
    leafSigningPrivKeyB64,
    createdAt: Date.now(),
  }
  writeRecord(userId, clientId, record)
  return record
}

export function getStoredDeviceMlsKeyPackage({
  userId,
  clientId = readLocalStorageItem('echo-device-id'),
  initKeyB64 = readLocalStorageItem('echo-device-mls-pub'),
} = {}) {
  if (!userId) return null
  const existing = readRecord(userId, clientId)
  return isUsableRecord(existing, { userId, clientId, initKeyB64 }) ? existing : null
}

/** Bundle init + KeyPackage args for processWelcome call sites. */
export function resolveProcessWelcomeOptions({ userId, myInitPrivKeyB64 }) {
  if (!userId || !myInitPrivKeyB64) {
    return { myInitPrivKeyB64 }
  }
  const stored = getStoredDeviceMlsKeyPackage({ userId })
  if (!stored?.keyPackage || !stored?.leafSigningPrivKeyB64) {
    return { myInitPrivKeyB64 }
  }
  return {
    myInitPrivKeyB64,
    myKeyPackage: stored.keyPackage,
    myLeafSigningPrivKeyB64: stored.leafSigningPrivKeyB64,
  }
}
