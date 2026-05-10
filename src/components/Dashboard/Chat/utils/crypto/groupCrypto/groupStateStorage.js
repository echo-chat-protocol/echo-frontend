import eld from '../../../../../../utils/storage/EncryptedLocalDatabase.js'
import { bytesToBase64 } from '../../helpers.js'

// Key schedule Imports
import { advanceEpoch } from '../keySchedule.js'
import {
  DEFAULT_MLS_CIPHER_SUITE,
  getGroupState,
  MLS_STATE_VERSION,
  normalizeGroupState,
} from './groupState.js'
import { randomBytes } from './pathSecrets.js'
import { findLeafIndexForUser, initTreeFromRoster, normalizeRoster } from './treeState.js'
import { generateLeafSigningKeypair } from './commitSigning.js'
import { issueCredential } from './credential.js'
import { computeTreeHash, genesisTranscriptHash } from './groupContext.js'
import { publicTreeSnapshot } from './treeState.js'

export async function saveGroupState(groupId, state) {
  if (!eld.isUnlocked()) {
    throw new Error('ELD must be unlocked before saving group state')
  }

  const normalized = normalizeGroupState({ ...state, groupId })
  await eld.storeMlsGroupState(groupId, {
    id: getGroupState(groupId),
    groupId,
    state: normalized,
  })

  return normalized
}

export async function loadGroupState(groupId) {
  if (!eld.isUnlocked()) {
    throw new Error('ELD must be unlocked before loading group state')
  }

  const record = await eld.getMlsGroupState(groupId)
  if (!record?.state) return null

  if (record.state.stateVersion !== MLS_STATE_VERSION) {
    throw new Error(`Incompatible group state version for group ${groupId}`)
  }

  return normalizeGroupState(record.state)
}

export async function createNewGroupState({
  groupId,
  creatorUserId,
  roster,
  cipherSuite = DEFAULT_MLS_CIPHER_SUITE,
  memberInitKeys = [],
  selfInitPrivKeyB64 = null,
}) {
  const normalizedRoster = normalizeRoster(roster)
  const selfLeafIndex = findLeafIndexForUser(normalizedRoster, creatorUserId)

  // Generate two random seed secrets for epoch 0.
  const initSecret0 = randomBytes(32)
  const commitSecret0 = randomBytes(32)

  // Build the initial tree so we can compute a tree hash for the GroupContext.
  const treeNodes = await initTreeFromRoster(
    normalizedRoster,
    selfLeafIndex,
    selfInitPrivKeyB64,
    memberInitKeys
  )

  const treePublicNodes = publicTreeSnapshot(treeNodes)
  const treeHash = await computeTreeHash(treePublicNodes)

  // Genesis transcript hash: deterministic starting point all members agree on.
  const genesisTH = await genesisTranscriptHash(groupId)

  // Generate the creator's leaf signing keypair and issue a self-signed credential.
  const { leafSigningPrivKeyB64, leafSigningPubKeyB64 } = await generateLeafSigningKeypair()
  const credential = await issueCredential(
    creatorUserId,
    leafSigningPrivKeyB64,
    leafSigningPubKeyB64
  )

  // Add the creator's signing pub key and credential to their roster entry.
  const rosterWithSigningKeys = normalizedRoster.map((m) =>
    String(m.userId) === String(creatorUserId) ? { ...m, leafSigningPubKeyB64, credential } : m
  )

  // Advance epoch 0 with the full GroupContext.
  const { applicationSecret, nextInitSecret } = await advanceEpoch({
    initSecret: initSecret0,
    commitSecret: commitSecret0,
    groupId,
    epoch: 0,
    cipherSuite,
    treeHash,
    confirmedTranscriptHash: genesisTH,
  })

  return saveGroupState(groupId, {
    stateVersion: MLS_STATE_VERSION,
    groupId,
    epoch: 0,
    cipherSuite,
    selfUserId: creatorUserId,
    selfLeafIndex,
    applicationSecretB64: bytesToBase64(applicationSecret),
    initSecretB64: bytesToBase64(nextInitSecret),
    confirmedTranscriptHashB64: bytesToBase64(genesisTH),
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    roster: rosterWithSigningKeys,
    tree: { nodes: treeNodes },
    leafSigningPrivKeyB64,
    secrets: {
      initSecretB64: bytesToBase64(nextInitSecret),
      epochInitSecretB64: bytesToBase64(initSecret0),
      epochCommitSecretB64: bytesToBase64(commitSecret0),
    },
    pendingCommits: [],
    pendingProposals: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}
