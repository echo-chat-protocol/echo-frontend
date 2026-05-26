import { base64ToBytes, bytesToBase64 } from '../../helpers.js'

import init, {
  generate_public_ephemeral_key,
  encrypt_aad_bytes as encAad,
} from '@mascaro101/echo-protocol'

import { copath, directPath, leafNode, nodeWidth, resolution } from './treemath.js'

import {
  advanceEpoch,
  computeConfirmationTag,
  deriveJoinerSecret,
  verifyConfirmationTag,
} from '../keySchedule.js'
import { normalizeGroupState } from './groupState.js'
import {
  makeCommitAadBytes,
  makePathSecretAadBytes,
  randomBytes,
  unwrapPathSecret,
  wrapGroupKey,
  wrapPathSecret,
} from './pathSecrets.js'
import {
  applyLeafDataPatch,
  blankNodeAndPath,
  computeLeafCount,
  findLeafIndexForUser,
  installLeafPublicKeysFromMemberInitKeys,
  makeTreeFromPublicNodes,
  normalizeRoster,
  publicTreeSnapshot,
  resizeNodes,
  rosterFromLeafData,
} from './treeState.js'
import { encodeCommitForSigning, signCommit, signWelcome, verifyCommit } from './commitSigning.js'
import { verifyRosterCredentials } from './credential.js'
import {
  resolveInitKeyB64,
  resolveRosterIdentityFromKeyPackage,
  verifyKeyPackage,
} from './keyPackage.js'
import {
  computeTreeHash,
  advanceTranscriptHash,
  genesisTranscriptHash,
  computeNodeSubtreeHash,
  computeParentHash,
} from './groupContext.js'
import { createProposal, resolveProposalRefs } from './proposals.js'

import {
  deriveSecret,
  expandWithLabel,
  deriveWelcomeSecret,
  deriveWelcomeKeyAndNonce,
} from '../keySchedule.js'
import { LABEL_PATH, LABEL_NODE, LABEL_COMMIT } from './labels.js'

// Read the previous confirmed transcript hash from state.
async function resolvePrevTranscriptHash(state) {
  if (
    typeof state.confirmedTranscriptHashB64 === 'string' &&
    state.confirmedTranscriptHashB64.length > 0
  ) {
    return base64ToBytes(state.confirmedTranscriptHashB64)
  }
  return genesisTranscriptHash()
}

// Read the previous confirmation tag from state.
function resolvePrevConfirmationTag(state) {
  if (typeof state.confirmationTagB64 === 'string' && state.confirmationTagB64.length > 0) {
    return base64ToBytes(state.confirmationTagB64)
  }
  return new Uint8Array(32)
}

// Build the fresh path secrets and node keys for a commit path.
export async function buildUpdatePath(treeNodes, senderLeafIndex, leafCount) {
  await init()

  const senderNodeIndex = leafNode(senderLeafIndex)
  const pathNodes = [senderNodeIndex, ...directPath(senderNodeIndex, leafCount)]
  const copathNodes = copath(senderNodeIndex, leafCount)

  // Fresh random secret
  const pathSecrets = [randomBytes(32)]

  for (let i = 1; i < pathNodes.length; i++) {
    pathSecrets.push(await deriveSecret(pathSecrets[i - 1], LABEL_PATH))
  }

  const commitSecret = await deriveSecret(pathSecrets[pathSecrets.length - 1], LABEL_COMMIT)

  const updatePath = []
  for (let i = 0; i < pathNodes.length; i++) {
    const nodeIndex = pathNodes[i]
    const pathSecret = pathSecrets[i]
    const nodePrivBytes = await expandWithLabel(pathSecret, LABEL_NODE, new Uint8Array(0), 32)
    const nodePubBytes = generate_public_ephemeral_key(nodePrivBytes)

    const recipientNodeIndices = new Set()
    if (i === 0) recipientNodeIndices.add(senderNodeIndex)
    if (i < copathNodes.length) {
      for (const idx of resolution(treeNodes, copathNodes[i], leafCount)) {
        recipientNodeIndices.add(idx)
      }
    }

    const encryptedPathSecrets = []
    for (const recipientNodeIdx of recipientNodeIndices) {
      const recipientPubB64 = treeNodes[recipientNodeIdx]?.publicKeyB64
      if (!recipientPubB64) continue
      const wrapped = await wrapPathSecret(
        pathSecret,
        recipientPubB64,
        makePathSecretAadBytes(nodeIndex)
      )
      encryptedPathSecrets.push({ recipientNodeIdx, ...wrapped })
    }

    let parentHashB64 = null
    if (i < copathNodes.length) {
      // Bind each non-root path node to its sibling subtree.
      const siblingHash = await computeNodeSubtreeHash(treeNodes, copathNodes[i], leafCount)
      const phBytes = await computeParentHash(nodePubBytes, siblingHash)
      parentHashB64 = bytesToBase64(phBytes)
    }

    updatePath.push({
      nodeIndex,
      publicKeyB64: bytesToBase64(nodePubBytes),
      privateKeyB64: bytesToBase64(nodePrivBytes),
      parentHashB64,
      encryptedPathSecrets,
    })
  }

  return { updatePath, commitSecret }
}

// Apply the public part of the update path to a tree snapshot.
export function deriveCommitTree(treeNodes, updatePath, ownedLeafIndex, senderLeafIndex) {
  const nextTree = resizeNodes(treeNodes, treeNodes.length)
  for (const entry of updatePath) {
    nextTree[entry.nodeIndex] = {
      publicKeyB64: entry.publicKeyB64,
      privateKeyB64:
        Number.isInteger(ownedLeafIndex) &&
        ownedLeafIndex === senderLeafIndex &&
        typeof entry.privateKeyB64 === 'string'
          ? entry.privateKeyB64
          : null,
    }
  }
  return nextTree
}

// Recover the commit secret for the local member from the update path.
export async function applyUpdatePath(
  treeNodes,
  updatePath,
  senderLeafIndex,
  leafCount,
  myLeafIndex,
  myPrivKeyB64
) {
  const senderNodeIndex = leafNode(senderLeafIndex)
  const pathNodes = [senderNodeIndex, ...directPath(senderNodeIndex, leafCount)]
  const copathNodes = copath(senderNodeIndex, leafCount)

  for (const entry of updatePath) {
    treeNodes[entry.nodeIndex] = { publicKeyB64: entry.publicKeyB64, privateKeyB64: null }
  }

  const myNodeIdx = Number.isInteger(myLeafIndex) ? leafNode(myLeafIndex) : null
  if (
    !Number.isInteger(myNodeIdx) ||
    typeof myPrivKeyB64 !== 'string' ||
    myPrivKeyB64.length === 0
  ) {
    return null
  }

  const recoverAndVerify = async (decryptedPathSecret, pathIndex) => {
    // Re-derive each node key locally and compare it to the claimed path entry.
    let current = decryptedPathSecret
    for (let j = pathIndex; j < pathNodes.length; j++) {
      const nodePriv = await expandWithLabel(current, LABEL_NODE, new Uint8Array(0), 32)
      const nodePub = generate_public_ephemeral_key(nodePriv)
      const expectedPubB64 = bytesToBase64(nodePub)

      const pathEntry = updatePath.find((e) => e.nodeIndex === pathNodes[j])
      if (pathEntry?.publicKeyB64 && pathEntry.publicKeyB64 !== expectedPubB64) {
        throw new Error(`Node key mismatch at nodeIndex ${pathNodes[j]} — update path is invalid`)
      }

      if (pathEntry?.parentHashB64 && j < copathNodes.length) {
        const siblingHash = await computeNodeSubtreeHash(treeNodes, copathNodes[j], leafCount)
        const expectedPH = await computeParentHash(nodePub, siblingHash)
        const claimedPH = base64ToBytes(pathEntry.parentHashB64)
        if (
          claimedPH.length !== expectedPH.length ||
          !claimedPH.every((b, i) => b === expectedPH[i])
        ) {
          throw new Error(
            `Parent hash mismatch at nodeIndex ${pathNodes[j]} — tree state is inconsistent`
          )
        }
      }

      if (j + 1 < pathNodes.length) current = await deriveSecret(current, LABEL_PATH)
    }
    return deriveSecret(current, LABEL_COMMIT)
  }

  if (myLeafIndex === senderLeafIndex) {
    const selfEncrypted = updatePath[0]?.encryptedPathSecrets?.find(
      (e) => e.recipientNodeIdx === myNodeIdx
    )
    if (selfEncrypted) {
      let pathSecret
      try {
        pathSecret = await unwrapPathSecret(
          selfEncrypted,
          myPrivKeyB64,
          makePathSecretAadBytes(pathNodes[0])
        )
      } catch {
        /* proceed with undefined pathSecret if decryption fails */
      }
      if (pathSecret) return await recoverAndVerify(pathSecret, 0)
    }
  }

  for (let i = 0; i < copathNodes.length; i++) {
    const res = resolution(treeNodes, copathNodes[i], leafCount)
    if (!res.includes(myNodeIdx)) continue

    const encrypted = updatePath[i]?.encryptedPathSecrets?.find(
      (e) => e.recipientNodeIdx === myNodeIdx
    )
    if (!encrypted) continue

    let pathSecret
    try {
      pathSecret = await unwrapPathSecret(
        encrypted,
        myPrivKeyB64,
        makePathSecretAadBytes(pathNodes[i])
      )
    } catch {
      continue
    }

    return await recoverAndVerify(pathSecret, i)
  }

  return null
}

// Build an add commit for one new member.
export async function buildAddCommit({ state, newMember, memberInitKeys }) {
  const currentState = normalizeGroupState(state)
  const newMemberUserId = String(newMember?.userId ?? '')

  if (!newMemberUserId) throw new Error('New member for add commit is missing userId')
  if (!Number.isInteger(newMember?.leafIndex))
    throw new Error('New member for add commit is missing leafIndex')
  if (!currentState.initSecretB64) {
    throw new Error(`Group state is missing initSecretB64 for group ${currentState.groupId}`)
  }

  for (const entry of memberInitKeys ?? []) {
    if (entry.keyPackage) await verifyKeyPackage(entry.keyPackage)
  }

  const roster = normalizeRoster(currentState.roster)
  if (roster.some((m) => String(m.userId) === newMemberUserId)) {
    throw new Error(`Member ${newMemberUserId} already exists in group ${currentState.groupId}`)
  }

  const newMemberKeyPackage =
    memberInitKeys?.find((e) => String(e.userId) === newMemberUserId)?.keyPackage ?? null
  const newMemberIdentity = resolveRosterIdentityFromKeyPackage(newMemberKeyPackage)

  const addProposal = await createProposal(
    {
      type: 'add',
      groupId: currentState.groupId,
      epoch: currentState.epoch,
      senderLeafIndex: currentState.selfLeafIndex,
      keyPackage: newMemberKeyPackage,
    },
    currentState.leafSigningPrivKeyB64
  )

  const newLeafData = applyLeafDataPatch(currentState.tree.leafData, {
    [String(newMember.leafIndex)]: {
      userId: newMemberUserId,
      username: newMember?.username ?? 'Member',
      leafSigningPubKeyB64:
        newMemberIdentity?.leafSigningPubKeyB64 ?? newMember?.leafSigningPubKeyB64 ?? null,
      credential: newMemberIdentity?.credential ?? newMember?.credential ?? null,
    },
  })

  const newRoster = rosterFromLeafData(newLeafData)
  const nextEpoch = currentState.epoch + 1

  const leafCount = computeLeafCount({
    roster: newRoster,
    treeNodes: currentState.tree.nodes,
    extraLeafIndex: newMember.leafIndex,
  })

  const width = nodeWidth(leafCount)
  const newTree = resizeNodes(currentState.tree.nodes, width)
  installLeafPublicKeysFromMemberInitKeys(newTree, newRoster, memberInitKeys)

  const newMemberInitEntries = (memberInitKeys ?? []).filter((entry) =>
    entry.leafIndex != null
      ? entry.leafIndex === newMember.leafIndex
      : String(entry.userId) === newMemberUserId
  )
  const newMemberInitKeyB64 = resolveInitKeyB64(newMemberInitEntries[0])
  if (!newMemberInitKeyB64) {
    throw new Error(
      `Missing initKeyB64 for member ${newMemberUserId} — fetch their KeyPackage first`
    )
  }

  newTree[leafNode(newMember.leafIndex)] = {
    publicKeyB64: newMemberInitKeyB64,
    privateKeyB64: null,
  }
  blankNodeAndPath(newTree, newMember.leafIndex, leafCount)
  newTree[leafNode(newMember.leafIndex)] = {
    publicKeyB64: newMemberInitKeyB64,
    privateKeyB64: null,
  }

  const { updatePath, commitSecret } = await buildUpdatePath(
    newTree,
    currentState.selfLeafIndex,
    leafCount
  )

  const nextTree = deriveCommitTree(
    newTree,
    updatePath,
    currentState.selfLeafIndex,
    currentState.selfLeafIndex
  )
  const treePublicNodes = publicTreeSnapshot(nextTree)

  const treeHash = await computeTreeHash(treePublicNodes, leafCount, newLeafData)
  const prevTH = await resolvePrevTranscriptHash(currentState)
  const prevConfirmationTag = resolvePrevConfirmationTag(currentState)

  const senderRosterEntry = newRoster.find(
    (m) => String(m.userId) === String(currentState.selfUserId)
  )

  const commit = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    type: 'add',
    senderLeafIndex: currentState.selfLeafIndex,
    senderSigningPubKeyB64: senderRosterEntry?.leafSigningPubKeyB64 ?? null,
    targetUserId: newMemberUserId,
    targetLeafIndex: newMember.leafIndex,
    roster: newRoster,
    leafDataPatch: { [String(newMember.leafIndex)]: newLeafData[String(newMember.leafIndex)] },
    leafCount,
    treePublicNodes,
    updatePath: updatePath.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      publicKeyB64: entry.publicKeyB64,
      parentHashB64: entry.parentHashB64 ?? null,
      encryptedPathSecrets: entry.encryptedPathSecrets,
    })),
    proposalRefs: [addProposal.ref],
    proposals: [addProposal],
  }

  const commitBytes = encodeCommitForSigning(commit)
  const newConfirmedTH = await advanceTranscriptHash(prevTH, prevConfirmationTag, commitBytes)

  const {
    applicationSecret,
    nextInitSecret,
    epochSecret,
    senderDataSecret,
    externalSecret,
    membershipSecret,
    resumptionPsk,
  } = await advanceEpoch({
    initSecret: base64ToBytes(currentState.initSecretB64),
    commitSecret,
    groupId: currentState.groupId,
    epoch: nextEpoch,
    cipherSuite: currentState.cipherSuite,
    treeHash,
    confirmedTranscriptHash: newConfirmedTH,
  })

  const confirmationTag = await computeConfirmationTag(epochSecret, newConfirmedTH)
  commit.confirmedTranscriptHashB64 = bytesToBase64(newConfirmedTH)
  commit.confirmationTagB64 = bytesToBase64(confirmationTag)
  commit.signature = await signCommit(commit, currentState.leafSigningPrivKeyB64)

  const joinerSecret = await deriveJoinerSecret(
    base64ToBytes(currentState.initSecretB64),
    commitSecret
  )

  // Wrap the joiner secret for the new member, then encrypt the shared group info.
  const aadBytes = makeCommitAadBytes(currentState.groupId, nextEpoch)
  const TEXT_ENC = new TextEncoder()
  const groupSecretsPlaintext = JSON.stringify({ joinerSecretB64: bytesToBase64(joinerSecret) })

  const encryptGroupInfo = async (info) => {
    const ws = await deriveWelcomeSecret(joinerSecret)
    const { key, nonce } = await deriveWelcomeKeyAndNonce(ws)
    const pt = TEXT_ENC.encode(JSON.stringify(info))
    const ct = encAad(pt, key, nonce, new Uint8Array(0))
    return { encryptedB64: bytesToBase64(ct), nonceB64: bytesToBase64(nonce) }
  }

  const encryptedGroupInfo = await encryptGroupInfo({
    roster: newRoster,
    leafData: newLeafData,
    treePublicNodes,
    leafCount,
    confirmedTranscriptHashB64: bytesToBase64(newConfirmedTH),
    confirmationTagB64: bytesToBase64(confirmationTag),
    senderLeafIndex: currentState.selfLeafIndex,
    senderSigningPubKeyB64: senderRosterEntry?.leafSigningPubKeyB64 ?? null,
  })

  const welcomes = []
  const welcomeTargets = newMemberInitEntries.length > 0 ? newMemberInitEntries : [null]
  for (const initEntry of welcomeTargets) {
    const targetInitKeyB64 = resolveInitKeyB64(initEntry) ?? newMemberInitKeyB64
    const targetWrappedGroupSecrets = await wrapGroupKey(
      bytesToBase64(TEXT_ENC.encode(groupSecretsPlaintext)),
      targetInitKeyB64,
      aadBytes
    )
    const welcome = {
      groupId: currentState.groupId,
      epoch: nextEpoch,
      cipherSuite: currentState.cipherSuite,
      recipientUserId: newMemberUserId,
      recipientClientId: initEntry?.clientId ?? null,
      recipientLeafIndex: newMember.leafIndex,
      senderLeafIndex: currentState.selfLeafIndex,
      senderSigningPubKeyB64: senderRosterEntry?.leafSigningPubKeyB64 ?? null,
      encryptedGroupSecrets: targetWrappedGroupSecrets,
      encryptedGroupInfo,
    }
    welcome.signature = await signWelcome(welcome, currentState.leafSigningPrivKeyB64)
    welcomes.push(welcome)
  }

  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    roster: newRoster,
    applicationSecretB64: bytesToBase64(applicationSecret),
    senderDataSecretB64: bytesToBase64(senderDataSecret),
    externalSecretB64: bytesToBase64(externalSecret),
    membershipSecretB64: bytesToBase64(membershipSecret),
    resumptionPskB64: bytesToBase64(resumptionPsk),
    initSecretB64: bytesToBase64(nextInitSecret),
    confirmationTagB64: bytesToBase64(confirmationTag),
    confirmedTranscriptHashB64: bytesToBase64(newConfirmedTH),
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: nextTree, leafData: newLeafData },
    secrets: { initSecretB64: bytesToBase64(nextInitSecret) },
    pendingProposals: [],
  })

  return { commit, welcome: welcomes[0], welcomes, nextState }
}

// Build a remove commit for one target member.
export async function buildRemoveCommit({ state, targetUserId, memberInitKeys }) {
  const currentState = normalizeGroupState(state)
  const targetUserIdStr = String(targetUserId ?? '')

  if (!targetUserIdStr) throw new Error('Invalid targetUserId for remove commit')
  if (!currentState.initSecretB64) {
    throw new Error(`Group state is missing initSecretB64 for group ${currentState.groupId}`)
  }

  for (const entry of memberInitKeys ?? []) {
    if (entry.keyPackage) await verifyKeyPackage(entry.keyPackage)
  }

  const roster = normalizeRoster(currentState.roster)
  const targetMember = roster.find((m) => String(m.userId) === targetUserIdStr)
  if (!targetMember) throw new Error(`Target userId ${targetUserIdStr} not found in group roster`)

  const removeProposal = await createProposal(
    {
      type: 'remove',
      groupId: currentState.groupId,
      epoch: currentState.epoch,
      senderLeafIndex: currentState.selfLeafIndex,
      targetLeafIndex: targetMember.leafIndex,
      targetUserId: targetUserIdStr,
    },
    currentState.leafSigningPrivKeyB64
  )

  const newLeafData = applyLeafDataPatch(currentState.tree.leafData, {
    [String(targetMember.leafIndex)]: null,
  })

  const newRoster = rosterFromLeafData(newLeafData)
  const leafCount = computeLeafCount({
    roster,
    treeNodes: currentState.tree.nodes,
    extraLeafIndex: targetMember.leafIndex,
  })

  const newTree = resizeNodes(currentState.tree.nodes, nodeWidth(leafCount))
  installLeafPublicKeysFromMemberInitKeys(newTree, roster, memberInitKeys)
  blankNodeAndPath(newTree, targetMember.leafIndex, leafCount)

  const nextEpoch = currentState.epoch + 1
  const { updatePath, commitSecret } = await buildUpdatePath(
    newTree,
    currentState.selfLeafIndex,
    leafCount
  )

  const nextTree = deriveCommitTree(
    newTree,
    updatePath,
    currentState.selfLeafIndex,
    currentState.selfLeafIndex
  )
  const treePublicNodes = publicTreeSnapshot(nextTree)
  const treeHash = await computeTreeHash(treePublicNodes, leafCount, newLeafData)
  const prevTH = await resolvePrevTranscriptHash(currentState)
  const prevConfirmationTag = resolvePrevConfirmationTag(currentState)

  const senderRosterEntry = newRoster.find(
    (m) => String(m.userId) === String(currentState.selfUserId)
  )

  const commit = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    type: 'remove',
    senderLeafIndex: currentState.selfLeafIndex,
    senderSigningPubKeyB64: senderRosterEntry?.leafSigningPubKeyB64 ?? null,
    targetUserId: targetUserIdStr,
    targetLeafIndex: targetMember.leafIndex,
    roster: newRoster,
    leafDataPatch: { [String(targetMember.leafIndex)]: null },
    leafCount,
    treePublicNodes,
    updatePath: updatePath.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      publicKeyB64: entry.publicKeyB64,
      parentHashB64: entry.parentHashB64 ?? null,
      encryptedPathSecrets: entry.encryptedPathSecrets,
    })),
    proposalRefs: [removeProposal.ref],
    proposals: [removeProposal],
  }

  const commitBytes = encodeCommitForSigning(commit)
  const newConfirmedTH = await advanceTranscriptHash(prevTH, prevConfirmationTag, commitBytes)

  const {
    applicationSecret,
    nextInitSecret,
    epochSecret,
    senderDataSecret,
    externalSecret,
    membershipSecret,
    resumptionPsk,
  } = await advanceEpoch({
    initSecret: base64ToBytes(currentState.initSecretB64),
    commitSecret,
    groupId: currentState.groupId,
    epoch: nextEpoch,
    cipherSuite: currentState.cipherSuite,
    treeHash,
    confirmedTranscriptHash: newConfirmedTH,
  })

  const confirmationTag = await computeConfirmationTag(epochSecret, newConfirmedTH)
  commit.confirmedTranscriptHashB64 = bytesToBase64(newConfirmedTH)
  commit.confirmationTagB64 = bytesToBase64(confirmationTag)
  commit.signature = await signCommit(commit, currentState.leafSigningPrivKeyB64)

  const selfStillPresent = newRoster.some(
    (m) => String(m.userId) === String(currentState.selfUserId)
  )

  // A removed member keeps the new roster view but loses epoch secrets.
  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    roster: newRoster,
    selfLeafIndex: selfStillPresent ? currentState.selfLeafIndex : null,
    applicationSecretB64: selfStillPresent ? bytesToBase64(applicationSecret) : null,
    senderDataSecretB64: selfStillPresent ? bytesToBase64(senderDataSecret) : null,
    externalSecretB64: selfStillPresent ? bytesToBase64(externalSecret) : null,
    membershipSecretB64: selfStillPresent ? bytesToBase64(membershipSecret) : null,
    resumptionPskB64: selfStillPresent ? bytesToBase64(resumptionPsk) : null,
    initSecretB64: selfStillPresent ? bytesToBase64(nextInitSecret) : null,
    confirmationTagB64: selfStillPresent ? bytesToBase64(confirmationTag) : null,
    confirmedTranscriptHashB64: selfStillPresent ? bytesToBase64(newConfirmedTH) : null,
    treeHashB64: selfStillPresent ? bytesToBase64(treeHash) : null,
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: nextTree, leafData: newLeafData },
    secrets: { initSecretB64: selfStillPresent ? bytesToBase64(nextInitSecret) : null },
    pendingProposals: [],
  })

  return { commit, nextState }
}

// Build a self-update commit that rotates the sender leaf.
export async function buildUpdateCommit({
  state,
  newInitKeyB64,
  newInitPrivKeyB64,
  newLeafSigningPrivKeyB64,
  newLeafSigningPubKeyB64,
  memberInitKeys,
}) {
  const currentState = normalizeGroupState(state)

  const selfMemberEntry = memberInitKeys?.find(
    (entry) => String(entry.userId) === String(currentState.selfUserId)
  )
  const newKeyPackage = selfMemberEntry?.keyPackage ?? null
  if (newKeyPackage) {
    await verifyKeyPackage(newKeyPackage)
    if (String(newKeyPackage.userId) !== String(currentState.selfUserId)) {
      throw new Error(`Update KeyPackage userId mismatch for ${currentState.selfUserId}`)
    }
  }
  const effectiveNewInitKeyB64 = newKeyPackage?.initKeyB64 ?? newInitKeyB64
  const effectiveLeafSigningPubKeyB64 =
    newKeyPackage?.leafSigningPubKeyB64 ?? newLeafSigningPubKeyB64
  const effectiveCredential = newKeyPackage?.credential ?? null

  if (!currentState.initSecretB64) {
    throw new Error(`Group state is missing initSecretB64 for group ${currentState.groupId}`)
  }

  const updateProposal = await createProposal(
    {
      type: 'update',
      groupId: currentState.groupId,
      epoch: currentState.epoch,
      senderLeafIndex: currentState.selfLeafIndex,
      newInitKeyB64: effectiveNewInitKeyB64,
      newLeafSigningPubKeyB64: effectiveLeafSigningPubKeyB64,
      keyPackage: newKeyPackage,
    },
    currentState.leafSigningPrivKeyB64
  )

  const leafCount = computeLeafCount({
    roster: currentState.roster,
    treeNodes: currentState.tree.nodes,
  })
  const newTree = resizeNodes(currentState.tree.nodes, nodeWidth(leafCount))
  installLeafPublicKeysFromMemberInitKeys(newTree, currentState.roster, memberInitKeys ?? [])

  // Replace the sender leaf key material before building the new path.
  const selfNodeIdx = leafNode(currentState.selfLeafIndex)
  newTree[selfNodeIdx] = {
    publicKeyB64: effectiveNewInitKeyB64,
    privateKeyB64: newInitPrivKeyB64 ?? null,
  }

  const { updatePath, commitSecret } = await buildUpdatePath(
    newTree,
    currentState.selfLeafIndex,
    leafCount
  )
  const nextTree = deriveCommitTree(
    newTree,
    updatePath,
    currentState.selfLeafIndex,
    currentState.selfLeafIndex
  )
  const treePublicNodes = publicTreeSnapshot(nextTree)

  const newLeafData = applyLeafDataPatch(currentState.tree.leafData, {
    [String(currentState.selfLeafIndex)]: {
      ...(currentState.tree.leafData[String(currentState.selfLeafIndex)] ?? {}),
      leafSigningPubKeyB64: effectiveLeafSigningPubKeyB64,
      credential:
        effectiveCredential ??
        currentState.tree.leafData[String(currentState.selfLeafIndex)]?.credential ??
        null,
    },
  })
  const newRoster = rosterFromLeafData(newLeafData)
  const treeHash = await computeTreeHash(treePublicNodes, leafCount, newLeafData)

  const nextEpoch = currentState.epoch + 1
  const prevTH = await resolvePrevTranscriptHash(currentState)
  const prevConfirmationTag = resolvePrevConfirmationTag(currentState)

  const commit = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    type: 'update',
    senderLeafIndex: currentState.selfLeafIndex,
    senderSigningPubKeyB64: effectiveLeafSigningPubKeyB64,
    targetUserId: currentState.selfUserId,
    targetLeafIndex: currentState.selfLeafIndex,
    roster: newRoster,
    leafDataPatch: {
      [String(currentState.selfLeafIndex)]: newLeafData[String(currentState.selfLeafIndex)],
    },
    leafCount,
    treePublicNodes,
    updatePath: updatePath.map((e) => ({
      nodeIndex: e.nodeIndex,
      publicKeyB64: e.publicKeyB64,
      parentHashB64: e.parentHashB64 ?? null,
      encryptedPathSecrets: e.encryptedPathSecrets,
    })),
    proposalRefs: [updateProposal.ref],
    proposals: [updateProposal],
  }

  const commitBytes = encodeCommitForSigning(commit)
  const newConfirmedTH = await advanceTranscriptHash(prevTH, prevConfirmationTag, commitBytes)

  const {
    applicationSecret,
    nextInitSecret,
    epochSecret,
    senderDataSecret,
    externalSecret,
    membershipSecret,
    resumptionPsk,
  } = await advanceEpoch({
    initSecret: base64ToBytes(currentState.initSecretB64),
    commitSecret,
    groupId: currentState.groupId,
    epoch: nextEpoch,
    cipherSuite: currentState.cipherSuite,
    treeHash,
    confirmedTranscriptHash: newConfirmedTH,
  })

  const confirmationTag = await computeConfirmationTag(epochSecret, newConfirmedTH)
  commit.confirmedTranscriptHashB64 = bytesToBase64(newConfirmedTH)
  commit.confirmationTagB64 = bytesToBase64(confirmationTag)
  commit.signature = await signCommit(commit, newLeafSigningPrivKeyB64)

  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    roster: newRoster,
    applicationSecretB64: bytesToBase64(applicationSecret),
    senderDataSecretB64: bytesToBase64(senderDataSecret),
    externalSecretB64: bytesToBase64(externalSecret),
    membershipSecretB64: bytesToBase64(membershipSecret),
    resumptionPskB64: bytesToBase64(resumptionPsk),
    initSecretB64: bytesToBase64(nextInitSecret),
    confirmationTagB64: bytesToBase64(confirmationTag),
    confirmedTranscriptHashB64: bytesToBase64(newConfirmedTH),
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: nextTree, leafData: newLeafData },
    secrets: { initSecretB64: bytesToBase64(nextInitSecret) },
    leafSigningPrivKeyB64: newLeafSigningPrivKeyB64,
    pendingProposals: [],
  })

  return { commit, nextState }
}

// Build a ReInit commit that closes the current epoch lineage.
export async function buildReInitCommit({ state, newGroupId, newCipherSuite }) {
  const currentState = normalizeGroupState(state)

  const { createReInitProposal } = await import('./proposals.js')
  const reInitProposal = await createReInitProposal({
    state: currentState,
    newGroupId,
    newCipherSuite,
  })

  const leafCount = computeLeafCount({
    roster: currentState.roster,
    treeNodes: currentState.tree.nodes,
  })
  const commitSecret = randomBytes(32)
  const treePublicNodes = publicTreeSnapshot(currentState.tree.nodes)
  const treeHash = await computeTreeHash(treePublicNodes, leafCount, currentState.tree.leafData)
  const nextEpoch = currentState.epoch + 1
  const prevTH = await resolvePrevTranscriptHash(currentState)
  const prevConfirmationTag = resolvePrevConfirmationTag(currentState)

  const senderRosterEntry = currentState.roster.find(
    (m) => String(m.userId) === String(currentState.selfUserId)
  )

  const commit = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    type: 'reinit',
    senderLeafIndex: currentState.selfLeafIndex,
    senderSigningPubKeyB64: senderRosterEntry?.leafSigningPubKeyB64 ?? null,
    targetUserId: null,
    targetLeafIndex: null,
    roster: currentState.roster,
    leafDataPatch: {},
    leafCount,
    treePublicNodes,
    updatePath: [],
    proposalRefs: [reInitProposal.ref],
    proposals: [reInitProposal],
    newGroupId: newGroupId ?? currentState.groupId,
    newCipherSuite: newCipherSuite ?? currentState.cipherSuite,
  }

  const commitBytes = encodeCommitForSigning(commit)
  const newConfirmedTH = await advanceTranscriptHash(prevTH, prevConfirmationTag, commitBytes)

  const { epochSecret } = await advanceEpoch({
    initSecret: base64ToBytes(currentState.initSecretB64),
    commitSecret,
    groupId: currentState.groupId,
    epoch: nextEpoch,
    cipherSuite: currentState.cipherSuite,
    treeHash,
    confirmedTranscriptHash: newConfirmedTH,
  })

  const confirmationTag = await computeConfirmationTag(epochSecret, newConfirmedTH)
  commit.confirmedTranscriptHashB64 = bytesToBase64(newConfirmedTH)
  commit.confirmationTagB64 = bytesToBase64(confirmationTag)
  commit.signature = await signCommit(commit, currentState.leafSigningPrivKeyB64)

  // ReInit leaves the group shell in place but clears the old epoch secrets.
  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    applicationSecretB64: null,
    senderDataSecretB64: null,
    externalSecretB64: null,
    initSecretB64: null,
    confirmationTagB64: null,
    reInit: true,
    pendingProposals: [],
  })

  return { commit, nextState, newGroupId: newGroupId ?? currentState.groupId }
}

// Verify and apply one incoming commit to local state.
export async function applyCommit({ state, commit, myInitPrivKeyB64 }) {
  const currentState = normalizeGroupState(state)

  if (!commit || typeof commit !== 'object') throw new Error('Invalid commit')
  if (String(commit.groupId ?? '') !== String(currentState.groupId)) {
    throw new Error('Commit groupId mismatch')
  }
  if (commit.epoch !== currentState.epoch + 1) throw new Error('Invalid commit epoch')
  if (!Array.isArray(commit.updatePath)) throw new Error('Commit is missing updatePath')

  if (!commit.confirmationTagB64) {
    throw new Error('Commit is missing confirmation tag — rejecting to fail closed')
  }

  let resolvedProposals = []
  if (Array.isArray(commit.proposalRefs) && commit.proposalRefs.length > 0) {
    // Proposal refs can resolve from inline proposals or locally pending ones.
    resolvedProposals = resolveProposalRefs(
      commit.proposalRefs,
      commit.proposals,
      currentState.pendingProposals
    )
  }

  const senderEntry = normalizeRoster(currentState.roster).find(
    (m) => m.leafIndex === commit.senderLeafIndex
  )
  if (!senderEntry?.leafSigningPubKeyB64) {
    throw new Error(`No signing pub key for commit sender at leafIndex ${commit.senderLeafIndex}`)
  }
  let commitVerifyKeyB64 = senderEntry.leafSigningPubKeyB64
  if (
    commit.senderSigningPubKeyB64 &&
    commit.senderSigningPubKeyB64 !== senderEntry.leafSigningPubKeyB64
  ) {
    if (commit.type !== 'update') {
      throw new Error('Commit sender signing pub key mismatch')
    }
    const updateProposal = resolvedProposals.find((proposal) => proposal.type === 'update')
    const proposedSigningKeyB64 =
      updateProposal?.keyPackage?.leafSigningPubKeyB64 ??
      updateProposal?.newLeafSigningPubKeyB64 ??
      commit.leafDataPatch?.[String(commit.targetLeafIndex)]?.leafSigningPubKeyB64 ??
      null
    if (!proposedSigningKeyB64 || proposedSigningKeyB64 !== commit.senderSigningPubKeyB64) {
      throw new Error('Commit sender signing pub key mismatch')
    }
    commitVerifyKeyB64 = proposedSigningKeyB64
  }

  await verifyCommit(commit, commitVerifyKeyB64)

  if (commit.type === 'add') {
    const addProposal = resolvedProposals.find((proposal) => proposal.type === 'add')
    const addPatch = commit.leafDataPatch?.[String(commit.targetLeafIndex)]
    if (addProposal?.keyPackage && addPatch) {
      if (String(addPatch.userId) !== String(addProposal.keyPackage.userId)) {
        throw new Error('Add commit leafData userId mismatch')
      }
      if (addPatch.leafSigningPubKeyB64 !== addProposal.keyPackage.leafSigningPubKeyB64) {
        throw new Error('Add commit signing pub key mismatch')
      }
      if (
        JSON.stringify(addPatch.credential ?? null) !==
        JSON.stringify(addProposal.keyPackage.credential ?? null)
      ) {
        throw new Error('Add commit credential mismatch')
      }
    }
  }

  if (commit.type === 'update') {
    const updateProposal = resolvedProposals.find((proposal) => proposal.type === 'update')
    const updatePatch = commit.leafDataPatch?.[String(commit.targetLeafIndex)]
    if (updateProposal?.keyPackage && updatePatch) {
      if (String(updatePatch.userId) !== String(updateProposal.keyPackage.userId)) {
        throw new Error('Update commit leafData userId mismatch')
      }
      if (updatePatch.leafSigningPubKeyB64 !== updateProposal.keyPackage.leafSigningPubKeyB64) {
        throw new Error('Update commit signing pub key mismatch')
      }
      if (
        JSON.stringify(updatePatch.credential ?? null) !==
        JSON.stringify(updateProposal.keyPackage.credential ?? null)
      ) {
        throw new Error('Update commit credential mismatch')
      }
    }
  }

  const newLeafData = applyLeafDataPatch(currentState.tree.leafData, commit.leafDataPatch ?? {})
  const newRoster =
    rosterFromLeafData(newLeafData).length > 0
      ? rosterFromLeafData(newLeafData)
      : normalizeRoster(commit.roster ?? [])

  // Commits are authoritative for tree state, but roster can still migrate from commit.roster.
  await verifyRosterCredentials(newRoster.filter((m) => m.credential))

  const leafCount = Number.isInteger(commit.leafCount)
    ? commit.leafCount
    : computeLeafCount({
        roster: newRoster,
        treeNodes: currentState.tree.nodes,
        extraLeafIndex: commit.targetLeafIndex,
      })

  const baseTree = Array.isArray(commit.treePublicNodes)
    ? makeTreeFromPublicNodes(commit.treePublicNodes, currentState.tree.nodes)
    : resizeNodes(currentState.tree.nodes, nodeWidth(leafCount))
  const candidateTree = [...baseTree]

  const selfLeafIndex = findLeafIndexForUser(newRoster, currentState.selfUserId)

  const commitSecret = await applyUpdatePath(
    candidateTree,
    commit.updatePath,
    commit.senderLeafIndex,
    leafCount,
    selfLeafIndex,
    myInitPrivKeyB64
  )

  const prevTH = await resolvePrevTranscriptHash(currentState)
  const prevConfirmationTag = resolvePrevConfirmationTag(currentState)
  const commitBytes = encodeCommitForSigning(commit)
  const expectedTH = await advanceTranscriptHash(prevTH, prevConfirmationTag, commitBytes)

  if (commit.confirmedTranscriptHashB64) {
    const claimedTH = base64ToBytes(commit.confirmedTranscriptHashB64)
    if (claimedTH.length !== expectedTH.length || !claimedTH.every((b, i) => b === expectedTH[i])) {
      throw new Error('Transcript hash mismatch — commit may be replayed or out of order')
    }
  }

  const treePublicNodes = Array.isArray(commit.treePublicNodes)
    ? commit.treePublicNodes
    : publicTreeSnapshot(candidateTree)
  const treeHash = await computeTreeHash(treePublicNodes, leafCount, newLeafData)

  const nextEpochSecrets =
    commitSecret && currentState.initSecretB64
      ? await advanceEpoch({
          initSecret: base64ToBytes(currentState.initSecretB64),
          commitSecret,
          groupId: currentState.groupId,
          epoch: commit.epoch,
          cipherSuite: currentState.cipherSuite,
          treeHash,
          confirmedTranscriptHash: expectedTH,
        })
      : null

  if (nextEpochSecrets && commit.confirmationTagB64) {
    await verifyConfirmationTag(
      nextEpochSecrets.epochSecret,
      expectedTH,
      base64ToBytes(commit.confirmationTagB64)
    )
  }

  if (commit.type === 'reinit') {
    return normalizeGroupState({
      ...currentState,
      epoch: commit.epoch,
      roster: newRoster,
      applicationSecretB64: null,
      senderDataSecretB64: null,
      externalSecretB64: null,
      initSecretB64: null,
      confirmationTagB64: null,
      reInit: true,
      tree: { nodes: candidateTree, leafData: newLeafData },
      pendingProposals: [],
    })
  }

  return normalizeGroupState({
    ...currentState,
    epoch: commit.epoch,
    roster: newRoster,
    selfLeafIndex,
    applicationSecretB64: nextEpochSecrets
      ? bytesToBase64(nextEpochSecrets.applicationSecret)
      : null,
    senderDataSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.senderDataSecret) : null,
    externalSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.externalSecret) : null,
    membershipSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.membershipSecret) : null,
    resumptionPskB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.resumptionPsk) : null,
    initSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.nextInitSecret) : null,
    confirmationTagB64: commit.confirmationTagB64 ?? null,
    confirmedTranscriptHashB64: bytesToBase64(expectedTH),
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: candidateTree, leafData: newLeafData },
    secrets: {
      initSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.nextInitSecret) : null,
    },
    pendingProposals: [],
  })
}
