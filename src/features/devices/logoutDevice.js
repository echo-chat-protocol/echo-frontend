import { deviceService } from './deviceService'

const PRIMARY_DEVICE_REVOKE_CODE = 'primary_device_revoke_forbidden'

export async function revokeCurrentDeviceForLogout() {
  const token = localStorage.getItem('token')
  const userId = localStorage.getItem('userId')
  const deviceId = localStorage.getItem('echo-device-id')

  if (!token || !userId || !deviceId) return { attempted: false, revoked: false }

  try {
    const result = await deviceService.listDevices(userId)
    const currentDevice = Array.isArray(result?.devices)
      ? result.devices.find((device) => device.deviceId === deviceId)
      : null

    if (currentDevice?.isPrimary) {
      return { attempted: false, revoked: false, skipped: 'primary_device' }
    }
  } catch {
    // If the device list cannot be loaded, still try the revoke request below.
  }

  try {
    await deviceService.revokeDevice(deviceId)
    return { attempted: true, revoked: true }
  } catch (error) {
    if (error?.code === PRIMARY_DEVICE_REVOKE_CODE) {
      return { attempted: true, revoked: false, skipped: 'primary_device' }
    }
    return { attempted: true, revoked: false, error }
  }
}
