import { base64ToBytes, bytesToBase64 } from '../../helpers.js'

// Key schedule Imports
import { advanceEpoch } from '../keySchedule.js'
import { DEFAULT_MLS_CIPHER_SUITE, MLS_STATE_VERSION, normalizeGroupState } from './groupState.js'
import { makeCommitAadBytes, unwrapGroupKey, wrapGroupKey } from './pathSecrets.js'
import {
  computeLeafCount,
  installOwnLeafPrivateKey,
  makeTreeFromPublicNodes,
  normalizeRoster,
  publicTreeSnapshot,
} from './treeState.js'
import { generateLeafSigningKeypair, signWelcome, verifyWelcome } from './commitSigning.js'
import { issueCredential, verifyRosterCredentials } from './credential.js'
import { computeTreeHash, genesisTranscriptHash } from './groupContext.js'

// Builds the initial welcome sent to each non-creator member when a group is created.
export async function buildInitialWelcomes({ creatorState, roster, memberInitKeys }) {
  const state = normalizeGroupState(creatorState)

  // Merge passed-in roster with state roster; state's signing keys take precedence.
  const passedRoster = normalizeRoster(roster)
  const normalizedRoster = passedRoster.map((m) => {
    const inState = state.roster.find((s) => String(s.userId) === String(m.userId))
    return inState
      ? {
          ...m,
          leafSigningPubKeyB64: inState.leafSigningPubKeyB64 ?? m.leafSigningPubKeyB64 ?? null,
          credential: inState.credential ?? m.credential ?? null,
        }
      : m
  })

  const initSecretB64 = state.secrets.epochInitSecretB64
  const commitSecretB64 = state.secrets.epochCommitSecretB64
  if (!initSecretB64 || !commitSecretB64) {
    throw new Error(`Creator state is missing epoch seed secrets for group ${state.groupId}`)
  }

  const aadBytes = makeCommitAadBytes(state.groupId, state.epoch)
  const treePublicNodes = publicTreeSnapshot(state.tree.nodes)

  const senderRosterEntry = normalizedRoster.find(
    (member) => String(member.userId) === String(state.selfUserId)
  )
  if (!senderRosterEntry?.leafSigningPubKeyB64) {
    throw new Error(
      `Creator state is missing sender leaf signing public key for group ${state.groupId}`
    )
  }
  if (!state.leafSigningPrivKeyB64) {
    throw new Error(
      `Creator state is missing sender leaf signing private key for group ${state.groupId}`
    )
  }

  const welcomes = []
  for (const member of normalizedRoster) {
    if (String(member.userId) === String(state.selfUserId)) continue

    const initKeyB64 = memberInitKeys?.find(
      (entry) => String(entry.userId) === String(member.userId)
    )?.initKeyB64
    if (!initKeyB64) {
      throw new Error(
        `Missing initKeyB64 for member ${member.userId} — fetch their KeyPackage before building Welcomes`
      )
    }

    const wrappedInitSecret = await wrapGroupKey(initSecretB64, initKeyB64, aadBytes)
    const wrappedCommitSecret = await wrapGroupKey(commitSecretB64, initKeyB64, aadBytes)

    const welcome = {
      groupId: state.groupId,
      epoch: state.epoch,
      cipherSuite: state.cipherSuite,
      roster: normalizedRoster,
      recipientUserId: member.userId,
      recipientLeafIndex: member.leafIndex,
      leafCount: computeLeafCount({ roster: normalizedRoster, treeNodes: state.tree.nodes }),
      senderLeafIndex: state.selfLeafIndex,
      senderSigningPubKeyB64: senderRosterEntry.leafSigningPubKeyB64,
      wrappedInitSecret,
      wrappedCommitSecret,
      treePublicNodes,
      confirmedTranscriptHashB64: state.confirmedTranscriptHashB64 ?? null,
    }
    welcome.signature = await signWelcome(welcome, state.leafSigningPrivKeyB64)
    welcomes.push(welcome)
  }

  return welcomes
}

// Takes in a welcome packet and builds the recipient's local group state.
export async function processWelcome({ welcome, selfUserId = null, myInitPrivKeyB64 }) {
  if (!welcome || typeof welcome !== 'object') throw new Error('Invalid welcome')
  if (typeof welcome.groupId !== 'string' || welcome.groupId.length === 0) {
    throw new Error('Welcome is missing groupId')
  }
  if (!Number.isInteger(welcome.recipientLeafIndex)) {
    throw new Error(`Welcome is missing recipientLeafIndex for group ${welcome.groupId}`)
  }
  if (!Array.isArray(welcome.roster)) {
    throw new Error(`Welcome is missing roster for group ${welcome.groupId}`)
  }
  if (!myInitPrivKeyB64) {
    throw new Error('myInitPrivKeyB64 required to process welcome')
  }
  if (!welcome.wrappedInitSecret || !welcome.wrappedCommitSecret) {
    throw new Error(`Welcome is missing encrypted key fields for group ${welcome.groupId}`)
  }
  if (!Number.isInteger(welcome.senderLeafIndex)) {
    throw new Error(`Welcome is missing senderLeafIndex for group ${welcome.groupId}`)
  }
  if (
    typeof welcome.senderSigningPubKeyB64 !== 'string' ||
    welcome.senderSigningPubKeyB64.length === 0
  ) {
    throw new Error(`Welcome is missing senderSigningPubKeyB64 for group ${welcome.groupId}`)
  }

  const normalizedRoster = normalizeRoster(welcome.roster)

  const senderEntry = normalizedRoster.find(
    (member) => member.leafIndex === welcome.senderLeafIndex
  )
  if (!senderEntry?.leafSigningPubKeyB64) {
    throw new Error(`No signing pub key for welcome sender at leafIndex ${welcome.senderLeafIndex}`)
  }
  if (senderEntry.leafSigningPubKeyB64 !== welcome.senderSigningPubKeyB64) {
    throw new Error('Welcome sender signing pub key mismatch')
  }
  await verifyWelcome(welcome, senderEntry.leafSigningPubKeyB64)

  // Verify all credentials in the roster before trusting any roster material.
  await verifyRosterCredentials(normalizedRoster)

  const aadBytes = makeCommitAadBytes(welcome.groupId, welcome.epoch)

  const initSecret = await unwrapGroupKey(welcome.wrappedInitSecret, myInitPrivKeyB64, aadBytes)
  const commitSecret = await unwrapGroupKey(welcome.wrappedCommitSecret, myInitPrivKeyB64, aadBytes)

  // Reconstruct the tree hash and confirmed transcript hash to feed into the key schedule.
  const treeNodes = makeTreeFromPublicNodes(welcome.treePublicNodes)
  installOwnLeafPrivateKey(treeNodes, welcome.recipientLeafIndex, myInitPrivKeyB64)

  const treePublicNodes = Array.isArray(welcome.treePublicNodes)
    ? welcome.treePublicNodes
    : publicTreeSnapshot(treeNodes)
  const treeHash = await computeTreeHash(treePublicNodes)

  const confirmedTranscriptHash = welcome.confirmedTranscriptHashB64
    ? base64ToBytes(welcome.confirmedTranscriptHashB64)
    : await genesisTranscriptHash(welcome.groupId)

  const cipherSuite =
    typeof welcome.cipherSuite === 'string' && welcome.cipherSuite.length > 0
      ? welcome.cipherSuite
      : DEFAULT_MLS_CIPHER_SUITE

  const { applicationSecret, nextInitSecret } = await advanceEpoch({
    initSecret: base64ToBytes(initSecret),
    commitSecret: base64ToBytes(commitSecret),
    groupId: welcome.groupId,
    epoch: welcome.epoch,
    cipherSuite,
    treeHash,
    confirmedTranscriptHash,
  })

  // Generate a fresh leaf signing keypair and self-signed credential for this member.
  const effectiveSelfUserId = selfUserId ?? welcome.recipientUserId
  const { leafSigningPrivKeyB64, leafSigningPubKeyB64 } = await generateLeafSigningKeypair()
  const credential = await issueCredential(
    effectiveSelfUserId,
    leafSigningPrivKeyB64,
    leafSigningPubKeyB64
  )

  const rosterWithSigningKey = normalizedRoster.map((m) =>
    String(m.userId) === String(effectiveSelfUserId)
      ? { ...m, leafSigningPubKeyB64, credential }
      : m
  )

  return normalizeGroupState({
    stateVersion: MLS_STATE_VERSION,
    groupId: welcome.groupId,
    epoch: Number.isInteger(welcome.epoch) ? welcome.epoch : 0,
    cipherSuite,
    selfUserId: effectiveSelfUserId,
    selfLeafIndex: welcome.recipientLeafIndex,
    applicationSecretB64: bytesToBase64(applicationSecret),
    initSecretB64: bytesToBase64(nextInitSecret),
    confirmedTranscriptHashB64: welcome.confirmedTranscriptHashB64 ?? null,
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    roster: rosterWithSigningKey,
    tree: { nodes: treeNodes },
    secrets: { initSecretB64: bytesToBase64(nextInitSecret) },
    pendingCommits: [],
    pendingProposals: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    leafSigningPrivKeyB64,
  })
}
