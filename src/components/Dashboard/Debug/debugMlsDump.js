/**
 * Builds a comprehensive JSON diagnostic bundle for MLS / group-crypto debugging.
 * Intended for post-mortem analysis when members lose state after removal, etc.
 */

import eld from '@/utils/storage/EncryptedLocalDatabase'
import { getSocket } from '@/services/socket'
import { getIdentityKeys, getSavedMessages } from '../Chat/utils/chat/keyManagement'
import { fetchAllGroupMessages } from '../Chat/utils/crypto/groupCrypto/groupMlsReplay'

const MAX_GROUPS_TO_PROBE = 25
const SOCKET_ACK_MS = 12_000

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ success: false, error: 'timeout' }), SOCKET_ACK_MS)
    socket.emit(event, payload, (res) => {
      clearTimeout(timeout)
      resolve(res ?? { success: false, error: 'no_ack' })
    })
  })
}

function collectEchoLocalStorage() {
  if (typeof localStorage === 'undefined') return {}
  const out = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('echo-')) continue
    try {
      const raw = localStorage.getItem(key)
      if (raw?.startsWith('{') || raw?.startsWith('[')) {
        try {
          out[key] = JSON.parse(raw)
        } catch {
          out[key] = raw
        }
      } else {
        out[key] = raw
      }
    } catch (err) {
      out[key] = `[read error: ${err?.message ?? err}]`
    }
  }
  return out
}

function collectUnreadGroupKeys(userId) {
  if (typeof localStorage === 'undefined' || !userId) return {}
  const prefix = `unreadGroup-${userId}-`
  const out = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key?.startsWith(prefix)) continue
    out[key] = localStorage.getItem(key)
  }
  return out
}

function rosterLeafIndices(roster) {
  if (!Array.isArray(roster)) return []
  return roster
    .filter((m) => Number.isInteger(m?.leafIndex))
    .map((m) => m.leafIndex)
    .sort((a, b) => a - b)
}

function leafDataIndices(leafData) {
  if (!leafData || typeof leafData !== 'object') return []
  return Object.keys(leafData)
    .filter((k) => leafData[k] != null)
    .map((k) => Number(k))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b)
}

/** Non-secret summary + consistency checks for one MLS state blob. */
export function analyzeMlsState(state) {
  if (!state || typeof state !== 'object') {
    return { present: false }
  }

  const roster = state.roster ?? []
  const leafData = state.tree?.leafData ?? {}
  const rosterLeaves = rosterLeafIndices(roster)
  const treeLeaves = leafDataIndices(leafData)
  const rosterUserIds = new Set(roster.map((m) => String(m?.userId ?? '')).filter(Boolean))
  const treeUserIds = new Set(
    Object.values(leafData)
      .filter(Boolean)
      .map((l) => String(l?.userId ?? ''))
      .filter(Boolean)
  )

  const leavesInTreeNotRoster = treeLeaves.filter((idx) => !rosterLeaves.includes(idx))
  const leavesInRosterNotTree = rosterLeaves.filter((idx) => !treeLeaves.includes(idx))

  return {
    present: true,
    groupId: state.groupId ?? null,
    epoch: state.epoch ?? null,
    cipherSuite: state.cipherSuite ?? null,
    selfUserId: state.selfUserId ?? null,
    selfLeafIndex: state.selfLeafIndex ?? null,
    reInit: Boolean(state.reInit),
    hasApplicationSecret: Boolean(state.applicationSecretB64 || state.groupKeyB64),
    hasInitSecret: Boolean(state.initSecretB64 || state.secrets?.initSecretB64),
    hasSenderDataSecret: Boolean(state.senderDataSecretB64),
    hasTreeHash: Boolean(state.treeHashB64),
    hasLeafSigningPriv: Boolean(state.leafSigningPrivKeyB64),
    rosterLeafCount: rosterLeaves.length,
    treeLeafCount: treeLeaves.length,
    rosterLeafIndices: rosterLeaves,
    treeLeafIndices: treeLeaves,
    leavesInTreeNotRoster,
    leavesInRosterNotTree,
    rosterUserIds: [...rosterUserIds],
    treeUserIds: [...treeUserIds],
    usersOnlyInTree: [...treeUserIds].filter((id) => !rosterUserIds.has(id)),
    usersOnlyInRoster: [...rosterUserIds].filter((id) => !treeUserIds.has(id)),
    pendingProposalsCount: Array.isArray(state.pendingProposals)
      ? state.pendingProposals.length
      : 0,
    senderGenerationsCount: Object.keys(state.senderGenerations ?? {}).length,
    treeNodeCount: Array.isArray(state.tree?.nodes) ? state.tree.nodes.length : 0,
    applicationMessageCounter: state.applicationMessageCounter ?? null,
  }
}

function formatConsoleEntries(entries) {
  return (entries ?? []).map((e) => ({
    id: e.id,
    level: e.level,
    time: e.time instanceof Date ? e.time.toISOString() : e.time,
    message: (e.args ?? [])
      .map((a) => {
        if (a instanceof Error) return a.stack || a.message
        if (typeof a === 'string') return a
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      })
      .join(' '),
    args: e.args,
  }))
}

function formatGroupTraceEntries(entries) {
  return (entries ?? []).map((e) => ({
    ...e,
    time: e.time instanceof Date ? e.time.toISOString() : e.time,
    plaintext:
      typeof e.plaintext === 'string'
        ? e.plaintext
        : e.plaintextBytes instanceof Uint8Array
          ? `[Uint8Array ${e.plaintextBytes.length}]`
          : e.plaintext,
  }))
}

function summarizeServerMessage(msg) {
  if (!msg || typeof msg !== 'object') return msg
  const base = {
    _id: msg._id,
    seq: msg.seq,
    groupId: msg.groupId,
    userId: msg.userId,
    username: msg.username,
    contentType: msg.contentType,
    messageType: msg.messageType,
    createdAt: msg.createdAt ?? msg.timestamp,
    epoch: msg.epoch,
    senderLeafIndex: msg.senderLeafIndex,
  }
  if (msg.contentType === 'commit' || msg.contentType === 'welcome') {
    let artifact = null
    if (typeof msg.payload === 'string') {
      try {
        artifact = JSON.parse(msg.payload)
      } catch {
        artifact = { parseError: true, rawLength: msg.payload.length }
      }
    }
    return {
      ...base,
      artifactSummary: artifact
        ? {
            type: artifact.type ?? msg.contentType,
            epoch: artifact.epoch,
            senderLeafIndex: artifact.senderLeafIndex,
            targetUserId: artifact.targetUserId,
            targetLeafIndex: artifact.targetLeafIndex,
            rosterLength: Array.isArray(artifact.roster) ? artifact.roster.length : null,
            hasUpdatePath: Array.isArray(artifact.updatePath),
            hasSignature: Boolean(artifact.signature),
            recipientUserId: artifact.recipientUserId,
            recipientLeafIndex: artifact.recipientLeafIndex,
            recipientClientId: artifact.recipientClientId,
          }
        : null,
      payload: artifact ?? msg.payload,
    }
  }
  if (msg.contentType === 'application') {
    return {
      ...base,
      headerB64: msg.headerB64 ?? null,
      ciphertextB64Length: typeof msg.ciphertextB64 === 'string' ? msg.ciphertextB64.length : null,
      encryptedSenderDataB64Length:
        typeof msg.encryptedSenderDataB64 === 'string' ? msg.encryptedSenderDataB64.length : null,
    }
  }
  return { ...base, payload: msg.payload, text: msg.text }
}

async function probeGroupOnServer(socket, groupId) {
  const gid = String(groupId)
  const [openGroup, messages] = await Promise.all([
    emitAck(socket, 'openGroup', { groupId: gid }),
    fetchAllGroupMessages(socket, gid).catch((err) => ({
      fetchError: err?.message ?? String(err),
    })),
  ])

  const commits = []
  const welcomes = []
  const application = []
  const other = []
  const messageList = Array.isArray(messages) ? messages : []

  for (const msg of messageList) {
    if (msg?.contentType === 'commit') commits.push(msg)
    else if (msg?.contentType === 'welcome') welcomes.push(msg)
    else if (msg?.contentType === 'application') application.push(msg)
    else other.push(msg)
  }

  return {
    openGroup: openGroup?.success
      ? {
          group: openGroup.group,
          membership: openGroup.membership,
          members: openGroup.members,
          memberCount: Array.isArray(openGroup.members) ? openGroup.members.length : 0,
        }
      : { error: openGroup?.error ?? 'openGroup_failed', raw: openGroup },
    serverEpoch: openGroup?.group?.epoch ?? null,
    messageCounts: {
      total: messageList.length,
      commits: commits.length,
      welcomes: welcomes.length,
      application: application.length,
      other: other.length,
    },
    messages: messageList.map(summarizeServerMessage),
    epochGap:
      Number.isInteger(openGroup?.group?.epoch) && commits.length > 0
        ? {
            serverEpoch: openGroup.group.epoch,
            latestCommitEpoch: Math.max(
              ...commits.map((m) => {
                try {
                  const c = JSON.parse(m.payload)
                  return Number.isInteger(c?.epoch) ? c.epoch : -1
                } catch {
                  return -1
                }
              })
            ),
          }
        : null,
  }
}

/**
 * @param {{ userId?: string, activeChat?: object, removedGroups?: object }} options
 */
export async function buildComprehensiveDebugLog({
  userId,
  activeChat = null,
  removedGroups = {},
} = {}) {
  const generatedAt = new Date().toISOString()
  const socket = getSocket()
  const deviceId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('echo-device-id') : null

  let identityKeys = null
  let identityError = null
  try {
    identityKeys = await getIdentityKeys()
  } catch (err) {
    identityError = err?.message ?? String(err)
  }

  let mlsExports = []
  let mlsExportError = null
  if (eld.isUnlocked?.()) {
    try {
      mlsExports = await eld.exportMlsGroupStatesForCurrentUser()
    } catch (err) {
      mlsExportError = err?.message ?? String(err)
    }
  } else {
    mlsExportError = 'ELD locked — unlock the app to export MLS group states'
  }

  const groupsList =
    userId && typeof localStorage !== 'undefined'
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem(`groups-${userId}`) || '[]')
          } catch {
            return []
          }
        })()
      : []

  const groupIds = new Set()
  if (activeChat?.type === 'group' && activeChat?.groupId) {
    groupIds.add(String(activeChat.groupId))
  }
  for (const entry of mlsExports) {
    if (entry?.groupId) groupIds.add(String(entry.groupId))
  }
  for (const g of groupsList) {
    if (g?.groupId) groupIds.add(String(g.groupId))
  }

  const idsToProbe = [...groupIds].slice(0, MAX_GROUPS_TO_PROBE)
  const groupBundles = []

  for (const groupId of idsToProbe) {
    const exportEntry = mlsExports.find((e) => String(e.groupId) === groupId)
    const rawStored = exportEntry?.state ?? null
    const localState =
      rawStored && typeof rawStored === 'object' && rawStored.state != null
        ? rawStored.state
        : rawStored
    let cachedMessages = []
    let cachedError = null
    if (userId) {
      try {
        cachedMessages = await getSavedMessages(userId, `group-${groupId}`)
      } catch (err) {
        cachedError = err?.message ?? String(err)
      }
    }

    let server = null
    if (socket?.connected) {
      server = await probeGroupOnServer(socket, groupId)
    } else {
      server = { error: 'socket_not_connected' }
    }

    const diagnostics = analyzeMlsState(localState)
    const serverEpoch = server?.serverEpoch
    const localEpoch = diagnostics.epoch

    groupBundles.push({
      groupId,
      isActiveChat: activeChat?.type === 'group' && String(activeChat?.groupId) === groupId,
      activeChatFlags: {
        removedFromGroup: activeChat?.removedFromGroup ?? null,
        removedInfo: activeChat?.removedInfo ?? null,
      },
      diagnostics,
      epochAlignment:
        Number.isInteger(serverEpoch) && Number.isInteger(localEpoch)
          ? {
              localEpoch,
              serverEpoch,
              delta: localEpoch - serverEpoch,
              aligned: localEpoch === serverEpoch,
            }
          : null,
      localState,
      server,
      cachedMessages: Array.isArray(cachedMessages)
        ? cachedMessages.map((m) => ({
            _id: m._id,
            userId: m.userId,
            username: m.username,
            text: m.text,
            createdAt: m.createdAt,
            messageType: m.messageType,
          }))
        : [],
      cachedMessagesError: cachedError,
    })
  }

  const consoleBuffer = typeof window !== 'undefined' ? window.__echoDebugBuffer?.entries : []
  const groupTrace = typeof window !== 'undefined' ? window.__echoGroupTrace?.entries : []

  return {
    _warning:
      'SENSITIVE: This file contains private keys, MLS epoch secrets, and message plaintext. Do not share publicly.',
    _purpose:
      'Echo MLS diagnostic bundle — use after member removal or "MLS state not ready" to compare local vs server epoch/roster/commits.',
    generatedAt,
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      language: typeof navigator !== 'undefined' ? navigator.language : null,
      eldUnlocked: Boolean(eld.isUnlocked?.()),
    },
    user: {
      userId: userId ?? null,
      deviceId,
      deviceMlsPub:
        typeof localStorage !== 'undefined' ? localStorage.getItem('echo-device-mls-pub') : null,
      deviceMlsPriv:
        typeof localStorage !== 'undefined' ? localStorage.getItem('echo-device-mls-priv') : null,
    },
    activeChat,
    removedGroups: removedGroups ?? {},
    identityKeys: identityKeys ?? null,
    identityKeysError: identityError,
    mlsExportError,
    mlsGroupStateCount: mlsExports.length,
    groupsList,
    socket: socket
      ? {
          connected: socket.connected,
          id: socket.id ?? null,
          disconnected: socket.disconnected,
        }
      : null,
    localStorageEcho: collectEchoLocalStorage(),
    unreadGroupCounters: collectUnreadGroupKeys(userId),
    groupBundles,
    groupBundlesTruncated: groupIds.size > MAX_GROUPS_TO_PROBE,
    groupIdsOmitted:
      groupIds.size > MAX_GROUPS_TO_PROBE ? [...groupIds].slice(MAX_GROUPS_TO_PROBE) : [],
    consoleLog: formatConsoleEntries(consoleBuffer),
    consoleLogCount: consoleBuffer?.length ?? 0,
    groupMessageTrace: formatGroupTraceEntries(groupTrace),
    groupMessageTraceCount: groupTrace?.length ?? 0,
  }
}

export function downloadDebugLog(payload, filenamePrefix = 'echo-mls-debug') {
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `${filenamePrefix}-${stamp}.json`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return name
}
