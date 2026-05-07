import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decryptApplicationMessageMock = vi.fn();
const loadGroupStateMock = vi.fn();
const saveGroupStateMock = vi.fn();
const consumePendingOutgoingGroupMessageMock = vi.fn();
const updateSavedMessagesMock = vi.fn();

vi.mock("../crypto/groupCryptoProvider", () => ({
  decryptApplicationMessage: (...args) => decryptApplicationMessageMock(...args),
  loadGroupState: (...args) => loadGroupStateMock(...args),
  saveGroupState: (...args) => saveGroupStateMock(...args),
}));

vi.mock("./keyManagement", () => ({
  consumePendingOutgoingGroupMessage: (...args) => consumePendingOutgoingGroupMessageMock(...args),
  updateSavedMessages: (...args) => updateSavedMessagesMock(...args),
}));

const { decryptIncomingGroupMessage } = await import("./groupMessageDecryption.js");

describe("decryptIncomingGroupMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T16:00:00.000Z"));

    decryptApplicationMessageMock.mockReset();
    loadGroupStateMock.mockReset();
    saveGroupStateMock.mockReset();
    consumePendingOutgoingGroupMessageMock.mockReset();
    updateSavedMessagesMock.mockReset();
    consumePendingOutgoingGroupMessageMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when the groupId is missing", async () => {
    await expect(
      decryptIncomingGroupMessage({
        message: {},
        userId: "alice",
      }),
    ).rejects.toThrow("decryptIncomingGroupMessage requires a groupId");
  });

  it("stores legacy payload messages without MLS decryption", async () => {
    const result = await decryptIncomingGroupMessage({
      message: {
        _id: "legacy-1",
        groupId: "group-1",
        userId: "bob",
        username: "Bob",
        payload: "plain group text",
        createdAt: "2026-03-22T15:59:00.000Z",
      },
      userId: "alice",
    });

    expect(result.formattedMessage).toEqual({
      _id: "legacy-1",
      userId: "bob",
      username: "Bob",
      text: "plain group text",
      createdAt: "2026-03-22T15:59:00.000Z",
      seenStatus: true,
    });
    expect(decryptApplicationMessageMock).not.toHaveBeenCalled();
    expect(updateSavedMessagesMock).toHaveBeenCalledWith(
      "alice",
      "group:group-1",
      result.formattedMessage,
      null,
    );
  });

  it("falls back to message.text for non-MLS messages", async () => {
    const result = await decryptIncomingGroupMessage({
      message: {
        groupId: "group-1",
        userId: "bob",
        text: "preview text",
      },
      userId: "alice",
    });

    expect(result.formattedMessage.text).toBe("preview text");
    expect(result.formattedMessage._id).toBe("group-1:2026-03-22T16:00:00.000Z");
    expect(updateSavedMessagesMock).toHaveBeenCalledTimes(1);
  });

  it("uses pending plaintext for self MLS echoes without decrypting", async () => {
    consumePendingOutgoingGroupMessageMock.mockReturnValue("my pending plaintext");

    const result = await decryptIncomingGroupMessage({
      message: {
        _id: "self-1",
        groupId: "group-1",
        userId: "alice",
        headerB64: "header-1",
        ciphertextB64: "cipher-1",
        contentType: "application",
      },
      userId: "alice",
      username: "Alice",
    });

    expect(consumePendingOutgoingGroupMessageMock).toHaveBeenCalledWith({
      groupId: "group-1",
      headerB64: "header-1",
      ciphertextB64: "cipher-1",
    });
    expect(result.formattedMessage.text).toBe("my pending plaintext");
    expect(result.formattedMessage.username).toBe("Alice");
    expect(loadGroupStateMock).not.toHaveBeenCalled();
    expect(decryptApplicationMessageMock).not.toHaveBeenCalled();
  });

  it("loads group state, decrypts MLS messages, persists advanced state, and stores plaintext", async () => {
    const localState = { groupId: "group-1", senderGenerations: { 1: 0 } };
    const advancedState = { groupId: "group-1", senderGenerations: { 1: 1 } };
    loadGroupStateMock.mockResolvedValue(localState);
    decryptApplicationMessageMock.mockResolvedValue({
      plaintextBytes: new TextEncoder().encode("decrypted message"),
      newState: advancedState,
    });
    saveGroupStateMock.mockResolvedValue({ ...advancedState, persisted: true });

    const result = await decryptIncomingGroupMessage({
      message: {
        _id: "mls-1",
        groupId: "group-1",
        userId: "bob",
        username: "Bob",
        contentType: "application",
        headerB64: "header-mls",
        ciphertextB64: "cipher-mls",
        createdAt: "2026-03-22T15:58:00.000Z",
      },
      userId: "alice",
    });

    expect(loadGroupStateMock).toHaveBeenCalledWith("group-1");
    expect(decryptApplicationMessageMock).toHaveBeenCalledWith({
      state: localState,
      header: "header-mls",
      ciphertext: "cipher-mls",
      includeNewState: true,
    });
    expect(saveGroupStateMock).toHaveBeenCalledWith("group-1", advancedState);
    expect(result.nextState).toEqual({ ...advancedState, persisted: true });
    expect(result.formattedMessage.text).toBe("decrypted message");
    expect(updateSavedMessagesMock).toHaveBeenCalledWith(
      "alice",
      "group:group-1",
      expect.objectContaining({ text: "decrypted message" }),
      null,
    );
  });

  it("uses the provided currentState instead of loading from storage", async () => {
    const currentState = { groupId: "group-1", senderGenerations: { 1: 0 } };
    decryptApplicationMessageMock.mockResolvedValue({
      plaintextBytes: new TextEncoder().encode("from current state"),
      newState: { groupId: "group-1", senderGenerations: { 1: 1 } },
    });
    saveGroupStateMock.mockResolvedValue({ groupId: "group-1", senderGenerations: { 1: 1 } });

    await decryptIncomingGroupMessage({
      message: {
        groupId: "group-1",
        userId: "bob",
        contentType: "application",
        headerB64: "header-current",
        ciphertextB64: "cipher-current",
      },
      userId: "alice",
      currentState,
    });

    expect(loadGroupStateMock).not.toHaveBeenCalled();
    expect(decryptApplicationMessageMock).toHaveBeenCalledWith({
      state: currentState,
      header: "header-current",
      ciphertext: "cipher-current",
      includeNewState: true,
    });
  });

  it("supports decryptApplicationMessage returning raw plaintext bytes", async () => {
    const currentState = { groupId: "group-1" };
    decryptApplicationMessageMock.mockResolvedValue(
      new TextEncoder().encode("raw bytes plaintext"),
    );

    const result = await decryptIncomingGroupMessage({
      message: {
        groupId: "group-1",
        userId: "bob",
        contentType: "application",
        headerB64: "header-raw",
        ciphertextB64: "cipher-raw",
      },
      userId: "alice",
      currentState,
    });

    expect(result.formattedMessage.text).toBe("raw bytes plaintext");
    expect(result.nextState).toBe(currentState);
    expect(saveGroupStateMock).not.toHaveBeenCalled();
  });

  it("does not persist when the returned MLS state is the same object", async () => {
    const currentState = { groupId: "group-1", senderGenerations: { 1: 0 } };
    decryptApplicationMessageMock.mockResolvedValue({
      plaintextBytes: new TextEncoder().encode("same object state"),
      newState: currentState,
    });

    const result = await decryptIncomingGroupMessage({
      message: {
        groupId: "group-1",
        userId: "bob",
        contentType: "application",
        headerB64: "header-same",
        ciphertextB64: "cipher-same",
      },
      userId: "alice",
      currentState,
    });

    expect(result.nextState).toBe(currentState);
    expect(saveGroupStateMock).not.toHaveBeenCalled();
  });

  it("uses the current user's username for self-authored messages missing a username", async () => {
    consumePendingOutgoingGroupMessageMock.mockReturnValue("self text");

    const result = await decryptIncomingGroupMessage({
      message: {
        groupId: "group-1",
        userId: "alice",
        contentType: "application",
        headerB64: "header-self",
        ciphertextB64: "cipher-self",
      },
      userId: "alice",
      username: "Alice",
    });

    expect(result.formattedMessage.username).toBe("Alice");
  });

  it("uses 'Member' for remote messages missing a username", async () => {
    const currentState = { groupId: "group-1" };
    decryptApplicationMessageMock.mockResolvedValue({
      plaintextBytes: new TextEncoder().encode("remote text"),
      newState: currentState,
    });

    const result = await decryptIncomingGroupMessage({
      message: {
        groupId: "group-1",
        userId: "bob",
        contentType: "application",
        headerB64: "header-remote",
        ciphertextB64: "cipher-remote",
      },
      userId: "alice",
      currentState,
    });

    expect(result.formattedMessage.username).toBe("Member");
  });

  it("passes through the provided setMessages callback to updateSavedMessages", async () => {
    const setMessages = vi.fn();

    await decryptIncomingGroupMessage({
      message: {
        groupId: "group-1",
        userId: "bob",
        payload: "setMessages payload",
      },
      userId: "alice",
      setMessages,
    });

    expect(updateSavedMessagesMock).toHaveBeenCalledWith(
      "alice",
      "group:group-1",
      expect.objectContaining({ text: "setMessages payload" }),
      setMessages,
    );
  });

  it("throws when an MLS application message arrives without local group state", async () => {
    loadGroupStateMock.mockResolvedValue(null);

    await expect(
      decryptIncomingGroupMessage({
        message: {
          groupId: "group-1",
          userId: "bob",
          contentType: "application",
          headerB64: "header-missing",
          ciphertextB64: "cipher-missing",
        },
        userId: "alice",
      }),
    ).rejects.toThrow("Missing local MLS state for group group-1");
  });
});
