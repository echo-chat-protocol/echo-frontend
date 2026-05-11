import { base64ToBytes, bytesToBase64 } from '../../helpers.js'
import init, { generate_public_ephemeral_key } from '@mascaro101/echo-protocol'

import { directPath, leafNode, left, level, nodeWidth, root, right } from './treemath.js'
import { resolveInitKeyB64 } from './keyPackage.js'

// Normalize roster entries into the shape used by group state.
export function normalizeRoster(roster) {
  if (!Array.isArray(roster)) return []
  return roster
    .map((member, index) => ({
      userId: String(member?.userId ?? ''),
      username: member?.username ?? 'Member',
      leafIndex: Number.isInteger(member?.leafIndex) ? member.leafIndex : index,
      leafSigningPubKeyB64:
        typeof member?.leafSigningPubKeyB64 === 'string' && member.leafSigningPubKeyB64.length > 0
          ? member.leafSigningPubKeyB64
          : null,
      credential: member?.credential ?? null,
    }))
    .filter((member) => member.userId.length > 0)
    .sort((a, b) => a.leafIndex - b.leafIndex)
}

// Find the leaf index for one user in a roster.
export function findLeafIndexForUser(roster, userId) {
  const match = normalizeRoster(roster).find(
    (member) => String(member.userId) === String(userId ?? '')
  )
  return Number.isInteger(match?.leafIndex) ? match.leafIndex : null
}

// Compute the leaf count implied by the roster.
export function leafCountFromRoster(roster, extraLeafIndex = null) {
  const leafIndices = normalizeRoster(roster).map((member) => member.leafIndex)
  if (Number.isInteger(extraLeafIndex)) leafIndices.push(extraLeafIndex)
  if (leafIndices.length === 0) return 0
  return Math.max(...leafIndices) + 1
}

// Compute the leaf count implied by a tree node array.
export function leafCountFromNodes(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return 0
  return Math.floor((nodes.length + 1) / 2)
}

// Use whichever source says the tree is larger.
export function computeLeafCount({ roster = [], treeNodes = [], extraLeafIndex = null }) {
  return Math.max(leafCountFromRoster(roster, extraLeafIndex), leafCountFromNodes(treeNodes))
}

// Normalize the per-leaf identity map stored with the tree.
export function normalizeLeafData(leafData) {
  if (!leafData || typeof leafData !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(leafData)) {
    if (v && typeof v === 'object' && v.userId) {
      out[String(k)] = {
        userId: String(v.userId),
        username: v.username ?? 'Member',
        leafSigningPubKeyB64: v.leafSigningPubKeyB64 ?? null,
        credential: v.credential ?? null,
      }
    }
  }
  return out
}

// Rebuild a roster array from the tree leaf data.
export function rosterFromLeafData(leafData) {
  return Object.entries(leafData ?? {})
    .map(([k, v]) => ({
      leafIndex: Number(k),
      userId: v.userId,
      username: v.username ?? 'Member',
      leafSigningPubKeyB64: v.leafSigningPubKeyB64 ?? null,
      credential: v.credential ?? null,
    }))
    .filter((m) => m.userId)
    .sort((a, b) => a.leafIndex - b.leafIndex)
}

// Apply a sparse patch to the leaf data map.
export function applyLeafDataPatch(existing, patch) {
  const result = { ...existing }
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === null) {
      delete result[k]
    } else {
      result[String(k)] = v
    }
  }
  return result
}

// Clone one tree node into the normalized node shape.
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

// Resize a node array while preserving existing entries.
export function resizeNodes(nodes, width) {
  return Array.from({ length: width }, (_, index) => cloneNode(nodes?.[index]))
}

// Merge public tree nodes with any private keys we already hold.
export function makeTreeFromPublicNodes(publicNodes, currentNodes = []) {
  if (!Array.isArray(publicNodes)) return []
  return publicNodes.map((publicKeyB64, index) => ({
    publicKeyB64: typeof publicKeyB64 === 'string' && publicKeyB64.length > 0 ? publicKeyB64 : null,
    privateKeyB64: currentNodes[index]?.privateKeyB64 ?? null,
  }))
}

// Install the local private key back into our own leaf node.
export function installOwnLeafPrivateKey(nodes, selfLeafIndex, selfPrivKeyB64) {
  if (
    !Number.isInteger(selfLeafIndex) ||
    typeof selfPrivKeyB64 !== 'string' ||
    selfPrivKeyB64.length === 0
  )
    return
  const nodeIndex = leafNode(selfLeafIndex)
  if (nodeIndex >= nodes.length) return
  const privBytes = base64ToBytes(selfPrivKeyB64)
  nodes[nodeIndex] = {
    publicKeyB64: bytesToBase64(generate_public_ephemeral_key(privBytes)),
    privateKeyB64: selfPrivKeyB64,
  }
}

// Drop redundant internal public keys from a tree snapshot.
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

// Build the initial tree nodes and leaf data from a roster.
export async function initTreeFromRoster(roster, selfLeafIndex, selfPrivKeyB64, memberInitKeys) {
  await init()
  const normalizedRoster = normalizeRoster(roster)
  const leafCount = leafCountFromRoster(normalizedRoster, selfLeafIndex)
  const width = nodeWidth(leafCount)
  const nodes = resizeNodes([], width)
  const leafData = {}

  for (const member of normalizedRoster) {
    const nodeIndex = leafNode(member.leafIndex)
    if (nodeIndex >= width) continue

    leafData[String(member.leafIndex)] = {
      userId: member.userId,
      username: member.username,
      leafSigningPubKeyB64: member.leafSigningPubKeyB64 ?? null,
      credential: member.credential ?? null,
    }

    if (member.leafIndex === selfLeafIndex && selfPrivKeyB64) {
      const privBytes = base64ToBytes(selfPrivKeyB64)
      nodes[nodeIndex] = {
        publicKeyB64: bytesToBase64(generate_public_ephemeral_key(privBytes)),
        privateKeyB64: selfPrivKeyB64,
      }
      continue
    }

    const memberInitKey = memberInitKeys?.find(
      (entry) => String(entry.userId) === String(member.userId)
    )
    const initKeyB64 = resolveInitKeyB64(memberInitKey)
    if (initKeyB64) {
      nodes[nodeIndex] = { publicKeyB64: initKeyB64, privateKeyB64: null }
    }
  }

  return { nodes, leafData }
}

// Blank one leaf and every node on its direct path.
export function blankNodeAndPath(treeNodes, leafIndex, leafCount) {
  if (!Number.isInteger(leafIndex)) return
  const targetNodeIndex = leafNode(leafIndex)
  if (targetNodeIndex < treeNodes.length) {
    treeNodes[targetNodeIndex] = { publicKeyB64: null, privateKeyB64: null }
  }
  for (const nodeIndex of directPath(targetNodeIndex, leafCount)) {
    if (nodeIndex < treeNodes.length) {
      treeNodes[nodeIndex] = { publicKeyB64: null, privateKeyB64: null }
    }
  }
}

// Fill leaf public keys from the latest init-key inputs.
export function installLeafPublicKeysFromMemberInitKeys(treeNodes, roster, memberInitKeys) {
  const initKeyMap = new Map(
    (Array.isArray(memberInitKeys) ? memberInitKeys : [])
      .map((entry) => [String(entry?.userId), resolveInitKeyB64(entry)])
      .filter(([, initKeyB64]) => typeof initKeyB64 === 'string' && initKeyB64.length > 0)
  )
  for (const member of normalizeRoster(roster)) {
    if (!Number.isInteger(member.leafIndex)) continue
    const publicKeyB64 = initKeyMap.get(String(member.userId))
    if (!publicKeyB64) continue
    const nodeIndex = leafNode(member.leafIndex)
    if (nodeIndex >= treeNodes.length) continue
    treeNodes[nodeIndex] = {
      publicKeyB64,
      privateKeyB64: treeNodes[nodeIndex]?.privateKeyB64 ?? null,
    }
  }
}
