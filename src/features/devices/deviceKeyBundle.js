/**
 * After a device is provisioned via pairing, it generates and publishes its
 * OWN per-device key bundle (IK, SPK, OPKs) — none of which is inherited from
 * the primary device. Peers fan-out to this device using the bundle published
 * here; the parent-signed deviceAuthorizationSignature (computed elsewhere)
 * anchors the new device's IK to the account.
 *
 * As a side effect we also write the device's identity material into ELD so
 * the rest of the app (which reads identity via eld.getIdentityKeys) finds
 * this device's own keys — never the primary's.
 */

import init, {
  generate_private_ephemeral_key,
  generate_public_ephemeral_key,
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
import eld from '@/utils/storage/EncryptedLocalDatabase'
import { getOrCreateDeviceIK, encodeKeyBase64 } from './qrCrypto'
import { deviceService } from './deviceService'
import { getDeviceMetadata } from './deviceMetadata'

const OTK_COUNT = 20
const LS_DEVICE_SPK_KEY = 'echo-device-spk'
const LS_DEVICE_OTKS_KEY = 'echo-device-otks'
const LS_DEVICE_AUTH_SIG_KEY = 'echo-device-auth-sig'

function b64dec(str) {
  if (typeof str !== 'string' || !str) return null
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

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

// XEdDSA-sign a 32-byte message under an X25519 identity private key.
function xeddsaSign(messageBytes, x25519Priv) {
  const xeddsaKey = convert_x25519_to_xeddsa(x25519Priv)
  const edPrivScaler = xeddsaKey.slice(0, 32)
  const prefix = xeddsaKey.slice(32, 64)
  const nonce = compute_determenistic_nonce(prefix, messageBytes)
  const noncePoint = compute_nonce_point(nonce)
  const publicEdKey = derive_ed25519_keypair_from_x25519(x25519Priv)
  const challengeHash = compute_challenge_hash(noncePoint, publicEdKey, messageBytes)
  const signatureScaler = compute_signature_scaler(nonce, challengeHash, edPrivScaler)
  const signature = compute_signature(noncePoint, signatureScaler)
  if (!verify_signature(signature, messageBytes, publicEdKey)) {
    throw new Error('XEdDSA self-verification failed')
  }
  return { signature, publicEdKey }
}

export async function generateAndUploadDeviceKeyBundle(deviceId) {
  if (!deviceId) throw new Error('deviceId is required')
  await ensureWasm()

  // ELD must be unlocked: the SPK private generated here must be persisted in
  // ELD in lockstep with the matching SPK pub published to the server.
  // Skipping the ELD write would leave Device.signedPreKey with no matching
  // private on this device — sender X3DH would succeed, receiver X3DH would
  // derive a different root_key, AES decryption would fail.
  if (!eld.isUnlocked?.()) {
    throw new Error('ELD must be unlocked before publishing a device key bundle')
  }

  const ik = await getOrCreateDeviceIK()
  const ikPubX25519B64 = encodeKeyBase64(ik.pub)

  // Generate this device's SPK and sign it under the device IK using XEdDSA.
  const spkRandom = crypto.getRandomValues(new Uint8Array(32))
  const spkPriv = generate_private_prekey(spkRandom)
  const spkPub = generate_public_prekey(spkPriv)
  const spkPubB64 = encodeKeyBase64(spkPub)

  const { signature: spkSignature, publicEdKey } = xeddsaSign(spkPub, ik.priv)
  const ikPubEd25519B64 = encodeKeyBase64(publicEdKey)
  const spkSignatureB64 = encodeKeyBase64(spkSignature)

  // OPK bundle (X25519). Private halves stay on this device — both in
  // localStorage (for device-forward decode paths) and in ELD (for the
  // unified per-device X3DH receive lookup).
  const otksPublic = []
  const otksForEld = []
  const otksForLocalStorage = []
  for (let i = 0; i < OTK_COUNT; i++) {
    const kp = await generateX25519KeyPair()
    const opkId = `dev-otk-${Date.now()}-${i}`
    otksPublic.push({ opkId, opkPub: encodeKeyBase64(kp.pub) })
    otksForEld.push({ opkId, privateKey: kp.priv })
    otksForLocalStorage.push({ opkId, priv: encodeKeyBase64(kp.priv) })
  }

  const keyBundle = {
    ...getDeviceMetadata(),
    publicIdentityKeyX25519: ikPubX25519B64,
    publicIdentityKeyEd25519: ikPubEd25519B64,
    signedPreKey: spkPubB64,
    signedPreKeySignature: spkSignatureB64,
    signedPreKeyId: 0,
    oneTimePreKeys: otksPublic,
  }

  localStorage.setItem(
    LS_DEVICE_SPK_KEY,
    JSON.stringify({ priv: encodeKeyBase64(spkPriv), pub: spkPubB64 })
  )
  localStorage.setItem(LS_DEVICE_OTKS_KEY, JSON.stringify(otksForLocalStorage))

  // Mirror this device's own identity material into ELD BEFORE the server
  // upload. Preserve any existing fields (privateKeyEd25519, etc.) by merging
  // rather than replacing — only overwrite the X25519 IK + the new SPK pair.
  const existingIdentity = (await eld.getIdentityKeys().catch(() => null)) || {}
  await eld.storeIdentityKeys({
    ...existingIdentity,
    privateKeyX25519: encodeKeyBase64(ik.priv),
    publicKeyX25519: ikPubX25519B64,
    publicKeyEd25519: ikPubEd25519B64,
    privatePreKey: encodeKeyBase64(spkPriv),
    spkId: 0,
    spkCreatedAt: new Date().toISOString(),
  })
  await eld.storeOPKs(otksForEld)

  // Only publish the public bundle once the matching private material is
  // safely in ELD. If `registerDeviceKeys` fails, we throw — the caller
  // (Dashboard init) leaves the retry flag unset so next mount tries again.
  await deviceService.registerDeviceKeys(deviceId, keyBundle)

  return keyBundle
}

// ─── Trust filter for per-device bundles ─────────────────────────────────────
//
// `filterTrustedDeviceBundles` filters a list of per-device bundles down to
// those the caller should trust to fan-out to (DM) or admit to a group (MLS).
// The primary device's bundle is the trust anchor; secondary bundles are kept
// only when their `deviceAuthorizationSignature` verifies under the primary's
// IK_Ed25519. A server that splices in a fake secondary cannot forge the
// signature without holding the primary's IK private.
//
// Input: bundles as returned by deviceService.getDeviceBundles /
// getDeviceIdentities. Output: a subset, primary first, untrusted secondaries
// dropped.
// Verify that a bundle's own SPK signature is well-formed (the SPK signature
// is required by X3DH on the sender's side). Returns true if the signature
// verifies under the bundle's publicIdentityKeyEd25519, false otherwise or if
// the bundle has no SPK material. This guards against legacy paired devices
// that uploaded placeholder values (e.g. the X25519 pub stuffed into the
// signature field) under earlier code paths.
async function bundleSpkSignatureVerifies(b) {
  const spkB64 = b?.signedPreKey
  const sigB64 = b?.signedPreKeySignature ?? b?.signature
  const edB64 = b?.publicIdentityKeyEd25519
  if (!spkB64 || !sigB64 || !edB64) return false
  try {
    const spk = b64dec(spkB64)
    const sig = b64dec(sigB64)
    const ed = b64dec(edB64)
    if (!spk || !sig || !ed) return false
    return await verify_signature(sig, spk, ed)
  } catch {
    return false
  }
}

export async function filterTrustedDeviceBundles(bundles) {
  if (!Array.isArray(bundles) || bundles.length === 0) return []
  await ensureWasm()

  const primary = bundles.find((b) => b?.isPrimary) ?? bundles[0]
  if (!primary) return []
  const primaryEdB64 = primary.publicIdentityKeyEd25519
  if (!primaryEdB64) return []

  // The primary is the trust anchor for secondaries, but it must itself carry
  // a valid SPK signature. A primary whose SPK material was clobbered by
  // older client code (e.g. signedPreKey == publicIdentityKeyX25519) cannot
  // be used to drive X3DH on the sender side — the responder's stored SPK
  // private wouldn't match. In that case return [] so callers fall back to
  // legacy single-target send paths (which use the never-overwritten
  // User.signature).
  const primarySpkOk = await bundleSpkSignatureVerifies(primary)
  if (!primarySpkOk) return []

  const primaryEd = b64dec(primaryEdB64)
  if (!primaryEd) return [primary]

  const trusted = [primary]
  for (const b of bundles) {
    if (b === primary) continue
    if (b?.isPrimary) continue
    const sigB64 = b?.deviceAuthorizationSignature
    const ikPubB64 = b?.publicIdentityKeyX25519
    if (!sigB64 || !ikPubB64) continue
    try {
      const sig = b64dec(sigB64)
      const ikPub = b64dec(ikPubB64)
      if (!sig || !ikPub) continue
      const authSigOk = await verify_signature(sig, ikPub, primaryEd)
      if (!authSigOk) continue
      // Also require that the secondary's OWN SPK signature verifies — a
      // valid auth_sig still doesn't help if the device's SPK material was
      // uploaded as bogus placeholders by older client code, because the
      // X3DH initiator will reject the bundle on the sender side.
      const spkOk = await bundleSpkSignatureVerifies(b)
      if (!spkOk) continue
      trusted.push(b)
    } catch {
      // Signature parse / verify failure — drop silently; an untrusted
      // secondary is the same outcome as no secondary.
    }
  }
  return trusted
}

// Return this device's own IK pubs (X25519 + derived Ed25519). Used by
// group-join flows that need to construct a leaf for this device.
export async function ensureDeviceIKPubs() {
  await ensureWasm()
  const ik = await getOrCreateDeviceIK()
  const edPub = derive_ed25519_keypair_from_x25519(ik.priv)
  return {
    pubX25519: encodeKeyBase64(ik.pub),
    pubEd25519: encodeKeyBase64(edPub),
  }
}

// Synchronously load this device's SPK pair from localStorage. Returns
// `{ priv, pub }` (both base64 strings) or null if the bundle has not been
// generated yet.
export function loadDeviceSPKPrivate() {
  const raw = localStorage.getItem(LS_DEVICE_SPK_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.priv && parsed?.pub) return { priv: parsed.priv, pub: parsed.pub }
  } catch {
    // Corrupt entry — treat as missing.
  }
  return null
}

// Synchronously read the parent-signed device authorization signature cached
// in localStorage. Returns null on the primary (which has no signature) or
// when the pairing flow has not yet stored it.
export function loadDeviceAuthorizationSignature() {
  return localStorage.getItem(LS_DEVICE_AUTH_SIG_KEY) || null
}

// Persist the parent's signature over this device's IK pub. Called by the
// pairing flow after the source device produces it, so subsequent group-join
// operations can attach the signature without a server round-trip.
export function storeDeviceAuthorizationSignature(signatureB64) {
  if (typeof signatureB64 === 'string' && signatureB64.length > 0) {
    localStorage.setItem(LS_DEVICE_AUTH_SIG_KEY, signatureB64)
  }
}
