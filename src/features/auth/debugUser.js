import { Buffer } from 'buffer'
import eld from '@/utils/storage/EncryptedLocalDatabase'
import { getDeviceMetadata } from '@/features/devices/deviceMetadata'
import { connectWithoutAuth } from '@/socket'
import { generateOneTimePreKeys } from '@/components/Dashboard/Chat/utils/crypto/opk'
import init, {
  generate_ed25519_private_key,
  generate_public_prekey,
  generate_private_prekey,
  derive_x25519_from_ed25519_private,
  convert_x25519_to_xeddsa,
  compute_determenistic_nonce,
  compute_nonce_point,
  derive_ed25519_keypair_from_x25519,
  compute_challenge_hash,
  compute_signature_scaler,
  compute_signature,
  verify_signature,
} from '@mascaro101/echo-protocol'

export const DEBUG_USER_PASSWORD = 'Pass123%'

const arrayBufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))

function createDebugUsername() {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `debug_${suffix}`
}

function emitRegister(socket, payload) {
  return new Promise((resolve, reject) => {
    const onConnectError = (err) => {
      socket.off('connect_error', onConnectError)
      reject(err)
    }

    socket.once('connect_error', onConnectError)
    socket.emit('register', payload, (response) => {
      socket.off('connect_error', onConnectError)
      resolve(response)
    })
  })
}

export async function createDebugUserAccount() {
  const username = createDebugUsername()
  const password = DEBUG_USER_PASSWORD

  await init()

  const randomBytesIK = crypto.getRandomValues(new Uint8Array(32))
  const randomBytesSPK = crypto.getRandomValues(new Uint8Array(32))

  const privateKey = generate_ed25519_private_key(randomBytesIK)
  const privatePreKey = generate_private_prekey(randomBytesSPK)
  const publicPreKey = generate_public_prekey(privatePreKey)

  const x25519KeyPair = derive_x25519_from_ed25519_private(privateKey)
  const { x25519_private_key: x25519PrivateKey, x25519_public_key: x25519PublicKey } = x25519KeyPair

  const xeddsaKey = convert_x25519_to_xeddsa(x25519PrivateKey)
  const edPrivScaler = xeddsaKey.slice(0, 32)
  const prefix = xeddsaKey.slice(32, 64)
  const deterministicNonce = compute_determenistic_nonce(prefix, publicPreKey)
  const noncePoint = compute_nonce_point(deterministicNonce)
  const publicEdKey = derive_ed25519_keypair_from_x25519(x25519PrivateKey)
  const challengeHash = compute_challenge_hash(noncePoint, publicEdKey, publicPreKey)
  const signatureScaler = compute_signature_scaler(deterministicNonce, challengeHash, edPrivScaler)
  const signature = compute_signature(noncePoint, signatureScaler)

  if (!verify_signature(signature, publicPreKey, publicEdKey)) {
    throw new Error('Failed to verify the generated signed pre-key')
  }

  const { privateKeys: opkPrivateKeys, publicBundle: opkPublicBundle } =
    await generateOneTimePreKeys(100)

  const publicKeyStringX25519 = Buffer.from(x25519PublicKey).toString('base64')
  const publicKeyStringED25519 = Buffer.from(publicEdKey).toString('base64')
  const publicPreKeyString = Buffer.from(publicPreKey).toString('base64')
  const signatureString = Buffer.from(signature).toString('base64')
  const privatePreKeyBase64 = arrayBufferToBase64(privatePreKey)
  const ed25519PrivateKeyBase64 = arrayBufferToBase64(privateKey)
  const x25519PrivateKeyBase64 = arrayBufferToBase64(x25519PrivateKey)
  const x25519PublicKeyBase64 = arrayBufferToBase64(x25519PublicKey)

  const keyBundle = {
    publicIdentityKeyX25519: publicKeyStringX25519,
    publicIdentityKeyEd25519: publicKeyStringED25519,
    publicSignedPreKey: [publicPreKeyString, signatureString],
    oneTimePreKeys: opkPublicBundle,
  }

  const socket = connectWithoutAuth()
  const deviceMetadata = getDeviceMetadata()
  const response = await emitRegister(socket, {
    username,
    password,
    keyBundle,
    aboutme: '',
    profilePicture: '',
    ...deviceMetadata,
  })

  if (!response?.success) {
    throw new Error(response?.error || 'Registration failed on server')
  }

  try {
    if (response.deviceId) localStorage.setItem('echo-device-id', response.deviceId)

    localStorage.setItem(
      'echo_device_ik',
      JSON.stringify({
        priv: x25519PrivateKeyBase64,
        pub: x25519PublicKeyBase64,
      })
    )

    await eld.createUser(response.userId, password)
    await eld.storeIdentityKeys({
      privateKeyEd25519: ed25519PrivateKeyBase64,
      privateKeyX25519: x25519PrivateKeyBase64,
      publicKeyX25519: x25519PublicKeyBase64,
      publicKeyEd25519: publicKeyStringED25519,
      privatePreKey: privatePreKeyBase64,
    })
    await eld.storeOPKs(opkPrivateKeys)
  } catch (err) {
    if (response.userId) await eld.resetUser(response.userId).catch(() => {})
    throw err
  } finally {
    eld.lock()
  }

  return {
    username,
    password,
    userId: response.userId,
    deviceId: response.deviceId || deviceMetadata.deviceId,
  }
}
