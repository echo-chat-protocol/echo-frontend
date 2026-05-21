import { describe, expect, it, vi, beforeEach } from 'vitest'

const getDeviceBundles = vi.fn()
const getDeviceIdentities = vi.fn()
const listDevices = vi.fn()
const filterTrustedDeviceBundles = vi.fn(async (bundles) => bundles)

vi.mock('@/features/devices/deviceService', () => ({
  deviceService: {
    getDeviceBundles,
    getDeviceIdentities,
    listDevices,
  },
}))

vi.mock('@/features/devices/deviceKeyBundle', () => ({
  filterTrustedDeviceBundles,
}))

describe('per-device DM fanout targets', () => {
  beforeEach(() => {
    getDeviceBundles.mockReset()
    getDeviceIdentities.mockReset()
    listDevices.mockReset()
    filterTrustedDeviceBundles.mockClear()
    filterTrustedDeviceBundles.mockImplementation(async (bundles) => bundles)
  })

  it('attaches OPK-consuming device bundles only when callers request hydration', async () => {
    const primaryBundle = {
      deviceId: 'peer-primary-device',
      deviceUserId: 'PEER',
      isPrimary: true,
      publicIdentityKeyX25519: 'peer-primary-ik',
      signedPreKey: 'peer-primary-spk',
      opk: { opkId: 'primary-opk', opkPub: 'primary-opk-pub' },
    }
    const secondaryBundle = {
      deviceId: 'peer-phone-device',
      deviceUserId: 'PEER_x1',
      isPrimary: false,
      publicIdentityKeyX25519: 'peer-phone-ik',
      signedPreKey: 'peer-phone-spk',
      opk: { opkId: 'phone-opk', opkPub: 'phone-opk-pub' },
    }

    getDeviceBundles.mockResolvedValue({ bundles: [primaryBundle, secondaryBundle] })
    getDeviceIdentities.mockResolvedValue({
      identities: [
        { deviceId: 'peer-primary-device', deviceUserId: 'PEER', isPrimary: true },
        { deviceId: 'peer-phone-device', deviceUserId: 'PEER_x1', isPrimary: false },
      ],
    })

    const { attachBundlesToFanoutTargets, buildDmFanoutTargets } =
      await import('./perDeviceSession')
    const targets = await buildDmFanoutTargets('PEER')
    const hydrated = await attachBundlesToFanoutTargets(targets)

    expect(targets).toEqual([
      {
        ownerUserId: 'PEER',
        sessionTargetId: 'PEER',
        peerDeviceId: null,
        peerDeviceUserId: null,
        peerUserId: 'PEER',
        deliveryUserId: 'PEER',
        bundle: null,
      },
      {
        ownerUserId: 'PEER',
        sessionTargetId: 'PEER_x1',
        peerDeviceId: 'peer-phone-device',
        peerDeviceUserId: 'PEER_x1',
        peerUserId: 'PEER_x1',
        deliveryUserId: 'PEER_x1',
        bundle: null,
      },
    ])
    expect(getDeviceBundles).toHaveBeenCalledWith('PEER')
    expect(hydrated).toEqual([
      {
        ownerUserId: 'PEER',
        sessionTargetId: 'PEER',
        peerDeviceId: null,
        peerDeviceUserId: null,
        peerUserId: 'PEER',
        deliveryUserId: 'PEER',
        bundle: primaryBundle,
      },
      {
        ownerUserId: 'PEER',
        sessionTargetId: 'PEER_x1',
        peerDeviceId: 'peer-phone-device',
        peerDeviceUserId: 'PEER_x1',
        peerUserId: 'PEER_x1',
        deliveryUserId: 'PEER_x1',
        bundle: secondaryBundle,
      },
    ])
  })

  it('falls back to identity-only linked devices when no trusted device bundle exists', async () => {
    getDeviceBundles.mockResolvedValue({ bundles: [] })
    getDeviceIdentities.mockResolvedValue({
      identities: [
        { deviceId: 'peer-primary-device', deviceUserId: 'PEER', isPrimary: true },
        { deviceId: 'peer-phone-device', deviceUserId: 'PEER_x1', isPrimary: false },
      ],
    })

    const { buildDmFanoutTargets } = await import('./perDeviceSession')
    const targets = await buildDmFanoutTargets('PEER')

    expect(targets).toEqual([
      {
        ownerUserId: 'PEER',
        sessionTargetId: 'PEER',
        peerDeviceId: null,
        peerDeviceUserId: null,
        peerUserId: 'PEER',
        deliveryUserId: 'PEER',
        bundle: null,
      },
      {
        ownerUserId: 'PEER',
        sessionTargetId: 'PEER_x1',
        peerDeviceId: 'peer-phone-device',
        peerDeviceUserId: 'PEER_x1',
        peerUserId: 'PEER_x1',
        deliveryUserId: 'PEER_x1',
        bundle: null,
      },
    ])
  })
})
