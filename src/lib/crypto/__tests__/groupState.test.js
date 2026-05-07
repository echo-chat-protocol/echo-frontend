/**
 * groupState.test.js
 *
 * Unit tests for normalizeGroupState and resolveApplicationKey.
 * These functions are pure (no WASM, no crypto) so no module mocking is required.
 * Tests cover: guard conditions, fallback chains, normalization edge cases, and the
 * `senderGenerations` seeding behaviour that bridges the legacy counter field.
 */
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

// ── Import helpers that treeState / groupState rely on ────────────────────────
// groupState imports treeState which imports @mascaro101/echo-protocol for
// generate_public_ephemeral_key (used by initTreeFromRoster). We only need
// normalizeGroupState and resolveApplicationKey here, both of which never
// reach that code path, but we still need to satisfy the import chain.

vi.mock('@mascaro101/echo-protocol', () => ({
  default: vi.fn(async () => {}),
  generate_public_ephemeral_key: vi.fn((priv) => {
    const out = new Uint8Array(32);
    out.set(new Uint8Array(priv).slice(0, 32));
    out[0] ^= 0x80;
    return out;
  }),
  generate_private_ephemeral_key: vi.fn((rand) => new Uint8Array(rand).slice(0, 32)),
  hkdf_derive: vi.fn((_ikm, _salt, _info, len) => new Uint8Array(len).fill(0xee)),
}));

const {
  normalizeGroupState,
  resolveApplicationKey,
  MLS_STATE_VERSION,
  DEFAULT_MLS_CIPHER_SUITE,
} = await import('../groupCrypto/groupState.js');

const { bytesToBase64, base64ToBytes } = await import('../../helpers.js');

// ── Fixture helpers ───────────────────────────────────────────────────────────

const APP_SECRET  = bytesToBase64(new Uint8Array(32).fill(0xab));
const INIT_SECRET = bytesToBase64(new Uint8Array(32).fill(0xcd));
const GROUP_KEY   = bytesToBase64(new Uint8Array(32).fill(0xef));
const SIGN_PRIV   = bytesToBase64(new Uint8Array(32).fill(0x77));

function minimalState(overrides = {}) {
  return {
    groupId:             'test-group',
    selfUserId:          'alice',
    selfLeafIndex:       0,
    epoch:               0,
    roster:              [{ userId: 'alice', leafIndex: 0 }],
    applicationSecretB64: APP_SECRET,
    initSecretB64:       INIT_SECRET,
    senderGenerations:   {},
    tree:                { nodes: [] },
    pendingCommits:      [],
    ...overrides,
  };
}

// ── normalizeGroupState — guard conditions ────────────────────────────────────

describe('normalizeGroupState — guard conditions', () => {
  it('throws "Invalid group state" for null', () => {
    expect(() => normalizeGroupState(null)).toThrow('Invalid group state');
  });

  it('throws "Invalid group state" for undefined', () => {
    expect(() => normalizeGroupState(undefined)).toThrow('Invalid group state');
  });

  it('throws "Invalid group state" for a string', () => {
    expect(() => normalizeGroupState('oops')).toThrow('Invalid group state');
  });

  it('throws "Invalid group state" for a number', () => {
    expect(() => normalizeGroupState(42)).toThrow('Invalid group state');
  });

  it('does not throw for a bare empty object (all fields have defaults)', () => {
    expect(() => normalizeGroupState({})).not.toThrow();
  });
});

// ── normalizeGroupState — stateVersion ───────────────────────────────────────

describe('normalizeGroupState — stateVersion', () => {
  it('preserves an explicitly set stateVersion', () => {
    const out = normalizeGroupState(minimalState({ stateVersion: 99 }));
    expect(out.stateVersion).toBe(99);
  });

  it('defaults to MLS_STATE_VERSION when stateVersion is absent', () => {
    const out = normalizeGroupState(minimalState({ stateVersion: undefined }));
    expect(out.stateVersion).toBe(MLS_STATE_VERSION);
  });

  // normalizeGroupState does NOT throw for a mismatched stateVersion —
  // that check lives in loadGroupState only.
  it('does NOT throw when stateVersion mismatches MLS_STATE_VERSION', () => {
    expect(() =>
      normalizeGroupState(minimalState({ stateVersion: MLS_STATE_VERSION + 999 })),
    ).not.toThrow();
  });
});

// ── normalizeGroupState — applicationSecretB64 fallback chain ─────────────────

describe('normalizeGroupState — applicationSecretB64 fallback chain', () => {
  it('uses applicationSecretB64 when present', () => {
    const out = normalizeGroupState(minimalState({ applicationSecretB64: APP_SECRET }));
    expect(out.applicationSecretB64).toBe(APP_SECRET);
  });

  it('falls back to groupKeyB64 when applicationSecretB64 is absent', () => {
    const out = normalizeGroupState(
      minimalState({ applicationSecretB64: undefined, groupKeyB64: GROUP_KEY }),
    );
    expect(out.applicationSecretB64).toBe(GROUP_KEY);
  });

  it('falls back to groupKeyB64 when applicationSecretB64 is an empty string', () => {
    const out = normalizeGroupState(
      minimalState({ applicationSecretB64: '', groupKeyB64: GROUP_KEY }),
    );
    expect(out.applicationSecretB64).toBe(GROUP_KEY);
  });

  it('returns null when applicationSecretB64 is explicitly null (no groupKeyB64 fallback)', () => {
    const out = normalizeGroupState(
      minimalState({ applicationSecretB64: null, groupKeyB64: GROUP_KEY }),
    );
    // Explicit null short-circuits the fallback chain.
    expect(out.applicationSecretB64).toBeNull();
  });

  it('returns null when both applicationSecretB64 and groupKeyB64 are absent', () => {
    const out = normalizeGroupState(
      minimalState({ applicationSecretB64: undefined, groupKeyB64: undefined }),
    );
    expect(out.applicationSecretB64).toBeNull();
  });

  it('groupKeyB64 in output mirrors the resolved applicationSecretB64', () => {
    const out = normalizeGroupState(minimalState({ applicationSecretB64: APP_SECRET }));
    expect(out.groupKeyB64).toBe(out.applicationSecretB64);
  });
});

// ── normalizeGroupState — initSecretB64 fallback chain ───────────────────────

describe('normalizeGroupState — initSecretB64 fallback chain', () => {
  it('uses top-level initSecretB64 when present', () => {
    const out = normalizeGroupState(minimalState({ initSecretB64: INIT_SECRET }));
    expect(out.initSecretB64).toBe(INIT_SECRET);
  });

  it('falls back to state.secrets.initSecretB64 when top-level is absent', () => {
    const out = normalizeGroupState(
      minimalState({
        initSecretB64: undefined,
        secrets: { initSecretB64: INIT_SECRET },
      }),
    );
    expect(out.initSecretB64).toBe(INIT_SECRET);
  });

  it('falls back to state.secrets.initSecretB64 when top-level is an empty string', () => {
    const out = normalizeGroupState(
      minimalState({
        initSecretB64: '',
        secrets: { initSecretB64: INIT_SECRET },
      }),
    );
    expect(out.initSecretB64).toBe(INIT_SECRET);
  });

  it('returns null when initSecretB64 is explicitly null (no secrets fallback)', () => {
    const out = normalizeGroupState(
      minimalState({
        initSecretB64: null,
        secrets: { initSecretB64: INIT_SECRET },
      }),
    );
    expect(out.initSecretB64).toBeNull();
  });

  it('returns null when both sources are absent', () => {
    const out = normalizeGroupState(
      minimalState({ initSecretB64: undefined, secrets: {} }),
    );
    expect(out.initSecretB64).toBeNull();
  });

  it('mirrors initSecretB64 inside the nested secrets object', () => {
    const out = normalizeGroupState(minimalState({ initSecretB64: INIT_SECRET }));
    expect(out.secrets.initSecretB64).toBe(INIT_SECRET);
  });

  it('preserves epochInitSecretB64 and epochCommitSecretB64 from state.secrets', () => {
    const epochInit   = bytesToBase64(new Uint8Array(32).fill(0x11));
    const epochCommit = bytesToBase64(new Uint8Array(32).fill(0x22));
    const out = normalizeGroupState(
      minimalState({
        secrets: {
          initSecretB64:       INIT_SECRET,
          epochInitSecretB64:  epochInit,
          epochCommitSecretB64: epochCommit,
        },
      }),
    );
    expect(out.secrets.epochInitSecretB64).toBe(epochInit);
    expect(out.secrets.epochCommitSecretB64).toBe(epochCommit);
  });

  it('sets epochInitSecretB64 and epochCommitSecretB64 to null when absent', () => {
    const out = normalizeGroupState(minimalState({ secrets: undefined }));
    expect(out.secrets.epochInitSecretB64).toBeNull();
    expect(out.secrets.epochCommitSecretB64).toBeNull();
  });
});

// ── normalizeGroupState — senderGenerations seeding ──────────────────────────

describe('normalizeGroupState — senderGenerations seeding from applicationMessageCounter', () => {
  it('seeds own leaf generation from applicationMessageCounter when the slot is absent', () => {
    const out = normalizeGroupState(
      minimalState({
        selfLeafIndex:             2,
        applicationMessageCounter: 7,
        senderGenerations:         {},
      }),
    );
    expect(out.senderGenerations['2']).toBe(7);
  });

  it('does NOT overwrite an existing generation entry', () => {
    const out = normalizeGroupState(
      minimalState({
        selfLeafIndex:             0,
        applicationMessageCounter: 99,
        senderGenerations:         { '0': 5 },
      }),
    );
    expect(out.senderGenerations['0']).toBe(5);
  });

  it('does NOT seed when selfLeafIndex is not an integer', () => {
    const out = normalizeGroupState(
      minimalState({
        selfLeafIndex:             null,
        selfUserId:                'nobody',
        applicationMessageCounter: 3,
        senderGenerations:         {},
        roster:                    [],
      }),
    );
    // No numeric selfLeafIndex → no seeding
    expect(Object.keys(out.senderGenerations)).toHaveLength(0);
  });

  it('does NOT seed when applicationMessageCounter is not an integer', () => {
    const out = normalizeGroupState(
      minimalState({
        selfLeafIndex:             0,
        applicationMessageCounter: 'bad',
        senderGenerations:         {},
      }),
    );
    expect(Object.keys(out.senderGenerations)).toHaveLength(0);
  });

  it('stringifies numeric senderGeneration keys', () => {
    const out = normalizeGroupState(
      minimalState({ senderGenerations: { 1: 3, 2: 8 } }),
    );
    expect(out.senderGenerations).toHaveProperty('1', 3);
    expect(out.senderGenerations).toHaveProperty('2', 8);
  });

  it('strips non-integer generation values', () => {
    const out = normalizeGroupState(
      minimalState({ senderGenerations: { '0': 'bad', '1': 2.5, '2': 4 } }),
    );
    expect(out.senderGenerations).not.toHaveProperty('0');
    expect(out.senderGenerations).not.toHaveProperty('1');
    expect(out.senderGenerations).toHaveProperty('2', 4);
  });
});

// ── normalizeGroupState — epoch / epoch defaults ──────────────────────────────

describe('normalizeGroupState — epoch defaults', () => {
  it('preserves an integer epoch', () => {
    const out = normalizeGroupState(minimalState({ epoch: 5 }));
    expect(out.epoch).toBe(5);
  });

  it('defaults epoch to 0 when absent', () => {
    const out = normalizeGroupState(minimalState({ epoch: undefined }));
    expect(out.epoch).toBe(0);
  });

  it('defaults epoch to 0 when epoch is a string', () => {
    const out = normalizeGroupState(minimalState({ epoch: 'three' }));
    expect(out.epoch).toBe(0);
  });
});

// ── normalizeGroupState — cipherSuite default ────────────────────────────────

describe('normalizeGroupState — cipherSuite default', () => {
  it('preserves a provided cipherSuite', () => {
    const out = normalizeGroupState(minimalState({ cipherSuite: 'CUSTOM-SUITE' }));
    expect(out.cipherSuite).toBe('CUSTOM-SUITE');
  });

  it('defaults to DEFAULT_MLS_CIPHER_SUITE when absent', () => {
    const out = normalizeGroupState(minimalState({ cipherSuite: undefined }));
    expect(out.cipherSuite).toBe(DEFAULT_MLS_CIPHER_SUITE);
  });
});

// ── normalizeGroupState — leafSigningPrivKeyB64 preservation ──────────────────

describe('normalizeGroupState — leafSigningPrivKeyB64', () => {
  it('preserves leafSigningPrivKeyB64 when present', () => {
    const out = normalizeGroupState(minimalState({ leafSigningPrivKeyB64: SIGN_PRIV }));
    expect(out.leafSigningPrivKeyB64).toBe(SIGN_PRIV);
  });

  it('returns null when leafSigningPrivKeyB64 is absent', () => {
    const out = normalizeGroupState(minimalState({ leafSigningPrivKeyB64: undefined }));
    expect(out.leafSigningPrivKeyB64).toBeNull();
  });

  it('returns null when leafSigningPrivKeyB64 is an empty string', () => {
    const out = normalizeGroupState(minimalState({ leafSigningPrivKeyB64: '' }));
    expect(out.leafSigningPrivKeyB64).toBeNull();
  });
});

// ── normalizeGroupState — pendingCommits ─────────────────────────────────────

describe('normalizeGroupState — pendingCommits', () => {
  it('preserves an existing pendingCommits array', () => {
    const pending = [{ id: 'c1' }];
    const out = normalizeGroupState(minimalState({ pendingCommits: pending }));
    expect(out.pendingCommits).toEqual(pending);
  });

  it('defaults to [] when pendingCommits is absent', () => {
    const out = normalizeGroupState(minimalState({ pendingCommits: undefined }));
    expect(out.pendingCommits).toEqual([]);
  });

  it('defaults to [] when pendingCommits is not an array', () => {
    const out = normalizeGroupState(minimalState({ pendingCommits: 'bad' }));
    expect(out.pendingCommits).toEqual([]);
  });
});

// ── normalizeGroupState — selfLeafIndex derivation ───────────────────────────

describe('normalizeGroupState — selfLeafIndex derivation', () => {
  it('uses explicit selfLeafIndex when provided', () => {
    const out = normalizeGroupState(minimalState({ selfLeafIndex: 1, selfUserId: 'bob',
      roster: [{ userId: 'alice', leafIndex: 0 }, { userId: 'bob', leafIndex: 1 }] }));
    expect(out.selfLeafIndex).toBe(1);
  });

  it('derives selfLeafIndex from selfUserId + roster when selfLeafIndex is missing', () => {
    const out = normalizeGroupState(minimalState({
      selfLeafIndex: undefined,
      selfUserId:    'alice',
      roster:        [{ userId: 'alice', leafIndex: 0 }, { userId: 'bob', leafIndex: 1 }],
    }));
    expect(out.selfLeafIndex).toBe(0);
  });
});

// ── resolveApplicationKey ─────────────────────────────────────────────────────

describe('resolveApplicationKey', () => {
  it('returns applicationSecretB64 and keyBytes when present', () => {
    const result = resolveApplicationKey({ applicationSecretB64: APP_SECRET, groupId: 'g1' });
    expect(result.applicationSecretB64).toBe(APP_SECRET);
    expect(result.keyBytes).toBeInstanceOf(Uint8Array);
    expect(result.keyBytes.length).toBeGreaterThan(0);
  });

  it('falls back to groupKeyB64 when applicationSecretB64 is absent', () => {
    const result = resolveApplicationKey({ groupKeyB64: GROUP_KEY, groupId: 'g2' });
    expect(result.applicationSecretB64).toBe(GROUP_KEY);
  });

  it('prefers applicationSecretB64 over groupKeyB64', () => {
    const result = resolveApplicationKey({
      applicationSecretB64: APP_SECRET,
      groupKeyB64:          GROUP_KEY,
      groupId:              'g3',
    });
    expect(result.applicationSecretB64).toBe(APP_SECRET);
  });

  it('throws when both keys are absent', () => {
    expect(() => resolveApplicationKey({ groupId: 'g4' })).toThrow(
      'Group state is missing application key material',
    );
  });

  it('throws when called with null', () => {
    expect(() => resolveApplicationKey(null)).toThrow();
  });

  it('includes the groupId in the error message', () => {
    expect(() => resolveApplicationKey({ groupId: 'my-group' })).toThrow('my-group');
  });

  it('keyBytes matches the base64-decoded applicationSecretB64', () => {
    const result   = resolveApplicationKey({ applicationSecretB64: APP_SECRET, groupId: 'g5' });
    const expected = base64ToBytes(APP_SECRET);
    expect(Buffer.from(result.keyBytes)).toEqual(Buffer.from(expected));
  });
});
