/**
 * After a device is provisioned via sync or pairing, it needs to register its
 * own public key bundle so the primary device can encrypt forwarded messages
 * for it using X3DH.  The device's identity key (IK) is shared with the
 * primary via the history package; the SPK and OTKs are freshly generated
 * and unique to this device installation.
 */

import init, {
  generate_private_ephemeral_key,
  generate_public_ephemeral_key,
} from '@mascaro101/echo-protocol'
import { getOrCreateDeviceIK, encodeKeyBase64 } from './qrCrypto'
import { deviceService } from './deviceService'
import { getDeviceMetadata } from './deviceMetadata'

const OTK_COUNT = 20
const LS_DEVICE_SPK_KEY = 'echo-device-spk'
const LS_DEVICE_OTKS_KEY = 'echo-device-otks'

let wasmReady = false
async function ensureWasm() {
  if (!wasmReady) {
    await init()
    wasmReady = true
  }
}

async function generateX25519KeyPair() {
  const rand = crypto.getRandomValues(new Uint8Array(32))
  const priv = await generate_private_ephemeral_key(rand)
  const pub = await generate_public_ephemeral_key(priv)
  return { priv, pub }
}

/**
 * Generate a fresh SPK and OTKs for this device installation, upload them
 * alongside the device's existing IK, and persist the private halves locally
 * so we can perform X3DH decryption for incoming device-forwarded messages.
 *
 * @param {string} deviceId - The deviceId assigned to this installation.
 * @returns {Promise<object>} The uploaded key bundle (public halves only).
 */
export async function generateAndUploadDeviceKeyBundle(deviceId) {
  if (!deviceId) throw new Error('deviceId is required')
  await ensureWasm()

  const ik = await getOrCreateDeviceIK()
  const ikPubB64 = encodeKeyBase64(ik.pub)

  const spk = await generateX25519KeyPair()
  const spkPubB64 = encodeKeyBase64(spk.pub)

  const otks = []
  const otkPrivates = []
  for (let i = 0; i < OTK_COUNT; i++) {
    const kp = await generateX25519KeyPair()
    const opkId = `dev-otk-${Date.now()}-${i}`
    otks.push({ opkId, opkPub: encodeKeyBase64(kp.pub) })
    otkPrivates.push({ opkId, priv: encodeKeyBase64(kp.priv) })
  }

  const keyBundle = {
    ...getDeviceMetadata(),
    publicIdentityKeyX25519: ikPubB64,
    publicIdentityKeyEd25519: ikPubB64,
    signedPreKey: spkPubB64,
    signedPreKeySignature: ikPubB64,
    signedPreKeyId: 0,
    oneTimePreKeys: otks,
  }

  localStorage.setItem(
    LS_DEVICE_SPK_KEY,
    JSON.stringify({ priv: encodeKeyBase64(spk.priv), pub: spkPubB64 })
  )
  localStorage.setItem(LS_DEVICE_OTKS_KEY, JSON.stringify(otkPrivates))

  await deviceService.registerDeviceKeys(deviceId, keyBundle)

  return keyBundle
}
