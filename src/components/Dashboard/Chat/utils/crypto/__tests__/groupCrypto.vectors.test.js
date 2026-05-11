import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const toHex = (bytes) => Buffer.from(bytes).toString('hex')
const fromHex = (value) => new Uint8Array(Buffer.from(value, 'hex'))

const { encodeGroupContext, advanceTranscriptHash } = await import('../groupCrypto/groupContext.js')
const { encodeCredentialForSigning } = await import('../groupCrypto/credential.js')
const { encodeKeyPackageForSigning } = await import('../groupCrypto/keyPackage.js')
const { encodeProposalForSigning } = await import('../groupCrypto/proposals.js')

const vectorsPath = resolve(
  process.cwd(),
  '..',
  'Echo-Protocol',
  'test-vectors',
  'group-crypto',
  'mls-vectors.json'
)
const vectors = JSON.parse(readFileSync(vectorsPath, 'utf8'))

describe('MLS vectors', () => {
  it('matches the group context vector', () => {
    const vector = vectors.find((entry) => entry.name === 'group-context-01')
    const actual = encodeGroupContext({
      groupId: 'vector-group',
      epoch: 5,
      cipherSuite: 'ECHO-MLS/X25519_AES256GCM_SHA256',
      treeHash: Uint8Array.from({ length: 32 }, (_, i) => i),
      confirmedTranscriptHash: Uint8Array.from({ length: 32 }, (_, i) => 255 - i),
    })
    expect(toHex(actual)).toBe(vector.hex)
  })

  it('matches the transcript hash vector', async () => {
    const vector = vectors.find((entry) => entry.name === 'transcript-hash-01')
    const actual = await advanceTranscriptHash(
      fromHex(vector.prev_confirmed_transcript_hash_hex),
      fromHex(vector.prev_confirmation_tag_hex),
      fromHex(vector.commit_bytes_hex)
    )
    expect(toHex(actual)).toBe(vector.confirmed_transcript_hash_hex)
  })

  it('matches the credential encoding vector', () => {
    const vector = vectors.find((entry) => entry.name === 'credential-encoding-01')
    const actual = encodeCredentialForSigning(
      'alice',
      'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA='
    )
    expect(toHex(actual)).toBe(vector.hex)
  })

  it('matches the KeyPackage encoding vector', () => {
    const vector = vectors.find((entry) => entry.name === 'keypackage-encoding-01')
    const actual = encodeKeyPackageForSigning({
      version: 'EchoMLS/v1',
      cipherSuite: 'ECHO-MLS/X25519_AES256GCM_SHA256',
      userId: 'bob',
      initKeyB64: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
      leafSigningPubKeyB64: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=',
      credential: {
        userId: 'bob',
        leafSigningPubKeyB64: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=',
        signature:
          'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA==',
      },
      createdAt: 1710000000000,
      expiresAt: 1710604800000,
    })
    expect(toHex(actual)).toBe(vector.hex)
  })

  it('matches the add proposal KeyPackage vector', () => {
    const vector = vectors.find((entry) => entry.name === 'proposal-add-keypackage-encoding-01')
    const actual = encodeProposalForSigning({
      type: 'add',
      groupId: 'vector-group',
      epoch: 5,
      senderLeafIndex: 0,
      keyPackage: {
        userId: 'carol',
        initKeyB64: 'BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU=',
        leafSigningPubKeyB64: 'BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY=',
        credential: {
          userId: 'carol',
          leafSigningPubKeyB64: 'BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY=',
          signature:
            'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBw==',
        },
        createdAt: 1711000000000,
        expiresAt: 1711604800000,
      },
    })
    expect(toHex(actual)).toBe(vector.hex)
  })

  it('matches the update proposal KeyPackage vector', () => {
    const vector = vectors.find((entry) => entry.name === 'proposal-update-keypackage-encoding-01')
    const actual = encodeProposalForSigning({
      type: 'update',
      groupId: 'vector-group',
      epoch: 6,
      senderLeafIndex: 1,
      keyPackage: {
        userId: 'bob',
        initKeyB64: 'CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg=',
        leafSigningPubKeyB64: 'CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk=',
        credential: {
          userId: 'bob',
          leafSigningPubKeyB64: 'CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk=',
          signature:
            'CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCg==',
        },
        createdAt: 1712000000000,
        expiresAt: 1712604800000,
      },
    })
    expect(toHex(actual)).toBe(vector.hex)
  })
})
