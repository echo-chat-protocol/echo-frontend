import { beforeEach, describe, expect, it, vi } from 'vitest';

const wasm = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  hkdf_extract: vi.fn((salt, ikm) => {
    const saltBytes = salt instanceof Uint8Array ? salt : new Uint8Array(salt);
    const ikmBytes = ikm instanceof Uint8Array ? ikm : new Uint8Array(ikm);
    const out = new Uint8Array(32);
    for (let i = 0; i < out.length; i++) {
      out[i] = ((saltBytes[i % saltBytes.length] || 0) ^ (ikmBytes[i % ikmBytes.length] || 0) ^ 0x5a) & 0xff;
    }
    return out;
  }),
  hkdf_expand: vi.fn((prk, info, length) => {
    const prkBytes = prk instanceof Uint8Array ? prk : new Uint8Array(prk);
    const infoBytes = info instanceof Uint8Array ? info : new Uint8Array(info);
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = ((prkBytes[i % prkBytes.length] || 0) + (infoBytes[i % infoBytes.length] || 0) + i) & 0xff;
    }
    return out;
  }),
}));

vi.mock('@mascaro101/echo-protocol', () => ({
  default: (...args) => wasm.init(...args),
  hkdf_extract: (...args) => wasm.hkdf_extract(...args),
  hkdf_expand: (...args) => wasm.hkdf_expand(...args),
}));

import {
  advanceEpoch,
  deriveAppKeyAndNonce,
  deriveSecret,
  expandWithLabel,
  ratchetAppSecret,
} from '../keySchedule.js';

const TEXT_ENCODER = new TextEncoder();

function encodeHKDFLabel(length, label, context) {
  const labelBytes = TEXT_ENCODER.encode(`MLS 1.0 ${label}`);
  const buf = new Uint8Array(2 + 1 + labelBytes.length + 4 + context.length);
  let offset = 0;
  buf[offset++] = (length >>> 8) & 0xff;
  buf[offset++] = length & 0xff;
  buf[offset++] = labelBytes.length;
  buf.set(labelBytes, offset);
  offset += labelBytes.length;
  buf[offset++] = (context.length >>> 24) & 0xff;
  buf[offset++] = (context.length >>> 16) & 0xff;
  buf[offset++] = (context.length >>> 8) & 0xff;
  buf[offset++] = context.length & 0xff;
  buf.set(context, offset);
  return buf;
}

function encodeGroupContext(groupId, epoch) {
  const groupIdBytes = TEXT_ENCODER.encode(groupId);
  const buf = new Uint8Array(4 + 2 + groupIdBytes.length);
  buf[0] = (epoch >>> 24) & 0xff;
  buf[1] = (epoch >>> 16) & 0xff;
  buf[2] = (epoch >>> 8) & 0xff;
  buf[3] = epoch & 0xff;
  buf[4] = (groupIdBytes.length >>> 8) & 0xff;
  buf[5] = groupIdBytes.length & 0xff;
  buf.set(groupIdBytes, 6);
  return buf;
}

function encodeAppSecretContext(leafIndex, generation) {
  const buf = new Uint8Array(8);
  buf[0] = (leafIndex >>> 24) & 0xff;
  buf[1] = (leafIndex >>> 16) & 0xff;
  buf[2] = (leafIndex >>> 8) & 0xff;
  buf[3] = leafIndex & 0xff;
  buf[4] = (generation >>> 24) & 0xff;
  buf[5] = (generation >>> 16) & 0xff;
  buf[6] = (generation >>> 8) & 0xff;
  buf[7] = generation & 0xff;
  return buf;
}

beforeEach(() => {
  wasm.init.mockClear();
  wasm.hkdf_extract.mockClear();
  wasm.hkdf_expand.mockClear();
});

describe('keySchedule expandWithLabel', () => {
  it('initializes the WASM module and passes the encoded HKDFLabel into hkdf_expand', async () => {
    const secret = new Uint8Array([1, 2, 3, 4]);
    const context = new Uint8Array([9, 8, 7]);

    const out = await expandWithLabel(secret, 'epoch', context, 32);

    expect(wasm.init).toHaveBeenCalledTimes(1);
    expect(wasm.hkdf_expand).toHaveBeenCalledTimes(1);
    expect(wasm.hkdf_expand).toHaveBeenCalledWith(
      secret,
      encodeHKDFLabel(32, 'epoch', context),
      32,
    );
    expect(out).toHaveLength(32);
  });
});

describe('keySchedule deriveSecret', () => {
  it('derives a 32-byte secret with an empty context', async () => {
    const secret = new Uint8Array([10, 20, 30, 40]);

    const out = await deriveSecret(secret, 'init');

    expect(wasm.init).toHaveBeenCalledTimes(1);
    expect(wasm.hkdf_expand).toHaveBeenCalledTimes(1);
    expect(wasm.hkdf_expand).toHaveBeenCalledWith(
      secret,
      encodeHKDFLabel(32, 'init', new Uint8Array(0)),
      32,
    );
    expect(out).toHaveLength(32);
  });
});

describe('keySchedule advanceEpoch', () => {
  it('extracts joinerSecret and derives epoch/application/sender-data/init secrets with RFC labels', async () => {
    const initSecret = new Uint8Array(32).fill(0x11);
    const commitSecret = new Uint8Array(32).fill(0x22);

    const result = await advanceEpoch({
      initSecret,
      commitSecret,
      groupId: 'group-42',
      epoch: 7,
    });

    expect(wasm.init).toHaveBeenCalledTimes(5);
    expect(wasm.hkdf_extract).toHaveBeenCalledTimes(1);
    expect(wasm.hkdf_extract).toHaveBeenCalledWith(initSecret, commitSecret);

    const joinerSecret = wasm.hkdf_extract.mock.results[0].value;
    const groupContext = encodeGroupContext('group-42', 7);

    expect(wasm.hkdf_expand).toHaveBeenNthCalledWith(
      1,
      joinerSecret,
      encodeHKDFLabel(32, 'epoch', groupContext),
      32,
    );

    const epochSecret = wasm.hkdf_expand.mock.results[0].value;

    expect(wasm.hkdf_expand).toHaveBeenNthCalledWith(
      2,
      epochSecret,
      encodeHKDFLabel(32, 'encryption', new Uint8Array(0)),
      32,
    );
    expect(wasm.hkdf_expand).toHaveBeenNthCalledWith(
      3,
      epochSecret,
      encodeHKDFLabel(32, 'sender_data', new Uint8Array(0)),
      32,
    );
    expect(wasm.hkdf_expand).toHaveBeenNthCalledWith(
      4,
      epochSecret,
      encodeHKDFLabel(32, 'init', new Uint8Array(0)),
      32,
    );

    expect(result.epochSecret).toEqual(epochSecret);
    expect(result.applicationSecret).toEqual(wasm.hkdf_expand.mock.results[1].value);
    expect(result.senderDataSecret).toEqual(wasm.hkdf_expand.mock.results[2].value);
    expect(result.nextInitSecret).toEqual(wasm.hkdf_expand.mock.results[3].value);
  });
});

describe('keySchedule deriveAppKeyAndNonce', () => {
  it('derives a 32-byte key and a 12-byte nonce from the application secret context', async () => {
    const applicationSecret = new Uint8Array(32).fill(0x33);

    const result = await deriveAppKeyAndNonce(applicationSecret, 5, 9);

    const context = encodeAppSecretContext(5, 9);

    expect(wasm.init).toHaveBeenCalledTimes(2);
    expect(wasm.hkdf_expand).toHaveBeenNthCalledWith(
      1,
      applicationSecret,
      encodeHKDFLabel(32, 'key', context),
      32,
    );
    expect(wasm.hkdf_expand).toHaveBeenNthCalledWith(
      2,
      applicationSecret,
      encodeHKDFLabel(12, 'nonce', context),
      12,
    );

    expect(result.key).toHaveLength(32);
    expect(result.nonce).toHaveLength(12);
    expect(result.key).toEqual(wasm.hkdf_expand.mock.results[0].value);
    expect(result.nonce).toEqual(wasm.hkdf_expand.mock.results[1].value);
  });
});

describe('keySchedule ratchetAppSecret', () => {
  it('ratchets the application secret using the secret label', async () => {
    const applicationSecret = new Uint8Array(32).fill(0x44);

    const result = await ratchetAppSecret(applicationSecret, 2, 11);

    expect(wasm.init).toHaveBeenCalledTimes(1);
    expect(wasm.hkdf_expand).toHaveBeenCalledTimes(1);
    expect(wasm.hkdf_expand).toHaveBeenCalledWith(
      applicationSecret,
      encodeHKDFLabel(32, 'secret', encodeAppSecretContext(2, 11)),
      32,
    );
    expect(result).toEqual(wasm.hkdf_expand.mock.results[0].value);
  });
});
