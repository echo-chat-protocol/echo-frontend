import { Buffer } from 'buffer'
import init, {
  generate_private_prekey,
  generate_public_prekey,
  convert_x25519_to_xeddsa,
  compute_determenistic_nonce,
  compute_nonce_point,
  derive_ed25519_keypair_from_x25519,
  compute_challenge_hash,
  compute_signature_scaler,
  compute_signature,
  verify_signature,
} from '@mascaro101/echo-protocol'

const SPK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function b64ToUint8Array(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function uint8ArrayToB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

export async function rotateSPKIfNeeded({ socket, eld }) {
  const keys = await eld.getIdentityKeys()
  if (!keys?.privateKeyX25519) return

  const age = Date.now() - new Date(keys.spkCreatedAt ?? 0).getTime()
  if (age < SPK_MAX_AGE_MS) return

  await init()

  const x25519PrivateKey = b64ToUint8Array(keys.privateKeyX25519)

  const randomBytes_SPK = crypto.getRandomValues(new Uint8Array(32))
  const privatePreKey = generate_private_prekey(randomBytes_SPK)
  const publicPreKey = generate_public_prekey(privatePreKey)

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
    throw new Error('SPK rotation: signature verification failed')
  }

  const spkId = crypto.randomUUID()
  const spkCreatedAt = new Date().toISOString()

  await new Promise((resolve, reject) => {
    socket.emit(
      'rotateSPK',
      {
        signedPreKey: Buffer.from(publicPreKey).toString('base64'),
        signature: Buffer.from(signature).toString('base64'),
        spkId,
      },
      (response) => {
        if (response?.success) resolve()
        else reject(new Error(response?.error ?? 'SPK rotation failed'))
      }
    )
  })

  await eld.storeIdentityKeys({
    ...keys,
    privatePreKey: uint8ArrayToB64(privatePreKey),
    spkId,
    spkCreatedAt,
  })
}
