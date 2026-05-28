import { describe, it, expect, vi } from "vitest";

import { createOpkReplenishHandler, requestOpkStatusAndReplenish } from "../replenish.js";

describe("OPK replenish helper", () => {
  it("does nothing when needed <= 0", async () => {
    const socket = { emit: vi.fn() };
    const eld = { isUnlocked: vi.fn(() => true), storeOPKs: vi.fn() };
    const generateOneTimePreKeys = vi.fn();

    const handler = createOpkReplenishHandler({ socket, eld, generateOneTimePreKeys });
    await handler({ needed: 0 });

    expect(generateOneTimePreKeys).not.toHaveBeenCalled();
    expect(eld.storeOPKs).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("does nothing when ELD is locked", async () => {
    const socket = { emit: vi.fn() };
    const eld = { isUnlocked: vi.fn(() => false), storeOPKs: vi.fn() };
    const generateOneTimePreKeys = vi.fn();

    const handler = createOpkReplenishHandler({ socket, eld, generateOneTimePreKeys });
    await handler({ needed: 10 });

    expect(generateOneTimePreKeys).not.toHaveBeenCalled();
    expect(eld.storeOPKs).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("bounds needed to maxBatch and uploads public bundle after storing private keys", async () => {
    const calls = [];
    const socket = {
      emit: vi.fn((event, payload, cb) => {
        calls.push({ event, payload });
        if (event === "uploadOneTimePreKeys") cb({ success: true, added: payload.oneTimePreKeys.length });
      }),
    };

    const eld = {
      isUnlocked: vi.fn(() => true),
      storeOPKs: vi.fn(async () => {
        calls.push({ event: "storeOPKs" });
      }),
    };

    const generateOneTimePreKeys = vi.fn(async (count) => ({
      privateKeys: Array.from({ length: count }, (_, i) => ({ opkId: `id-${i}`, privateKey: new Uint8Array(32) })),
      publicBundle: Array.from({ length: count }, (_, i) => ({ opkId: `id-${i}`, publicKey: `PUB-${i}` })),
    }));

    const handler = createOpkReplenishHandler({ socket, eld, generateOneTimePreKeys, maxBatch: 2 });
    await handler({ needed: 999 });

    expect(generateOneTimePreKeys).toHaveBeenCalledWith(2);
    expect(eld.storeOPKs).toHaveBeenCalledTimes(1);

    const storeIndex = calls.findIndex((c) => c.event === "storeOPKs");
    const uploadIndex = calls.findIndex((c) => c.event === "uploadOneTimePreKeys");
    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(uploadIndex).toBeGreaterThan(storeIndex);
  });

  it("prevents concurrent replenishment (in-flight guard)", async () => {
    let uploadCb = null;
    const socket = {
      emit: vi.fn((event, payload, cb) => {
        if (event === "uploadOneTimePreKeys") uploadCb = cb;
      }),
    };
    const eld = { isUnlocked: vi.fn(() => true), storeOPKs: vi.fn(() => {}) };
    const generateOneTimePreKeys = vi.fn(() => ({
      privateKeys: [{ opkId: "a", privateKey: new Uint8Array(32) }],
      publicBundle: [{ opkId: "a", publicKey: "P" }],
    }));

    const handler = createOpkReplenishHandler({ socket, eld, generateOneTimePreKeys, maxBatch: 1 });

    const p1 = handler({ needed: 1 });
    const p2 = handler({ needed: 1 });

    expect(generateOneTimePreKeys).toHaveBeenCalledTimes(1);
    // Handler contains awaits (even for sync mocks), so allow microtasks to run before asserting emit.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(socket.emit).toHaveBeenCalledTimes(1);

    uploadCb?.({ success: true });
    await Promise.all([p1, p2]);
  });

  it("requestOpkStatusAndReplenish calls handler when needed > 0", async () => {
    const socket = {
      emit: vi.fn((event, _payload, cb) => {
        if (event === "getOpkStatus") cb({ success: true, needed: 3 });
      }),
    };
    const handler = vi.fn();

    const status = await requestOpkStatusAndReplenish({ socket, handler });
    expect(status.success).toBe(true);
    expect(handler).toHaveBeenCalledWith({ needed: 3 });
  });
});
