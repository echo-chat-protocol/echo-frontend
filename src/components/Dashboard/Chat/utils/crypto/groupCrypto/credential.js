import { signBytes, verifyBytes } from './commitSigning.js'

const TEXT_ENCODER = new TextEncoder()

export function encodeCredentialForSigning(userId, leafSigningPubKeyB64) {
  return TEXT_ENCODER.encode(`EchoMLS/v1/Credential|${userId}|${leafSigningPubKeyB64}`)
}

// Issues a self-signed credential binding userId to a leaf signing key.
// Call once per session after generating a leaf signing keypair.
export async function issueCredential(userId, leafSigningPrivKeyB64, leafSigningPubKeyB64) {
  const message = encodeCredentialForSigning(String(userId), leafSigningPubKeyB64)
  const signature = await signBytes(message, leafSigningPrivKeyB64)
  return {
    version: 'EchoMLS/v1',
    userId: String(userId),
    leafSigningPubKeyB64,
    signature,
  }
}

// Verifies a credential is internally self-consistent (self-signed).
// Throws on any failure.
export async function verifyCredential(credential) {
  if (!credential?.userId || !credential?.leafSigningPubKeyB64 || !credential?.signature) {
    throw new Error('Credential is missing required fields')
  }
  const message = encodeCredentialForSigning(credential.userId, credential.leafSigningPubKeyB64)
  await verifyBytes(message, credential.signature, credential.leafSigningPubKeyB64)
}

// For every roster entry that carries a credential, verifies it and cross-checks
// that the credential pubkey matches the roster entry's leafSigningPubKeyB64.
export async function verifyRosterCredentials(roster) {
  for (const member of roster) {
    if (!member.credential) continue
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
