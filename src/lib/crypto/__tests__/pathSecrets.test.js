/**
 * pathSecrets.test.js
 *
 * Tests wrapGroupKey / unwrapGroupKey and wrapPathSecret / unwrapPathSecret using
 * the real AES-256-GCM and X25519 WASM primitives loaded via initSync.
 * Wrong-key and tampered-payload tests exercise the actual authentication tag
 * check rather than a stubbed crypto layer, giving real security guarantees.
 */
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
if (!globalThis.btoa) globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64');

// ── Real WASM mock ────────────────────────────────────────────────────────────
vi.mock('@mascaro101/echo-protocol', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve }      = await import('node:path');

  const aes    = await import('@mascaro101/echo-protocol/aes.js');
  const x25519 = await import('@mascaro101/echo-protocol/x25519.js');

  aes.initSync({
    module: readFileSync(resolve('node_modules/@mascaro101/echo-protocol/aes_bg.wasm')),
  });
  x25519.initSync({
    module: readFileSync(resolve('node_modules/@mascaro101/echo-protocol/x25519_bg.wasm')),
  });

  return {
    default:                        vi.fn(async () => {}),
    encrypt_aad_bytes:              aes.encrypt_aad_bytes,
    decrypt_aad_bytes:              aes.decrypt_aad_bytes,
    diffie_hellman:                 x25519.diffie_hellman,
    generate_private_ephemeral_key: x25519.generate_private_ephemeral_key,
    generate_public_ephemeral_key:  x25519.generate_public_ephemeral_key,
    hkdf_derive:                    x25519.hkdf_derive,
  };
});

const { base64ToBytes, bytesToBase64 } = await import('../../helpers.js');
const {
  wrapGroupKey,
  unwrapGroupKey,
  wrapPathSecret,
  unwrapPathSecret,
  makeCommitAadBytes,
  makePathSecretAadBytes,
  makeHeaderB64,
  makeHeaderBytes,
  parseHeader,
  normalizeBytes,
  randomBytes,
  MLS_HEADER_VERSION,
} = await import('../groupCrypto/pathSecrets.js');

// Access the real X25519 sub-module (already initialised in the mock factory)
// to generate proper clamped X25519 key material for test fixtures.
const x25519 = await import('@mascaro101/echo-protocol/x25519.js');

// ── Fixture helper ────────────────────────────────────────────────────────────

/**
 * Generate a proper X25519 keypair from a deterministic seed byte.
 * Using a seed rather than crypto.getRandomValues makes fixtures reproducible.
 */
function makeKeypair(seedByte) {
  const seed = new Uint8Array(32).fill(seedByte);
  const priv = x25519.generate_private_ephemeral_key(seed);
  const pub  = x25519.generate_public_ephemeral_key(priv);
  return {
    privB64: bytesToBase64(priv),
    pubB64:  bytesToBase64(pub),
  };
}

// ── wrapGroupKey / unwrapGroupKey ─────────────────────────────────────────────

describe('wrapGroupKey / unwrapGroupKey', () => {
  const GROUP_KEY_B64 = bytesToBase64(new Uint8Array(32).fill(0xaa));

  it('round-trip with the correct private key recovers the original group key', async () => {
    const { privB64, pubB64 } = makeKeypair(0x01);
    const aad = makeCommitAadBytes('group-1', 1);

    const wrapped   = await wrapGroupKey(GROUP_KEY_B64, pubB64, aad);
    const recovered = await unwrapGroupKey(wrapped, privB64, aad);

    expect(recovered).toBe(GROUP_KEY_B64);
  });

  it('unwrap with a different private key throws (wrong DH → wrong wrap key → GCM auth fails)', async () => {
    const { pubB64 }           = makeKeypair(0x02);
    const { privB64: wrongPriv } = makeKeypair(0x03); // different seed
    const aad = makeCommitAadBytes('group-2', 1);

    const wrapped = await wrapGroupKey(GROUP_KEY_B64, pubB64, aad);
    await expect(unwrapGroupKey(wrapped, wrongPriv, aad)).rejects.toThrow();
  });

  it('tampered ciphertext (flipped byte) throws (GCM authentication tag failure)', async () => {
    const { privB64, pubB64 } = makeKeypair(0x04);
    const aad = makeCommitAadBytes('group-3', 2);

    const wrapped    = await wrapGroupKey(GROUP_KEY_B64, pubB64, aad);
    const encBytes   = base64ToBytes(wrapped.encryptedB64);
    encBytes[0]     ^= 0xff;
    const tampered   = { ...wrapped, encryptedB64: bytesToBase64(encBytes) };

    await expect(unwrapGroupKey(tampered, privB64, aad)).rejects.toThrow();
  });

  it('tampered auth tag (last byte flipped) throws', async () => {
    const { privB64, pubB64 } = makeKeypair(0x05);
    const aad = makeCommitAadBytes('group-4', 1);

    const wrapped  = await wrapGroupKey(GROUP_KEY_B64, pubB64, aad);
    const encBytes = base64ToBytes(wrapped.encryptedB64);
    encBytes[encBytes.length - 1] ^= 0x01;
    const tampered = { ...wrapped, encryptedB64: bytesToBase64(encBytes) };

    await expect(unwrapGroupKey(tampered, privB64, aad)).rejects.toThrow();
  });

  it('wrong AAD (different epoch) causes GCM to reject', async () => {
    const { privB64, pubB64 } = makeKeypair(0x06);
    const correctAad = makeCommitAadBytes('group-5', 1);
    const wrongAad   = makeCommitAadBytes('group-5', 2); // epoch changed

    const wrapped = await wrapGroupKey(GROUP_KEY_B64, pubB64, correctAad);
    await expect(unwrapGroupKey(wrapped, privB64, wrongAad)).rejects.toThrow();
  });

  it('wrapped envelope contains non-empty encryptedB64, ephPubB64, and nonceB64', async () => {
    const { pubB64 } = makeKeypair(0x07);
    const wrapped = await wrapGroupKey(GROUP_KEY_B64, pubB64, makeCommitAadBytes('group-6', 1));

    expect(typeof wrapped.encryptedB64).toBe('string');
    expect(wrapped.encryptedB64.length).toBeGreaterThan(0);
    expect(typeof wrapped.ephPubB64).toBe('string');
    expect(wrapped.ephPubB64.length).toBeGreaterThan(0);
    expect(typeof wrapped.nonceB64).toBe('string');
    expect(wrapped.nonceB64.length).toBeGreaterThan(0);
  });

  it('two calls with independent random nonces produce different ciphertexts', async () => {
    const { pubB64 } = makeKeypair(0x08);
    const aad = makeCommitAadBytes('group-7', 1);

    const w1 = await wrapGroupKey(GROUP_KEY_B64, pubB64, aad);
    const w2 = await wrapGroupKey(GROUP_KEY_B64, pubB64, aad);

    // Non-deterministic encryption: nonces must differ across calls.
    expect(w1.nonceB64).not.toBe(w2.nonceB64);
  });
});

// ── wrapPathSecret / unwrapPathSecret ─────────────────────────────────────────

describe('wrapPathSecret / unwrapPathSecret', () => {
  const PATH_SECRET = new Uint8Array(32).fill(0x42);

  it('round-trip with the correct private key recovers the original path secret bytes', async () => {
    const { privB64, pubB64 } = makeKeypair(0x10);
    const aad = makePathSecretAadBytes(5);

    const wrapped   = await wrapPathSecret(PATH_SECRET, pubB64, aad);
    const recovered = await unwrapPathSecret(wrapped, privB64, aad);

    expect(Buffer.from(recovered)).toEqual(Buffer.from(PATH_SECRET));
  });

  it('unwrap with a different private key throws', async () => {
    const { pubB64 }           = makeKeypair(0x11);
    const { privB64: wrongPriv } = makeKeypair(0x12);
    const aad = makePathSecretAadBytes(3);

    const wrapped = await wrapPathSecret(PATH_SECRET, pubB64, aad);
    await expect(unwrapPathSecret(wrapped, wrongPriv, aad)).rejects.toThrow();
  });

  it('tampered ciphertext (first byte flipped) throws', async () => {
    const { privB64, pubB64 } = makeKeypair(0x13);
    const aad = makePathSecretAadBytes(7);

    const wrapped  = await wrapPathSecret(PATH_SECRET, pubB64, aad);
    const encBytes = base64ToBytes(wrapped.encryptedB64);
    encBytes[0]   ^= 0xff;
    const tampered = { ...wrapped, encryptedB64: bytesToBase64(encBytes) };

    await expect(unwrapPathSecret(tampered, privB64, aad)).rejects.toThrow();
  });

  it('wrong AAD (different nodeIndex) causes decryption to fail', async () => {
    const { privB64, pubB64 } = makeKeypair(0x14);

    const wrapped = await wrapPathSecret(PATH_SECRET, pubB64, makePathSecretAadBytes(0));
    // Unwrap with nodeIndex 1 → different AAD → GCM auth failure
    await expect(unwrapPathSecret(wrapped, privB64, makePathSecretAadBytes(1))).rejects.toThrow();
  });

  it('different nodeIndices in makePathSecretAadBytes produce distinct AAD bytes', () => {
    const aad0 = makePathSecretAadBytes(0);
    const aad1 = makePathSecretAadBytes(1);
    expect(Buffer.from(aad0)).not.toEqual(Buffer.from(aad1));
  });
});

// ── makeCommitAadBytes ────────────────────────────────────────────────────────

describe('makeCommitAadBytes', () => {
  it('returns a Uint8Array starting with the EchoMLS/v1/Commit domain prefix', () => {
    const aad = makeCommitAadBytes('grp-1', 0);
    const text = new TextDecoder().decode(aad);
    expect(text.startsWith('EchoMLS/v1/Commit|')).toBe(true);
  });

  it('encodes groupId and epoch into the bytes', () => {
    const aad = makeCommitAadBytes('my-group', 7);
    const text = new TextDecoder().decode(aad);
    expect(text).toContain('my-group');
    expect(text).toContain('7');
  });

  it('different groupId → different bytes', () => {
    const a = makeCommitAadBytes('group-a', 1);
    const b = makeCommitAadBytes('group-b', 1);
    expect(Buffer.from(a)).not.toEqual(Buffer.from(b));
  });

  it('different epoch → different bytes', () => {
    const a = makeCommitAadBytes('same-group', 1);
    const b = makeCommitAadBytes('same-group', 2);
    expect(Buffer.from(a)).not.toEqual(Buffer.from(b));
  });
});

// ── makePathSecretAadBytes ────────────────────────────────────────────────────

describe('makePathSecretAadBytes', () => {
  it('starts with the EchoMLS/v1/PathSecret domain prefix', () => {
    const text = new TextDecoder().decode(makePathSecretAadBytes(0));
    expect(text.startsWith('EchoMLS/v1/PathSecret|')).toBe(true);
  });

  it('encodes nodeIndex into the bytes', () => {
    const text = new TextDecoder().decode(makePathSecretAadBytes(42));
    expect(text).toContain('42');
  });

  it('is deterministic for the same nodeIndex', () => {
    expect(Buffer.from(makePathSecretAadBytes(3))).toEqual(
      Buffer.from(makePathSecretAadBytes(3)),
    );
  });
});

// ── makeHeaderB64 / parseHeader round-trip ────────────────────────────────────

describe('makeHeaderB64 / parseHeader', () => {
  const SAMPLE_HEADER = {
    version:         MLS_HEADER_VERSION,
    groupId:         'grp-42',
    epoch:           5,
    senderLeafIndex: 1,
    generation:      3,
    cipherSuite:     'ECHO-MLS/X25519_AES256GCM_SHA256',
  };

  it('round-trip recovers all header fields', () => {
    const b64    = makeHeaderB64(SAMPLE_HEADER);
    const parsed = parseHeader(b64);
    expect(parsed).toEqual(SAMPLE_HEADER);
  });

  it('makeHeaderB64 returns a non-empty base64 string', () => {
    const b64 = makeHeaderB64(SAMPLE_HEADER);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
  });

  it('parseHeader accepts an already-parsed object and returns it unchanged', () => {
    const parsed = parseHeader(SAMPLE_HEADER);
    expect(parsed).toEqual(SAMPLE_HEADER);
  });

  it('parseHeader throws on null or invalid input', () => {
    expect(() => parseHeader(null)).toThrow();
    expect(() => parseHeader(42)).toThrow();
  });
});

// ── normalizeBytes ────────────────────────────────────────────────────────────

describe('normalizeBytes', () => {
  it('returns a Uint8Array unchanged', () => {
    const u8 = new Uint8Array([1, 2, 3]);
    expect(normalizeBytes(u8, 'test')).toBe(u8);
  });

  it('wraps ArrayBuffer in a Uint8Array', () => {
    const buf = new Uint8Array([4, 5, 6]).buffer;
    const out = normalizeBytes(buf, 'test');
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(out)).toEqual(Buffer.from([4, 5, 6]));
  });

  it('wraps a plain JS array in a Uint8Array', () => {
    const out = normalizeBytes([7, 8, 9], 'test');
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(out)).toEqual(Buffer.from([7, 8, 9]));
  });

  it('throws for a non-byte-array input', () => {
    expect(() => normalizeBytes('string', 'field')).toThrow('Invalid field');
    expect(() => normalizeBytes(42,       'num')).toThrow('Invalid num');
  });
});

// ── randomBytes ──────────────────────────────────────────────────────────────

describe('randomBytes', () => {
  it('returns a Uint8Array of the requested length', () => {
    expect(randomBytes(12)).toBeInstanceOf(Uint8Array);
    expect(randomBytes(12)).toHaveLength(12);
    expect(randomBytes(32)).toHaveLength(32);
  });

  it('successive calls produce different bytes', () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(Buffer.from(a)).not.toEqual(Buffer.from(b));
  });
});
