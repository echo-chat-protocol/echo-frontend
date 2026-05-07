// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CreateGroupModal from "./CreateGroupModal";

const createNewGroupStateMock = vi.fn();
const buildInitialWelcomesMock = vi.fn();
const getIdentityKeysMock = vi.fn();
const formatProfileImageMock = vi.fn(() => "profile.png");
const getSocketMock = vi.fn();

vi.mock("../../../socket", () => ({
  getSocket: (...args) => getSocketMock(...args),
}));

vi.mock("../DashboardComponents/utils/helpers", () => ({
  formatProfileImage: (...args) => formatProfileImageMock(...args),
}));

vi.mock("../Chat/utils/chat/keyManagement", () => ({
  getIdentityKeys: (...args) => getIdentityKeysMock(...args),
}));

vi.mock("../Chat/utils/crypto/groupCryptoProvider", () => ({
  createNewGroupState: (...args) => createNewGroupStateMock(...args),
  buildInitialWelcomes: (...args) => buildInitialWelcomesMock(...args),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("CreateGroupModal MLS initialization", () => {
  let container;
  let root;
  let socket;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    createNewGroupStateMock.mockReset();
    buildInitialWelcomesMock.mockReset();
    getIdentityKeysMock.mockReset();
    formatProfileImageMock.mockClear();
    getIdentityKeysMock.mockResolvedValue({
      publicKeyX25519: "alice-init-pub-b64",
      privateKeyX25519: "alice-init-priv-b64",
    });

    socket = {
      emit: vi.fn((event, payload, callback) => {
        if (event === "searchUser") {
          callback?.({ success: true, user: { id: "bob", username: "Bob" } });
          return;
        }

        if (event === "getUserInfo") {
          callback?.({ success: true, user: { profilePicture: null } });
          return;
        }

        if (event === "createGroup") {
          callback?.({
            success: true,
            group: {
              groupId: "group-1",
              name: payload.name,
              mlsEnabled: payload.mlsEnabled === true,
              epoch: 0,
              cipherSuite: payload.cipherSuite ?? null,
            },
            members: [
              { userId: "alice", leafIndex: 0 },
              { userId: "bob", leafIndex: 1 },
            ],
          });
          return;
        }

        if (event === "fetchKeyPackage") {
          callback?.({ success: true, initKeyB64: "bob-init-key-b64" });
        }
      }),
      on: vi.fn(),
      off: vi.fn(),
    };

    getSocketMock.mockReturnValue(socket);
    createNewGroupStateMock.mockResolvedValue({
      groupId: "group-1",
      groupKeyB64: "creator-group-key-b64",
    });
    buildInitialWelcomesMock.mockResolvedValue([
      {
        groupId: "group-1",
        epoch: 0,
        cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
        roster: [
          { userId: "alice", username: "Member", leafIndex: 0 },
          { userId: "bob", username: "Bob", leafIndex: 1 },
        ],
        recipientUserId: "bob",
        recipientLeafIndex: 1,
        wrappedInitSecret: { encryptedB64: "init-ct", ephPubB64: "init-pub", nonceB64: "init-nonce" },
        wrappedCommitSecret: { encryptedB64: "commit-ct", ephPubB64: "commit-pub", nonceB64: "commit-nonce" },
        treePublicNodes: ["alice-pub", "root-pub", "bob-pub"],
      },
    ]);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("initializes group MLS state after successful MLS group creation", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <CreateGroupModal
          open
          onClose={onClose}
          onCreated={onCreated}
          userId="alice"
        />
      );
      await flush();
    });

    const nameInput = container.querySelector('input[placeholder="Group name"]');
    const searchInput = container.querySelector('input[placeholder="Search username to add..."]');
    const mlsCheckbox = container.querySelector('input[type="checkbox"]');

    await act(async () => {
      setInputValue(nameInput, "Project Team");
      setInputValue(searchInput, "Bob");
      mlsCheckbox.click();
      await flush();
    });

    const searchAction = searchInput.parentElement.querySelector("button");

    await act(async () => {
      searchAction.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });

    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Add")
    );

    await act(async () => {
      addButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });

    const createButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Create group")
    );

    await act(async () => {
      createButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });

    expect(socket.emit).toHaveBeenCalledWith(
      "createGroup",
      {
        name: "Project Team",
        memberIds: ["bob"],
        mlsEnabled: true,
        cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      },
      expect.any(Function)
    );

    expect(createNewGroupStateMock).toHaveBeenCalledWith({
      groupId: "group-1",
      creatorUserId: "alice",
      roster: [
        { userId: "alice", username: "Member", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
      memberInitKeys: [
        { userId: "alice", leafIndex: 0, initKeyB64: "alice-init-pub-b64" },
        { userId: "bob", leafIndex: 1, initKeyB64: "bob-init-key-b64" },
      ],
      selfInitPrivKeyB64: "alice-init-priv-b64",
    });
    expect(buildInitialWelcomesMock).toHaveBeenCalledWith({
      creatorState: { groupId: "group-1", groupKeyB64: "creator-group-key-b64" },
      roster: [
        { userId: "alice", username: "Member", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
      memberInitKeys: [
        { userId: "bob", initKeyB64: "bob-init-key-b64", leafIndex: 1 },
      ],
    });
    const welcomeEmitCall = socket.emit.mock.calls.find(
      ([eventName]) => eventName === "sendGroupWelcome"
    );
    expect(welcomeEmitCall).toBeTruthy();
    expect(welcomeEmitCall[1]).toEqual({
      groupId: "group-1",
      recipientUserId: "bob",
      welcome: {
        groupId: "group-1",
        epoch: 0,
        cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
        roster: [
          { userId: "alice", username: "Member", leafIndex: 0 },
          { userId: "bob", username: "Bob", leafIndex: 1 },
        ],
        recipientUserId: "bob",
        recipientLeafIndex: 1,
        wrappedInitSecret: { encryptedB64: "init-ct", ephPubB64: "init-pub", nonceB64: "init-nonce" },
        wrappedCommitSecret: { encryptedB64: "commit-ct", ephPubB64: "commit-pub", nonceB64: "commit-nonce" },
        treePublicNodes: ["alice-pub", "root-pub", "bob-pub"],
      },
    });
    expect(onCreated).toHaveBeenCalledWith({
      groupId: "group-1",
      name: "Project Team",
      mlsEnabled: true,
      epoch: 0,
      cipherSuite: "MLS-MVP/X25519_AES256GCM_SHA256",
    });
    expect(onClose).toHaveBeenCalled();
  });
});
