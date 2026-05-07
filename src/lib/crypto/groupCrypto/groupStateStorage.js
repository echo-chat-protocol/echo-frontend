import eld from '../../../../../../utils/storage/EncryptedLocalDatabase.js';
import { bytesToBase64 } from '../../helpers.js';

// Key schedule Imports
import { advanceEpoch } from '../keySchedule.js';
import {
  DEFAULT_MLS_CIPHER_SUITE,
  getGroupState,
  MLS_STATE_VERSION,
  normalizeGroupState,
} from './groupState.js';
import { randomBytes } from './pathSecrets.js';
import {
  findLeafIndexForUser,
  initTreeFromRoster,
  normalizeRoster,
} from './treeState.js';
import { generateLeafSigningKeypair } from './commitSigning.js';

// Validates, normalizes and persits one groups MLS state in the ELD
export async function saveGroupState(groupId, state) {
  if (!eld.isUnlocked()) {
    throw new Error('ELD must be unlocked before saving group state');
  }

  const normalized = normalizeGroupState({ ...state, groupId });
  await eld.storeMlsGroupState(groupId, {
    id: getGroupState(groupId),
    groupId,
    state: normalized,
  });

  return normalized;
}

// Loads and validates one groups MLS state from the ELD
export async function loadGroupState(groupId) {
  if (!eld.isUnlocked()) {
    throw new Error('ELD must be unlocked before loading group state');
  }

  const record = await eld.getMlsGroupState(groupId);
  if (!record?.state) return null;

  if (record.state.stateVersion !== MLS_STATE_VERSION) {
    throw new Error(`Incompatible group state version for group ${groupId}`);
  }

  return normalizeGroupState(record.state);
}

// Creates new group state
export async function createNewGroupState({
  groupId,
  creatorUserId,
  roster,
  cipherSuite = DEFAULT_MLS_CIPHER_SUITE,
  memberInitKeys = [],
  selfInitPrivKeyB64 = null,
}) {

  // normalize the roster and find the leaf index for the creator user
  const normalizedRoster = normalizeRoster(roster);
  const selfLeafIndex = findLeafIndexForUser(normalizedRoster, creatorUserId);

  // generate two random seed secrets for epoch 0
  const initSecret0 = randomBytes(32);
  const commitSecret0 = randomBytes(32);

  // advance the epoch using the generated secrets to derive the initial application secret and the
  // next init secret for the group
  const { applicationSecret, nextInitSecret } = await advanceEpoch({
    initSecret: initSecret0,
    commitSecret: commitSecret0,
    groupId,
    epoch: 0,
  });

  // build the initial tree nodes for epoch 0 using the roster and the creator leaf index and init key
  const treeNodes = await initTreeFromRoster(
    normalizedRoster,
    selfLeafIndex,
    selfInitPrivKeyB64,
    memberInitKeys,
  );

  // generate leaf signing keypair for the creator
  const { leafSigningPrivKeyB64, leafSigningPubKeyB64 } = await generateLeafSigningKeypair();

  // add the creator's signing pub key to their roster entry
  const rosterWithSigningKeys = normalizedRoster.map((m) =>
    String(m.userId) === String(creatorUserId)
      ? { ...m, leafSigningPubKeyB64 }
      : m,
  );

  // return and save the initial group state, this will be the state for epoch 0
  return saveGroupState(groupId, {
    stateVersion: MLS_STATE_VERSION,
    groupId,
    epoch: 0,
    cipherSuite,
    selfUserId: creatorUserId,
    selfLeafIndex,
    applicationSecretB64: bytesToBase64(applicationSecret),
    initSecretB64: bytesToBase64(nextInitSecret),
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
