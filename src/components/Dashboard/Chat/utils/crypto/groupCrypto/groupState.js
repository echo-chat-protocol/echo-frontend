import { base64ToBytes } from '../../helpers.js'

import { nodeWidth } from './treemath.js'
import {
  computeLeafCount,
  findLeafIndexForUser,
  normalizeLeafData,
  normalizeRoster,
  resizeNodes,
  rosterFromLeafData,
} from './treeState.js'

export const MLS_STATE_VERSION = 1
export const MLS_STATE_PREFIX = 'echo-mls:groupState:'
export const DEFAULT_MLS_CIPHER_SUITE = 'ECHO-MLS/X25519_AES256GCM_SHA256'

// Build the storage key for one group state record.
export function getGroupState(groupId) {
  return `${MLS_STATE_PREFIX}${groupId}`
}

// Resolve the current application secret from state.
export function resolveApplicationKey(state) {
  const applicationSecretB64 =
    typeof state?.applicationSecretB64 === 'string' && state.applicationSecretB64.length > 0
      ? state.applicationSecretB64
      : typeof state?.groupKeyB64 === 'string' && state.groupKeyB64.length > 0
        ? state.groupKeyB64
        : null

  if (!applicationSecretB64) {
    throw new Error(
      `Group state is missing application key material for group ${state?.groupId ?? ''}`
    )
  }
  return { applicationSecretB64, keyBytes: base64ToBytes(applicationSecretB64) }
}

// Normalize all persisted and in-memory group state fields.
export function normalizeGroupState(state) {
  if (!state || typeof state !== 'object') throw new Error('Invalid group state')

  // Prefer the tree leaf data when it is present. Older state may only have roster.
  const rawLeafData = normalizeLeafData(state.tree?.leafData)
  const leafDataRoster = rosterFromLeafData(rawLeafData)
  const roster = leafDataRoster.length > 0 ? leafDataRoster : normalizeRoster(state.roster)

  const selfLeafIndex = Number.isInteger(state.selfLeafIndex)
    ? state.selfLeafIndex
    : findLeafIndexForUser(roster, state.selfUserId)

  const leafCount = computeLeafCount({
    roster,
    treeNodes: state.tree?.nodes,
    extraLeafIndex: selfLeafIndex,
  })
  const width = nodeWidth(leafCount)
  const treeNodes = resizeNodes(state.tree?.nodes, width)

  const rawSenderGenerations =
    state.senderGenerations && typeof state.senderGenerations === 'object'
      ? state.senderGenerations
      : {}
  const senderGenerations = Object.fromEntries(
    Object.entries(rawSenderGenerations)
      .filter(([, value]) => Number.isInteger(value))
      .map(([key, value]) => [String(key), value])
  )

  if (
    Number.isInteger(selfLeafIndex) &&
    Number.isInteger(state.applicationMessageCounter) &&
    senderGenerations[String(selfLeafIndex)] === undefined
  ) {
    // Backfill the local sender counter from older state shapes.
    senderGenerations[String(selfLeafIndex)] = state.applicationMessageCounter
  }

  const applicationSecretB64 =
    state.applicationSecretB64 === null
      ? null
      : typeof state.applicationSecretB64 === 'string' && state.applicationSecretB64.length > 0
        ? state.applicationSecretB64
        : state.groupKeyB64 === null
          ? null
          : typeof state.groupKeyB64 === 'string' && state.groupKeyB64.length > 0
            ? state.groupKeyB64
            : null

  const initSecretB64 =
    state.initSecretB64 === null
      ? null
      : typeof state.initSecretB64 === 'string' && state.initSecretB64.length > 0
        ? state.initSecretB64
        : state.secrets?.initSecretB64 === null
          ? null
          : typeof state.secrets?.initSecretB64 === 'string' &&
              state.secrets.initSecretB64.length > 0
            ? state.secrets.initSecretB64
            : null

  const senderDataSecretB64 =
    typeof state.senderDataSecretB64 === 'string' && state.senderDataSecretB64.length > 0
      ? state.senderDataSecretB64
      : null

  const confirmationTagB64 =
    typeof state.confirmationTagB64 === 'string' && state.confirmationTagB64.length > 0
      ? state.confirmationTagB64
      : null

  const externalSecretB64 =
    typeof state.externalSecretB64 === 'string' && state.externalSecretB64.length > 0
      ? state.externalSecretB64
      : null

  const membershipSecretB64 =
    typeof state.membershipSecretB64 === 'string' && state.membershipSecretB64.length > 0
      ? state.membershipSecretB64
      : null

  const resumptionPskB64 =
    typeof state.resumptionPskB64 === 'string' && state.resumptionPskB64.length > 0
      ? state.resumptionPskB64
      : null

  return {
    stateVersion: state.stateVersion || MLS_STATE_VERSION,
    groupId: state.groupId,
    epoch: Number.isInteger(state.epoch) ? state.epoch : 0,
    cipherSuite:
      typeof state.cipherSuite === 'string' && state.cipherSuite.length > 0
        ? state.cipherSuite
        : DEFAULT_MLS_CIPHER_SUITE,
    selfUserId: state.selfUserId ?? null,
    selfLeafIndex,
    applicationSecretB64,
    senderDataSecretB64,
    confirmationTagB64,
    externalSecretB64,
    membershipSecretB64,
    resumptionPskB64,
    initSecretB64,
    senderGenerations,
    roster,
    tree: { nodes: treeNodes, leafData: rawLeafData },
    secrets: {
      initSecretB64,
      epochInitSecretB64:
        typeof state.secrets?.epochInitSecretB64 === 'string'
          ? state.secrets.epochInitSecretB64
          : null,
      epochCommitSecretB64:
        typeof state.secrets?.epochCommitSecretB64 === 'string'
          ? state.secrets.epochCommitSecretB64
          : null,
    },
    pendingCommits: Array.isArray(state.pendingCommits) ? state.pendingCommits : [],
    pendingProposals: Array.isArray(state.pendingProposals) ? state.pendingProposals : [],
    confirmedTranscriptHashB64:
      typeof state.confirmedTranscriptHashB64 === 'string' &&
      state.confirmedTranscriptHashB64.length > 0
        ? state.confirmedTranscriptHashB64
        : null,
    treeHashB64:
      typeof state.treeHashB64 === 'string' && state.treeHashB64.length > 0
        ? state.treeHashB64
        : null,
    createdAt: state.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    groupKeyB64: applicationSecretB64,
    applicationMessageCounter: Number.isInteger(selfLeafIndex)
      ? (senderGenerations[String(selfLeafIndex)] ?? 0)
      : 0,
    leafSigningPrivKeyB64:
      typeof state.leafSigningPrivKeyB64 === 'string' && state.leafSigningPrivKeyB64.length > 0
        ? state.leafSigningPrivKeyB64
        : null,
    reInit: state.reInit === true,
  }
}
