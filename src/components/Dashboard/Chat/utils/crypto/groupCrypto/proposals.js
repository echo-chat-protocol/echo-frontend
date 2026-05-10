import { bytesToBase64 } from '../../helpers.js'
import { signBytes, verifyBytes } from './commitSigning.js'
import { verifyKeyPackage } from './keyPackage.js'
import { sha256 } from './groupContext.js'

const TEXT_ENCODER = new TextEncoder()

// Deterministic canonical encoding of a Proposal for signing.
// The `ref` field and `signature` field are excluded from the encoding.
export function encodeProposalForSigning(proposal) {
  const fields = [
    'EchoMLS/v1/Proposal',
    proposal.type,
    proposal.groupId,
    String(proposal.epoch),
    String(proposal.senderLeafIndex),
    proposal.type === 'add' ? (proposal.keyPackage?.userId ?? '') : '',
    proposal.type === 'remove' ? String(proposal.targetLeafIndex ?? '') : '',
    proposal.type === 'remove' ? String(proposal.targetUserId ?? '') : '',
  ]
  return TEXT_ENCODER.encode(fields.join('|'))
}

// Create and sign a proposal. The `ref` is a stable content-addressed identifier
// used to reference this proposal inside a commit's proposalRefs array.
export async function createProposal(proposalFields, leafSigningPrivKeyB64) {
  const base = { version: 'EchoMLS/v1', ...proposalFields }
  const message = encodeProposalForSigning(base)
  base.signature = await signBytes(message, leafSigningPrivKeyB64)
  base.ref = bytesToBase64(await sha256(message))
  return base
}

// Verify a received proposal against the sender's signing pubkey from the current roster.
// Also verifies any embedded KeyPackage for add proposals.
export async function verifyProposal(proposal, senderSigningPubKeyB64) {
  if (!proposal?.signature) throw new Error('Proposal missing signature')
  const message = encodeProposalForSigning(proposal)
  await verifyBytes(message, proposal.signature, senderSigningPubKeyB64)
  if (proposal.type === 'add' && proposal.keyPackage) {
    await verifyKeyPackage(proposal.keyPackage)
  }
}
