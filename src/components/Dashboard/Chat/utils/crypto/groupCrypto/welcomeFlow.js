import { base64ToBytes, bytesToBase64 } from '../../helpers.js'

import { decrypt_aad_bytes, encrypt_aad_bytes } from '@mascaro101/echo-protocol'

import {
  deriveEpochSecrets,
  deriveJoinerSecret,
  deriveWelcomeSecret,
  deriveWelcomeKeyAndNonce,
} from '../keySchedule.js'
import { DEFAULT_MLS_CIPHER_SUITE, MLS_STATE_VERSION, normalizeGroupState } from './groupState.js'
import { makeCommitAadBytes, unwrapGroupKey, wrapGroupKey } from './pathSecrets.js'
import {
  computeLeafCount,
  installOwnLeafPrivateKey,
  makeTreeFromPublicNodes,
  normalizeLeafData,
  normalizeRoster,
  publicTreeSnapshot,
  rosterFromLeafData,
} from './treeState.js'
import { generateLeafSigningKeypair, signWelcome, verifyWelcome } from './commitSigning.js'
import { issueCredential, verifyRosterCredentials } from './credential.js'
import { computeTreeHash, genesisTranscriptHash } from './groupContext.js'
import {
  resolveInitKeyB64,
  resolveRosterIdentityFromKeyPackage,
  verifyKeyPackage,
} from './keyPackage.js'

const TEXT_ENCODER = new TextEncoder()

// GroupInfo is encrypted under keys derived from the joiner secret.
async function encryptGroupInfo(groupInfo, joinerSecret) {
  const welcomeSecret = await deriveWelcomeSecret(joinerSecret)
  const { key, nonce } = await deriveWelcomeKeyAndNonce(welcomeSecret)
  const plaintext = TEXT_ENCODER.encode(JSON.stringify(groupInfo))
  const encrypted = encrypt_aad_bytes(plaintext, key, nonce, new Uint8Array(0))
  return { encryptedB64: bytesToBase64(encrypted), nonceB64: bytesToBase64(nonce) }
}

// Decrypt the shared group snapshot from a welcome message.
async function decryptGroupInfo(encryptedGroupInfo, joinerSecret) {
  const welcomeSecret = await deriveWelcomeSecret(joinerSecret)
  const { key, nonce } = await deriveWelcomeKeyAndNonce(welcomeSecret)
  const encrypted = base64ToBytes(encryptedGroupInfo.encryptedB64)
  const decrypted = decrypt_aad_bytes(encrypted, key, nonce, new Uint8Array(0))
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decrypted))
}

// Build one welcome message per joiner from the creator state.
export async function buildInitialWelcomes({ creatorState, roster, memberInitKeys }) {
  const state = normalizeGroupState(creatorState)

  for (const entry of memberInitKeys ?? []) {
    if (entry?.keyPackage) await verifyKeyPackage(entry.keyPackage)
  }

  const passedRoster = normalizeRoster(roster)
  const normalizedRoster = passedRoster.map((m) => {
    // Match by leafIndex first so device leaves don't inherit primary's signing key.
    const inState = state.roster.find((s) =>
      Number.isInteger(m.leafIndex) && Number.isInteger(s.leafIndex)
        ? s.leafIndex === m.leafIndex
        : String(s.userId) === String(m.userId)
    )
    const keyPackage = memberInitKeys?.find((entry) =>
      entry.leafIndex != null
        ? entry.leafIndex === m.leafIndex
        : String(entry.userId) === String(m.userId)
    )?.keyPackage
    const kpIdentity = resolveRosterIdentityFromKeyPackage(keyPackage)
    return inState
      ? {
          ...m,
          leafSigningPubKeyB64:
            inState.leafSigningPubKeyB64 ??
            kpIdentity?.leafSigningPubKeyB64 ??
            m.leafSigningPubKeyB64 ??
            null,
          credential: inState.credential ?? kpIdentity?.credential ?? m.credential ?? null,
        }
      : {
          ...m,
          leafSigningPubKeyB64: kpIdentity?.leafSigningPubKeyB64 ?? m.leafSigningPubKeyB64 ?? null,
          credential: kpIdentity?.credential ?? m.credential ?? null,
        }
  })

  const initSecretB64 = state.secrets.epochInitSecretB64
  const commitSecretB64 = state.secrets.epochCommitSecretB64
  if (!initSecretB64 || !commitSecretB64) {
    throw new Error(`Creator state is missing epoch seed secrets for group ${state.groupId}`)
  }

  const joinerSecret = await deriveJoinerSecret(
    base64ToBytes(initSecretB64),
    base64ToBytes(commitSecretB64)
  )

  const aadBytes = makeCommitAadBytes(state.groupId, state.epoch)
  const treePublicNodes = publicTreeSnapshot(state.tree.nodes)
  const leafCount = computeLeafCount({ roster: normalizedRoster, treeNodes: state.tree.nodes })

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

  const mergedLeafData = { ...state.tree.leafData }
  for (const member of normalizedRoster) {
    mergedLeafData[String(member.leafIndex)] = {
      ...(mergedLeafData[String(member.leafIndex)] ?? {}),
      userId: member.userId,
      username: member.username,
      leafSigningPubKeyB64: member.leafSigningPubKeyB64 ?? null,
      credential: member.credential ?? null,
    }
  }

  const groupInfo = {
    roster: normalizedRoster,
    leafData: mergedLeafData,
    treePublicNodes,
    leafCount,
    confirmedTranscriptHashB64: state.confirmedTranscriptHashB64 ?? null,
    confirmationTagB64: state.confirmationTagB64 ?? null,
    senderLeafIndex: state.selfLeafIndex,
    senderSigningPubKeyB64: senderRosterEntry.leafSigningPubKeyB64,
  }

  const welcomes = []
  for (const member of normalizedRoster) {
    // Skip creator's own leaf only; device leaves (same userId, different leafIndex) do get Welcomes.
    if (
      String(member.userId) === String(state.selfUserId) &&
      member.leafIndex === state.selfLeafIndex
    )
      continue

    // Look up by leafIndex first (multi-device support), fall back to userId.
    const initKeyEntry = memberInitKeys?.find((entry) =>
      entry.leafIndex != null
        ? entry.leafIndex === member.leafIndex
        : String(entry.userId) === String(member.userId)
    )
    const initKeyB64 = resolveInitKeyB64(initKeyEntry)
    if (!initKeyB64) {
      throw new Error(
        `Missing initKeyB64 for member ${member.userId} leaf ${member.leafIndex} — fetch their KeyPackage before building Welcomes`
      )
    }

    const groupSecretsPlaintext = JSON.stringify({ joinerSecretB64: bytesToBase64(joinerSecret) })
    const wrappedGroupSecrets = await wrapGroupKey(
      bytesToBase64(TEXT_ENCODER.encode(groupSecretsPlaintext)),
      initKeyB64,
      aadBytes
    )

    const encryptedGroupInfo = await encryptGroupInfo(groupInfo, joinerSecret)

    const welcome = {
      groupId: state.groupId,
      epoch: state.epoch,
      cipherSuite: state.cipherSuite,
      recipientUserId: member.userId,
      recipientClientId: initKeyEntry?.clientId ?? null,
      recipientLeafIndex: member.leafIndex,
      senderLeafIndex: state.selfLeafIndex,
      senderSigningPubKeyB64: senderRosterEntry.leafSigningPubKeyB64,
      encryptedGroupSecrets: wrappedGroupSecrets,
      encryptedGroupInfo,
    }
    welcome.signature = await signWelcome(welcome, state.leafSigningPrivKeyB64)
    welcomes.push(welcome)
  }

  return welcomes
}

// Consume a welcome and rebuild the local state for that epoch.
export async function processWelcome({
  welcome,
  selfUserId = null,
  myInitPrivKeyB64,
  myKeyPackage = null,
  myLeafSigningPrivKeyB64 = null,
}) {
  if (!welcome || typeof welcome !== 'object') throw new Error('Invalid welcome')
  if (typeof welcome.groupId !== 'string' || welcome.groupId.length === 0) {
    throw new Error('Welcome is missing groupId')
  }
  if (!Number.isInteger(welcome.recipientLeafIndex)) {
    throw new Error(`Welcome is missing recipientLeafIndex for group ${welcome.groupId}`)
  }
  if (!myInitPrivKeyB64) throw new Error('myInitPrivKeyB64 required to process welcome')

  if (!welcome.encryptedGroupSecrets || !welcome.encryptedGroupInfo) {
    throw new Error(`Welcome is missing encrypted fields for group ${welcome.groupId}`)
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

  try {
    // Verify the sender before decrypting any welcome payloads.
    await verifyWelcome(welcome, welcome.senderSigningPubKeyB64)
  } catch (error) {
    if (error?.message === 'Welcome missing signature or signing pub key') {
      throw error
    }
    throw new Error('Welcome signature invalid')
  }

  const aadBytes = makeCommitAadBytes(welcome.groupId, welcome.epoch)
  const groupSecretsRaw = await unwrapGroupKey(
    welcome.encryptedGroupSecrets,
    myInitPrivKeyB64,
    aadBytes
  )
  const groupSecretsText = new TextDecoder('utf-8', { fatal: true }).decode(
    base64ToBytes(groupSecretsRaw)
  )
  const { joinerSecretB64 } = JSON.parse(groupSecretsText)
  const joinerSecret = base64ToBytes(joinerSecretB64)

  const groupInfo = await decryptGroupInfo(welcome.encryptedGroupInfo, joinerSecret)
  const effectiveSelfUserId = selfUserId ?? welcome.recipientUserId

  if (myKeyPackage) {
    // When a KeyPackage is provided, bind the welcome to that expected identity.
    await verifyKeyPackage(myKeyPackage)
    if (String(myKeyPackage.userId) !== String(effectiveSelfUserId)) {
      throw new Error(`KeyPackage userId mismatch for welcome recipient ${effectiveSelfUserId}`)
    }
    if (typeof myLeafSigningPrivKeyB64 !== 'string' || myLeafSigningPrivKeyB64.length === 0) {
      throw new Error('myLeafSigningPrivKeyB64 required when processing welcome with myKeyPackage')
    }
  }

  if (
    groupInfo.senderSigningPubKeyB64 &&
    welcome.senderSigningPubKeyB64 !== groupInfo.senderSigningPubKeyB64
  ) {
    throw new Error('Welcome sender signing pub key mismatch')
  }

  const otherMembers = (groupInfo.roster ?? []).filter(
    (m) => String(m.userId) !== String(selfUserId ?? welcome.recipientUserId) && m.credential
  )
  await verifyRosterCredentials(otherMembers)

  const treeNodes = makeTreeFromPublicNodes(groupInfo.treePublicNodes ?? [])
  installOwnLeafPrivateKey(treeNodes, welcome.recipientLeafIndex, myInitPrivKeyB64)

  const treePublicNodes = Array.isArray(groupInfo.treePublicNodes)
    ? groupInfo.treePublicNodes
    : publicTreeSnapshot(treeNodes)

  const leafCount =
    groupInfo.leafCount ?? computeLeafCount({ roster: groupInfo.roster ?? [], treeNodes })
  const resolvedLeafData = normalizeLeafData(groupInfo.leafData ?? {})

  if (myKeyPackage) {
    const recipientLeafData = resolvedLeafData[String(welcome.recipientLeafIndex)]
    if (!recipientLeafData) {
      throw new Error(`Welcome groupInfo is missing recipient leafData for ${effectiveSelfUserId}`)
    }
    if (String(recipientLeafData.userId) !== String(effectiveSelfUserId)) {
      throw new Error('Welcome recipient userId mismatch')
    }
    if (
      recipientLeafData.leafSigningPubKeyB64 &&
      recipientLeafData.leafSigningPubKeyB64 !== myKeyPackage.leafSigningPubKeyB64
    ) {
      throw new Error('Welcome recipient signing pub key mismatch')
    }
    if (recipientLeafData.credential) {
      const actual = JSON.stringify(recipientLeafData.credential)
      const expected = JSON.stringify(myKeyPackage.credential ?? null)
      if (actual !== expected) {
        throw new Error('Welcome recipient credential mismatch')
      }
    }
  }

  const treeHash = await computeTreeHash(treePublicNodes, leafCount, resolvedLeafData)

  const confirmedTranscriptHash = groupInfo.confirmedTranscriptHashB64
    ? base64ToBytes(groupInfo.confirmedTranscriptHashB64)
    : await genesisTranscriptHash()

  const cipherSuite =
    typeof welcome.cipherSuite === 'string' && welcome.cipherSuite.length > 0
      ? welcome.cipherSuite
      : DEFAULT_MLS_CIPHER_SUITE

  const {
    applicationSecret: appSec,
    senderDataSecret: sdSec,
    externalSecret: extSec,
    membershipSecret: memberSec,
    resumptionPsk: resumptionPskBytes,
    nextInitSecret: nextInit,
  } = await deriveEpochSecrets(joinerSecret, {
    groupId: welcome.groupId,
    epoch: welcome.epoch,
    cipherSuite,
    treeHash,
    confirmedTranscriptHash,
  })

  let leafSigningPrivKeyB64
  let leafSigningPubKeyB64
  let credential
  if (myKeyPackage) {
    leafSigningPrivKeyB64 = myLeafSigningPrivKeyB64
    leafSigningPubKeyB64 = myKeyPackage.leafSigningPubKeyB64
    credential = myKeyPackage.credential ?? null
  } else {
    // Older callers can still generate a local signing identity on welcome.
    const generated = await generateLeafSigningKeypair()
    leafSigningPrivKeyB64 = generated.leafSigningPrivKeyB64
    leafSigningPubKeyB64 = generated.leafSigningPubKeyB64
    credential = await issueCredential(
      effectiveSelfUserId,
      leafSigningPrivKeyB64,
      leafSigningPubKeyB64
    )
  }

  const leafData = { ...resolvedLeafData }
  // Always write the local leaf from the recipient view before building state.
  leafData[String(welcome.recipientLeafIndex)] = {
    userId: effectiveSelfUserId,
    username: leafData[String(welcome.recipientLeafIndex)]?.username ?? 'Member',
    leafSigningPubKeyB64,
    credential,
  }

  const roster = rosterFromLeafData(leafData)

  // Rebuild the full local MLS state for the joined epoch.
  return normalizeGroupState({
    stateVersion: MLS_STATE_VERSION,
    groupId: welcome.groupId,
    epoch: Number.isInteger(welcome.epoch) ? welcome.epoch : 0,
    cipherSuite,
    selfUserId: effectiveSelfUserId,
    selfLeafIndex: welcome.recipientLeafIndex,
    applicationSecretB64: bytesToBase64(appSec),
    senderDataSecretB64: bytesToBase64(sdSec),
    externalSecretB64: bytesToBase64(extSec),
    membershipSecretB64: bytesToBase64(memberSec),
    resumptionPskB64: bytesToBase64(resumptionPskBytes),
    initSecretB64: bytesToBase64(nextInit),
    confirmationTagB64: groupInfo.confirmationTagB64 ?? null,
    confirmedTranscriptHashB64: groupInfo.confirmedTranscriptHashB64 ?? null,
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    roster,
    tree: { nodes: treeNodes, leafData },
    secrets: { initSecretB64: bytesToBase64(nextInit) },
    pendingCommits: [],
    pendingProposals: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    leafSigningPrivKeyB64,
  })
}
