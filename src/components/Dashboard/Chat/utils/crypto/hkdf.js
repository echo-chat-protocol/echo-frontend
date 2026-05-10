import { hkdf_derive } from '@mascaro101/echo-protocol'

const CHAIN_SALT = new Uint8Array()
const CHAIN_INFO = new TextEncoder().encode('EchoProtocol/v1/KDF_CK')

export const deriveChainKeys = (rootKey, userId, targetUserid) => {
  const INFO_CHAIN_INIT = new TextEncoder().encode(`EchoProtocol/v1/CHAIN_INIT`)
  const okm = hkdf_derive(rootKey, new Uint8Array(), INFO_CHAIN_INIT, 64)
  const ck0 = okm.slice(0, 32)
  const ck1 = okm.slice(32)

  const iAmLowerId = String(userId) < String(targetUserid)

  const sendingChainKey = iAmLowerId ? ck0 : ck1
  const receivingChainKey = iAmLowerId ? ck1 : ck0

  return { sendingChainKey, receivingChainKey }
}

export const chain_key_KDF = (chainKey) => {
  return hkdf_derive(chainKey, CHAIN_SALT, CHAIN_INFO, 76)
}
