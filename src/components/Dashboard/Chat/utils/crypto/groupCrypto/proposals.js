import { bytesToBase64 } from '../../helpers.js'
import { signBytes, verifyBytes } from './commitSigning.js'
import { verifyKeyPackage } from './keyPackage.js'
import { sha256 } from './groupContext.js'
import { normalizeGroupState } from './groupState.js'

const TEXT_ENCODER = new TextEncoder()

// Keep proposal signing stable across runtimes.
export function encodeProposalForSigning(proposal) {
  const base = [
    'EchoMLS/v1/Proposal',
    proposal.type,
    String(proposal.groupId ?? ''),
    String(proposal.epoch ?? ''),
    String(proposal.senderLeafIndex ?? ''),
  ]

  const appendKeyPackageFields = (kp) => {
    base.push(kp?.userId ?? '')
    base.push(kp?.initKeyB64 ?? '')
    base.push(kp?.leafSigningPubKeyB64 ?? '')
    base.push(kp?.credential?.userId ?? '')
    base.push(kp?.credential?.leafSigningPubKeyB64 ?? '')
    base.push(kp?.credential?.signature ?? '')
    base.push(String(kp?.createdAt ?? ''))
    base.push(String(kp?.expiresAt ?? ''))
  }

  switch (proposal.type) {
    case 'add':
      appendKeyPackageFields(proposal.keyPackage)
      break
    case 'remove':
      base.push(String(proposal.targetLeafIndex ?? ''))
      base.push(String(proposal.targetUserId ?? ''))
      break
    case 'update':
      if (proposal.keyPackage) {
        appendKeyPackageFields(proposal.keyPackage)
      } else {
        base.push(proposal.newInitKeyB64 ?? '')
        base.push(proposal.newLeafSigningPubKeyB64 ?? '')
      }
      break
    case 'external_init':
      base.push(proposal.externalPubB64 ?? '')
      base.push(proposal.joinerSigningPubKeyB64 ?? '')
      break
    case 'psk':
      base.push(proposal.pskId ?? '')
      base.push(proposal.pskNonce ?? '')
      break
    case 'reinit':
      base.push(proposal.newGroupId ?? '')
      base.push(proposal.newCipherSuite ?? '')
      break
    default:
      break
  }

  return TEXT_ENCODER.encode(base.join('|'))
}

// Sign a proposal and attach its stable reference.
export async function createProposal(proposalFields, leafSigningPrivKeyB64) {
  const base = { version: 'EchoMLS/v1', ...proposalFields }
  const message = encodeProposalForSigning(base)
  base.signature = await signBytes(message, leafSigningPrivKeyB64)
  base.ref = bytesToBase64(await sha256(message))
  return base
}

// Verify a proposal with the sender signing key.
export async function verifyProposal(proposal, senderSigningPubKeyB64) {
  if (!proposal?.signature) throw new Error('Proposal missing signature')
  const message = encodeProposalForSigning(proposal)
  await verifyBytes(message, proposal.signature, senderSigningPubKeyB64)
  if ((proposal.type === 'add' || proposal.type === 'update') && proposal.keyPackage) {
    await verifyKeyPackage(proposal.keyPackage)
  }
}

// Store one verified proposal in pending state.
export async function receiveProposal({ state, proposal }) {
  const currentState = normalizeGroupState(state)

  const senderEntry = currentState.roster.find((m) => m.leafIndex === proposal.senderLeafIndex)
  if (!senderEntry?.leafSigningPubKeyB64) {
    if (proposal.type !== 'external_init') {
      throw new Error(`No signing key for proposal sender at leafIndex ${proposal.senderLeafIndex}`)
    }
    if (!proposal.joinerSigningPubKeyB64) {
      throw new Error('ExternalInit proposal missing joinerSigningPubKeyB64 — cannot verify sender')
    }
    await verifyProposal(proposal, proposal.joinerSigningPubKeyB64)
  } else {
    await verifyProposal(proposal, senderEntry.leafSigningPubKeyB64)
  }

  const alreadyHave = currentState.pendingProposals.some((p) => p.ref === proposal.ref)
  if (alreadyHave) return currentState

  // Keep proposals in arrival order so commit builders can resolve refs later.
  return normalizeGroupState({
    ...currentState,
    pendingProposals: [...currentState.pendingProposals, proposal],
  })
}

// Resolve commit proposal refs from inline or pending proposals.
export function resolveProposalRefs(proposalRefs, inlineProposals, pendingProposals) {
  if (!Array.isArray(proposalRefs) || proposalRefs.length === 0) return []
  const byRef = new Map()
  for (const p of [...(pendingProposals ?? []), ...(inlineProposals ?? [])]) {
    if (p.ref) byRef.set(p.ref, p)
  }
  return proposalRefs.map((ref) => {
    const p = byRef.get(ref)
    if (!p) throw new Error(`Cannot resolve proposalRef ${ref}`)
    return p
  })
}

// Build a self-update proposal from local state.
export async function createUpdateProposal({ state, newInitKeyB64, newLeafSigningPubKeyB64 }) {
  const currentState = normalizeGroupState(state)
  return createProposal(
    {
      type: 'update',
      groupId: currentState.groupId,
      epoch: currentState.epoch,
      senderLeafIndex: currentState.selfLeafIndex,
      newInitKeyB64,
      newLeafSigningPubKeyB64,
    },
    currentState.leafSigningPrivKeyB64
  )
}

// Build an ExternalInit proposal for a new joiner.
export async function createExternalInitProposal({
  externalPubB64,
  joinerSigningPrivKeyB64,
  joinerSigningPubKeyB64,
}) {
  if (!joinerSigningPubKeyB64) {
    throw new Error(
      'createExternalInitProposal requires joinerSigningPubKeyB64 so receivers can verify the proposal'
    )
  }
  return createProposal(
    {
      type: 'external_init',
      senderLeafIndex: -1,
      externalPubB64,
      joinerSigningPubKeyB64,
    },
    joinerSigningPrivKeyB64
  )
}

// Build a PSK proposal from local state.
export async function createPskProposal({ state, pskId, pskNonce }) {
  const currentState = normalizeGroupState(state)
  return createProposal(
    {
      type: 'psk',
      groupId: currentState.groupId,
      epoch: currentState.epoch,
      senderLeafIndex: currentState.selfLeafIndex,
      pskId,
      pskNonce,
    },
    currentState.leafSigningPrivKeyB64
  )
}

// Build a ReInit proposal from local state.
export async function createReInitProposal({ state, newGroupId, newCipherSuite }) {
  const currentState = normalizeGroupState(state)
  return createProposal(
    {
      type: 'reinit',
      groupId: currentState.groupId,
      epoch: currentState.epoch,
      senderLeafIndex: currentState.selfLeafIndex,
      newGroupId: newGroupId ?? currentState.groupId,
      newCipherSuite: newCipherSuite ?? currentState.cipherSuite,
    },
    currentState.leafSigningPrivKeyB64
  )
}
