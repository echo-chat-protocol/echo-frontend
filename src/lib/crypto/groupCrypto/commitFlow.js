import { base64ToBytes, bytesToBase64 } from '../../helpers.js'

// Protocol Imports
import init, { generate_public_ephemeral_key } from '@mascaro101/echo-protocol'

// TreeKEM math Imports
import { copath, directPath, leafNode, nodeWidth, resolution } from './treemath.js'

// Key schedule Imports
import { advanceEpoch, deriveSecret, expandWithLabel } from '../keySchedule.js'
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

import { signCommit, verifyCommit } from './commitSigning.js'

// This function builds the update path for a given sender
// it generates new path secrets for each node in the direct path
// and encrypts them for the appropriate recipients
export async function buildUpdatePath(treeNodes, senderLeafIndex, leafCount) {
  // initialize crypto, this will load the WASM module
  await init()

  // compute the direct path and copath nodes for the sender, these are used to determine which nodes
  // need to be updated and which recipients need to be sent the new path secrets
  const senderNodeIndex = leafNode(senderLeafIndex)
  const pathNodes = [senderNodeIndex, ...directPath(senderNodeIndex, leafCount)]
  const copathNodes = copath(senderNodeIndex, leafCount)

  // generate a random path secret for each node in the direct path, the path secret for each node
  // is derived from the previous one, this creates a chain of secrets that can be used to efficiently
  // update the tree and derive the new epoch secret for the commit, the final ps is the commit secret for the new epoch
  const pathSecrets = [randomBytes(32)]
  for (let index = 1; index < pathNodes.length; index++) {
    pathSecrets.push(await deriveSecret(pathSecrets[index - 1], 'path'))
  }

  // the commit secret for the new epoch is derived from the last ps, this is the secret that will be used to derive
  // the epoch secret and the application secret for the new epoch
  const commitSecret = await deriveSecret(pathSecrets[pathSecrets.length - 1], 'path')

  // for each node in the direct path, encrypt the corresponding ps for the appropriate recipients
  // the recipients for each node are determined by the copath, for the first node it's just the sender
  // for the rest it's the siblings of the nodes in the direct path
  const updatePath = []
  for (let index = 0; index < pathNodes.length; index++) {
    const nodeIndex = pathNodes[index]
    const pathSecret = pathSecrets[index]
    const nodePrivBytes = await expandWithLabel(pathSecret, 'node', new Uint8Array(0), 32)
    const nodePubBytes = generate_public_ephemeral_key(nodePrivBytes)

    // the recipients for this node are determined by the copath, for the first node it's just the sender
    const recipientNodeIndices = new Set()
    if (index === 0) recipientNodeIndices.add(senderNodeIndex)

    // The recipients are the siblings of the nodes in the direct path, which are determined by the copath
    if (index < copathNodes.length) {
      for (const recipientNodeIdx of resolution(treeNodes, copathNodes[index], leafCount)) {
        recipientNodeIndices.add(recipientNodeIdx)
      }
    }

    // Encrypt the path secret for each recipient, the AAD for this encryption is the node index
    const encryptedPathSecrets = []
    for (const recipientNodeIdx of recipientNodeIndices) {
      const recipientPubB64 = treeNodes[recipientNodeIdx]?.publicKeyB64
      if (!recipientPubB64) continue

      const wrapped = await wrapPathSecret(
        pathSecret,
        recipientPubB64,
        makePathSecretAadBytes(nodeIndex)
      )

      encryptedPathSecrets.push({
        recipientNodeIdx,
        ...wrapped,
      })
    }

    // add the new public key for this node and the encrypted path secrets to the update path,
    // the private key is only included if the sender is also the recipient of this node update
    updatePath.push({
      nodeIndex,
      publicKeyB64: bytesToBase64(nodePubBytes),
      privateKeyB64: bytesToBase64(nodePrivBytes),
      encryptedPathSecrets,
    })
  }

  return { updatePath, commitSecret }
}

// buids the post commit tree snapshot from an existing tree + update path
export function deriveCommitTree(treeNodes, updatePath, ownedLeafIndex, senderLeafIndex) {
  // the nextTree is resized to match the current tree
  const nextTree = resizeNodes(treeNodes, treeNodes.length)

  // for each node in the update path, replace the corresponding node in the tree with the new pk and
  // include the new sk if the sender is also the recipient of this node update, otherwise set sk to null
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

// Apply new pk path nodes into your local tree and try to recover the commitSecret for this commit
export async function applyUpdatePath(
  treeNodes,
  updatePath,
  senderLeafIndex,
  leafCount,
  myLeafIndex,
  myPrivKeyB64
) {
  // compute sender path geometry
  const senderNodeIndex = leafNode(senderLeafIndex)
  const pathNodes = [senderNodeIndex, ...directPath(senderNodeIndex, leafCount)]
  const copathNodes = copath(senderNodeIndex, leafCount)

  // for each entry in updatePath sets pkB64 to entry.pkB64 and skB64 to null
  for (const entry of updatePath) {
    treeNodes[entry.nodeIndex] = {
      publicKeyB64: entry.publicKeyB64,
      privateKeyB64: null,
    }
  }

  // verify we can decrypt (if missing or invalid returns null)
  const myNodeIdx = Number.isInteger(myLeafIndex) ? leafNode(myLeafIndex) : null
  if (
    !Number.isInteger(myNodeIdx) ||
    typeof myPrivKeyB64 !== 'string' ||
    myPrivKeyB64.length === 0
  ) {
    return null
  }

  // internal helper, decrypts one encrypted ps with unwrapPsAaadBytes then repeatedly derives up the path
  // final extra derive fives the commitSecret
  const decryptCommitSecretFromPath = async (pathIndex, encrypted) => {
    const pathSecret = await unwrapPathSecret(
      encrypted,
      myPrivKeyB64,
      makePathSecretAadBytes(pathNodes[pathIndex])
    )

    let current = pathSecret
    for (let index = pathIndex + 1; index < pathNodes.length; index++) {
      current = await deriveSecret(current, 'path')
    }
    return deriveSecret(current, 'path')
  }

  // if you are the sender try to decrypt the self-targeted encrypted entry from updatePath[0]
  if (myLeafIndex === senderLeafIndex) {
    const selfEncrypted = updatePath[0]?.encryptedPathSecrets?.find(
      (entry) => entry.recipientNodeIdx === myNodeIdx
    )
    if (selfEncrypted) {
      try {
        return await decryptCommitSecretFromPath(0, selfEncrypted)
      } catch {
        return null
      }
    }
  }

  // If not sender, for each copath level check if you node is in resolution, find encrypted entry for your ndoe
  // try decrypting and deriving commitSecret
  for (let index = 0; index < copathNodes.length; index++) {
    const res = resolution(treeNodes, copathNodes[index], leafCount)
    if (!res.includes(myNodeIdx)) continue

    const encrypted = updatePath[index]?.encryptedPathSecrets?.find(
      (entry) => entry.recipientNodeIdx === myNodeIdx
    )
    if (!encrypted) continue

    try {
      return await decryptCommitSecretFromPath(index, encrypted)
    } catch {
      return null
    }
  }

  return null
}

// builds the commit and welcome messages for adding a new member to the group
export async function buildAddCommit({ state, newMember, memberInitKeys }) {
  // Validate inputs and load state
  const currentState = normalizeGroupState(state)
  const newMemberUserId = String(newMember?.userId ?? '')

  // validates the new member fields and checks that the new member is not already in the roster
  if (!newMemberUserId) throw new Error('New member for add commit is missing userId')
  if (!Number.isInteger(newMember?.leafIndex)) {
    throw new Error('New member for add commit is missing leafIndex')
  }
  if (!currentState.initSecretB64) {
    throw new Error(`Group state is missing initSecretB64 for group ${currentState.groupId}`)
  }

  // normalize roster and check if new member is already in the roster
  const roster = normalizeRoster(currentState.roster)
  if (roster.some((member) => String(member.userId) === newMemberUserId)) {
    throw new Error(`Member ${newMemberUserId} already exists in group ${currentState.groupId}`)
  }

  // build new roster with the new member added
  const newRoster = normalizeRoster([
    ...roster,
    {
      userId: newMemberUserId,
      username: newMember?.username ?? '',
      leafIndex: newMember.leafIndex,
    },
  ])

  // recompute tree size
  const nextEpoch = currentState.epoch + 1
  const leafCount = computeLeafCount({
    roster: newRoster,
    treeNodes: currentState.tree.nodes,
    extraLeafIndex: newMember.leafIndex,
  })

  // resize the tree to fit the new leaf count, this will clone the existing nodes and
  // add null nodes for the new leaf if needed, then install any pk init keys
  const width = nodeWidth(leafCount)
  const newTree = resizeNodes(currentState.tree.nodes, width)
  installLeafPublicKeysFromMemberInitKeys(newTree, newRoster, memberInitKeys)

  // find the new member initKeyB64 from memberInitKeys, this is required to add the new member to the tree
  const newMemberInitKeyB64 = memberInitKeys?.find(
    (entry) => String(entry.userId) === newMemberUserId
  )?.initKeyB64
  if (!newMemberInitKeyB64) {
    throw new Error(
      `Missing initKeyB64 for member ${newMemberUserId} — fetch their KeyPackage first`
    )
  }

  // install the new members pk in their leaf node
  newTree[leafNode(newMember.leafIndex)] = {
    publicKeyB64: newMemberInitKeyB64,
    privateKeyB64: null,
  }

  // clears that leaf + ancestor path so old path are invalidated
  blankNodeAndPath(newTree, newMember.leafIndex, leafCount)

  // re-installs the new members leaf public key
  newTree[leafNode(newMember.leafIndex)] = {
    publicKeyB64: newMemberInitKeyB64,
    privateKeyB64: null,
  }

  // builds sender update path with new tree
  const { updatePath, commitSecret } = await buildUpdatePath(
    newTree,
    currentState.selfLeafIndex,
    leafCount
  )

  // advances the epoch to derive the new epoch secrets based on the commit secret from the update path
  const { applicationSecret, nextInitSecret } = await advanceEpoch({
    initSecret: base64ToBytes(currentState.initSecretB64),
    commitSecret,
    groupId: currentState.groupId,
    epoch: nextEpoch,
  })

  // builds post commit tree snapshot
  const nextTree = deriveCommitTree(
    newTree,
    updatePath,
    currentState.selfLeafIndex,
    currentState.selfLeafIndex
  )
  const treePublicNodes = publicTreeSnapshot(nextTree)
  const aadBytes = makeCommitAadBytes(currentState.groupId, nextEpoch)

  // wraps secret for the new member only
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

  // builds commit, welcome and next state object with
  // group metadata, new member info, roster, tree snapshop and update path
  const commit = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    type: 'add',
    senderLeafIndex: currentState.selfLeafIndex,
    targetUserId: newMemberUserId,
    targetLeafIndex: newMember.leafIndex,
    roster: newRoster,
    leafCount,
    treePublicNodes,
    updatePath: updatePath.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      publicKeyB64: entry.publicKeyB64,
      encryptedPathSecrets: entry.encryptedPathSecrets,
    })),
  }

  const welcome = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    cipherSuite: currentState.cipherSuite,
    roster: newRoster,
    recipientUserId: newMemberUserId,
    recipientLeafIndex: newMember.leafIndex,
    leafCount,
    wrappedInitSecret,
    wrappedCommitSecret,
    treePublicNodes,
  }

  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    roster: newRoster,
    applicationSecretB64: bytesToBase64(applicationSecret),
    initSecretB64: bytesToBase64(nextInitSecret),
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: nextTree },
    secrets: { initSecretB64: bytesToBase64(nextInitSecret) },
  })

  // Attach sender signing pub key (so receivers know whose key to check against)
  const senderRosterEntry = newRoster.find(
    (m) => String(m.userId) === String(currentState.selfUserId)
  )
  commit.senderSigningPubKeyB64 = senderRosterEntry?.leafSigningPubKeyB64 ?? null
  commit.signature = await signCommit(commit, currentState.leafSigningPrivKeyB64)

  return { commit, welcome, nextState }
}

// Creates the next-epoch commit for kicking a member out of the group
export async function buildRemoveCommit({ state, targetUserId, memberInitKeys }) {
  // normalizes current state
  const currentState = normalizeGroupState(state)
  const targetUserIdStr = String(targetUserId ?? '')

  // validates the target userId and checks that the target member is in the roster
  if (!targetUserIdStr) {
    throw new Error('Invalid targetUserId for remove commit')
  }
  if (!currentState.initSecretB64) {
    throw new Error(`Group state is missing initSecretB64 for group ${currentState.groupId}`)
  }

  // normalize roster and find the target member in the roster to get their leaf index and init key
  const roster = normalizeRoster(currentState.roster)
  const targetMember = roster.find((member) => String(member.userId) === targetUserIdStr)
  if (!targetMember) {
    throw new Error(`Target userId ${targetUserIdStr} not found in group roster`)
  }

  // builds newRoster without the removed user
  const newRoster = roster.filter((member) => String(member.userId) !== targetUserIdStr)
  const leafCount = computeLeafCount({
    roster,
    treeNodes: currentState.tree.nodes,
    extraLeafIndex: targetMember.leafIndex,
  })

  // rebuilds the tree with the removed member's leaf and direct path blanked out and any new member init keys
  // installed, this will prepare the tree for building the update path for the remove commit
  const newTree = resizeNodes(currentState.tree.nodes, nodeWidth(leafCount))
  installLeafPublicKeysFromMemberInitKeys(newTree, roster, memberInitKeys)

  blankNodeAndPath(newTree, targetMember.leafIndex, leafCount)

  // builds sender update path with new tree
  const nextEpoch = currentState.epoch + 1

  const { updatePath, commitSecret } = await buildUpdatePath(
    newTree,
    currentState.selfLeafIndex,
    leafCount
  )

  // advances the epoch to derive the new epoch secrets based on the commit secret from the update path
  const { applicationSecret, nextInitSecret } = await advanceEpoch({
    initSecret: base64ToBytes(currentState.initSecretB64),
    commitSecret,
    groupId: currentState.groupId,
    epoch: nextEpoch,
  })

  // Derives post-commit tree snapshot and tree public nodes for the commit
  const nextTree = deriveCommitTree(
    newTree,
    updatePath,
    currentState.selfLeafIndex,
    currentState.selfLeafIndex
  )
  const treePublicNodes = publicTreeSnapshot(nextTree)

  // builds commit object with group metadata, target member info, roster, tree snapshop and update path
  const commit = {
    groupId: currentState.groupId,
    epoch: nextEpoch,
    type: 'remove',
    senderLeafIndex: currentState.selfLeafIndex,
    targetUserId: targetUserIdStr,
    targetLeafIndex: targetMember.leafIndex,
    roster: newRoster,
    leafCount,
    treePublicNodes,
    updatePath: updatePath.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      publicKeyB64: entry.publicKeyB64,
      encryptedPathSecrets: entry.encryptedPathSecrets,
    })),
  }

  // computes selfStillPresent to determine if the removed member is the same as the sender
  // if so the sender is also removed and should not include secrets or leaf index in the next state
  const selfStillPresent = newRoster.some(
    (member) => String(member.userId) === String(currentState.selfUserId)
  )

  // returns the normalized next state
  const nextState = normalizeGroupState({
    ...currentState,
    epoch: nextEpoch,
    roster: newRoster,
    selfLeafIndex: selfStillPresent ? currentState.selfLeafIndex : null,
    applicationSecretB64: selfStillPresent ? bytesToBase64(applicationSecret) : null,
    initSecretB64: selfStillPresent ? bytesToBase64(nextInitSecret) : null,
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: nextTree },
    secrets: {
      initSecretB64: selfStillPresent ? bytesToBase64(nextInitSecret) : null,
    },
  })

  // Attach sender signing pub key (so receivers know whose key to check against)
  const senderRosterEntry = newRoster.find(
    (m) => String(m.userId) === String(currentState.selfUserId)
  )
  commit.senderSigningPubKeyB64 = senderRosterEntry?.leafSigningPubKeyB64 ?? null
  commit.signature = await signCommit(commit, currentState.leafSigningPrivKeyB64)

  return { commit, nextState }
}

// This is the function each member will call to apply a commit to their local state when they recieve a commit
export async function applyCommit({ state, commit, myInitPrivKeyB64 }) {
  // normalize current state
  const currentState = normalizeGroupState(state)

  // validate the commit fields and check that the commit is for the current group and has a valid epoch
  if (!commit || typeof commit !== 'object') throw new Error('Invalid commit')
  if (String(commit.groupId ?? '') !== String(currentState.groupId)) {
    throw new Error('Commit groupId mismatch')
  }
  if (commit.epoch !== currentState.epoch + 1) {
    throw new Error('Invalid commit epoch')
  }
  if (!Array.isArray(commit.roster)) throw new Error('Commit is missing roster')
  if (!Array.isArray(commit.updatePath)) throw new Error('Commit is missing updatePath')

  // Look up sender in the CURRENT roster (before applying the commit)
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

  await verifyCommit(commit, senderEntry.leafSigningPubKeyB64)

  // computes the leafCount
  const leafCount = Number.isInteger(commit.leafCount)
    ? commit.leafCount
    : computeLeafCount({
        roster: commit.roster,
        treeNodes: currentState.tree.nodes,
        extraLeafIndex: commit.targetLeafIndex,
      })

  // rebuilds the working tree from the commit treePublicNodes if included, otherwise resize to match leafCount
  const treeNodes = Array.isArray(commit.treePublicNodes)
    ? makeTreeFromPublicNodes(commit.treePublicNodes, currentState.tree.nodes)
    : resizeNodes(currentState.tree.nodes, nodeWidth(leafCount))

  // Find your new selfLeafIndex in the commit roster
  const selfLeafIndex = findLeafIndexForUser(commit.roster, currentState.selfUserId)

  // applies the commit path updates, installs new path pk into tree
  // tries to decrypt one encrypted ps intended for you to recover the commit secret
  const commitSecret = await applyUpdatePath(
    treeNodes,
    commit.updatePath,
    commit.senderLeafIndex,
    leafCount,
    selfLeafIndex,
    myInitPrivKeyB64
  )

  // If it recovered commitSecret and has current initSecretB64 advance epoch to derive appSecret and initSecret
  const nextEpochSecrets =
    commitSecret && currentState.initSecretB64
      ? await advanceEpoch({
          initSecret: base64ToBytes(currentState.initSecretB64),
          commitSecret,
          groupId: currentState.groupId,
          epoch: commit.epoch,
        })
      : null

  // return normalized next state with new epoch, new roster, new tree, reset sender generations and secrets
  return normalizeGroupState({
    ...currentState,
    epoch: commit.epoch,
    roster: commit.roster,
    selfLeafIndex,
    applicationSecretB64: nextEpochSecrets
      ? bytesToBase64(nextEpochSecrets.applicationSecret)
      : null,
    initSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.nextInitSecret) : null,
    senderGenerations: {},
    applicationMessageCounter: 0,
    tree: { nodes: treeNodes },
    secrets: {
      initSecretB64: nextEpochSecrets ? bytesToBase64(nextEpochSecrets.nextInitSecret) : null,
    },
  })
}
