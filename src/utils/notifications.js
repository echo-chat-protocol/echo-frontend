// Cross-platform notifications helper.
// In Tauri (desktop/mobile) it uses `@tauri-apps/plugin-notification`; on the web
// it falls back to the Web Notifications API.

const isTauriEnv = () =>
  typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__)

// Web fallback notification icon (the Web Notifications API takes a URL).
const WEB_ICON = '/echo-logo.svg'

// Small/status-bar icon (the "image on the left"), a monochrome drawable
// (res/drawable/ic_echo_notification.png). Set per-notification because the
// notification plugin's Rust config is unit-typed — a global `plugins.notification`
// config object crashes init ("invalid type: map, expected unit").
const ANDROID_SMALL_ICON = 'ic_echo_notification'

// High-importance channel so message notifications "pop down" as a heads-up
// banner (with a preview) instead of landing silently in the shade. The plugin's
// auto-created "default" channel is IMPORTANCE_DEFAULT, which never heads-up, and
// a channel's importance can't be raised after creation — hence a dedicated one.
const MESSAGE_CHANNEL_ID = 'echo-messages'

let tauriNotif = null
async function getTauriNotificationApi() {
  if (!isTauriEnv()) return null
  if (tauriNotif) return tauriNotif
  try {
    // `@tauri-apps/plugin-notification` is a real dependency, so let Vite resolve
    // and code-split it normally. The previous `new Function('return import(p)')`
    // dodge left the bare specifier unresolvable at runtime, so the import always
    // threw — silently falling back to the Web Notification API, which the Android
    // WebView reports as "denied" and never actually posts.
    tauriNotif = await import('@tauri-apps/plugin-notification')
    return tauriNotif
  } catch (err) {
    console.warn('[notifications] Tauri notification plugin unavailable:', err)
    return null
  }
}

// Create the high-importance message channel once (Android 8+). Returns whether
// the channel is usable. If the channel commands aren't permitted by the app's
// capabilities (older build), this returns false so callers fall back to the
// default channel instead of targeting a missing one (which silently drops the
// notification — "if the channel does not exist, the notification won't fire").
let messageChannelEnsured = false
async function ensureMessageChannel(api) {
  if (messageChannelEnsured) return true
  if (!api?.createChannel) return false
  try {
    let existing = []
    try {
      existing = api.channels ? await api.channels() : []
    } catch {
      existing = [] // listChannels may be unpermitted; createChannel is idempotent
    }
    if (!existing?.some?.((c) => c.id === MESSAGE_CHANNEL_ID)) {
      await api.createChannel({
        id: MESSAGE_CHANNEL_ID,
        name: 'Messages',
        description: 'New message alerts',
        importance: api.Importance?.High ?? 4, // IMPORTANCE_HIGH → heads-up banner
        visibility: api.Visibility?.Private ?? 0, // hide content on lock screen
        lights: true,
        vibration: true,
      })
    }
    messageChannelEnsured = true
    return true
  } catch (err) {
    console.warn('[notifications] could not create message channel:', err)
    return false
  }
}

// Tauri IPC without depending on `@tauri-apps/api` (use the injected internals).
async function invokeCommand(cmd, args) {
  const internals = typeof window !== 'undefined' ? window.__TAURI_INTERNALS__ : null
  if (!internals?.invoke) return null
  return internals.invoke(cmd, args)
}

// Max staged image size (bytes). Avoids shuttling huge GIFs over IPC for a
// transient notification.
const MAX_NOTIF_IMAGE_BYTES = 3 * 1024 * 1024

// Stage a message image (data: URL or remote http(s) URL) to a local file and
// return a `file://` URL the notification plugin can render as a big picture.
// Returns null on any failure (caller just sends a text-only notification).
async function stageImageForNotification(image) {
  if (!image || !isTauriEnv()) return null
  try {
    let bytes
    let ext
    if (image.startsWith('data:')) {
      const comma = image.indexOf(',')
      if (comma < 0) return null
      const meta = image.slice(5, comma) // e.g. "image/png;base64"
      ext = (meta.split(';')[0].split('/')[1] || 'img').toLowerCase()
      const bin = atob(image.slice(comma + 1))
      bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    } else {
      // Remote URL (e.g. a GIF). Prefer a Rust-side fetch that bypasses CORS and
      // avoids doing network IO on the Android UI thread. Fall back to Web fetch
      // only if the Rust command is unavailable for some reason.
      const extHint = (image.match(/\.(\w+)(?:\?|$)/)?.[1] || 'img')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
      const saved = await invokeCommand('save_notification_image_from_url', {
        url: image,
        ext_hint: extHint,
        timeout_ms: 4000,
      })
      if (saved) return `file://${saved}`
      // Web fetch fallback (may be blocked by CORS)
      const res = await fetch(image)
      if (!res.ok) return null
      bytes = new Uint8Array(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || ''
      ext = (ct.split('/')[1] || image.match(/\.(\w+)(?:\?|$)/)?.[1] || 'img')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    }
    if (!bytes?.length || bytes.length > MAX_NOTIF_IMAGE_BYTES) return null
    const path = await invokeCommand('save_notification_image', {
      data: Array.from(bytes),
      ext: ext || 'img',
    })
    return path ? `file://${path}` : null
  } catch (err) {
    console.warn('[notifications] could not stage image for notification:', err)
    return null
  }
}

// Best-effort: fetch a remote image and return a data: URL (base64). CORS may block
// cross-origin reads; callers should treat failures as non-fatal.
async function toDataUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || 'image/png'
    const buf = await res.arrayBuffer()
    const bin = String.fromCharCode(...new Uint8Array(buf))
    const b64 = btoa(bin)
    return `data:${ct};base64,${b64}`
  } catch {
    return null
  }
}

export async function ensureNotificationPermission() {
  try {
    const api = await getTauriNotificationApi()
    if (api) {
      const granted = await api.isPermissionGranted()
      if (!granted) await api.requestPermission()
      await ensureMessageChannel(api)
      return
    }
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') await Notification.requestPermission()
    }
  } catch {
    // non-fatal
  }
}

// Low-level passthrough. Accepts the Tauri notification Options plus `webIcon`
// (URL used only for the Web Notifications fallback) and `tag` (web grouping).
export async function notify(opts = {}) {
  const { title, body, webIcon, tag } = opts
  try {
    const api = await getTauriNotificationApi()
    if (api) {
      // Do NOT gate sending on isPermissionGranted(): on Android it maps to
      // areNotificationsEnabled(), which can report a false negative even when
      // notifications post fine — and a hard return here silently drops every
      // notification. Permission is requested at startup via
      // ensureNotificationPermission(); just attempt the send and let the OS
      // drop it only if notifications are genuinely disabled.
      // Only target the custom channel if we could actually create it. Sending
      // to a non-existent channel silently drops the notification, so fall back
      // to the plugin's default channel when channel creation isn't permitted.
      let channelId = opts.channelId
      if (channelId === MESSAGE_CHANNEL_ID) {
        const ok = await ensureMessageChannel(api)
        if (!ok) channelId = undefined
      }
      // Forward only the fields the plugin understands.
      const {
        id,
        largeBody,
        summary,
        group,
        groupSummary,
        inboxLines,
        icon,
        largeIcon,
        iconColor,
        number,
        sound,
        attachments,
      } = opts
      api.sendNotification({
        title,
        body,
        id,
        channelId,
        largeBody,
        summary,
        group,
        groupSummary,
        inboxLines,
        icon,
        largeIcon,
        iconColor,
        number,
        sound,
        attachments,
      })
      return
    }
    if (typeof Notification !== 'undefined') {
      if (Notification.permission !== 'granted') {
        const res = await Notification.requestPermission()
        if (res !== 'granted') return
      }
      new Notification(title || 'Notification', {
        body,
        // Prefer a per-notification webIcon (e.g. sender avatar) when provided
        icon: webIcon || WEB_ICON,
        tag,
      })
    }
  } catch {
    // best effort only
  }
}

// ── Per-conversation message notifications ──────────────────────────────────
// Stable positive 32-bit notification id per conversation (always ≥ 2; id 1 is
// reserved for the cross-chat group summary). Repeat messages from the same
// sender reuse the id so they update ONE notification.
function conversationNotifId(key) {
  const s = `echo:${key}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (Math.abs(h) % 2_000_000_000) + 2
}

// Android notification group: every chat's notification joins this group so they
// bundle under one "Echo" entry that expands to show all chats.
const GROUP_KEY = 'echo_messages'
const SUMMARY_ID = 1

// In-memory rolling buffer per conversation (title + recent lines). Drives both
// per-conversation inbox stacking and the cross-chat summary. Resets on reload
// (the system tray is the source of truth anyway).
const convoBuffers = new Map() // key -> { title, lines: string[] }
const MAX_LINES = 5

// Post/refresh the group summary listing the latest line from every chat with
// pending notifications — this is what the user expands to see all chats. Only
// shown once 2+ chats have notifications (a single chat needs no summary).
async function postGroupSummary() {
  const convos = [...convoBuffers.values()].filter((b) => b.lines.length > 0)
  const api = await getTauriNotificationApi()
  if (convos.length < 2) {
    try {
      if (api?.cancel) await api.cancel([SUMMARY_ID])
    } catch {
      // non-fatal
    }
    return
  }
  const lines = convos.map((b) => `${b.title}: ${b.lines[b.lines.length - 1]}`).slice(-MAX_LINES)
  const total = convos.reduce((n, b) => n + b.lines.length, 0)
  await notify({
    id: SUMMARY_ID,
    channelId: MESSAGE_CHANNEL_ID,
    group: GROUP_KEY,
    groupSummary: true,
    title: 'Echo',
    body: `${total} new message${total === 1 ? '' : 's'}`,
    inboxLines: lines,
    summary: `${convos.length} chats`,
    icon: ANDROID_SMALL_ICON,
    webIcon: WEB_ICON,
  })
}

/**
 * Notify about an incoming message. Messages sharing a `conversationKey` collapse
 * into one notification (same id) and stack as inbox lines, and all chats bundle
 * under an expandable group summary. `image` (data:/http(s) URL) renders as a big
 * picture; `avatar` (the sender's profile picture URL) becomes the large icon.
 * @param {{ conversationKey: string, title: string, body: string, image?: string, avatar?: string }} args
 */
export async function notifyMessage({ conversationKey, title, body, image, avatar }) {
  const key = String(conversationKey ?? title ?? 'echo')
  const buf = convoBuffers.get(key) ?? { title, lines: [] }
  buf.title = title || buf.title
  if (body) buf.lines.push(body)
  if (buf.lines.length > MAX_LINES) buf.lines = buf.lines.slice(-MAX_LINES)
  convoBuffers.set(key, buf)

  const count = buf.lines.length
  // The sender's profile picture as the avatar (large icon). No echo-logo default.
  // Try to stage the avatar locally; if that fails and it's an http(s) URL, let
  // the Android plugin fetch it directly (we vendor-extended it to support http/https).
  let largeIcon = null
  // iOS does not support a notification largeIcon/avatar like Android does.
  // It does support image attachments shown in the expanded view. Prefer staging
  // to a file on iOS so we can attach the avatar if needed.
  const isIOS =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '')
  if (avatar) {
    if (isIOS) {
      // On iOS, attachments require a file URL; try staging first.
      largeIcon = await stageImageForNotification(avatar)
      // Fall back to data URL only as a last resort (iOS attachments won't use it).
      if (!largeIcon && /^https?:\/\//i.test(avatar)) largeIcon = await toDataUrl(avatar)
    } else {
      // Android: Prefer an on-the-fly data: URL to avoid native-network-on-UI-thread and CORS issues.
      if (/^https?:\/\//i.test(avatar)) {
        largeIcon = await toDataUrl(avatar)
      }
      if (!largeIcon) largeIcon = await stageImageForNotification(avatar)
      if (!largeIcon && /^https?:\/\//i.test(avatar)) largeIcon = avatar
    }
  }
  const opts = {
    id: conversationNotifId(key),
    channelId: MESSAGE_CHANNEL_ID, // high-importance → heads-up banner with preview
    group: GROUP_KEY,
    tag: `echo:${key}`,
    title: buf.title || 'Echo',
    body: buf.lines[count - 1] || body || 'New message',
    icon: ANDROID_SMALL_ICON,
    // On the web fallback, try to show the sender's avatar as the icon too
    webIcon: avatar || WEB_ICON,
    ...(largeIcon ? { largeIcon } : {}),
  }

  // A media message shows the picture (big-picture style). It takes precedence
  // over the inbox stack, so only stack lines for text-only conversations.
  let fileUrl = null
  if (image) {
    fileUrl = await stageImageForNotification(image)
    if (!fileUrl && /^https?:\/\//i.test(image)) fileUrl = image
  }
  // iOS fallback: if we don't have a message image, attach the avatar so
  // the notification shows a picture on mobile where largeIcon isn't supported.
  if (!fileUrl && isIOS && largeIcon && /^file:\/\//i.test(largeIcon)) {
    opts.attachments = [{ id: 'avatar', url: largeIcon }]
    opts.summary = body || undefined
  }
  if (fileUrl) {
    opts.attachments = [{ id: 'media', url: fileUrl }]
    opts.summary = body || undefined
  } else if (count > 1) {
    // Inbox style: show the recent messages stacked under the one notification.
    opts.inboxLines = [...buf.lines]
    opts.summary = `${count} new messages`
    opts.number = count
  }
  await notify(opts)
  await postGroupSummary()
}

/**
 * Reset a conversation's notification stack and dismiss its system notification
 * (call when the user opens/reads that conversation).
 */
export async function clearMessageNotif(conversationKey) {
  const key = String(conversationKey ?? '')
  if (!key) return
  convoBuffers.delete(key)
  try {
    const api = await getTauriNotificationApi()
    if (api?.cancel) await api.cancel([conversationNotifId(key)])
    // Refresh (or tear down) the cross-chat summary now that one chat is gone.
    await postGroupSummary()
  } catch {
    // non-fatal
  }
}
