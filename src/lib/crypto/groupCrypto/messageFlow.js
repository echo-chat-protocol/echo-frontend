import { base64ToBytes, bytesToBase64 } from '../../helpers.js';

// Protocol Imports
import {
  decrypt_aad_bytes,
  encrypt_aad_bytes,
} from '@mascaro101/echo-protocol';

// Key schedule Imports
import { deriveAppKeyAndNonce } from '../keySchedule.js';
import {
  normalizeGroupState,
  resolveApplicationKey,
} from './groupState.js';
import {
  makeHeaderB64,
  makeHeaderBytes,
  MLS_HEADER_VERSION,
  normalizeBytes,
  normalizePlaintextBytes,
  parseHeader,
} from './pathSecrets.js';

// This is the function to encrypt application messages using the current epoch application secret
// and incrementing the sender generation for each message
export async function encryptApplicationMessage({ state, plaintextBytes, aadBytes }) {

  // normalize group state
  const normalizedState = normalizeGroupState(state);


  // validate groupId and selfLeafIndex
  if (!normalizedState.groupId) {
    throw new Error('Group state is missing groupId');
  }
  if (!Number.isInteger(normalizedState.selfLeafIndex)) {
    throw new Error(`Group state is missing selfLeafIndex for group ${normalizedState.groupId}`);
  }

  // derive the app key and nonce for this message using the current application secret, self leaf index and sender generation
  const { applicationSecretB64, keyBytes: appSecret } = resolveApplicationKey(normalizedState);

  // reads self current sender generation counter
  const generation = normalizedState.senderGenerations[String(normalizedState.selfLeafIndex)] ?? 0;
  const { key, nonce } = await deriveAppKeyAndNonce(
    appSecret,
    normalizedState.selfLeafIndex,
    generation,
  );

  // builds the header for this message, the header includes the groupId, epoch, sender leaf index, sender generation and cipher suite
  const header = {
    version: MLS_HEADER_VERSION,
    groupId: normalizedState.groupId,
    epoch: normalizedState.epoch,
    senderLeafIndex: normalizedState.selfLeafIndex,
    generation,
    cipherSuite: normalizedState.cipherSuite,
  };

  // Chooses AAD, if caller did not pass aadBytes it uses serialzied header bytes
  // otherwise normalizes provided aadBytes
  const resolvedAadBytes = aadBytes == null
    ? makeHeaderBytes(header)
    : normalizeBytes(aadBytes, 'aadBytes');

  // encrypts plaintext and base64 encodes the ciphertext
  const ciphertextB64 = bytesToBase64(
    encrypt_aad_bytes(normalizePlaintextBytes(plaintextBytes), key, nonce, resolvedAadBytes),
  );

  // creates new state where your sender generation is incremented by 1
  const newState = normalizeGroupState({
    ...normalizedState,
    senderGenerations: {
      ...normalizedState.senderGenerations,
      [String(normalizedState.selfLeafIndex)]: generation + 1,
    },
  });

  // returns headers, ciphertext and state
  return {
    header,
    headerB64: makeHeaderB64(header),
    ciphertextB64,
    nonceB64: null,
    newState: {
      ...newState,
      groupKeyB64: newState.applicationSecretB64,
    },
  };
}

// This is the function to decrypt application messages using the current epoch application secret
// and the sender generation in the message header
export async function decryptApplicationMessage({ state, header, ciphertext, aadBytes, includeNewState = false }) {

  // normalize group state and paarse header
  const normalizedState = normalizeGroupState(state);
  const parsedHeader = parseHeader(header);

  // Validate input fields
  if (!normalizedState.groupId) {
    throw new Error('Group state is missing groupId');
  }
  if (parsedHeader.version !== MLS_HEADER_VERSION) {
    throw new Error(`Unsupported MLS header version for group ${normalizedState.groupId}`);
  }
  if (String(parsedHeader.groupId ?? '') !== String(normalizedState.groupId)) {
    throw new Error(`MLS header groupId mismatch for group ${normalizedState.groupId}`);
  }
  if (!Number.isInteger(parsedHeader.senderLeafIndex)) {
    throw new Error(`MLS header is missing senderLeafIndex for group ${normalizedState.groupId}`);
  }
  if (!Number.isInteger(parsedHeader.generation)) {
    throw new Error(`MLS header is missing generation for group ${normalizedState.groupId}`);
  }
  if (Number.isInteger(parsedHeader.epoch) && parsedHeader.epoch !== normalizedState.epoch) {
    throw new Error(`MLS epoch mismatch for group ${normalizedState.groupId}`);
  }
  if (parsedHeader.cipherSuite && parsedHeader.cipherSuite !== normalizedState.cipherSuite) {
    throw new Error(`MLS cipher suite mismatch for group ${normalizedState.groupId}`);
  }
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    throw new Error(`MLS ciphertext is missing for group ${normalizedState.groupId}`);
  }

  // validate that the sender generation in the header matches the expected sender generation in the state for this sender
  // (protects against replay attacks)
  const expectedGeneration = normalizedState.senderGenerations[String(parsedHeader.senderLeafIndex)] ?? 0;
  if (parsedHeader.generation !== expectedGeneration) {
    throw new Error(
      `MLS generation mismatch for group ${normalizedState.groupId}: expected ${expectedGeneration}, got ${parsedHeader.generation}`,
    );
  }

  // Resolves the application secret form state
  const { keyBytes: appSecret } = resolveApplicationKey(normalizedState);

  // Derives message key + nonce
  const { key, nonce } = await deriveAppKeyAndNonce(
    appSecret,
    parsedHeader.senderLeafIndex,
    parsedHeader.generation,
  );

  // Chooses AAD, if caller did not pass aadBytes it uses serialzied header bytes
  const resolvedAadBytes = aadBytes == null
    ? makeHeaderBytes(parsedHeader)
    : normalizeBytes(aadBytes, 'aadBytes');

  // Decrypts the ciphertext using the derived key and nonce and the resolved AAD, returns plaintext bytes
  const plaintextBytes = decrypt_aad_bytes(base64ToBytes(ciphertext), key, nonce, resolvedAadBytes);
  if (!includeNewState) {
    return plaintextBytes;
  }

  // creates new state with nromalized group state and increments the sender generation for this sender
  const newState = normalizeGroupState({
    ...normalizedState,
    senderGenerations: {
      ...normalizedState.senderGenerations,
      [String(parsedHeader.senderLeafIndex)]: parsedHeader.generation + 1,
    },
  });

  // returns plaintext and new state with updated sender generation and group key (application secret)
  return {
    plaintextBytes,
    newState,
  };
}
