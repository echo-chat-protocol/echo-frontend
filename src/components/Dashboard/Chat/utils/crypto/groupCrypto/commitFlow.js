import { base64ToBytes, bytesToBase64 } from '../../helpers.js'

// Protocol Imports
import init, { generate_public_ephemeral_key } from '@mascaro101/echo-protocol'

// TreeKEM math Imports
import { copath, directPath, leafNode, nodeWidth, resolution } from './treemath.js'

// Key schedule Imports
import { advanceEpoch, computeConfirmationTag, verifyConfirmationTag } from '../keySchedule.js'
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
  blankNodeAndPath,
  computeLeafCount,
  findLeafIndexForUser,
  installLeafPublicKeysFromMemberInitKeys,
  makeTreeFromPublicNodes,
  normalizeRoster,
  publicTreeSnapshot,
  resizeNodes,
} from './treeState.js'
import { encodeCommitForSigning, signCommit, signWelcome, verifyCommit } from './commitSigning.js'
import { verifyRosterCredentials } from './credential.js'
import { verifyKeyPackage } from './keyPackage.js'
import {
  computeTreeHash,
  advanceTranscriptHash,
  genesisTranscriptHash,
  computeNodeSubtreeHash,
  computeParentHash,
} from './groupContext.js'

// Returns prevTH bytes: from state if available, otherwise genesis.
async function resolvePrevTranscriptHash(state) {
  if (
    typeof state.confirmedTranscriptHashB64 === 'string' &&
    state.confirmedTranscriptHashB64.length > 0
  ) {
    return base64ToBytes(state.confirmedTranscriptHashB64)
  }
  return genesisTranscriptHash(state.groupId)
}

// Builds the update path for a given sender.
// Generates new path secrets for each node in the direct path and encrypts
// them for the appropriate copath recipients.
export async function buildUpdatePath(treeNodes, senderLeafIndex, leafCount) {
  await init()

  const senderNodeIndex = leafNode(senderLeafIndex)
  const pathNodes = [senderNodeIndex, ...directPath(senderNodeIndex, leafCount)]
  const copathNodes = copath(senderNodeIndex, leafCount)

  // Random path secret for the leaf; each parent derives from the one below.
  const pathSecrets = [randomBytes(32)]
  for (let index = 1; index < pathNodes.length; index++) {
    const { deriveSecret } = await import('../keySchedule.js')
    pathSecrets.push(await deriveSecret(pathSecrets[index - 1], 'path'))
  }

  const { deriveSecret, expandWithLabel } = await import('../keySchedule.js')
  const commitSecret = await deriveSecret(pathSecrets[pathSecrets.length - 1], 'path')

  const updatePath = []
  for (let index = 0; index < pathNodes.length; index++) {
    const nodeIndex = pathNodes[index]
    const pathSecret = pathSecrets[index]
    const nodePrivBytes = await expandWithLabel(pathSecret, 'node', new Uint8Array(0), 32)
    const nodePubBytes = generate_public_ephemeral_key(nodePrivBytes)

    const recipientNodeIndices = new Set()
    if (index === 0) recipientNodeIndices.add(senderNodeIndex)

    if (index < copathNodes.length) {
      for (const recipientNodeIdx of resolution(treeNodes, copathNodes[index], leafCount)) {
        recipientNodeIndices.add(recipientNodeIdx)
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

    // parent_hash = SHA-256(nodePub || subtreeHash(copathNodes[index]))
    // Binds this node's public key to the state of its copath sibling subtree.
    // treeNodes is still the pre-commit tree here (buildUpdatePath never writes to it).
    let parentHashB64 = null
    if (index < copathNodes.length) {
      const siblingHash = await computeNodeSubtreeHash(treeNodes, copathNodes[index], leafCount)
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

// Builds the post-commit tree snapshot from an existing tree + update path.
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

// Apply new pk path nodes into your local tree and try to recover the commitSecret.
// After decrypting a path secret, re-derives all ancestor path secrets and verifies:
//   1. Each claimed node publicKeyB64 matches the key derived from the path secret.
//   2. Each claimed parentHashB64 matches SHA-256(nodePub || subtreeHash(copathSibling)).
// This closes the gap where a sender could claim arbitrary parent public keys without
// holding the corresponding private keys or respecting the copath binding.
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

  const { deriveSecret, expandWithLabel } = await import('../keySchedule.js')

  // Re-derives all path secrets upward from pathIndex, verifies each claimed node key
  // and parent hash, then returns the commit secret. Throws on any mismatch so callers
  // treat a verified decryption failure differently from a security violation.
  const recoverAndVerify = async (decryptedPathSecret, pathIndex) => {
    let current = decryptedPathSecret
    for (let j = pathIndex; j < pathNodes.length; j++) {
      const nodePriv = await expandWithLabel(current, 'node', new Uint8Array(0), 32)
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

      if (j + 1 < pathNodes.length) {
        current = await deriveSecret(current, 'path')
      }
    }
    return deriveSecret(current, 'path')
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
        /* decryption failed, fall through */
      }
      if (pathSecret) return await recoverAndVerify(pathSecret, 0)
    }
  }

  for (let index = 0; index < copathNodes.length; index++) {
    const res = resolution(treeNodes, copathNodes[index], leafCount)
    if (!res.includes(myNodeIdx)) continue

    const encrypted = updatePath[index]?.encryptedPathSecrets?.find(
      (e) => e.recipientNodeIdx === myNodeIdx
    )
    if (!encrypted) continue

    let pathSecret
    try {
      pathSecret = await unwrapPathSecret(
        encrypted,
        myPrivKeyB64,
        makePathSecretAadBytes(pathNodes[index])
      )
    } catch {
      continue
    } // wrong key — try next copath position

    // Decryption succeeded: verification errors must propagate (not be silenced).
    return await recoverAndVerify(pathSecret, index)
  }

  return null
}

// Builds the commit and welcome for adding a new member to the group.
export async function buildAddCommit({ state, newMember, memberInitKeys }) {
  const currentState = normalizeGroupState(state)
  const newMemberUserId = String(newMember?.userId ?? '')

  if (!newMemberUserId) throw new Error('New member for add commit is missing userId')
  if (!Number.isInteger(newMember?.leafIndex)) {
    throw new Error('New member for add commit is missing leafIndex')
  }
  if (!currentState.initSecretB64) {
    throw new Error(`Group state is missing initSecretB64 for group ${currentState.groupId}`)
  }

  // Verify any KeyPackages present in memberInitKeys before touching their keys.
  for (const entry of memberInitKeys ?? []) {
    if (entry.keyPackage) {
      await verifyKeyPackage(entry.keyPackage)
    }
  }

  const roster = normalizeRoster(currentState.roster)
  if (roster.some((member) => String(member.userId) === newMemberUserId)) {
    throw new Error(`Member ${newMemberUserId} already exists in group ${currentState.groupId}`)
  }

  const newRoster = normalizeRoster([
    ...roster,
    {
      userId: newMemberUserId,
      username: newMember?.username ?? '',
      leafIndex: newMember.leafIndex,
    },
  ])

  const nextEpoch = currentState.epoch + 1
  const leafCount = computeLeafCount({
    roster: newRoster,
    treeNodes: currentState.tree.nodes,
    extraLeafIndex: newMember.leafIndex,
  })

  const width = nodeWidth(leafCount)
  const newTree = resizeNodes(currentState.tree.nodes, width)
  installLeafPublicKeysFromMemberInitKeys(newTree, newRoster, memberInitKeys)

  const newMemberInitKeyB64 = memberInitKeys?.find(
    (entry) => String(entry.userId) === newMemberUserId
  )?.initKeyB64
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
  const treeHash = await computeTreeHash(treePublicNodes)
  const prevTH = await resolvePrevTranscriptHash(currentState)

  const senderRosterEntry = newRoster.find(
    (m) => String(m.userId) === String(currentState.selfUserId)
  )

  // Build commit with all fields set before computing transcript hash.
  const commit = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    type: 'add',
    senderLeafIndex: currentState.selfLeafIndex,
    senderSigningPubKeyB64: senderRosterEntry?.leafSigningPubKeyB64 ?? null,
    targetUserId: newMemberUserId,
    targetLeafIndex: newMember.leafIndex,
    roster: newRoster,
    leafCount,
    treePublicNodes,
    updatePath: updatePath.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      publicKeyB64: entry.publicKeyB64,
      parentHashB64: entry.parentHashB64 ?? null,
      encryptedPathSecrets: entry.encryptedPathSecrets,
    })),
    proposalRefs: [],
  }

  // Transcript hash is computed over the commit content (encodeCommitForSigning does not
  // include confirmedTranscriptHashB64 or confirmationTagB64, so it's non-circular).
  const commitBytes = encodeCommitForSigning(commit)
  const newConfirmedTH = await advanceTranscriptHash(prevTH, commitBytes)

  // Advance epoch with full GroupContext so epochSecret is bound to tree + transcript.
  const { applicationSecret, nextInitSecret, epochSecret } = await advanceEpoch({
    initSecret: base64ToBytes(currentState.initSecretB64),
    commitSecret,
    groupId: currentState.groupId,
    epoch: nextEpoch,
    cipherSuite: currentState.cipherSuite,
    treeHash,
    confirmedTranscriptHash: newConfirmedTH,
  })

  // Confirmation tag proves sender derived the same epoch secrets as receivers will.
  const confirmationTag = await computeConfirmationTag(epochSecret, newConfirmedTH)
  commit.confirmedTranscriptHashB64 = bytesToBase64(newConfirmedTH)
  commit.confirmationTagB64 = bytesToBase64(confirmationTag)
  commit.signature = await signCommit(commit, currentState.leafSigningPrivKeyB64)

  const aadBytes = makeCommitAadBytes(currentState.groupId, nextEpoch)
  const wrappedInitSecret = await wrapGroupKey(
    currentState.initSecretB64,
    newMemberInitKeyB64,
    aadBytes
  )
  const wrappedCommitSecret = await wrapGroupKey(
    bytesToBase64(commitSecret),
    newMemberInitKeyB64,
    aadBytes
  )

  const welcome = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    cipherSuite: currentState.cipherSuite,
    roster: newRoster,
    recipientUserId: newMemberUserId,
    recipientLeafIndex: newMember.leafIndex,
    leafCount,
    senderLeafIndex: currentState.selfLeafIndex,
    senderSigningPubKeyB64: senderRosterEntry?.leafSigningPubKeyB64 ?? null,
    wrappedInitSecret,
    wrappedCommitSecret,
    treePublicNodes,
    confirmedTranscriptHashB64: bytesToBase64(newConfirmedTH),
  }
  welcome.signature = await signWelcome(welcome, currentState.leafSigningPrivKeyB64)

  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    roster: newRoster,
    applicationSecretB64: bytesToBase64(applicationSecret),
    initSecretB64: bytesToBase64(nextInitSecret),
    confirmedTranscriptHashB64: bytesToBase64(newConfirmedTH),
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: nextTree },
    secrets: { initSecretB64: bytesToBase64(nextInitSecret) },
  })

  return { commit, welcome, nextState }
}

// Creates the next-epoch commit for removing a member from the group.
export async function buildRemoveCommit({ state, targetUserId, memberInitKeys }) {
  const currentState = normalizeGroupState(state)
  const targetUserIdStr = String(targetUserId ?? '')

  if (!targetUserIdStr) throw new Error('Invalid targetUserId for remove commit')
  if (!currentState.initSecretB64) {
    throw new Error(`Group state is missing initSecretB64 for group ${currentState.groupId}`)
  }

  // Verify any KeyPackages present in memberInitKeys.
  for (const entry of memberInitKeys ?? []) {
    if (entry.keyPackage) {
      await verifyKeyPackage(entry.keyPackage)
    }
  }

  const roster = normalizeRoster(currentState.roster)
  const targetMember = roster.find((member) => String(member.userId) === targetUserIdStr)
  if (!targetMember) {
    throw new Error(`Target userId ${targetUserIdStr} not found in group roster`)
  }

  const newRoster = roster.filter((member) => String(member.userId) !== targetUserIdStr)
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
  const treeHash = await computeTreeHash(treePublicNodes)
  const prevTH = await resolvePrevTranscriptHash(currentState)

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
    leafCount,
    treePublicNodes,
    updatePath: updatePath.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      publicKeyB64: entry.publicKeyB64,
      parentHashB64: entry.parentHashB64 ?? null,
      encryptedPathSecrets: entry.encryptedPathSecrets,
    })),
    proposalRefs: [],
  }

  const commitBytes = encodeCommitForSigning(commit)
  const newConfirmedTH = await advanceTranscriptHash(prevTH, commitBytes)

  const { applicationSecret, nextInitSecret, epochSecret } = await advanceEpoch({
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
    (member) => String(member.userId) === String(currentState.selfUserId)
  )

  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    roster: newRoster,
    selfLeafIndex: selfStillPresent ? currentState.selfLeafIndex : null,
    applicationSecretB64: selfStillPresent ? bytesToBase64(applicationSecret) : null,
    initSecretB64: selfStillPresent ? bytesToBase64(nextInitSecret) : null,
    confirmedTranscriptHashB64: selfStillPresent ? bytesToBase64(newConfirmedTH) : null,
    treeHashB64: selfStillPresent ? bytesToBase64(treeHash) : null,
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: nextTree },
    secrets: {
      initSecretB64: selfStillPresent ? bytesToBase64(nextInitSecret) : null,
    },
  })

  return { commit, nextState }
}

// Applies a received commit to derive the next local epoch state.
export async function applyCommit({ state, commit, myInitPrivKeyB64 }) {
  const currentState = normalizeGroupState(state)

  if (!commit || typeof commit !== 'object') throw new Error('Invalid commit')
  if (String(commit.groupId ?? '') !== String(currentState.groupId)) {
    throw new Error('Commit groupId mismatch')
  }
  if (commit.epoch !== currentState.epoch + 1) {
    throw new Error('Invalid commit epoch')
  }
  if (!Array.isArray(commit.roster)) throw new Error('Commit is missing roster')
  if (!Array.isArray(commit.updatePath)) throw new Error('Commit is missing updatePath')

  // Confirmation tag is mandatory — reject commits that omit it (fail closed).
  if (!commit.confirmationTagB64) {
    throw new Error('Commit is missing confirmation tag — rejecting to fail closed')
  }

  // Look up sender in the CURRENT roster (before applying the commit).
  const senderEntry = normalizeRoster(currentState.roster).find(
    (m) => m.leafIndex === commit.senderLeafIndex
  )
  if (!senderEntry?.leafSigningPubKeyB64) {
    throw new Error(`No signing pub key for commit sender at leafIndex ${commit.senderLeafIndex}`)
  }
  if (
    commit.senderSigningPubKeyB64 &&
    commit.senderSigningPubKeyB64 !== senderEntry.leafSigningPubKeyB64
  ) {
    throw new Error('Commit sender signing pub key mismatch')
  }

  // Verify commit signature. encodeCommitForSigning does not include confirmedTranscriptHashB64
  // or confirmationTagB64, so the signature is stable whether or not those fields are present.
  await verifyCommit(commit, senderEntry.leafSigningPubKeyB64)

  // Verify all credentials in the incoming roster.
  await verifyRosterCredentials(commit.roster)

  const leafCount = Number.isInteger(commit.leafCount)
    ? commit.leafCount
    : computeLeafCount({
        roster: commit.roster,
        treeNodes: currentState.tree.nodes,
        extraLeafIndex: commit.targetLeafIndex,
      })

  const treeNodes = Array.isArray(commit.treePublicNodes)
    ? makeTreeFromPublicNodes(commit.treePublicNodes, currentState.tree.nodes)
    : resizeNodes(currentState.tree.nodes, nodeWidth(leafCount))

  const selfLeafIndex = findLeafIndexForUser(commit.roster, currentState.selfUserId)

  const commitSecret = await applyUpdatePath(
    treeNodes,
    commit.updatePath,
    commit.senderLeafIndex,
    leafCount,
    selfLeafIndex,
    myInitPrivKeyB64
  )

  // Compute the transcript hash from our current state and the received commit bytes.
  // This must match what the committer claimed.
  const prevTH = await resolvePrevTranscriptHash(currentState)
  const commitBytes = encodeCommitForSigning(commit)
  const expectedTH = await advanceTranscriptHash(prevTH, commitBytes)

  if (commit.confirmedTranscriptHashB64) {
    const claimedTH = base64ToBytes(commit.confirmedTranscriptHashB64)
    if (claimedTH.length !== expectedTH.length || !claimedTH.every((b, i) => b === expectedTH[i])) {
      throw new Error('Transcript hash mismatch — commit may be replayed or out of order')
    }
  }

  // Compute tree hash from the commit's public tree.
  const treePublicNodes = Array.isArray(commit.treePublicNodes)
    ? commit.treePublicNodes
    : publicTreeSnapshot(treeNodes)
  const treeHash = await computeTreeHash(treePublicNodes)

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

  // Verify the confirmation tag if we were able to derive the epoch secrets.
  if (nextEpochSecrets && commit.confirmationTagB64) {
    await verifyConfirmationTag(
      nextEpochSecrets.epochSecret,
      expectedTH,
      base64ToBytes(commit.confirmationTagB64)
    )
  }

  return normalizeGroupState({
    ...currentState,
    epoch: commit.epoch,
    roster: commit.roster,
    selfLeafIndex,
    applicationSecretB64: nextEpochSecrets
      ? bytesToBase64(nextEpochSecrets.applicationSecret)
      : null,
    initSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.nextInitSecret) : null,
    confirmedTranscriptHashB64: bytesToBase64(expectedTH),
    treeHashB64: bytesToBase64(treeHash),
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: treeNodes },
    secrets: {
      initSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.nextInitSecret) : null,
    },
  })
}
