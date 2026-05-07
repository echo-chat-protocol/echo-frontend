import { base64ToBytes, bytesToBase64 } from '@features/chat/utils/helpers'
import init, { generate_public_ephemeral_key } from '@mascaro101/echo-protocol'

// TreeKEM math Imports
import { directPath, leafNode, left, level, nodeWidth, root, right } from './treemath.js'

// Utility function that cleans member list before MLS logic
export function normalizeRoster(roster) {
  // If roster is not formated return empty array
  if (!Array.isArray(roster)) return []

  // Map roster to expected format, filter out entries without userId, and sort by leafIndex
  return roster
    .map((member, index) => ({
      userId: String(member?.userId ?? ''),
      username: member?.username ?? 'Member',
      leafIndex: Number.isInteger(member?.leafIndex) ? member.leafIndex : index,
      leafSigningPubKeyB64:
        typeof member?.leafSigningPubKeyB64 === 'string' && member.leafSigningPubKeyB64.length > 0
          ? member.leafSigningPubKeyB64
          : null,
    }))
    .filter((member) => member.userId.length > 0)
    .sort((a, b) => a.leafIndex - b.leafIndex)
}

// Calculates the index of a leaf given the roster and the userId
export function findLeafIndexForUser(roster, userId) {
  const match = normalizeRoster(roster).find(
    (member) => String(member.userId) === String(userId ?? '')
  )
  return Number.isInteger(match?.leafIndex) ? match.leafIndex : null
}

// Calculates the number of leaves in the tree given the roster
export function leafCountFromRoster(roster, extraLeafIndex = null) {
  const leafIndices = normalizeRoster(roster).map((member) => member.leafIndex)
  if (Number.isInteger(extraLeafIndex)) leafIndices.push(extraLeafIndex)
  if (leafIndices.length === 0) return 0
  return Math.max(...leafIndices) + 1
}

// Estimate leaf members the TreeKem tree currently represents based on total node slots
// 2n -1 = nodes, n = (nodes + 1)/2
export function leafCountFromNodes(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return 0
  return Math.floor((nodes.length + 1) / 2)
}

// Export a deterministic public-tree snapshot.
// Redundant internal public keys are compacted to null because the subtree can
// still be resolved from descendant public nodes.
export function publicTreeSnapshot(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return []

  const width = nodes.length
  const leafCount = leafCountFromNodes(nodes)
  const snapshot = Array.from({ length: width }, (_, index) => nodes[index]?.publicKeyB64 ?? null)

  const compact = (index) => {
    if (index >= width) {
      if (level(index) === 0) return false
      return compact(left(index)) || compact(right(index))
    }

    if (level(index) === 0) return typeof snapshot[index] === 'string' && snapshot[index].length > 0

    const childHasPublic = compact(left(index)) || compact(right(index))

    if (childHasPublic && typeof snapshot[index] === 'string' && snapshot[index].length > 0) {
      snapshot[index] = null
    }

    return childHasPublic || (typeof snapshot[index] === 'string' && snapshot[index].length > 0)
  }

  if (leafCount > 0) compact(root(leafCount))
  return snapshot
}

// Given the roster and the current tree nodes, estimate the leaf count needed to represent
// all members in the roster and the tree, this is used to determine how many nodes the tree
// should have when loading or creating a group state
export function computeLeafCount({ roster = [], treeNodes = [], extraLeafIndex = null }) {
  return Math.max(leafCountFromRoster(roster, extraLeafIndex), leafCountFromNodes(treeNodes))
}

// Creates a sanitized copy of one tree node object, checks that pk and sk are valid STRINGS
// and are not empty. Return if so, return null if not
export function cloneNode(node) {
  return {
    publicKeyB64:
      typeof node?.publicKeyB64 === 'string' && node.publicKeyB64.length > 0
        ? node.publicKeyB64
        : null,
    privateKeyB64:
      typeof node?.privateKeyB64 === 'string' && node.privateKeyB64.length > 0
        ? node.privateKeyB64
        : null,
  }
}

// builds a new tree-node array of exact length "width"
// if resized to grow, creates empty nodes and cleans the others
export function resizeNodes(nodes, width) {
  return Array.from({ length: width }, (_, index) => cloneNode(nodes?.[index]))
}

// Combines known private keys with recieved list of public keys
// to build a full tree representation with private keys in the correct nodes
export function makeTreeFromPublicNodes(publicNodes, currentNodes = []) {
  if (!Array.isArray(publicNodes)) return []
  return publicNodes.map((publicKeyB64, index) => ({
    publicKeyB64: typeof publicKeyB64 === 'string' && publicKeyB64.length > 0 ? publicKeyB64 : null,
    privateKeyB64: currentNodes[index]?.privateKeyB64 ?? null,
  }))
}

// Puts own private key into own node in the tree
export function installOwnLeafPrivateKey(nodes, selfLeafIndex, selfPrivKeyB64) {
  if (
    !Number.isInteger(selfLeafIndex) ||
    typeof selfPrivKeyB64 !== 'string' ||
    selfPrivKeyB64.length === 0
  ) {
    return
  }

  const nodeIndex = leafNode(selfLeafIndex)
  if (nodeIndex >= nodes.length) return

  const privBytes = base64ToBytes(selfPrivKeyB64)
  nodes[nodeIndex] = {
    publicKeyB64: bytesToBase64(generate_public_ephemeral_key(privBytes)),
    privateKeyB64: selfPrivKeyB64,
  }
}

// Builds the initial treeKEM node array from the group roster
export async function initTreeFromRoster(roster, selfLeafIndex, selfPrivKeyB64, memberInitKeys) {
  // initialize crypto, this will load the WASM module
  await init()

  // normalize the roster and size the tree
  const normalizedRoster = normalizeRoster(roster)
  const leafCount = leafCountFromRoster(normalizedRoster, selfLeafIndex)
  const width = nodeWidth(leafCount)
  const nodes = resizeNodes([], width)

  // Fill each members leaf node
  for (const member of normalizedRoster) {
    const nodeIndex = leafNode(member.leafIndex)
    if (nodeIndex >= width) continue

    // If this leaf is self, install the private key and corresponding public key in the tree node
    if (member.leafIndex === selfLeafIndex && selfPrivKeyB64) {
      const privBytes = base64ToBytes(selfPrivKeyB64)
      nodes[nodeIndex] = {
        publicKeyB64: bytesToBase64(generate_public_ephemeral_key(privBytes)),
        privateKeyB64: selfPrivKeyB64,
      }
      continue
    }

    // find initKeyB64 for this member, if found install the pk in the tree node, sk will be secret
    const memberInitKey = memberInitKeys?.find(
      (entry) => String(entry.userId) === String(member.userId)
    )
    if (memberInitKey?.initKeyB64) {
      nodes[nodeIndex] = {
        publicKeyB64: memberInitKey.initKeyB64,
        privateKeyB64: null,
      }
    }
  }

  return nodes
}

// wipes a members leaf node and all ancestor nodes on that leafs direct path
export function blankNodeAndPath(treeNodes, leafIndex, leafCount) {
  if (!Number.isInteger(leafIndex)) return

  // set that leafs pk and sk to null
  const targetNodeIndex = leafNode(leafIndex)
  if (targetNodeIndex < treeNodes.length) {
    treeNodes[targetNodeIndex] = { publicKeyB64: null, privateKeyB64: null }
  }

  // for every node in direct path set pk and sk to null
  for (const nodeIndex of directPath(targetNodeIndex, leafCount)) {
    if (nodeIndex < treeNodes.length) {
      treeNodes[nodeIndex] = { publicKeyB64: null, privateKeyB64: null }
    }
  }
}

// fils leaf nodes with members public init keys
export function installLeafPublicKeysFromMemberInitKeys(treeNodes, roster, memberInitKeys) {
  // build map from member init keys
  const initKeyMap = new Map(
    (Array.isArray(memberInitKeys) ? memberInitKeys : [])
      .filter((entry) => typeof entry?.initKeyB64 === 'string' && entry.initKeyB64.length > 0)
      .map((entry) => [String(entry.userId), entry.initKeyB64])
  )

  // loop over normalized roster
  // for each member lookup pkB64 compute leaf node slot in leafnode
  for (const member of normalizeRoster(roster)) {
    if (!Number.isInteger(member.leafIndex)) continue
    const publicKeyB64 = initKeyMap.get(String(member.userId))
    if (!publicKeyB64) continue

    const nodeIndex = leafNode(member.leafIndex)
    if (nodeIndex >= treeNodes.length) continue

    // install the pkB64 in the correct tree node, do not overwrite any existing skB64
    treeNodes[nodeIndex] = {
      publicKeyB64,
      privateKeyB64: treeNodes[nodeIndex]?.privateKeyB64 ?? null,
    }
  }
}
