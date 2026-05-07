// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import GroupChat from "./GroupChat";

const loadGroupStateMock = vi.fn();
const createNewGroupStateMock = vi.fn();
const saveGroupStateMock = vi.fn();
const encryptApplicationMessageMock = vi.fn();
const decryptApplicationMessageMock = vi.fn();
const applyCommitMock = vi.fn();
const processWelcomeMock = vi.fn();
const getIdentityKeysMock = vi.fn();
const getSavedMessagesMock = vi.fn();
const updateSavedMessagesMock = vi.fn();
const consumePendingOutgoingGroupMessageMock = vi.fn();
const setPendingOutgoingGroupMessageMock = vi.fn();
const deletePendingOutgoingGroupMessageMock = vi.fn();
const getSocketMock = vi.fn();

vi.mock("../../../socket", () => ({
  getSocket: (...args) => getSocketMock(...args),
}));

vi.mock("./MessageDisplay/displayText", () => ({
  default: ({ messages }) => (
    <div data-testid="display-text">{messages.map((message) => message.text).join("|")}</div>
  ),
}));

vi.mock("./MessageInput/GroupSendText", () => ({
  default: ({ sendMessage, disabled, disabledReason }) => (
    <button
      data-testid="group-send-text"
      data-disabled={disabled ? "true" : "false"}
      data-disabled-reason={disabledReason ?? ""}
      disabled={disabled}
      onClick={() => sendMessage("client message")}
    >
      send
    </button>
  ),
}));

vi.mock("./utils/crypto/groupCryptoProvider", () => ({
  loadGroupState: (...args) => loadGroupStateMock(...args),
  createNewGroupState: (...args) => createNewGroupStateMock(...args),
  saveGroupState: (...args) => saveGroupStateMock(...args),
  encryptApplicationMessage: (...args) => encryptApplicationMessageMock(...args),
  decryptApplicationMessage: (...args) => decryptApplicationMessageMock(...args),
  applyCommit: (...args) => applyCommitMock(...args),
  processWelcome: (...args) => processWelcomeMock(...args),
}));

vi.mock("./utils/chat/keyManagement", () => ({
  consumePendingOutgoingGroupMessage: (...args) => consumePendingOutgoingGroupMessageMock(...args),
  deletePendingOutgoingGroupMessage: (...args) => deletePendingOutgoingGroupMessageMock(...args),
  getIdentityKeys: (...args) => getIdentityKeysMock(...args),
  getSavedMessages: (...args) => getSavedMessagesMock(...args),
  setPendingOutgoingGroupMessage: (...args) => setPendingOutgoingGroupMessageMock(...args),
  updateSavedMessages: (...args) => updateSavedMessagesMock(...args),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeOpenGroupResponse(overrides = {}) {
  return {
    success: true,
    group: {
      groupId: "group-1",
      name: "Project Team",
      createdBy: "alice",
      mlsEnabled: true,
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      ...(overrides.group ?? {}),
    },
    members: [
      { userId: "alice", username: "Alice", leafIndex: 0, status: "active" },
      { userId: "bob", username: "Bob", leafIndex: 1, status: "active" },
      ...(overrides.members ?? []),
    ],
    membership: {
      role: "admin",
      leafIndex: 0,
      status: "active",
      ...(overrides.membership ?? {}),
    },
  };
}

describe("GroupChat MLS state lifecycle", () => {
  let container;
  let root;
  let socket;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    Element.prototype.scrollIntoView = vi.fn();

    loadGroupStateMock.mockReset();
    createNewGroupStateMock.mockReset();
    saveGroupStateMock.mockReset();
    encryptApplicationMessageMock.mockReset();
    decryptApplicationMessageMock.mockReset();
    applyCommitMock.mockReset();
    processWelcomeMock.mockReset();
    getIdentityKeysMock.mockReset();
    getIdentityKeysMock.mockResolvedValue(null);
    getSavedMessagesMock.mockReset();
    getSavedMessagesMock.mockResolvedValue([]);
    updateSavedMessagesMock.mockReset();
    consumePendingOutgoingGroupMessageMock.mockReset();
    consumePendingOutgoingGroupMessageMock.mockReturnValue(null);
    setPendingOutgoingGroupMessageMock.mockReset();
    deletePendingOutgoingGroupMessageMock.mockReset();
    updateSavedMessagesMock.mockImplementation(async (_userId, _targetId, message, setMessages) => {
      if (setMessages) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === message._id)) return prev;
          return [...prev, message];
        });
      }
    });

    socket = {
      emit: vi.fn((event, payload, callback) => {
        if (event === "openGroup") {
          callback?.(makeOpenGroupResponse());
          return;
        }

        if (event === "fetchGroupMessages") {
          callback?.({
            success: true,
            messages: [
              {
                _id: "m1",
                groupId: payload.groupId,
                seq: 0,
                userId: "alice",
                username: "Alice",
                contentType: "application",
                headerB64: "header-b64",
                ciphertextB64: "ciphertext-b64",
              },
            ],
          });
          return;
        }

        if (event === "sendGroupMessage") {
          callback?.({ success: true, seq: 1 });
        }
      }),
      on: vi.fn(),
      off: vi.fn(),
    };

    getSocketMock.mockReturnValue(socket);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("reuses existing MLS state and decrypts fetched messages", async () => {
    const localState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "group-key",
      applicationMessageCounter: 0,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };
    const replayedState = {
      ...localState,
      groupKeyB64: "group-key-next",
      applicationMessageCounter: 1,
    };

    loadGroupStateMock.mockResolvedValue(localState);
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));
    decryptApplicationMessageMock.mockResolvedValue({
      plaintextBytes: new TextEncoder().encode("decrypted hello"),
      newState: replayedState,
    });

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="alice"
          username="Alice"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    expect(loadGroupStateMock).toHaveBeenCalledWith("group-1");
    expect(createNewGroupStateMock).not.toHaveBeenCalled();
    expect(getSavedMessagesMock).toHaveBeenCalledWith("alice", "group:group-1");
    expect(decryptApplicationMessageMock).toHaveBeenCalledWith({
      state: expect.objectContaining({ groupId: "group-1", selfLeafIndex: 0 }),
      header: "header-b64",
      ciphertext: "ciphertext-b64",
      includeNewState: true,
    });
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({
        groupKeyB64: "group-key-next",
        applicationMessageCounter: 1,
      }),
    );
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain("decrypted hello");
  });

  it("uses cached plaintext for previously decrypted MLS messages after relogin", async () => {
    loadGroupStateMock.mockResolvedValue({
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "group-key-latest",
      applicationMessageCounter: 4,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    });
    getSavedMessagesMock.mockResolvedValue([
      {
        _id: "m1",
        userId: "alice",
        username: "Alice",
        text: "cached before logout",
        createdAt: "2026-03-21T10:00:00.000Z",
        seenStatus: true,
      },
    ]);
    decryptApplicationMessageMock.mockRejectedValue(new Error("old ciphertext cannot be replayed from latest ratchet"));

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="alice"
          username="Alice"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain("cached before logout");
    expect(container.querySelector('[data-testid="display-text"]').textContent).not.toContain("[Unable to decrypt message]");
  });

  it("creates a placeholder MLS state for invited members without local keys and disables sending", async () => {
    loadGroupStateMock.mockResolvedValue(null);
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));
    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === "openGroup") {
        callback?.(
          makeOpenGroupResponse({
            group: { createdBy: "carol" },
            membership: { role: "member", leafIndex: 1 },
          })
        );
        return;
      }

      if (event === "fetchGroupMessages") {
        callback?.({ success: true, messages: [] });
      }
    });

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="bob"
          username="Bob"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    expect(createNewGroupStateMock).not.toHaveBeenCalled();
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({
        selfUserId: "bob",
        selfLeafIndex: 1,
        groupKeyB64: null,
      })
    );

    const sendButton = container.querySelector('[data-testid="group-send-text"]');
    expect(sendButton.getAttribute("data-disabled")).toBe("true");
  });

  it("encrypts MLS messages, sends the envelope, and persists the advanced state", async () => {
    const localState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "group-key",
      applicationMessageCounter: 5,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };

    loadGroupStateMock.mockResolvedValue(localState);
    decryptApplicationMessageMock.mockResolvedValue(new TextEncoder().encode("existing"));
    encryptApplicationMessageMock.mockResolvedValue({
      header: {
        groupId: "group-1",
        epoch: 2,
        senderLeafIndex: 0,
      },
      headerB64: "header-out",
      ciphertextB64: "ciphertext-out",
      nonceB64: "nonce-out",
      newState: {
        ...localState,
        applicationMessageCounter: 6,
      },
    });
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="alice"
          username="Alice"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    const sendButton = container.querySelector('[data-testid="group-send-text"]');

    await act(async () => {
      sendButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      await flush();
    });

    expect(encryptApplicationMessageMock).toHaveBeenCalledTimes(1);
    const encryptCall = encryptApplicationMessageMock.mock.calls[0][0];
    expect(encryptCall.state).toEqual(expect.objectContaining({ groupId: "group-1", applicationMessageCounter: 5 }));
    expect(ArrayBuffer.isView(encryptCall.plaintextBytes)).toBe(true);

    expect(socket.emit).toHaveBeenCalledWith(
      "sendGroupMessage",
      expect.objectContaining({
        groupId: "group-1",
        nonce: "nonce-out",
        contentType: "application",
        headerB64: "header-out",
        ciphertextB64: "ciphertext-out",
        epoch: 2,
        senderLeafIndex: 0,
      }),
      expect.any(Function)
    );

    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ applicationMessageCounter: 6 })
    );
    expect(setPendingOutgoingGroupMessageMock).toHaveBeenCalledWith({
      groupId: "group-1",
      headerB64: "header-out",
      ciphertextB64: "ciphertext-out",
      text: "client message",
    });
    expect(deletePendingOutgoingGroupMessageMock).not.toHaveBeenCalled();
  });

  it("processes a group welcome for an invited member and enables sending", async () => {
    loadGroupStateMock.mockResolvedValue(null);
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));
    const welcomeState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "bob",
      selfLeafIndex: 1,
      groupKeyB64: "welcome-group-key",
      applicationMessageCounter: 0,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };
    processWelcomeMock.mockResolvedValue(welcomeState);
    encryptApplicationMessageMock.mockResolvedValue({
      header: {
        groupId: "group-1",
        epoch: 2,
        senderLeafIndex: 1,
      },
      headerB64: "header-after-welcome",
      ciphertextB64: "cipher-after-welcome",
      nonceB64: "nonce-after-welcome",
      newState: {
        ...welcomeState,
        applicationMessageCounter: 1,
      },
    });

    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === "openGroup") {
        callback?.(
          makeOpenGroupResponse({
            group: { createdBy: "alice" },
            membership: { role: "member", leafIndex: 1 },
          })
        );
        return;
      }

      if (event === "fetchGroupMessages") {
        callback?.({ success: true, messages: [] });
      }
    });

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="bob"
          username="Bob"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    const sendButton = container.querySelector('[data-testid="group-send-text"]');
    expect(sendButton.getAttribute("data-disabled")).toBe("true");

    const welcomeListener = socket.on.mock.calls.find(([eventName]) => eventName === "groupWelcome")?.[1];
    expect(typeof welcomeListener).toBe("function");

    await act(async () => {
      await welcomeListener({
        groupId: "group-1",
        welcome: {
          groupId: "group-1",
          epoch: 2,
          cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
          roster: [
            { userId: "alice", username: "Alice", leafIndex: 0 },
            { userId: "bob", username: "Bob", leafIndex: 1 },
          ],
          recipientUserId: "bob",
          recipientLeafIndex: 1,
          groupKeyB64: "welcome-group-key",
        },
      });
      await flush();
    });

    expect(processWelcomeMock).toHaveBeenCalledWith(expect.objectContaining({
      welcome: {
        groupId: "group-1",
        epoch: 2,
        cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
        roster: [
          { userId: "alice", username: "Alice", leafIndex: 0 },
          { userId: "bob", username: "Bob", leafIndex: 1 },
        ],
        recipientUserId: "bob",
        recipientLeafIndex: 1,
        groupKeyB64: "welcome-group-key",
      },
      selfUserId: "bob",
    }));

    expect(saveGroupStateMock).toHaveBeenLastCalledWith(
      "group-1",
      expect.objectContaining({
        selfUserId: "bob",
        selfLeafIndex: 1,
        groupKeyB64: "welcome-group-key",
      })
    );
    expect(sendButton.getAttribute("data-disabled")).toBe("false");

    await act(async () => {
      sendButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      await flush();
    });

    expect(encryptApplicationMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          selfUserId: "bob",
          selfLeafIndex: 1,
          groupKeyB64: "welcome-group-key",
        }),
        plaintextBytes: expect.anything(),
      })
    );

    expect(socket.emit).toHaveBeenCalledWith(
      "sendGroupMessage",
      expect.objectContaining({
        groupId: "group-1",
        nonce: "nonce-after-welcome",
        contentType: "application",
        headerB64: "header-after-welcome",
        ciphertextB64: "cipher-after-welcome",
        epoch: 2,
        senderLeafIndex: 1,
      }),
      expect.any(Function)
    );

    expect(saveGroupStateMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(encryptApplicationMessageMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("applies a group commit for the active group and persists the updated state", async () => {
    const localState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "group-key",
      applicationMessageCounter: 3,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };

    loadGroupStateMock.mockResolvedValue(localState);
    decryptApplicationMessageMock.mockResolvedValue(new TextEncoder().encode("existing"));
    applyCommitMock.mockResolvedValue({
      ...localState,
      epoch: 3,
      groupKeyB64: "next-group-key",
      applicationMessageCounter: 0,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
        { userId: "carol", username: "Carol", leafIndex: 2 },
      ],
    });
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="alice"
          username="Alice"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    const commitListener = socket.on.mock.calls.find(([eventName]) => eventName === "groupCommit")?.[1];
    expect(typeof commitListener).toBe("function");

    const commit = {
      groupId: "group-1",
      epoch: 3,
      type: "add",
      senderLeafIndex: 0,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
        { userId: "carol", username: "Carol", leafIndex: 2 },
      ],
      nextGroupKeyB64: "next-group-key",
      targetUserId: "carol",
      targetLeafIndex: 2,
    };

    await act(async () => {
      await commitListener({ groupId: "group-1", commit });
      await flush();
    });

    expect(applyCommitMock).toHaveBeenCalledWith(expect.objectContaining({
      state: expect.objectContaining({ groupId: "group-1", epoch: 2 }),
      commit,
    }));
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({
        epoch: 3,
        groupKeyB64: "next-group-key",
      })
    );
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain("Alice added Carol to the group");
    const sendButton = container.querySelector('[data-testid="group-send-text"]');
    expect(sendButton.getAttribute("data-disabled")).toBe("false");
  });

  it("decrypts live MLS group messages in the active GroupChat using current state", async () => {
    const localState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "group-key",
      applicationMessageCounter: 1,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };
    const advancedState = {
      ...localState,
      senderGenerations: { 1: 1 },
    };

    loadGroupStateMock.mockResolvedValue(localState);
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));
    decryptApplicationMessageMock.mockImplementation(async ({ header }) => {
      if (header === "header-live") {
        return {
          plaintextBytes: new TextEncoder().encode("live incoming"),
          newState: advancedState,
        };
      }
      return new TextEncoder().encode("existing");
    });

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="alice"
          username="Alice"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    const liveListener = socket.on.mock.calls.find(([eventName]) => eventName === "newGroupMessage")?.[1];
    expect(typeof liveListener).toBe("function");

    await act(async () => {
      await liveListener({
        groupId: "group-1",
        _id: "live-1",
        seq: 1,
        userId: "bob",
        username: "Bob",
        contentType: "application",
        headerB64: "header-live",
        ciphertextB64: "cipher-live",
        createdAt: "2026-03-22T15:00:00.000Z",
      });
      await flush();
    });

    expect(decryptApplicationMessageMock).toHaveBeenCalledWith({
      state: expect.objectContaining({ groupId: "group-1", selfLeafIndex: 0 }),
      header: "header-live",
      ciphertext: "cipher-live",
      includeNewState: true,
    });
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ senderGenerations: { 1: 1 } }),
    );
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain("live incoming");
  });

  it("disables sending after a group commit removes the current user", async () => {
    const localState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "bob",
      selfLeafIndex: 1,
      groupKeyB64: "group-key",
      applicationMessageCounter: 2,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };

    loadGroupStateMock.mockResolvedValue(localState);
    decryptApplicationMessageMock.mockResolvedValue(new TextEncoder().encode("existing"));
    applyCommitMock.mockResolvedValue({
      ...localState,
      epoch: 3,
      selfLeafIndex: null,
      groupKeyB64: null,
      applicationMessageCounter: 0,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
      ],
    });
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="bob"
          username="Bob"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    const sendButton = container.querySelector('[data-testid="group-send-text"]');
    expect(sendButton.getAttribute("data-disabled")).toBe("false");

    const commitListener = socket.on.mock.calls.find(([eventName]) => eventName === "groupCommit")?.[1];
    expect(typeof commitListener).toBe("function");

    await act(async () => {
      await commitListener({
        groupId: "group-1",
        commit: {
          groupId: "group-1",
          epoch: 3,
          type: "remove",
          senderLeafIndex: 0,
          roster: [{ userId: "alice", username: "Alice", leafIndex: 0 }],
          nextGroupKeyB64: "next-group-key",
          targetUserId: "bob",
          targetLeafIndex: 1,
        },
      });
      await flush();
    });

    expect(applyCommitMock).toHaveBeenCalledTimes(1);
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({
        epoch: 3,
        selfLeafIndex: null,
        groupKeyB64: null,
      })
    );
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain("Alice removed Bob from the group");
    expect(sendButton.getAttribute("data-disabled")).toBe("true");
  });

  it("does not overwrite local MLS epoch or sender generations during membership refresh", async () => {
    const localState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "group-key",
      applicationMessageCounter: 1,
      senderGenerations: { 0: 1 },
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
        { userId: "charlie", username: "Charlie", leafIndex: 2 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };

    loadGroupStateMock.mockResolvedValue(localState);
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));
    decryptApplicationMessageMock.mockResolvedValue(new TextEncoder().encode("existing"));

    let openGroupCount = 0;
    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === "openGroup") {
        openGroupCount += 1;
        if (openGroupCount === 1) {
          callback?.({
            success: true,
            group: {
              groupId: "group-1",
              name: "Project Team",
              createdBy: "alice",
              mlsEnabled: true,
              epoch: 2,
              cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
            },
            members: [
              { userId: "alice", username: "Alice", leafIndex: 0, status: "active" },
              { userId: "bob", username: "Bob", leafIndex: 1, status: "active" },
              { userId: "charlie", username: "Charlie", leafIndex: 2, status: "active" },
            ],
            membership: {
              role: "admin",
              leafIndex: 0,
              status: "active",
            },
          });
          return;
        }

        callback?.({
          success: true,
          group: {
            groupId: "group-1",
            name: "Project Team",
            createdBy: "alice",
            mlsEnabled: true,
            epoch: 3,
            cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
          },
          members: [
            { userId: "alice", username: "Alice", leafIndex: 0, status: "active" },
            { userId: "charlie", username: "Charlie", leafIndex: 2, status: "active" },
          ],
          membership: {
            role: "admin",
            leafIndex: 0,
            status: "active",
          },
        });
        return;
      }

      if (event === "fetchGroupMessages") {
        callback?.({ success: true, messages: [] });
      }
    });

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="alice"
          username="Alice"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
    });

    saveGroupStateMock.mockClear();

    const membershipListener = socket.on.mock.calls.find(([eventName]) => eventName === "groupMemberRemoved")?.[1];
    expect(typeof membershipListener).toBe("function");

    await act(async () => {
      membershipListener({ groupId: "group-1", memberId: "bob" });
      await flush();
      await flush();
    });

    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({
        epoch: 2,
        cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
        senderGenerations: { 0: 1 },
        roster: [
          { userId: "alice", username: "Alice", leafIndex: 0 },
          { userId: "charlie", username: "Charlie", leafIndex: 2 },
        ],
      })
    );
    expect(saveGroupStateMock).not.toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ epoch: 3 })
    );
  });

  it("replays stored welcomes and commits before decrypting MLS history", async () => {
    loadGroupStateMock.mockResolvedValue(null);
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));

    const welcomeState = {
      groupId: "group-1",
      epoch: 2,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      selfUserId: "bob",
      selfLeafIndex: 1,
      groupKeyB64: "welcome-key",
      applicationMessageCounter: 0,
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      tree: { nodes: [], root: null },
      secrets: { epochSecretsB64: null, initSecretB64: null },
      pendingCommits: [],
    };

    const committedState = {
      ...welcomeState,
      epoch: 3,
      groupKeyB64: "committed-key",
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
        { userId: "carol", username: "Carol", leafIndex: 2 },
      ],
    };

    processWelcomeMock.mockResolvedValue(welcomeState);
    applyCommitMock.mockResolvedValue(committedState);
    decryptApplicationMessageMock.mockResolvedValue(new TextEncoder().encode("replayed history"));

    socket.emit.mockImplementation((event, payload, callback) => {
      if (event === "openGroup") {
        callback?.(
          makeOpenGroupResponse({
            group: { createdBy: "alice", epoch: 3 },
            membership: { role: "member", leafIndex: 1 },
            members: [
              { userId: "alice", username: "Alice", leafIndex: 0, status: "active" },
              { userId: "bob", username: "Bob", leafIndex: 1, status: "active" },
              { userId: "carol", username: "Carol", leafIndex: 2, status: "active" },
            ],
          })
        );
        return;
      }

      if (event === "fetchGroupMessages") {
        callback?.({
          success: true,
          messages: [
            {
              _id: "welcome-1",
              groupId: "group-1",
              seq: 0,
              userId: "alice",
              username: "Alice",
              contentType: "welcome",
              payload: JSON.stringify({
                groupId: "group-1",
                epoch: 2,
                cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
                roster: [
                  { userId: "alice", username: "Alice", leafIndex: 0 },
                  { userId: "bob", username: "Bob", leafIndex: 1 },
                ],
                recipientUserId: "bob",
                recipientLeafIndex: 1,
                groupKeyB64: "welcome-key",
              }),
            },
            {
              _id: "commit-1",
              groupId: "group-1",
              seq: 1,
              userId: "alice",
              username: "Alice",
              contentType: "commit",
              payload: JSON.stringify({
                groupId: "group-1",
                epoch: 3,
                type: "add",
                senderLeafIndex: 0,
                roster: [
                  { userId: "alice", username: "Alice", leafIndex: 0 },
                  { userId: "bob", username: "Bob", leafIndex: 1 },
                  { userId: "carol", username: "Carol", leafIndex: 2 },
                ],
                nextGroupKeyB64: "committed-key",
                targetUserId: "carol",
                targetLeafIndex: 2,
              }),
            },
            {
              _id: "app-1",
              groupId: "group-1",
              seq: 2,
              userId: "alice",
              username: "Alice",
              contentType: "application",
              headerB64: "header-after-replay",
              ciphertextB64: "ciphertext-after-replay",
            },
          ],
        });
      }
    });

    await act(async () => {
      root.render(
        <GroupChat
          activeGroupId="group-1"
          activeGroupName="Project Team"
          userId="bob"
          username="Bob"
          currentWallpaper="default"
        />
      );
      await flush();
      await flush();
      await flush();
    });

    expect(processWelcomeMock).toHaveBeenCalledWith(expect.objectContaining({
      welcome: expect.objectContaining({
        groupId: "group-1",
        recipientUserId: "bob",
        groupKeyB64: "welcome-key",
      }),
      selfUserId: "bob",
    }));
    expect(applyCommitMock).toHaveBeenCalledWith(expect.objectContaining({
      state: expect.objectContaining({ groupKeyB64: "welcome-key", epoch: 2 }),
      commit: expect.objectContaining({
        groupId: "group-1",
        epoch: 3,
        nextGroupKeyB64: "committed-key",
      }),
    }));
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ groupKeyB64: "welcome-key", epoch: 2 })
    );
    expect(saveGroupStateMock).toHaveBeenCalledWith(
      "group-1",
      expect.objectContaining({ groupKeyB64: "committed-key", epoch: 3 })
    );
    expect(decryptApplicationMessageMock).toHaveBeenCalledWith({
      state: expect.objectContaining({ groupKeyB64: "committed-key", epoch: 3 }),
      header: "header-after-replay",
      ciphertext: "ciphertext-after-replay",
      includeNewState: true,
    });
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain("Alice added Carol to the group");
    expect(container.querySelector('[data-testid="display-text"]').textContent).toContain("replayed history");
  });
});
