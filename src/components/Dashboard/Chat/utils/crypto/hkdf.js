import { hkdf_derive } from '@mascaro101/echo-protocol'

const CHAIN_SALT = new Uint8Array()
const CHAIN_INFO = new TextEncoder().encode('EchoProtocol/v1/KDF_CK')

const getLocalDeviceId = () => {
  try {
    const token = globalThis.localStorage?.getItem?.('token')
    const payload = token?.split?.('.')?.[1]
    if (payload) {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
      const decoded = JSON.parse(globalThis.atob(padded))
      if (decoded?.deviceUserId) return decoded.deviceUserId
    }
    return globalThis.localStorage?.getItem?.('echo-device-id') || null
  } catch {
    return null
  }
}

const chainParticipantId = (userId, targetUserId, options = {}) => {
  const target = String(targetUserId)
  const ownDeviceId = options.ownDeviceId || getLocalDeviceId()

  if (target.includes('@') && ownDeviceId) {
    return `${userId}@${ownDeviceId}`
  }

  return String(userId)
}

export const deriveChainKeys = (rootKey, userId, targetUserid, options = {}) => {
  const INFO_CHAIN_INIT = new TextEncoder().encode(`EchoProtocol/v1/CHAIN_INIT`)
  const okm = hkdf_derive(rootKey, new Uint8Array(), INFO_CHAIN_INIT, 64)
  const ck0 = okm.slice(0, 32)
  const ck1 = okm.slice(32)

  const localParticipant = chainParticipantId(userId, targetUserid, options)
  const remoteParticipant = String(targetUserid)
  const iAmLowerId = localParticipant < remoteParticipant

  const sendingChainKey = iAmLowerId ? ck0 : ck1
  const receivingChainKey = iAmLowerId ? ck1 : ck0

  return { sendingChainKey, receivingChainKey }
}

export const chain_key_KDF = (chainKey) => {
  return hkdf_derive(chainKey, CHAIN_SALT, CHAIN_INFO, 76)
}
