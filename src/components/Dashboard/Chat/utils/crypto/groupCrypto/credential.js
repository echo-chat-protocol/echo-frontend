import { base64ToBytes } from '../../helpers.js'
import { signBytes, verifyBytes } from './commitSigning.js'
import { DOMAIN_CREDENTIAL, PROTOCOL_VERSION } from './labels.js'

const TEXT_ENCODER = new TextEncoder()

// Prefix one byte string with its length.
function lp(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : TEXT_ENCODER.encode(String(bytes ?? ''))
  const out = new Uint8Array(4 + b.length)
  out[0] = (b.length >>> 24) & 0xff
  out[1] = (b.length >>> 16) & 0xff
  out[2] = (b.length >>> 8) & 0xff
  out[3] = b.length & 0xff
  out.set(b, 4)
  return out
}

// Encode the credential fields that are covered by the signature.
export function encodeCredentialForSigning(userId, leafSigningPubKeyB64) {
  const domain = lp(TEXT_ENCODER.encode(DOMAIN_CREDENTIAL))
  const uid = lp(TEXT_ENCODER.encode(String(userId ?? '')))
  const pub = lp(leafSigningPubKeyB64 ? base64ToBytes(leafSigningPubKeyB64) : new Uint8Array(0))
  const buf = new Uint8Array(domain.length + uid.length + pub.length)
  buf.set(domain, 0)
  buf.set(uid, domain.length)
  buf.set(pub, domain.length + uid.length)
  return buf
}

// Issue one signed credential for a leaf signing key.
export async function issueCredential(userId, leafSigningPrivKeyB64, leafSigningPubKeyB64) {
  const message = encodeCredentialForSigning(String(userId), leafSigningPubKeyB64)
  const signature = await signBytes(message, leafSigningPrivKeyB64)
  return {
    version: PROTOCOL_VERSION,
    userId: String(userId),
    leafSigningPubKeyB64,
    signature,
  }
}

// Verify one signed credential object.
export async function verifyCredential(credential) {
  if (!credential?.userId || !credential?.leafSigningPubKeyB64 || !credential?.signature) {
    throw new Error('Credential is missing required fields')
  }
  const message = encodeCredentialForSigning(credential.userId, credential.leafSigningPubKeyB64)
  await verifyBytes(message, credential.signature, credential.leafSigningPubKeyB64)
}

// Verify every credential present in a roster.
export async function verifyRosterCredentials(roster) {
  for (const member of roster) {
    if (!member.credential) {
      throw new Error(
        `Member ${member.userId ?? member.leafIndex} has no credential — identity binding required`
      )
    }
    await verifyCredential(member.credential)
    if (member.credential.leafSigningPubKeyB64 !== member.leafSigningPubKeyB64) {
      throw new Error(
        `Credential pubkey mismatch for userId ${member.userId}: ` +
          `roster has ${member.leafSigningPubKeyB64}, credential has ${member.credential.leafSigningPubKeyB64}`
      )
    }
    if (member.credential.userId !== String(member.userId)) {
      throw new Error(`Credential userId mismatch for roster entry ${member.userId}`)
    }
  }
}
