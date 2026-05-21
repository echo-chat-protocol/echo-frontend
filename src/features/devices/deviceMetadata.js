const DEVICE_ID_KEY = 'echo-device-id'

function randomId() {
  return crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function detectPlatform() {
  const ua = navigator.userAgent || ''
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return navigator.platform || 'Web'
}

function detectBrowser() {
  const ua = navigator.userAgent || ''
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'
  return 'Browser'
}

export function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = randomId()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export function resetDeviceId() {
  const deviceId = randomId()
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}

export function getDeviceMetadata() {
  const platform = detectPlatform()
  const browser = detectBrowser()
  const deviceName = `${platform} ${browser}`.trim()

  return {
    deviceId: getOrCreateDeviceId(),
    deviceName,
    platform,
    userAgent: navigator.userAgent || '',
    locale: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  }
}
