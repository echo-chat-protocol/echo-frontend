import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  X,
  Trash2,
  Copy,
  Pause,
  Play,
  Filter,
  ChevronRight,
  RefreshCw,
  Maximize2,
  Minimize2,
  Terminal,
  Layers,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Network,
  KeyRound,
} from 'lucide-react'
import { buildComprehensiveDebugLog, downloadDebugLog } from './debugMlsDump'
import { deviceService } from '@/features/devices/deviceService'
import {
  getIdentityKeys,
  getPeerIdentityKeys,
  getRootKey,
  getSendingChainKey,
  getReceivingChainKey,
} from '../Chat/utils/chat/keyManagement'
import { loadGroupState } from '../Chat/utils/crypto/groupCryptoProvider'
import {
  level,
  left,
  right,
  root,
  directPath,
  leafNode,
} from '../Chat/utils/crypto/groupCrypto/treemath'

const EMPTY_TRACE_ENTRIES = []

const MAX_ENTRIES = 500
const LEVELS = ['log', 'info', 'warn', 'error', 'debug']
const LEVEL_COLORS = {
  log: 'text-white/80',
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-rose-300',
  debug: 'text-violet-300',
}

// ── Shared in-memory console capture (installed once on window) ─────────────
const sharedBuffer = (() => {
  if (typeof window === 'undefined') return null
  if (window.__echoDebugBuffer) return window.__echoDebugBuffer

  const buffer = {
    entries: [],
    listeners: new Set(),
    push(entry) {
      this.entries.push(entry)
      if (this.entries.length > MAX_ENTRIES) {
        this.entries.splice(0, this.entries.length - MAX_ENTRIES)
      }
      this.listeners.forEach((fn) => {
        try {
          fn()
        } catch {
          /* ignore */
        }
      })
    },
    clear() {
      this.entries = []
      this.listeners.forEach((fn) => {
        try {
          fn()
        } catch {
          /* ignore */
        }
      })
    },
    subscribe(fn) {
      this.listeners.add(fn)
      return () => this.listeners.delete(fn)
    },
  }

  const origin = {}
  LEVELS.forEach((level) => {
    origin[level] = console[level]?.bind(console) ?? console.log.bind(console)
    console[level] = (...args) => {
      try {
        buffer.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          level,
          time: new Date(),
          args,
        })
      } catch {
        /* don't break logging on capture error */
      }
      origin[level](...args)
    }
  })

  window.addEventListener('error', (e) => {
    buffer.push({
      id: `${Date.now()}-err`,
      level: 'error',
      time: new Date(),
      args: [`[window.error] ${e.message}`, e.filename, `:${e.lineno}:${e.colno}`],
    })
  })
  window.addEventListener('unhandledrejection', (e) => {
    buffer.push({
      id: `${Date.now()}-rej`,
      level: 'error',
      time: new Date(),
      args: ['[unhandledrejection]', e.reason],
    })
  })

  window.__echoDebugBuffer = buffer
  return buffer
})()

// ── Group-message trace buffer (populated by messageFlow.js / groupMessageDecryption.js) ─
const GROUP_TRACE_MAX = 200
const groupTraceBuffer = (() => {
  if (typeof window === 'undefined') return null
  if (window.__echoGroupTrace) return window.__echoGroupTrace

  const buffer = {
    entries: [],
    listeners: new Set(),
    push(entry) {
      const enriched = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date(),
        ...entry,
      }
      this.entries.push(enriched)
      if (this.entries.length > GROUP_TRACE_MAX) {
        this.entries.splice(0, this.entries.length - GROUP_TRACE_MAX)
      }
      this.listeners.forEach((fn) => {
        try {
          fn()
        } catch {
          /* ignore */
        }
      })
    },
    clear() {
      this.entries = []
      this.listeners.forEach((fn) => {
        try {
          fn()
        } catch {
          /* ignore */
        }
      })
    },
    subscribe(fn) {
      this.listeners.add(fn)
      return () => this.listeners.delete(fn)
    },
  }
  window.__echoGroupTrace = buffer
  return buffer
})()

// ── Helpers ─────────────────────────────────────────────────────────────────
function safeStringify(value) {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  if (typeof value === 'function') return value.toString()
  try {
    const seen = new WeakSet()
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === 'bigint') return `${v.toString()}n`
        if (v instanceof Uint8Array) return `Uint8Array(${v.length})[${bytesPreview(v)}]`
        if (v && typeof v === 'object') {
          if (seen.has(v)) return '[Circular]'
          seen.add(v)
        }
        return v
      },
      2
    )
  } catch {
    return String(value)
  }
}

function bytesPreview(u8, n = 16) {
  const slice = Array.from(u8.slice(0, n))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
  return u8.length > n ? `${slice}…` : slice
}

function bytesToBase64(u8) {
  if (!(u8 instanceof Uint8Array)) return null
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}

function formatTime(d) {
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function shortKey(b64, head = 10, tail = 6) {
  if (!b64 || typeof b64 !== 'string') return '—'
  if (b64.length <= head + tail + 1) return b64
  return `${b64.slice(0, head)}…${b64.slice(-tail)}`
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

// ── Reusable bits ───────────────────────────────────────────────────────────
function KeyValue({ label, value, mono = true, copy = true }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div className='flex items-start gap-2 py-1'>
      <span className='shrink-0 text-[10.5px] uppercase tracking-wider text-white/40'>{label}</span>
      <span
        className={`min-w-0 flex-1 break-all text-[11.5px] ${mono ? 'font-mono' : ''} text-white/85`}
        title={display}
      >
        {display}
      </span>
      {copy && display !== '—' && (
        <button
          onClick={() => copyText(display)}
          className='shrink-0 rounded p-0.5 text-white/30 hover:bg-white/10 hover:text-white/80'
          title='Copy'
        >
          <Copy size={11} />
        </button>
      )}
    </div>
  )
}
KeyValue.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.any,
  mono: PropTypes.bool,
  copy: PropTypes.bool,
}

function CollapsibleRow({ title, subtitle, badges, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className='rounded-lg border border-white/[0.06] bg-white/[0.015] overflow-hidden'>
      <button
        onClick={() => setOpen((v) => !v)}
        className='flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03]'
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <div className='min-w-0 flex-1'>
          <div className='truncate text-[12.5px] font-medium text-white/90'>{title}</div>
          {subtitle && (
            <div className='truncate text-[10.5px] text-white/40 font-mono'>{subtitle}</div>
          )}
        </div>
        {badges && <div className='flex shrink-0 gap-1'>{badges}</div>}
      </button>
      {open && <div className='border-t border-white/[0.05] bg-black/30 px-3 py-2'>{children}</div>}
    </div>
  )
}
CollapsibleRow.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  badges: PropTypes.node,
  children: PropTypes.node,
  defaultOpen: PropTypes.bool,
}

function SectionHeader({ icon, title, count, onRefresh }) {
  return (
    <div className='mb-2 flex items-center gap-2'>
      {icon}
      <h4 className='text-[11px] font-semibold uppercase tracking-wider text-white/55'>{title}</h4>
      {typeof count === 'number' && (
        <span className='rounded bg-white/5 px-1.5 py-px text-[10px] font-mono text-white/50'>
          {count}
        </span>
      )}
      <div className='flex-1' />
      {onRefresh && (
        <button
          onClick={onRefresh}
          className='grid h-6 w-6 place-items-center rounded text-white/40 hover:bg-white/10 hover:text-white'
          title='Refresh'
        >
          <RefreshCw size={11} />
        </button>
      )}
    </div>
  )
}
SectionHeader.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  onRefresh: PropTypes.func,
}

// ── Sections ────────────────────────────────────────────────────────────────
function DevicesSection({ userId, refreshTick }) {
  const [state, setState] = useState({ loading: true, devices: [], error: null })

  const load = useCallback(async () => {
    if (!userId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const result = await deviceService.listDevices(userId)
      const devices = Array.isArray(result?.devices)
        ? result.devices
        : Array.isArray(result)
          ? result
          : []
      setState({ loading: false, devices, error: null })
    } catch (err) {
      setState({ loading: false, devices: [], error: err?.message || 'Failed to load devices' })
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load, refreshTick])

  const currentDeviceId =
    typeof window !== 'undefined' ? localStorage.getItem('echo-device-id') : null

  return (
    <section className='mb-4'>
      <SectionHeader title='Paired Devices' count={state.devices.length} onRefresh={load} />
      {state.error && (
        <div className='rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200'>
          {state.error}
        </div>
      )}
      {state.loading && !state.devices.length && (
        <div className='text-[11px] text-white/40'>Loading…</div>
      )}
      <div className='space-y-1.5'>
        {state.devices.map((d) => {
          const id = d.deviceId || d.id || ''
          const isSelf = id === currentDeviceId
          return (
            <CollapsibleRow
              key={id || JSON.stringify(d)}
              title={d.name || d.deviceName || d.platform || 'Device'}
              subtitle={id}
              badges={
                <>
                  {isSelf && (
                    <span className='rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300'>
                      this
                    </span>
                  )}
                  {d.platform && (
                    <span className='rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60'>
                      {d.platform}
                    </span>
                  )}
                </>
              }
            >
              {Object.entries(d).map(([k, v]) => (
                <KeyValue key={k} label={k} value={typeof v === 'object' ? safeStringify(v) : v} />
              ))}
            </CollapsibleRow>
          )
        })}
        {!state.loading && state.devices.length === 0 && !state.error && (
          <div className='text-[11px] text-white/40'>No devices reported.</div>
        )}
      </div>
    </section>
  )
}
DevicesSection.propTypes = {
  userId: PropTypes.string,
  refreshTick: PropTypes.number.isRequired,
}

function GroupSection({ activeChat, userId, refreshTick }) {
  const [state, setState] = useState({ loading: true, groupState: null, error: null })

  const groupId = activeChat?.type === 'group' ? activeChat?.groupId : null

  const load = useCallback(async () => {
    if (!groupId) {
      setState({ loading: false, groupState: null, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const gs = await loadGroupState(groupId)
      setState({ loading: false, groupState: gs, error: null })
    } catch (err) {
      setState({
        loading: false,
        groupState: null,
        error: err?.message || 'Failed to load group state',
      })
    }
  }, [groupId])

  useEffect(() => {
    load()
  }, [load, refreshTick])

  if (!groupId) return null

  const gs = state.groupState
  const roster = gs?.roster ?? []
  const leafData = gs?.tree?.leafData ?? {}

  return (
    <section className='mb-4'>
      <SectionHeader
        icon={<Layers size={12} className='text-violet-300/80' />}
        title={`Group · ${activeChat?.name || groupId}`}
        count={roster.length}
        onRefresh={load}
      />
      {state.error && (
        <div className='mb-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200'>
          {state.error}
        </div>
      )}
      {gs && (
        <div className='mb-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2'>
          <KeyValue label='groupId' value={gs.groupId} />
          <KeyValue label='epoch' value={gs.epoch} />
          <KeyValue label='cipherSuite' value={gs.cipherSuite} />
          <KeyValue label='selfLeafIndex' value={gs.selfLeafIndex} />
          <KeyValue label='selfUserId' value={gs.selfUserId} />
        </div>
      )}
      <div className='space-y-1.5'>
        {roster.map((m) => {
          const leaf = leafData[String(m.leafIndex)] || {}
          const isSelf = String(m.userId) === String(userId) && m.leafIndex === gs?.selfLeafIndex
          return (
            <CollapsibleRow
              key={`${m.userId}-${m.leafIndex}`}
              title={m.username || leaf.username || `User ${m.userId}`}
              subtitle={`uid:${m.userId}  leaf:${m.leafIndex}`}
              badges={
                <>
                  {isSelf && (
                    <span className='rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300'>
                      self
                    </span>
                  )}
                  {m.leafSigningPubKeyB64 || leaf.leafSigningPubKeyB64 ? (
                    <span className='rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-200'>
                      signed
                    </span>
                  ) : (
                    <span className='rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200'>
                      no-sig
                    </span>
                  )}
                </>
              }
            >
              <KeyValue label='userId' value={m.userId} />
              <KeyValue label='username' value={m.username || leaf.username} />
              <KeyValue label='leafIndex' value={m.leafIndex} />
              <KeyValue
                label='leafSigningPubKey'
                value={m.leafSigningPubKeyB64 || leaf.leafSigningPubKeyB64}
              />
              <KeyValue label='initKey (leaf)' value={leaf.initKeyB64 || leaf.publicKeyB64} />
              <KeyValue label='credential' value={safeStringify(m.credential || leaf.credential)} />
              <KeyValue label='clientId / deviceId' value={m.clientId || leaf.clientId} />
              {Object.entries(leaf).map(([k, v]) =>
                [
                  'userId',
                  'username',
                  'leafSigningPubKeyB64',
                  'initKeyB64',
                  'publicKeyB64',
                  'credential',
                  'clientId',
                ].includes(k) ? null : (
                  <KeyValue
                    key={`leaf-${k}`}
                    label={`leaf.${k}`}
                    value={typeof v === 'object' ? safeStringify(v) : v}
                  />
                )
              )}
            </CollapsibleRow>
          )
        })}
        {!state.loading && roster.length === 0 && (
          <div className='text-[11px] text-white/40'>No roster loaded.</div>
        )}
      </div>
    </section>
  )
}
GroupSection.propTypes = {
  activeChat: PropTypes.object,
  userId: PropTypes.string,
  refreshTick: PropTypes.number.isRequired,
}

// ── Ratchet-tree (TreeKEM/MLS) visualization ────────────────────────────────
// Node-box geometry for the inverted (root-on-top) diagram.
const TREE_NODE_W = 124
const TREE_NODE_H = 48
const TREE_H_GAP = 18
const TREE_V_GAP = 38

// Build a laid-out, top-down binary tree from the flat left-balanced node array.
// Root sits at depth 0; leaves fan out along the bottom. Virtual (out-of-array)
// internal nodes are flattened so incomplete trees still render as a clean
// binary structure. Returns positioned nodes + parent→child edges, or null.
function buildTreeLayout(nodes, leafData, selfLeafIndex) {
  const width = Array.isArray(nodes) ? nodes.length : 0
  if (width === 0) return null
  const leafCount = Math.floor((width + 1) / 2)

  // Node indices on the path from our own leaf to the root.
  const selfPath = new Set()
  if (Number.isInteger(selfLeafIndex) && selfLeafIndex >= 0) {
    const selfNode = leafNode(selfLeafIndex)
    selfPath.add(selfNode)
    for (const idx of directPath(selfNode, leafCount)) selfPath.add(idx)
  }

  // Real children of a node, descending through virtual internal nodes.
  const realChildren = (x) => {
    if (level(x) === 0) return []
    const out = []
    for (const child of [left(x), right(x)]) {
      if (child < width) out.push(child)
      else if (level(child) > 0) out.push(...realChildren(child))
      // virtual leaf (>= width, level 0): no real node, skip
    }
    return out
  }

  const describe = (x, isRoot) => {
    const isLeaf = level(x) === 0
    const node = nodes[x] || {}
    const hasPub = typeof node.publicKeyB64 === 'string' && node.publicKeyB64.length > 0
    const hasPriv = typeof node.privateKeyB64 === 'string' && node.privateKeyB64.length > 0
    const leafIndex = isLeaf ? x / 2 : null
    const member = isLeaf ? leafData?.[String(leafIndex)] || null : null
    return {
      x,
      isRoot,
      isLeaf,
      leafIndex,
      hasPub,
      hasPriv,
      member,
      publicKeyB64: node.publicKeyB64 || null,
      onSelfPath: selfPath.has(x),
      isSelf: isLeaf && leafIndex === selfLeafIndex,
    }
  }

  const colStep = TREE_NODE_W + TREE_H_GAP
  const rowStep = TREE_NODE_H + TREE_V_GAP
  const laid = []
  let leafCol = 0
  let maxDepth = 0

  // DFS in left→right order: leaves get sequential columns, parents centre over
  // their children, depth increases downward.
  const build = (x, depth, isRoot) => {
    maxDepth = Math.max(maxDepth, depth)
    const info = describe(x, isRoot)
    const kids = realChildren(x).map((c) => build(c, depth + 1, false))
    let cx
    if (kids.length === 0) {
      cx = leafCol * colStep + TREE_NODE_W / 2
      leafCol += 1
    } else {
      cx = kids.reduce((sum, k) => sum + k.cx, 0) / kids.length
    }
    const laidNode = {
      ...info,
      key: `n${x}`,
      cx,
      cy: depth * rowStep + TREE_NODE_H / 2,
      depth,
      children: kids,
    }
    laid.push(laidNode)
    return laidNode
  }

  build(root(leafCount), 0, true)

  const edges = []
  for (const n of laid) {
    for (const c of n.children) edges.push({ from: n, to: c, key: `${n.key}-${c.key}` })
  }

  const svgW = Math.max(leafCol, 1) * colStep
  const svgH = (maxDepth + 1) * rowStep
  return { laid, edges, dims: { svgW, svgH }, leafCount, nodeCount: width }
}

// Plain-text rendering (indented, root-first) for the copy button.
function treeLayoutToText(layout) {
  if (!layout) return ''
  const lines = []
  const byDepth = [...layout.laid].sort((a, b) => a.depth - b.depth || a.cx - b.cx)
  for (const n of byDepth) {
    const tag = n.isRoot ? 'root' : n.isLeaf ? `leaf ${n.leafIndex}` : `node ${n.x}`
    const who = n.member ? `${n.member.username || 'Member'} (uid:${n.member.userId})` : ''
    const status = n.hasPub ? (n.hasPriv ? 'has priv' : 'pub only') : 'blank'
    const flags = [n.isSelf ? 'self' : null, n.onSelfPath ? 'on-path' : null]
      .filter(Boolean)
      .join(',')
    lines.push(
      `${'  '.repeat(n.depth)}${tag} [${status}]${who ? ` ${who}` : ''}${flags ? ` <${flags}>` : ''}`
    )
  }
  return lines.join('\n')
}

// One positioned node box in the diagram.
function TreeNodeBox({ node }) {
  const dotColor = node.hasPub
    ? node.hasPriv
      ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]'
      : 'bg-sky-400'
    : 'bg-white/20'
  const tag = node.isRoot ? 'root' : node.isLeaf ? `L${node.leafIndex}` : `n${node.x}`
  const border = node.onSelfPath
    ? 'border-emerald-400/45 bg-emerald-500/[0.06]'
    : node.isRoot
      ? 'border-violet-400/40 bg-violet-500/[0.06]'
      : 'border-white/[0.1] bg-white/[0.02]'

  return (
    <div
      title={node.publicKeyB64 || (node.hasPub ? '' : 'blank node')}
      style={{
        position: 'absolute',
        left: node.cx - TREE_NODE_W / 2,
        top: node.cy - TREE_NODE_H / 2,
        width: TREE_NODE_W,
        height: TREE_NODE_H,
      }}
      className={`flex flex-col justify-center gap-0.5 rounded-md border px-1.5 py-1 ${border}`}
    >
      <div className='flex items-center gap-1'>
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <span
          className={`shrink-0 rounded px-1 text-[9px] font-mono ${
            node.isRoot
              ? 'bg-violet-500/20 text-violet-200'
              : node.isLeaf
                ? 'bg-white/[0.08] text-white/75'
                : 'bg-white/[0.05] text-white/50'
          }`}
        >
          {tag}
        </span>
        {node.isSelf && (
          <span className='shrink-0 rounded bg-emerald-500/15 px-1 text-[8.5px] text-emerald-300'>
            self
          </span>
        )}
        {node.hasPriv && <KeyRound size={9} className='ml-auto shrink-0 text-emerald-300/80' />}
      </div>

      {node.isLeaf ? (
        node.member ? (
          <div className='flex min-w-0 items-center gap-1'>
            <span className='truncate text-[11px] text-white/85'>
              {node.member.username || 'Member'}
            </span>
            {node.member.leafSigningPubKeyB64 ? (
              <span
                className='shrink-0 rounded bg-violet-500/15 px-1 text-[8px] text-violet-200'
                title='leaf signing key present'
              >
                sig
              </span>
            ) : (
              <span
                className='shrink-0 rounded bg-amber-500/15 px-1 text-[8px] text-amber-200'
                title='no leaf signing key'
              >
                no-sig
              </span>
            )}
          </div>
        ) : (
          <div className='truncate text-[10px] text-white/30'>
            {node.hasPub ? 'occupied' : 'blank'}
          </div>
        )
      ) : (
        <div className='truncate font-mono text-[9.5px] text-white/35'>
          {node.publicKeyB64 ? shortKey(node.publicKeyB64, 6, 4) : 'blank'}
        </div>
      )}
    </div>
  )
}
TreeNodeBox.propTypes = {
  node: PropTypes.object.isRequired,
}

// SVG + positioned-box diagram. Edges are drawn parent-bottom → child-top.
function TreeDiagram({ layout }) {
  const { svgW, svgH } = layout.dims
  return (
    <div className='overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-3'>
      <div style={{ position: 'relative', width: svgW, height: svgH, minWidth: '100%' }}>
        <svg
          width={svgW}
          height={svgH}
          className='absolute inset-0 pointer-events-none'
          style={{ overflow: 'visible' }}
        >
          {layout.edges.map((e) => {
            const onPath = e.from.onSelfPath && e.to.onSelfPath
            const x1 = e.from.cx
            const y1 = e.from.cy + TREE_NODE_H / 2
            const x2 = e.to.cx
            const y2 = e.to.cy - TREE_NODE_H / 2
            const midY = (y1 + y2) / 2
            return (
              <path
                key={e.key}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                fill='none'
                stroke={onPath ? 'rgba(52,211,153,0.55)' : 'rgba(255,255,255,0.14)'}
                strokeWidth={onPath ? 1.6 : 1}
              />
            )
          })}
        </svg>
        {layout.laid.map((node) => (
          <TreeNodeBox key={node.key} node={node} />
        ))}
      </div>
    </div>
  )
}
TreeDiagram.propTypes = {
  layout: PropTypes.object.isRequired,
}

function GroupTreeSection({ activeChat, userId, refreshTick }) {
  const [state, setState] = useState({ loading: true, groupState: null, error: null })

  const groupId = activeChat?.type === 'group' ? activeChat?.groupId : null

  const load = useCallback(async () => {
    if (!groupId) {
      setState({ loading: false, groupState: null, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const gs = await loadGroupState(groupId)
      setState({ loading: false, groupState: gs, error: null })
    } catch (err) {
      setState({
        loading: false,
        groupState: null,
        error: err?.message || 'Failed to load group state',
      })
    }
  }, [groupId])

  useEffect(() => {
    load()
  }, [load, refreshTick])

  const gs = state.groupState

  const layout = useMemo(() => {
    if (!gs?.tree?.nodes) return null
    // Prefer the explicit selfLeafIndex; fall back to a roster lookup by userId.
    let selfLeafIndex = gs.selfLeafIndex
    if (!Number.isInteger(selfLeafIndex)) {
      const mine = (gs.roster ?? []).find((m) => String(m.userId) === String(userId ?? ''))
      selfLeafIndex = Number.isInteger(mine?.leafIndex) ? mine.leafIndex : null
    }
    return buildTreeLayout(gs.tree.nodes, gs.tree.leafData ?? {}, selfLeafIndex)
  }, [gs, userId])

  if (!groupId) return null

  const width = gs?.tree?.nodes?.length ?? 0
  const leafCount = width > 0 ? Math.floor((width + 1) / 2) : 0
  const occupiedLeaves = layout ? layout.laid.filter((n) => n.isLeaf && n.hasPub).length : 0
  const privNodes = layout ? layout.laid.filter((n) => n.hasPriv).length : 0

  return (
    <section className='mb-4'>
      <SectionHeader
        icon={<Network size={12} className='text-emerald-300/80' />}
        title='Ratchet Tree (TreeKEM)'
        count={width}
        onRefresh={load}
      />
      {state.error && (
        <div className='mb-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200'>
          {state.error}
        </div>
      )}

      {gs?.tree?.nodes ? (
        <>
          <div className='mb-2 flex flex-wrap items-center gap-1.5 text-[10px]'>
            <span className='rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/55'>
              epoch {gs.epoch}
            </span>
            <span className='rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/55'>
              {leafCount} leaves · {width} nodes
            </span>
            <span className='rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/55'>
              {occupiedLeaves} occupied
            </span>
            <span className='rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/55'>
              {privNodes} priv held
            </span>
            <div className='flex-1' />
            <button
              onClick={() => copyText(treeLayoutToText(layout))}
              className='flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-white/60 hover:bg-white/10'
              title='Copy tree as text'
            >
              <Copy size={10} /> copy
            </button>
          </div>

          {/* Legend */}
          <div className='mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-white/40'>
            <span className='flex items-center gap-1'>
              <span className='inline-block h-1.5 w-1.5 rounded-full bg-emerald-400' /> pub + priv
            </span>
            <span className='flex items-center gap-1'>
              <span className='inline-block h-1.5 w-1.5 rounded-full bg-sky-400' /> pub only
            </span>
            <span className='flex items-center gap-1'>
              <span className='inline-block h-1.5 w-1.5 rounded-full bg-white/20' /> blank
            </span>
            <span className='flex items-center gap-1'>
              <KeyRound size={9} className='text-emerald-300/80' /> private key held
            </span>
            <span className='flex items-center gap-1'>
              <span className='inline-block h-2 w-3 rounded-sm bg-emerald-500/[0.18]' /> our path to
              root
            </span>
          </div>

          {layout ? (
            <TreeDiagram layout={layout} />
          ) : (
            <div className='rounded-lg border border-white/[0.06] bg-black/30 px-3 py-3 text-[11px] text-white/40'>
              Tree is empty.
            </div>
          )}
        </>
      ) : (
        !state.loading && (
          <div className='text-[11px] text-white/40'>No tree loaded for this group.</div>
        )
      )}
    </section>
  )
}
GroupTreeSection.propTypes = {
  activeChat: PropTypes.object,
  userId: PropTypes.string,
  refreshTick: PropTypes.number.isRequired,
}

function CryptoSection({ activeChat, userId, refreshTick }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const ownIdentity = await getIdentityKeys().catch(() => null)
      if (activeChat?.type === 'group' && activeChat?.groupId) {
        const gs = await loadGroupState(activeChat.groupId).catch(() => null)
        setData({ kind: 'group', ownIdentity, groupState: gs })
      } else if (activeChat?.id) {
        const peerId = String(activeChat.id)
        const [rootKey, sendingChain, receivingChain, peerIdentity] = await Promise.all([
          getRootKey(userId, peerId).catch(() => null),
          getSendingChainKey(userId, peerId).catch(() => null),
          getReceivingChainKey(userId, peerId).catch(() => null),
          getPeerIdentityKeys(peerId).catch(() => null),
        ])
        setData({
          kind: 'dm',
          peerId,
          ownIdentity,
          rootKey,
          sendingChain,
          receivingChain,
          peerIdentity,
        })
      } else {
        setData({ kind: 'none', ownIdentity })
      }
    } catch (err) {
      setError(err?.message || 'Failed to load crypto state')
    }
  }, [activeChat, userId])

  useEffect(() => {
    load()
  }, [load, refreshTick])

  return (
    <section>
      <SectionHeader title='Crypto State' onRefresh={load} />
      {error && (
        <div className='mb-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200'>
          {error}
        </div>
      )}
      {data?.ownIdentity && (
        <CollapsibleRow
          title='Own Identity'
          subtitle={shortKey(data.ownIdentity.publicKeyX25519)}
          defaultOpen
        >
          <KeyValue label='publicKeyX25519' value={data.ownIdentity.publicKeyX25519} />
          {showAll && (
            <KeyValue label='privateKeyX25519' value={data.ownIdentity.privateKeyX25519} />
          )}
          <KeyValue label='publicKeyEd25519' value={data.ownIdentity.publicKeyEd25519} />
          {showAll && (
            <KeyValue label='privateKeyEd25519' value={data.ownIdentity.privateKeyEd25519} />
          )}
          <button
            onClick={() => setShowAll((v) => !v)}
            className='mt-1 rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10'
          >
            {showAll ? 'Hide private keys' : 'Show private keys'}
          </button>
        </CollapsibleRow>
      )}

      {data?.kind === 'dm' && (
        <div className='mt-2 space-y-1.5'>
          <CollapsibleRow
            title={`Peer · ${activeChat?.username || activeChat?.name || data.peerId}`}
            subtitle={`uid:${data.peerId}`}
            defaultOpen
          >
            <KeyValue label='peer.publicKeyX25519' value={data.peerIdentity?.publicKeyX25519} />
            <KeyValue label='peer.publicKeyEd25519' value={data.peerIdentity?.publicKeyEd25519} />
            <KeyValue label='peer.firstSeenAt' value={data.peerIdentity?.firstSeenAt} />
          </CollapsibleRow>

          <CollapsibleRow
            title='Double Ratchet · Root Key'
            subtitle={data.rootKey ? `${data.rootKey.length} bytes` : '—'}
          >
            <KeyValue label='base64' value={bytesToBase64(data.rootKey)} />
            <KeyValue
              label='hex (first 32)'
              value={data.rootKey ? bytesPreview(data.rootKey, 32) : null}
            />
          </CollapsibleRow>

          <CollapsibleRow
            title='Sending Chain Key'
            subtitle={data.sendingChain ? `${data.sendingChain.length} bytes` : '—'}
          >
            <KeyValue label='base64' value={bytesToBase64(data.sendingChain)} />
            <KeyValue
              label='hex (first 32)'
              value={data.sendingChain ? bytesPreview(data.sendingChain, 32) : null}
            />
          </CollapsibleRow>

          <CollapsibleRow
            title='Receiving Chain Key'
            subtitle={data.receivingChain ? `${data.receivingChain.length} bytes` : '—'}
          >
            <KeyValue label='base64' value={bytesToBase64(data.receivingChain)} />
            <KeyValue
              label='hex (first 32)'
              value={data.receivingChain ? bytesPreview(data.receivingChain, 32) : null}
            />
          </CollapsibleRow>
        </div>
      )}

      {data?.kind === 'group' && data.groupState && (
        <div className='mt-2 space-y-1.5'>
          <CollapsibleRow
            title='MLS Epoch Secrets'
            subtitle={`epoch ${data.groupState.epoch}`}
            defaultOpen
          >
            <KeyValue label='applicationSecret' value={data.groupState.applicationSecretB64} />
            <KeyValue label='senderDataSecret' value={data.groupState.senderDataSecretB64} />
            <KeyValue label='externalSecret' value={data.groupState.externalSecretB64} />
            <KeyValue label='membershipSecret' value={data.groupState.membershipSecretB64} />
            <KeyValue label='resumptionPsk' value={data.groupState.resumptionPskB64} />
            <KeyValue label='initSecret (next)' value={data.groupState.initSecretB64} />
            <KeyValue label='confirmationTag' value={data.groupState.confirmationTagB64} />
            <KeyValue
              label='confirmedTranscriptHash'
              value={data.groupState.confirmedTranscriptHashB64}
            />
            <KeyValue label='treeHash' value={data.groupState.treeHashB64} />
          </CollapsibleRow>

          {data.groupState.leafSigningPrivKeyB64 && (
            <CollapsibleRow title='Own Leaf Signing Key' subtitle='private — sensitive'>
              <KeyValue label='leafSigningPrivKey' value={data.groupState.leafSigningPrivKeyB64} />
            </CollapsibleRow>
          )}

          <CollapsibleRow
            title='Sender Generations (per-leaf message counters)'
            subtitle={`${Object.keys(data.groupState.senderGenerations ?? {}).length} leaves tracked`}
          >
            {Object.entries(data.groupState.senderGenerations ?? {}).map(([k, v]) => (
              <KeyValue key={k} label={`leaf ${k}`} value={safeStringify(v)} />
            ))}
            {Object.keys(data.groupState.senderGenerations ?? {}).length === 0 && (
              <div className='text-[11px] text-white/40'>No generations yet.</div>
            )}
          </CollapsibleRow>

          <CollapsibleRow title='Raw Group State (JSON)' subtitle='all fields'>
            <pre className='max-h-80 overflow-auto whitespace-pre-wrap break-all text-[10.5px] text-white/70'>
              {safeStringify(data.groupState)}
            </pre>
          </CollapsibleRow>
        </div>
      )}

      {data?.kind === 'none' && (
        <div className='text-[11px] text-white/40'>
          Open a chat or group to see its crypto state.
        </div>
      )}
    </section>
  )
}
CryptoSection.propTypes = {
  activeChat: PropTypes.object,
  userId: PropTypes.string,
  refreshTick: PropTypes.number.isRequired,
}

// ── Group Messages section ──────────────────────────────────────────────────
function GroupMessagesSection({ activeChat }) {
  const [, force] = useState(0)
  const [onlyThisGroup, setOnlyThisGroup] = useState(true)
  const [showOutgoing, setShowOutgoing] = useState(true)
  const [showIncoming, setShowIncoming] = useState(true)

  useEffect(() => {
    if (!groupTraceBuffer) return undefined
    return groupTraceBuffer.subscribe(() => force((n) => n + 1))
  }, [])

  const activeGroupId = activeChat?.type === 'group' ? String(activeChat?.groupId ?? '') : null
  const entries = groupTraceBuffer?.entries ?? EMPTY_TRACE_ENTRIES

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (onlyThisGroup && activeGroupId && String(e.groupId) !== activeGroupId) return false
      if (!showOutgoing && e.direction === 'out') return false
      if (!showIncoming && e.direction === 'in') return false
      return true
    })
  }, [entries, onlyThisGroup, showOutgoing, showIncoming, activeGroupId])

  // Keep each trace event visible. Re-add flows can legitimately reuse the same
  // leaf/generation, so the generated trace id is part of the fallback key.
  const merged = useMemo(() => {
    const byKey = new Map()
    for (const e of filtered) {
      const key =
        e.messageId ||
        [
          e.groupId ?? '?',
          e.direction ?? '?',
          e.phase ?? '?',
          e.epoch ?? '?',
          e.senderLeafIndex ?? '?',
          e.generation ?? '?',
          e.id ?? '?',
        ].join(':')
      if (!byKey.has(key)) byKey.set(key, { key, parts: [] })
      byKey.get(key).parts.push(e)
    }
    return Array.from(byKey.values()).sort((a, b) => {
      const ta = a.parts[a.parts.length - 1].time.getTime()
      const tb = b.parts[b.parts.length - 1].time.getTime()
      return tb - ta
    })
  }, [filtered])

  return (
    <section className='mb-4'>
      <SectionHeader
        icon={<MessageSquare size={12} className='text-sky-300/80' />}
        title='Group Messages (trace)'
        count={merged.length}
        onRefresh={() => force((n) => n + 1)}
      />

      <div className='mb-2 flex flex-wrap items-center gap-1.5 text-[10.5px]'>
        <Toggle on={onlyThisGroup} onClick={() => setOnlyThisGroup((v) => !v)}>
          this group only
        </Toggle>
        <Toggle on={showIncoming} onClick={() => setShowIncoming((v) => !v)}>
          <ArrowDownLeft size={10} className='inline -mt-0.5' /> incoming
        </Toggle>
        <Toggle on={showOutgoing} onClick={() => setShowOutgoing((v) => !v)}>
          <ArrowUpRight size={10} className='inline -mt-0.5' /> outgoing
        </Toggle>
        <div className='flex-1' />
        <button
          onClick={() => groupTraceBuffer?.clear()}
          className='rounded bg-white/5 px-2 py-0.5 text-[10px] text-rose-300/80 hover:bg-rose-500/15'
        >
          clear
        </button>
      </div>

      {merged.length === 0 && (
        <div className='rounded border border-white/[0.06] bg-white/[0.015] px-3 py-3 text-center text-[11px] text-white/40'>
          No group messages traced yet. Send or receive a group message to populate.
        </div>
      )}

      <div className='space-y-1.5'>
        {merged.map(({ key, parts }) => {
          const arrival = parts.find((p) => p.phase === 'arrive')
          const crypto = parts.find((p) => p.phase === 'decrypt' || p.phase === 'encrypt')
          const isOut = parts.some((p) => p.direction === 'out')
          const last = parts[parts.length - 1]
          let preview = '(no plaintext captured)'
          if (typeof arrival?.plaintext === 'string' && arrival.plaintext.length > 0) {
            preview = arrival.plaintext
          } else if (crypto?.plaintextBytes) {
            try {
              preview = new TextDecoder().decode(crypto.plaintextBytes)
            } catch {
              preview = `(${crypto.plaintextBytes.length} bytes — not utf-8)`
            }
          }
          const previewShort =
            typeof preview === 'string'
              ? preview.length > 60
                ? `${preview.slice(0, 60)}…`
                : preview
              : '—'

          return (
            <CollapsibleRow
              key={key}
              title={
                <span className='flex items-center gap-2'>
                  {isOut ? (
                    <ArrowUpRight size={12} className='text-emerald-300' />
                  ) : (
                    <ArrowDownLeft size={12} className='text-sky-300' />
                  )}
                  <span className='truncate'>{previewShort}</span>
                </span>
              }
              subtitle={`${formatTime(last.time)} · ${arrival?.senderUsername || (isOut ? 'me' : '?')} · gen ${
                crypto?.generation ?? '?'
              } · epoch ${crypto?.epoch ?? arrival?.epoch ?? '?'}`}
              badges={
                <>
                  {arrival?.framing && (
                    <span className='rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60'>
                      {arrival.framing}
                    </span>
                  )}
                  {crypto?.sourceFraming && !arrival?.framing && (
                    <span className='rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60'>
                      {crypto.sourceFraming}
                    </span>
                  )}
                </>
              }
            >
              {arrival && (
                <div className='mb-2 border-b border-white/[0.05] pb-2'>
                  <div className='mb-1 text-[10px] uppercase tracking-wider text-white/40'>
                    Arrival
                  </div>
                  <KeyValue label='messageId' value={arrival.messageId} />
                  <KeyValue label='groupId' value={arrival.groupId} />
                  <KeyValue label='senderUserId' value={arrival.senderUserId} />
                  <KeyValue label='senderUsername' value={arrival.senderUsername} />
                  <KeyValue label='isOwnMessage' value={String(arrival.isOwnMessage)} />
                  <KeyValue label='createdAt' value={arrival.createdAt} />
                  <KeyValue label='contentType' value={arrival.contentType} />
                  <KeyValue label='framing' value={arrival.framing} />
                  <KeyValue
                    label='ciphertextB64 size'
                    value={`${arrival.sizes?.ciphertextB64 ?? 0} chars`}
                  />
                  <KeyValue
                    label='encryptedSenderDataB64 size'
                    value={`${arrival.sizes?.encryptedSenderDataB64 ?? 0} chars`}
                  />
                  <KeyValue
                    label='headerB64 size'
                    value={`${arrival.sizes?.headerB64 ?? 0} chars`}
                  />
                  <KeyValue
                    label='usedPendingPlaintext'
                    value={String(arrival.usedPendingPlaintext)}
                  />
                </div>
              )}

              {crypto && (
                <div className='mb-2 border-b border-white/[0.05] pb-2'>
                  <div className='mb-1 text-[10px] uppercase tracking-wider text-white/40'>
                    {crypto.phase === 'encrypt' ? 'Encryption' : 'Decryption'}
                  </div>
                  <KeyValue label='phase' value={crypto.phase} />
                  <KeyValue label='direction' value={crypto.direction} />
                  <KeyValue label='epoch' value={crypto.epoch} />
                  <KeyValue label='senderLeafIndex' value={crypto.senderLeafIndex} />
                  <KeyValue label='generation' value={crypto.generation} />
                  {Number.isInteger(crypto.expectedGeneration) && (
                    <KeyValue label='expectedGeneration' value={crypto.expectedGeneration} />
                  )}
                  <KeyValue label='sourceFraming' value={crypto.sourceFraming} />
                  <KeyValue
                    label='applicationSecret (b64)'
                    value={bytesToBase64(crypto.appSecret)}
                  />
                  <KeyValue label='derivedKey (b64)' value={bytesToBase64(crypto.derivedKey)} />
                  <KeyValue
                    label='derivedKey (hex)'
                    value={crypto.derivedKey ? bytesPreview(crypto.derivedKey, 32) : null}
                  />
                  <KeyValue label='nonce (b64)' value={bytesToBase64(crypto.nonce)} />
                  <KeyValue
                    label='nonce (hex)'
                    value={crypto.nonce ? bytesPreview(crypto.nonce, 32) : null}
                  />
                  {crypto.ciphertextBytes && (
                    <KeyValue label='ciphertext bytes' value={`${crypto.ciphertextBytes.length}`} />
                  )}
                  {crypto.plaintextBytes && (
                    <KeyValue label='plaintext bytes' value={`${crypto.plaintextBytes.length}`} />
                  )}
                </div>
              )}

              <div className='mb-1 text-[10px] uppercase tracking-wider text-white/40'>
                Plaintext
              </div>
              <pre className='max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-[11px] text-white/85'>
                {typeof preview === 'string' ? preview : safeStringify(preview)}
              </pre>
            </CollapsibleRow>
          )
        })}
      </div>
    </section>
  )
}
GroupMessagesSection.propTypes = {
  activeChat: PropTypes.object,
}

function Toggle({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-0.5 transition ${
        on
          ? 'bg-violet-500/20 text-violet-100'
          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  )
}
Toggle.propTypes = {
  on: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node,
}

// ── Console pane ────────────────────────────────────────────────────────────
function ConsolePane() {
  const [, force] = useState(0)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeLevels, setActiveLevels] = useState(() => new Set(LEVELS))
  const [showLevelMenu, setShowLevelMenu] = useState(false)
  const scrollRef = useRef(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (!sharedBuffer) return undefined
    if (paused) return undefined
    return sharedBuffer.subscribe(() => force((n) => n + 1))
  }, [paused])

  useEffect(() => {
    if (!autoScrollRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  })

  const entries = sharedBuffer?.entries ?? EMPTY_TRACE_ENTRIES
  const lowerFilter = filter.trim().toLowerCase()
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!activeLevels.has(e.level)) return false
      if (!lowerFilter) return true
      return e.args.some((a) => safeStringify(a).toLowerCase().includes(lowerFilter))
    })
  }, [entries, lowerFilter, activeLevels])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const handleCopy = () => {
    const text = filtered
      .map(
        (e) =>
          `[${formatTime(e.time)}] ${e.level.toUpperCase()} ${e.args
            .map((a) => safeStringify(a))
            .join(' ')}`
      )
      .join('\n')
    copyText(text)
  }

  const toggleLevel = (level) => {
    setActiveLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2'>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder='Filter…'
          className='min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none'
        />
        <div className='relative'>
          <button
            onClick={() => setShowLevelMenu((v) => !v)}
            title='Levels'
            className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10'
          >
            <Filter size={14} />
          </button>
          {showLevelMenu && (
            <div className='absolute right-0 top-9 z-10 w-32 rounded-lg border border-white/10 bg-[#11121a] p-1 shadow-xl'>
              {LEVELS.map((l) => (
                <label
                  key={l}
                  className='flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[12px] text-white/80 hover:bg-white/5'
                >
                  <input
                    type='checkbox'
                    checked={activeLevels.has(l)}
                    onChange={() => toggleLevel(l)}
                    className='accent-violet-500'
                  />
                  <span className={LEVEL_COLORS[l]}>{l}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          title={paused ? 'Resume' : 'Pause'}
          className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10'
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          onClick={handleCopy}
          title='Copy visible'
          className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10'
        >
          <Copy size={14} />
        </button>
        <button
          onClick={() => sharedBuffer?.clear()}
          title='Clear'
          className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-rose-300/80 hover:bg-rose-500/15'
        >
          <Trash2 size={14} />
        </button>
        <span className='ml-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50 font-mono'>
          {filtered.length}/{entries.length}
        </span>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain font-mono text-[11.5px] leading-relaxed'
      >
        {filtered.length === 0 ? (
          <div className='grid h-full place-items-center px-6 text-center text-[12px] text-white/40'>
            No logs match the current filter.
          </div>
        ) : (
          <ul className='divide-y divide-white/[0.04]'>
            {filtered.map((e) => (
              <li key={e.id} className='px-3 py-1.5 hover:bg-white/[0.02]'>
                <div className='flex items-baseline gap-2'>
                  <span className='shrink-0 text-[10px] text-white/30'>{formatTime(e.time)}</span>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-wider ${LEVEL_COLORS[e.level]}`}
                  >
                    {e.level}
                  </span>
                  <pre
                    className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${LEVEL_COLORS[e.level]}`}
                  >
                    {e.args.map((a) => safeStringify(a)).join(' ')}
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────────
export default function DebugPanel({ open, onClose, activeChat, userId, removedGroups = {} }) {
  const [tab, setTab] = useState('overview')
  const [refreshTick, setRefreshTick] = useState(0)
  const [dumpStatus, setDumpStatus] = useState(null)
  const [dumpBusy, setDumpBusy] = useState(false)
  const [widthPct, setWidthPct] = useState(() => {
    if (typeof window === 'undefined') return 70
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    const stored = Number(localStorage.getItem('echo-debug-width-pct'))
    if (Number.isFinite(stored) && stored >= 20 && stored <= 100) return stored
    return isMobile ? 70 : 40
  })
  const [maximized, setMaximized] = useState(false)
  const dragRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('echo-debug-width-pct', String(widthPct))
  }, [widthPct])

  // Auto-refresh data sections every 5s while open
  useEffect(() => {
    if (!open) return undefined
    const t = setInterval(() => setRefreshTick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [open])

  // Pointer-driven resize handle (desktop only)
  useEffect(() => {
    const handle = dragRef.current
    if (!handle) return undefined

    let dragging = false
    const onDown = (e) => {
      dragging = true
      handle.setPointerCapture?.(e.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    const onMove = (e) => {
      if (!dragging) return
      const vw = window.innerWidth
      const fromRight = vw - e.clientX
      const pct = Math.max(20, Math.min(100, (fromRight / vw) * 100))
      setWidthPct(pct)
      setMaximized(pct >= 99)
    }
    const onUp = (e) => {
      if (!dragging) return
      dragging = false
      handle.releasePointerCapture?.(e.pointerId)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    handle.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      handle.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const effectiveWidthPct = maximized ? 100 : widthPct

  const handleExportDiagnosticLog = async () => {
    setDumpBusy(true)
    setDumpStatus('Collecting MLS, messages, keys, and server state…')
    try {
      const payload = await buildComprehensiveDebugLog({
        userId,
        activeChat,
        removedGroups,
      })
      const filename = downloadDebugLog(payload)
      setDumpStatus(`Downloaded ${filename}`)
      try {
        await copyText(JSON.stringify(payload, null, 2))
        setDumpStatus(`Downloaded ${filename} — also copied JSON to clipboard`)
      } catch {
        /* clipboard optional */
      }
    } catch (err) {
      setDumpStatus(`Export failed: ${err?.message ?? err}`)
    } finally {
      setDumpBusy(false)
    }
  }

  return (
    <>
      {/* Backdrop — only when the panel covers most of the screen.
          At smaller widths the chat behind stays interactive so users can
          read the chat alongside the debug panel. */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200 ${
          open && effectiveWidthPct >= 90 ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        data-testid='debug-panel'
        aria-hidden={!open}
        style={{
          width: `min(100vw, ${effectiveWidthPct}%)`,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        className={`fixed inset-y-0 right-0 z-[70] flex h-[100dvh] max-w-[100vw] flex-col border-l border-white/10 bg-[#0b0b0f]/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Resize handle — works on mobile (wider grab area) and desktop */}
        <div
          ref={dragRef}
          className='absolute inset-y-0 -left-3 z-10 w-6 cursor-col-resize md:-left-1 md:w-3'
          title='Drag to resize'
          style={{ touchAction: 'none' }}
        >
          {/* Visual rail */}
          <div className='absolute inset-y-0 left-2.5 w-px bg-white/10 transition-colors hover:bg-violet-400/60 md:left-1' />
          {/* Mobile grip indicator */}
          <div className='pointer-events-none absolute top-1/2 left-1.5 hidden h-12 w-1 -translate-y-1/2 rounded-full bg-white/30 max-md:block' />
        </div>

        {/* Header */}
        <div className='flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3'>
          <div className='flex items-center gap-2'>
            <span className='inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' />
            <h3 className='text-[13px] font-semibold tracking-tight text-white'>Debug Console</h3>
          </div>
          <div className='flex items-center gap-1'>
            <button
              onClick={handleExportDiagnosticLog}
              disabled={dumpBusy}
              title='Download full diagnostic JSON (MLS state, commits, keys, console, traces)'
              className='flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/15 px-2.5 py-1.5 text-[11px] font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50'
            >
              <Download size={13} className='shrink-0' />
              <span className='truncate'>{dumpBusy ? 'Exporting…' : 'Export log'}</span>
            </button>
            <button
              onClick={() => setRefreshTick((n) => n + 1)}
              title='Refresh data'
              className='grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white'
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setMaximized((v) => !v)}
              title={maximized ? 'Restore width' : 'Maximize'}
              className='hidden h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white md:grid'
            >
              {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={onClose}
              aria-label='Close debug panel'
              className='grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white'
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {dumpStatus && (
          <div
            className={`shrink-0 border-b px-4 py-1.5 text-[10.5px] font-mono ${
              dumpStatus.startsWith('Export failed')
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                : 'border-violet-500/20 bg-violet-500/10 text-violet-100'
            }`}
          >
            {dumpStatus}
          </div>
        )}

        {/* Tabs */}
        <div className='flex shrink-0 items-center gap-1 border-b border-white/10 px-2 py-1.5'>
          <TabButton
            active={tab === 'overview'}
            onClick={() => setTab('overview')}
            icon={<Layers size={13} />}
          >
            Overview
          </TabButton>
          <TabButton
            active={tab === 'console'}
            onClick={() => setTab('console')}
            icon={<Terminal size={13} />}
          >
            Console
          </TabButton>
        </div>

        {/* Body */}
        {tab === 'overview' ? (
          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3'>
            <DevicesSection userId={userId} refreshTick={refreshTick} />
            <GroupSection activeChat={activeChat} userId={userId} refreshTick={refreshTick} />
            <GroupTreeSection activeChat={activeChat} userId={userId} refreshTick={refreshTick} />
            <GroupMessagesSection activeChat={activeChat} />
            <CryptoSection activeChat={activeChat} userId={userId} refreshTick={refreshTick} />
          </div>
        ) : (
          <ConsolePane />
        )}
      </aside>
    </>
  )
}

DebugPanel.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  activeChat: PropTypes.object,
  userId: PropTypes.string,
  removedGroups: PropTypes.object,
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
        active
          ? 'bg-violet-500/20 text-violet-100'
          : 'text-white/55 hover:bg-white/5 hover:text-white/85'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
TabButton.propTypes = {
  active: PropTypes.bool,
  onClick: PropTypes.func,
  icon: PropTypes.node,
  children: PropTypes.node,
}
