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

// Build initial welcome message recieved by each member when they are added to a group
export async function buildInitialWelcomes({ creatorState, roster, memberInitKeys }) {
  // Validate inputs and load state
  const state = normalizeGroupState(creatorState)
  // Use state.roster as the authoritative source since it carries leafSigningPubKeyB64.
  // Merge with the passed-in roster so any extra members are included, but signing keys
  // from the state always take precedence.
  const passedRoster = normalizeRoster(roster)
  const normalizedRoster = passedRoster.map((m) => {
    const inState = state.roster.find((s) => String(s.userId) === String(m.userId))
    return inState
      ? {
          ...m,
          leafSigningPubKeyB64: inState.leafSigningPubKeyB64 ?? m.leafSigningPubKeyB64 ?? null,
        }
      : m
  })
  const initSecretB64 = state.secrets.epochInitSecretB64
  const commitSecretB64 = state.secrets.epochCommitSecretB64

  // these secrets are required to build the welcome messages
  if (!initSecretB64 || !commitSecretB64) {
    throw new Error(`Creator state is missing epoch seed secrets for group ${state.groupId}`)
  }

  // builds commit AAD
  const aadBytes = makeCommitAadBytes(state.groupId, state.epoch)

  // collect current treePublicNodes
  const treePublicNodes = publicTreeSnapshot(state.tree.nodes)

  const welcomes = []
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

  // for each memvber (except creator) find that members initKeyB64 from memberInitKeys
  // encryps init secret for that member via wrapGroupKey
  // creates welcome message object with group metadata, roster, recipients info, encrypted secrets tree pk's
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

    // returns welcome array with one welcome per member
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
    }
    welcome.signature = await signWelcome(welcome, state.leafSigningPrivKeyB64)
    welcomes.push(welcome)
  }

  return welcomes
}

// Takes in the welcome packet and turns it into a users local group state
export async function processWelcome({ welcome, selfUserId = null, myInitPrivKeyB64 }) {
  // validates the welcome fields
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

  // builds AAD for unwrapping secrets
  const aadBytes = makeCommitAadBytes(welcome.groupId, welcome.epoch)

  // decrypt the init and commit secrets from the welcome using the recipients init private key
  const initSecret = await unwrapGroupKey(welcome.wrappedInitSecret, myInitPrivKeyB64, aadBytes)
  const commitSecret = await unwrapGroupKey(welcome.wrappedCommitSecret, myInitPrivKeyB64, aadBytes)

  // advance epoch using the decrypted secrets to derive the application secret for this user
  const { applicationSecret, nextInitSecret } = await advanceEpoch({
    initSecret: base64ToBytes(initSecret),
    commitSecret: base64ToBytes(commitSecret),
    groupId: welcome.groupId,
    epoch: welcome.epoch,
  })

  // Rebuild tree from welcome treePublicNodes and install the recipients init private key
  const treeNodes = makeTreeFromPublicNodes(welcome.treePublicNodes)
  installOwnLeafPrivateKey(treeNodes, welcome.recipientLeafIndex, myInitPrivKeyB64)

  // Generate leaf signing keypair for this member, this will be used for signing and verifying commits
  const { leafSigningPrivKeyB64, leafSigningPubKeyB64 } = await generateLeafSigningKeypair()
  const rosterWithSigningKey = normalizedRoster.map((m) =>
    String(m.userId) === String(selfUserId ?? welcome.recipientUserId)
      ? { ...m, leafSigningPubKeyB64 }
      : m
  )

  // return a normalized group state with epoch, roster, tree and derived secrets
  return normalizeGroupState({
    stateVersion: MLS_STATE_VERSION,
    groupId: welcome.groupId,
    epoch: Number.isInteger(welcome.epoch) ? welcome.epoch : 0,
    cipherSuite:
      typeof welcome.cipherSuite === 'string' && welcome.cipherSuite.length > 0
        ? welcome.cipherSuite
        : DEFAULT_MLS_CIPHER_SUITE,
    selfUserId: selfUserId ?? welcome.recipientUserId ?? null,
    selfLeafIndex: welcome.recipientLeafIndex,
    applicationSecretB64: bytesToBase64(applicationSecret),
    initSecretB64: bytesToBase64(nextInitSecret),
    senderGenerations: {},
    roster: rosterWithSigningKey,
    tree: { nodes: treeNodes },
    secrets: { initSecretB64: bytesToBase64(nextInitSecret) },
    pendingCommits: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    leafSigningPrivKeyB64,
  })
}
