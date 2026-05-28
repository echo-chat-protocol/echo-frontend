import { describe, expect, it } from 'vitest'
import {
  canDecryptMlsApplicationMessage,
  filterMessagesForMembershipWindow,
} from '../groupCrypto/messageEpoch'

describe('messageEpoch', () => {
  it('rejects messages from epochs before the user rejoined', () => {
    const state = {
      epoch: 10,
      decryptFromEpoch: 10,
      leftAtEpoch: null,
      applicationSecretB64: 'secret',
    }

    expect(canDecryptMlsApplicationMessage(state, 9)).toBe(false)
    expect(canDecryptMlsApplicationMessage(state, 10)).toBe(true)
  })

  it('filters cached plaintext from the removal gap', () => {
    const filtered = filterMessagesForMembershipWindow(
      [
        { _id: '1', text: 'before', mlsEpoch: 4 },
        { _id: '2', text: 'gap', mlsEpoch: 7 },
        { _id: '3', text: 'after', mlsEpoch: 10 },
        { _id: 'sys', text: 'joined', messageType: 'system' },
      ],
      { decryptFromEpoch: 10, leftAtEpoch: 6 }
    )

    expect(filtered.map((m) => m._id)).toEqual(['1', '3', 'sys'])
  })
})
