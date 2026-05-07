import { base64ToBytes } from '../../helpers.js';

// TreeKEM math Imports
import { nodeWidth } from './treemath.js';
import {
  computeLeafCount,
  findLeafIndexForUser,
  normalizeRoster,
  resizeNodes,
} from './treeState.js';

// local group state management
export const MLS_STATE_VERSION = 1;
// Prefix for keys in the ELD, the full key is this prefix + groupId
export const MLS_STATE_PREFIX = 'echo-mls:groupState:';
// Default cipher suite, for now we only support one
export const DEFAULT_MLS_CIPHER_SUITE = 'ECHO-MLS/X25519_AES256GCM_SHA256';

// builds storage key string for groupId
export function getGroupState(groupId) {
  return `${MLS_STATE_PREFIX}${groupId}`;
}

// picks which stored group key to use, uses stae.applicationSecretB64 if available
// falls back to state.groupKeyB64 for legacy support, throws if neither are available
export function resolveApplicationKey(state) {
  const applicationSecretB64 = typeof state?.applicationSecretB64 === 'string' && state.applicationSecretB64.length > 0
    ? state.applicationSecretB64
    : (
      typeof state?.groupKeyB64 === 'string' && state.groupKeyB64.length > 0
        ? state.groupKeyB64
        : null
    );

  if (!applicationSecretB64) {
    throw new Error(`Group state is missing application key material for group ${state?.groupId ?? ''}`);
  }

  return { applicationSecretB64, keyBytes: base64ToBytes(applicationSecretB64) };
}

// Normalize and sanitize group state ebfore being used or updated
export function normalizeGroupState(state) {

  // throw if missing state
  if (!state || typeof state !== 'object') {
    throw new Error('Invalid group state');
  }

  // normalize the roster and find the self leaf index
  const roster = normalizeRoster(state.roster);
  const selfLeafIndex = Number.isInteger(state.selfLeafIndex)
    ? state.selfLeafIndex
    : findLeafIndexForUser(roster, state.selfUserId);

  // computes the number of leaves
  const leafCount = computeLeafCount({
    roster,
    treeNodes: state.tree?.nodes,
    extraLeafIndex: selfLeafIndex,
  });

  // compute the width of the tree and resize the tree nodes to match
  // this will clean all nodes and ensure the tree has the correct number of nodes to represent the roster
  const width = nodeWidth(leafCount);
  const treeNodes = resizeNodes(state.tree?.nodes, width);

  // normalize sender generations, stringifies keys and if own generation key is missing
  // but applicationMessageCounter and selfLeafIndex are available, add self generation to the map
  const rawSenderGenerations = state.senderGenerations && typeof state.senderGenerations === 'object'
    ? state.senderGenerations
    : {};
  const senderGenerations = Object.fromEntries(
    Object.entries(rawSenderGenerations)
      .filter(([, value]) => Number.isInteger(value))
      .map(([key, value]) => [String(key), value]),
  );

  if (
    Number.isInteger(selfLeafIndex)
    && Number.isInteger(state.applicationMessageCounter)
    && senderGenerations[String(selfLeafIndex)] === undefined
  ) {
    senderGenerations[String(selfLeafIndex)] = state.applicationMessageCounter;
  }

  // Resolve applicationSecretB64 with fallback to groupKeyB64
  const applicationSecretB64 = state.applicationSecretB64 === null
    ? null
    : (
      typeof state.applicationSecretB64 === 'string' && state.applicationSecretB64.length > 0
        ? state.applicationSecretB64
        : (
          state.groupKeyB64 === null
            ? null
            : (
              typeof state.groupKeyB64 === 'string' && state.groupKeyB64.length > 0
                ? state.groupKeyB64
                : null
            )
        )
    );

  // Resolve initSecret with fallback to state.secrets.initSecretsB64
  const initSecretB64 = state.initSecretB64 === null
    ? null
    : (
      typeof state.initSecretB64 === 'string' && state.initSecretB64.length > 0
        ? state.initSecretB64
        : (
          state.secrets?.initSecretB64 === null
            ? null
            : (
              typeof state.secrets?.initSecretB64 === 'string' && state.secrets.initSecretB64.length > 0
                ? state.secrets.initSecretB64
                : null
            )
        )
    );

  // returns canonical state object with normalized roster, tree and keys, this is the format that the rest of the code expects
  // basically returns a cleaned up version of the input state with fallbacks
  return {
    stateVersion: state.stateVersion || MLS_STATE_VERSION,
    groupId: state.groupId,
    epoch: Number.isInteger(state.epoch) ? state.epoch : 0,
    cipherSuite: typeof state.cipherSuite === 'string' && state.cipherSuite.length > 0
      ? state.cipherSuite
      : DEFAULT_MLS_CIPHER_SUITE,
    selfUserId: state.selfUserId ?? null,
    selfLeafIndex,
    applicationSecretB64,
    initSecretB64,
    senderGenerations,
    roster,
    tree: { nodes: treeNodes },
    secrets: {
      initSecretB64,
      epochInitSecretB64: typeof state.secrets?.epochInitSecretB64 === 'string'
        ? state.secrets.epochInitSecretB64
        : null,
      epochCommitSecretB64: typeof state.secrets?.epochCommitSecretB64 === 'string'
        ? state.secrets.epochCommitSecretB64
        : null,
    },
    pendingCommits: Array.isArray(state.pendingCommits) ? state.pendingCommits : [],
    createdAt: state.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    groupKeyB64: applicationSecretB64,
    applicationMessageCounter: Number.isInteger(selfLeafIndex)
      ? (senderGenerations[String(selfLeafIndex)] ?? 0)
      : 0,
    leafSigningPrivKeyB64: typeof state.leafSigningPrivKeyB64 === 'string' && state.leafSigningPrivKeyB64.length > 0
      ? state.leafSigningPrivKeyB64 : null,
  };
}
