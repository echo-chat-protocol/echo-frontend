import eld from '../../../../../../utils/storage/EncryptedLocalDatabase.js'
import { bytesToBase64 } from '../../helpers.js'

import { advanceEpoch, computeConfirmationTag } from '../keySchedule.js'
import {
  DEFAULT_MLS_CIPHER_SUITE,
  getGroupState,
  MLS_STATE_VERSION,
  normalizeGroupState,
} from './groupState.js'
import { randomBytes } from './pathSecrets.js'
import {
  findLeafIndexForUser,
  initTreeFromRoster,
  normalizeRoster,
  publicTreeSnapshot,
} from './treeState.js'
import { generateLeafSigningKeypair } from './commitSigning.js'
import { issueCredential } from './credential.js'
import { computeTreeHash, genesisTranscriptHash } from './groupContext.js'
import { resolveRosterIdentityFromKeyPackage, verifyKeyPackage } from './keyPackage.js'

// Normalize and persist one MLS group state record.
export async function saveGroupState(groupId, state) {
  if (!eld.isUnlocked()) throw new Error('ELD must be unlocked before saving group state')
  const normalized = normalizeGroupState({ ...state, groupId })
  await eld.storeMlsGroupState(groupId, { id: getGroupState(groupId), groupId, state: normalized })
  return normalized
}

// Load and normalize one MLS group state record.
export async function loadGroupState(groupId) {
  if (!eld.isUnlocked()) throw new Error('ELD must be unlocked before loading group state')
  const record = await eld.getMlsGroupState(groupId)
  if (!record?.state) return null
  if (record.state.stateVersion !== MLS_STATE_VERSION) {
    throw new Error(`Incompatible group state version for group ${groupId}`)
  }
  return normalizeGroupState(record.state)
}

// Create the initial MLS state for a new group.
export async function createNewGroupState({
  groupId,
  creatorUserId,
  roster,
  cipherSuite = DEFAULT_MLS_CIPHER_SUITE,
  memberInitKeys = [],
  selfInitPrivKeyB64 = null,
}) {
  for (const entry of memberInitKeys ?? []) {
    if (entry?.keyPackage) await verifyKeyPackage(entry.keyPackage)
  }

  const normalizedRoster = normalizeRoster(roster).map((member) => {
    const kp = memberInitKeys?.find(
      (entry) => String(entry.userId) === String(member.userId)
    )?.keyPackage
    const identity = resolveRosterIdentityFromKeyPackage(kp)
    return identity
      ? {
          ...member,
          leafSigningPubKeyB64: identity.leafSigningPubKeyB64,
          credential: identity.credential,
        }
      : member
  })
  const selfLeafIndex = findLeafIndexForUser(normalizedRoster, creatorUserId)

  const initSecret0 = randomBytes(32)
  const commitSecret0 = randomBytes(32)

  const { nodes: treeNodes, leafData: initialLeafData } = await initTreeFromRoster(
    normalizedRoster,
    selfLeafIndex,
    selfInitPrivKeyB64,
    memberInitKeys
  )

  const treePublicNodes = publicTreeSnapshot(treeNodes)
  const leafCount = normalizedRoster.length

  const genesisTH = await genesisTranscriptHash()

  const treeHash = await computeTreeHash(treePublicNodes, leafCount, initialLeafData)

  const { leafSigningPrivKeyB64, leafSigningPubKeyB64 } = await generateLeafSigningKeypair()
  const credential = await issueCredential(
    creatorUserId,
    leafSigningPrivKeyB64,
    leafSigningPubKeyB64
  )

  const leafData = { ...initialLeafData }
  if (selfLeafIndex !== null) {
    leafData[String(selfLeafIndex)] = {
      ...(leafData[String(selfLeafIndex)] ?? {}),
      userId: creatorUserId,
      username:
        normalizedRoster.find((m) => String(m.userId) === String(creatorUserId))?.username ??
        'Member',
      leafSigningPubKeyB64,
      credential,
    }
  }

  const rosterWithSigningKeys = normalizedRoster.map((m) =>
    String(m.userId) === String(creatorUserId) ? { ...m, leafSigningPubKeyB64, credential } : m
  )

  const {
    applicationSecret,
    nextInitSecret,
    senderDataSecret,
    externalSecret,
    epochSecret,
    membershipSecret,
    resumptionPsk,
  } = await advanceEpoch({
    initSecret: initSecret0,
    commitSecret: commitSecret0,
    groupId,
    epoch: 0,
    cipherSuite,
    treeHash,
    confirmedTranscriptHash: genesisTH,
  })

  const confirmationTag = await computeConfirmationTag(epochSecret, genesisTH)

  return saveGroupState(groupId, {
    stateVersion: MLS_STATE_VERSION,
    groupId,
    epoch: 0,
    cipherSuite,
    selfUserId: creatorUserId,
    selfLeafIndex,
    applicationSecretB64: bytesToBase64(applicationSecret),
    senderDataSecretB64: bytesToBase64(senderDataSecret),
    externalSecretB64: bytesToBase64(externalSecret),
    membershipSecretB64: bytesToBase64(membershipSecret),
    resumptionPskB64: bytesToBase64(resumptionPsk),
    initSecretB64: bytesToBase64(nextInitSecret),
    confirmationTagB64: bytesToBase64(confirmationTag),
    confirmedTranscriptHashB64: bytesToBase64(genesisTH),
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    roster: rosterWithSigningKeys,
    tree: { nodes: treeNodes, leafData },
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
