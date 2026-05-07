import { describe, it, expect, vi, beforeEach } from "vitest";
import { arrayBufferToBase64 } from "../../helpers.js";

const decryptMock = vi.hoisted(() =>
    vi.fn(async () => JSON.stringify({ text: "hi", image: null }))
);

// deterministic “chain KDF”: mk = byte b, nextCk = b+1
const chainKdfMock = vi.hoisted(() =>
    vi.fn((ck) => {
        const b = ck[0];
        const mk = new Uint8Array(32).fill(b);
        const next = new Uint8Array(32).fill((b + 1) & 0xff);
        return new Uint8Array([...mk, ...next]);
    })
);

const km = vi.hoisted(() => ({
    getSessionKey: vi.fn(),
    setSessionKey: vi.fn(),

    getRootKey: vi.fn(),
    setRootKey: vi.fn(),

    getEphemeralData: vi.fn(),
    setEphemeralData: vi.fn(),
    setOwnEphemeralKeys: vi.fn(),

    getReceivingChainKey: vi.fn(),
    setReceivingChainKey: vi.fn(),
    setSendingChainKey: vi.fn(),

    setCurrentSendingNumber: vi.fn(),
    getCurrentSendingNumber: vi.fn(),
    setPreviousSendingNumber: vi.fn(),

    getCurrentReceivingNumber: vi.fn(),
    setCurrentReceivingNumber: vi.fn(),

    getSkippedMessages: vi.fn(),
    setSkippedMessages: vi.fn(),

    updateSavedMessages: vi.fn(),
}));

vi.mock('@mascaro101/echo-protocol', () => ({
    default: async () => { },
    generate_private_ephemeral_key: vi.fn(),
    generate_public_ephemeral_key: vi.fn(),
    diffie_hellman: vi.fn(),
    hkdf_derive: vi.fn(),
}));

vi.mock("../../crypto/aes", () => ({
    buildAadBytes: () => new Uint8Array([1]),
    decryptWithAad: (...args) => decryptMock(...args),
}));
vi.mock("../../crypto/dr", () => ({
    initializeDoubleRatchetResponse: vi.fn(),
    continueDoubleRatchetChain: vi.fn(),
}));
vi.mock("../../crypto/hkdf", () => ({
    chain_key_KDF: (ck) => chainKdfMock(ck),
    deriveChainKeys: () => ({ receivingChainKey: new Uint8Array(32).fill(99) }),
}));
vi.mock("../../chat/keyManagement", () => km);

import { decryptIncomingMessage } from "../../chat/messageDecryption.js";

beforeEach(() => {
    vi.clearAllMocks();
    km.getRootKey.mockResolvedValue(new Uint8Array(32).fill(1)); // avoid !root_key branch
    km.getEphemeralData.mockResolvedValue({ previousTargetPublicEphemeralKey: "sameDh" }); 
    km.getReceivingChainKey.mockResolvedValue(new Uint8Array(32).fill(5)); // starting CKr
    km.getSkippedMessages.mockResolvedValue({});
});

function msg({ n }) {
    return {
        payload: "ciphertext",
        publicEphemeralKey: "sameDh",
        sendingNumber: n,
        previousSendingNumber: 0,
    };
}

describe("decryptIncomingMessage Nr/skipped (no DH change)", () => {
    it("T2: in-order n=0 sets Nr=1 and advances chain", async () => {
        km.getCurrentReceivingNumber.mockResolvedValue(0);

        await decryptIncomingMessage(msg({ n: 0 }), "nonce", "me", "peer", new Uint8Array(32), {}, null);

        expect(km.setCurrentReceivingNumber).toHaveBeenCalledWith("peer", 1);
        expect(km.setReceivingChainKey).toHaveBeenCalled(); // next CK stored
    });

    it("T3: out-of-order n=2 caches 0..1 and sets Nr=3", async () => {
        km.getCurrentReceivingNumber.mockResolvedValue(0);

        await decryptIncomingMessage(msg({ n: 2 }), "nonce", "me", "peer", new Uint8Array(32), {}, null);

        expect(km.setCurrentReceivingNumber).toHaveBeenCalledWith("peer", 3);

        const skippedArg = km.setSkippedMessages.mock.calls.at(-1)[1];
        expect(skippedArg).toHaveProperty("sameDh");
        expect(skippedArg.sameDh).toHaveProperty("0");
        expect(skippedArg.sameDh).toHaveProperty("1");
    });

    it("T4: late n=1 uses cached skipped key and deletes it", async () => {
        km.getCurrentReceivingNumber.mockResolvedValue(3);

        const mkFor1 = arrayBufferToBase64(new Uint8Array(32).fill(42));
        km.getSkippedMessages.mockResolvedValue({ sameDh: { 1: mkFor1 } });

        await decryptIncomingMessage(msg({ n: 1 }), "nonce", "me", "peer", new Uint8Array(32), {}, null);

        // late message should not advance chain or Nr
        expect(km.setReceivingChainKey).not.toHaveBeenCalled();
        expect(km.setCurrentReceivingNumber).not.toHaveBeenCalled();

        const skippedAfter = km.setSkippedMessages.mock.calls.at(-1)[1];
        expect(skippedAfter.sameDh?.["1"]).toBeUndefined();
    });
});
