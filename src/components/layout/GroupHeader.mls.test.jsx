// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import GroupHeader from "./GroupHeader";

const loadGroupStateMock = vi.fn();
const saveGroupStateMock = vi.fn();
const buildAddCommitMock = vi.fn();
const buildRemoveCommitMock = vi.fn();
const getSocketMock = vi.fn();
const formatProfileImageMock = vi.fn(() => "profile.png");

vi.mock("../../../../socket", () => ({
  getSocket: (...args) => getSocketMock(...args),
}));

vi.mock("../utils/helpers", () => ({
  formatProfileImage: (...args) => formatProfileImageMock(...args),
}));

vi.mock("../../Chat/utils/crypto/groupCryptoProvider", () => ({
  loadGroupState: (...args) => loadGroupStateMock(...args),
  saveGroupState: (...args) => saveGroupStateMock(...args),
  buildAddCommit: (...args) => buildAddCommitMock(...args),
  buildRemoveCommit: (...args) => buildRemoveCommitMock(...args),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const settle = async () => {
  await act(async () => {
    await flush();
    await flush();
  });
};

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setTextareaValue(textarea, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function makeMember({ userId, username, leafIndex, role = "member" }) {
  return {
    userId,
    username,
    leafIndex,
    role,
    status: "active",
    profilePicture: null,
  };
}

describe("GroupHeader MLS membership updates", () => {
  let container;
  let root;
  let socket;
  let currentMembers;
  let mlsEnabled;
  let groupDescription;
  let groupProfilePicture;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    loadGroupStateMock.mockReset();
    saveGroupStateMock.mockReset();
    buildAddCommitMock.mockReset();
    buildRemoveCommitMock.mockReset();
    formatProfileImageMock.mockClear();

    currentMembers = [
      makeMember({ userId: "alice", username: "Alice", leafIndex: 0, role: "admin" }),
    ];
    mlsEnabled = true;
    groupDescription = "Initial description";
    groupProfilePicture = "/uploads/group-1.png";

    socket = {
      emit: vi.fn((event, payload, callback) => {
        if (event === "openGroup") {
          callback?.({
            success: true,
            group: {
              groupId: payload.groupId,
              name: "Project Team",
              description: groupDescription,
              profilePicture: groupProfilePicture,
              createdBy: "alice",
              mlsEnabled,
              epoch: 2,
              cipherSuite: mlsEnabled ? "MLS-MVP/X25519_AES256GCM_SHA256" : null,
            },
            members: currentMembers,
            membership: {
              role: "admin",
              leafIndex: 0,
              status: "active",
            },
          });
          return;
        }

        if (event === "searchUser") {
          callback?.({ success: true, user: { id: "bob", username: "Bob" } });
          return;
        }

        if (event === "getUserInfo") {
          callback?.({ success: true, user: { profilePicture: null } });
          return;
        }

        if (event === "addGroupMember") {
          currentMembers = [
            ...currentMembers,
            makeMember({ userId: payload.memberId, username: "Bob", leafIndex: 1 }),
          ];
          callback?.({ success: true });
          return;
        }

        if (event === "removeGroupMember") {
          currentMembers = currentMembers.filter(
            (member) => String(member.userId) !== String(payload.memberId)
          );
          callback?.({ success: true });
          return;
        }

        if (event === "sendGroupCommit" || event === "sendGroupWelcome") {
          callback?.({ success: true });
          return;
        }

        if (event === "updateGroupProfile") {
          groupDescription = payload.description;
          groupProfilePicture = payload.profilePicture;
          callback?.({
            success: true,
            group: {
              groupId: payload.groupId,
              name: "Project Team",
              description: groupDescription,
              profilePicture: groupProfilePicture,
            },
          });
          return;
        }

        if (event === "fetchKeyPackage") {
          callback?.({
            success: true,
            initKeyB64: payload.userId === "bob" ? "bob-init-key-b64" : "key-init-b64",
          });
        }
      }),
      on: vi.fn(),
      off: vi.fn(),
    };

    getSocketMock.mockReturnValue(socket);
    saveGroupStateMock.mockImplementation(async (_groupId, state) => ({ ...state }));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  async function renderHeader() {
    await act(async () => {
      root.render(
        <GroupHeader
          groupId="group-1"
          groupName="Project Team"
          groupDescription={groupDescription}
          groupProfilePicture={groupProfilePicture}
          userId="alice"
        />
      );
      await flush();
      await flush();
    });
  }

  async function openMembersModal() {
    const optionsButton = container.querySelector('button[aria-label="Group options"]');
    await act(async () => {
      optionsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });

    const membersButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Members")
    );

    await act(async () => {
      membersButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
  }

  async function openProfileModal() {
    const optionsButton = container.querySelector('button[aria-label="Group options"]');
    await act(async () => {
      optionsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });

    const profileButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Group profile")
    );

    await act(async () => {
      profileButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
  }

  async function searchForBob() {
    const searchInput = container.querySelector('input[placeholder="Search username..."]');
    await act(async () => {
      setInputValue(searchInput, "Bob");
      await flush();
    });

    const searchButton = searchInput.parentElement.querySelector("button");
    await act(async () => {
      searchButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
  }

  it("builds and relays MLS add-member artifacts, then saves next state", async () => {
    loadGroupStateMock.mockResolvedValue({
      groupId: "group-1",
      epoch: 2,
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "old-key",
      roster: [{ userId: "alice", username: "Alice", leafIndex: 0 }],
    });
    buildAddCommitMock.mockResolvedValue({
      commit: { groupId: "group-1", epoch: 3, type: "add" },
      welcome: { groupId: "group-1", epoch: 3, recipientUserId: "bob" },
      nextState: { groupId: "group-1", epoch: 3, groupKeyB64: "new-key" },
    });

    await renderHeader();
    await openMembersModal();
    await searchForBob();

    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Add"
    );

    await act(async () => {
      addButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      await flush();
    });
    await settle();

    expect(loadGroupStateMock).toHaveBeenCalledWith("group-1");
    expect(buildAddCommitMock).toHaveBeenCalledWith({
      state: expect.objectContaining({ groupId: "group-1", selfLeafIndex: 0 }),
      newMember: { userId: "bob", username: "Bob", leafIndex: 1 },
      memberInitKeys: [
        { userId: "alice", leafIndex: 0, initKeyB64: "key-init-b64" },
        { userId: "bob", leafIndex: 1, initKeyB64: "bob-init-key-b64" },
      ],
    });
    expect(socket.emit).toHaveBeenCalledWith(
      "sendGroupCommit",
      { groupId: "group-1", commit: { groupId: "group-1", epoch: 3, type: "add" } },
      expect.any(Function)
    );
    expect(socket.emit).toHaveBeenCalledWith(
      "sendGroupWelcome",
      {
        groupId: "group-1",
        recipientUserId: "bob",
        welcome: { groupId: "group-1", epoch: 3, recipientUserId: "bob" },
      },
      expect.any(Function)
    );
    expect(saveGroupStateMock).toHaveBeenCalledWith("group-1", {
      groupId: "group-1",
      epoch: 3,
      groupKeyB64: "new-key",
    });
  });

  it("builds and relays MLS remove-member commits, then saves next state", async () => {
    currentMembers = [
      makeMember({ userId: "alice", username: "Alice", leafIndex: 0, role: "admin" }),
      makeMember({ userId: "bob", username: "Bob", leafIndex: 1 }),
    ];

    loadGroupStateMock.mockResolvedValue({
      groupId: "group-1",
      epoch: 2,
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "old-key",
      roster: [
        { userId: "alice", username: "Alice", leafIndex: 0 },
        { userId: "bob", username: "Bob", leafIndex: 1 },
      ],
    });
    buildRemoveCommitMock.mockResolvedValue({
      commit: { groupId: "group-1", epoch: 3, type: "remove", targetUserId: "bob" },
      nextState: { groupId: "group-1", epoch: 3, groupKeyB64: "rotated-key" },
    });

    await renderHeader();
    await openMembersModal();

    const removeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Remove"
    );

    await act(async () => {
      removeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      await flush();
    });
    await settle();

    expect(loadGroupStateMock).toHaveBeenCalledWith("group-1");
    expect(buildRemoveCommitMock).toHaveBeenCalledWith({
      state: expect.objectContaining({ groupId: "group-1", selfLeafIndex: 0 }),
      targetUserId: "bob",
      memberInitKeys: [{ userId: "alice", leafIndex: 0, initKeyB64: "key-init-b64" }],
    });
    expect(socket.emit).toHaveBeenCalledWith(
      "sendGroupCommit",
      {
        groupId: "group-1",
        commit: { groupId: "group-1", epoch: 3, type: "remove", targetUserId: "bob" },
      },
      expect.any(Function)
    );
    expect(saveGroupStateMock).toHaveBeenCalledWith("group-1", {
      groupId: "group-1",
      epoch: 3,
      groupKeyB64: "rotated-key",
    });
  });

  it("keeps legacy group membership changes free of MLS commit and welcome events", async () => {
    mlsEnabled = false;
    currentMembers = [
      makeMember({ userId: "alice", username: "Alice", leafIndex: 0, role: "admin" }),
      makeMember({ userId: "bob", username: "Bob", leafIndex: 1 }),
    ];

    await renderHeader();
    await openMembersModal();
    await searchForBob();

    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Add"
    );
    const removeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Remove"
    );

    await act(async () => {
      addButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      removeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    await settle();

    expect(buildAddCommitMock).not.toHaveBeenCalled();
    expect(buildRemoveCommitMock).not.toHaveBeenCalled();
    expect(loadGroupStateMock).not.toHaveBeenCalled();
    expect(saveGroupStateMock).not.toHaveBeenCalled();
    expect(
      socket.emit.mock.calls.some(([eventName]) => eventName === "sendGroupCommit")
    ).toBe(false);
    expect(
      socket.emit.mock.calls.some(([eventName]) => eventName === "sendGroupWelcome")
    ).toBe(false);
  });

  it("updates the group description through the profile modal", async () => {
    await renderHeader();
    expect(container.textContent).toContain("Initial description");

    await openProfileModal();

    const descriptionField = container.querySelector('textarea[placeholder="Add a description for this group"]');
    await act(async () => {
      setTextareaValue(descriptionField, "Updated project status");
      await flush();
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Save"
    );

    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      await flush();
    });

    expect(socket.emit).toHaveBeenCalledWith(
      "updateGroupProfile",
      {
        groupId: "group-1",
        description: "Updated project status",
        profilePicture: "/uploads/group-1.png",
      },
      expect.any(Function)
    );
    expect(container.textContent).toContain("Updated project status");
  });

  it("lets the last MLS member leave without building a remove commit", async () => {
    currentMembers = [
      makeMember({ userId: "alice", username: "Alice", leafIndex: 0, role: "admin" }),
    ];

    loadGroupStateMock.mockResolvedValue({
      groupId: "group-1",
      epoch: 2,
      selfUserId: "alice",
      selfLeafIndex: 0,
      groupKeyB64: "old-key",
      roster: [{ userId: "alice", username: "Alice", leafIndex: 0 }],
    });

    await renderHeader();

    const optionsButton = container.querySelector('button[aria-label="Group options"]');
    await act(async () => {
      optionsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });

    const leaveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Leave group")
    );

    await act(async () => {
      leaveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      await flush();
    });

    expect(buildRemoveCommitMock).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      "removeGroupMember",
      { groupId: "group-1", memberId: "alice" },
      expect.any(Function)
    );
  });
});
