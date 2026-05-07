import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Camera, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { getSocket } from "../../../../socket";
import { formatProfileImage } from "../utils/helpers";

import {
  loadGroupState,
  saveGroupState,
  buildAddCommit,
  buildRemoveCommit
} from "../../Chat/utils/crypto/groupCryptoProvider";

import { getIdentityKeys } from '../../Chat/utils/chat/keyManagement';
import { compressImage } from "../../Chat/utils/imageUtils";

const MAX_GROUP_PROFILE_IMAGE_BYTES = 140 * 1024;
const SOCKET_ACK_TIMEOUT_MS = 12000;

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });

const GroupHeader = ({ groupId, groupName, groupDescription, groupProfilePicture, userId }) => {
  const socket = useMemo(() => getSocket(), []);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [processingProfileImage, setProcessingProfileImage] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [profilePictureDraft, setProfilePictureDraft] = useState("");
  const [profileError, setProfileError] = useState("");

  const [groupMeta, setGroupMeta] = useState({
    name: groupName || "Group",
    description: groupDescription || "",
    profilePicture: groupProfilePicture || "",
    mlsEnabled: false,
    epoch: 0,
    cipherSuite: null,
  });

  useEffect(() => {
    setGroupMeta((prev) => ({
      ...prev,
      name: groupName || prev.name || "Group",
      description: groupDescription ?? prev.description ?? "",
      profilePicture: groupProfilePicture ?? prev.profilePicture ?? "",
    }));
  }, [groupDescription, groupName, groupProfilePicture]);

  const refresh = useCallback(() => {
    if (!groupId) return;
    socket.emit("openGroup", { groupId }, (res) => {
      if (!res?.success) return;
      setMembers(Array.isArray(res.members) ? res.members : []);
      setRole(res?.membership?.role ?? null);

      setGroupMeta({
        name: res?.group?.name || groupName || "Group",
        description: res?.group?.description ?? "",
        profilePicture: res?.group?.profilePicture ?? "",
        mlsEnabled: Boolean(res?.group?.mlsEnabled),
        epoch: Number.isInteger(res?.group?.epoch) ? res.group.epoch : 0,
        cipherSuite: res?.group?.cipherSuite ?? null,
      });
    });
  }, [groupId, groupName, socket]);

  const openGroupDetails = () =>
    new Promise((resolve, reject) => {
      if (!groupId) {
        reject(new Error("Missing groupId"));
        return;
      }

      socket.emit("openGroup", { groupId }, (res) => {
        if (!res?.success) {
          reject(new Error(res?.error || "Failed to open group"));
          return;
        }

        resolve(res);
      });
    });

  const emitWithAck = (eventName, payload, fallbackError) =>
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${fallbackError} (request timed out)`));
      }, SOCKET_ACK_TIMEOUT_MS);

      socket.emit(eventName, payload, (ack) => {
        clearTimeout(timeoutId);
        if (!ack?.success) {
          reject(new Error(ack?.error || fallbackError));
          return;
        }
        resolve(ack);
      });
    });

  const toRoster = (groupMembers) => (Array.isArray(groupMembers) ? groupMembers : [])
    .map((m) => ({
      userId: String(m.userId),
      username: m.username ?? "",
      leafIndex: m.leafIndex,
    }))
    .filter((m) => m.userId && Number.isInteger(m.leafIndex))
    .sort((a, b) => a.leafIndex - b.leafIndex);

  useEffect(() => {
    refresh();
    setMenuOpen(false);
    setMembersOpen(false);
    setProfileOpen(false);
  }, [groupId, refresh]);

  useEffect(() => {
    const handleChanged = (evt) => {
      const changedGroupId = String(evt?.groupId ?? evt?.group?.groupId ?? "");
      if (changedGroupId !== String(groupId)) return;
      refresh();
    };
    socket.on("groupMemberAdded", handleChanged);
    socket.on("groupMemberRemoved", handleChanged);
    socket.on("groupUpdated", handleChanged);
    return () => {
      socket.off("groupMemberAdded", handleChanged);
      socket.off("groupMemberRemoved", handleChanged);
      socket.off("groupUpdated", handleChanged);
    };
  }, [groupId, refresh, socket]);

  const memberCount = members.length;
  const subtitle = role === "admin" ? `Admin · ${memberCount} members` : `${memberCount} members`;
  const displayName = groupMeta.name || groupName || "Group";
  const displayDescription = groupMeta.description?.trim() || "";
  const avatarSrc = formatProfileImage(groupMeta.profilePicture, displayName);
  const canAdd = role === "admin";
  const canEditProfile = Boolean(role);

  const openProfileModal = useCallback(() => {
    setDescriptionDraft(groupMeta.description ?? "");
    setProfilePictureDraft(groupMeta.profilePicture ?? "");
    setProfileError("");
    setProfileOpen(true);
  }, [groupMeta.description, groupMeta.profilePicture]);

  const handleProfilePictureChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      event.target.value = "";
      return;
    }

    try {
      setProcessingProfileImage(true);
      setProfileError("");
      const compressedBlob = await compressImage(file, 256, 0.6);
      if (compressedBlob.size > MAX_GROUP_PROFILE_IMAGE_BYTES) {
        throw new Error("Group image is too large. Choose a smaller image.");
      }

      const compressedDataUrl = await blobToDataUrl(compressedBlob);
      setProfilePictureDraft(compressedDataUrl);
    } catch (err) {
      setProfileError(err?.message || "Failed to prepare group image.");
    } finally {
      setProcessingProfileImage(false);
    }

    // Allow selecting the same file again later.
    event.target.value = "";
  };

  const handleSaveProfile = async () => {
    if (!groupId || !canEditProfile || processingProfileImage) return;
    setSavingProfile(true);
    setProfileError("");

    try {
      const ack = await emitWithAck(
        "updateGroupProfile",
        {
          groupId,
          description: descriptionDraft,
          profilePicture: profilePictureDraft,
        },
        "Failed to update group profile",
      );

      if (ack?.group) {
        setGroupMeta((prev) => ({
          ...prev,
          name: ack.group.name || prev.name,
          description: ack.group.description ?? "",
          profilePicture: ack.group.profilePicture ?? "",
        }));
      }

      refresh();
      setProfileOpen(false);
    } catch (err) {
      console.error("[GroupHeader] Failed to update group profile:", err);
      setProfileError(err?.message || "Failed to update group profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSearch = () => {
    const term = searchTerm.trim();
    if (!term) return;
    setLoading(true);
    setSearchResult(null);

    socket.emit("searchUser", { searchTerm: term }, (res) => {
      if (!res?.success || !res?.user) {
        setLoading(false);
        return;
      }
      const basic = res.user;
      socket.emit("getUserInfo", { userId: basic.id }, (infoRes) => {
        const profilePicture = infoRes?.success ? infoRes?.user?.profilePicture : null;
        const profileImage = formatProfileImage(profilePicture, basic.username);
        setSearchResult({ ...basic, profileImage });
        setLoading(false);
      });
    });
  };

  const handleAdd = async (memberId) => {
    if (!canAdd || !memberId) return;
    setLoading(true);

    try {
      await emitWithAck('addGroupMember', { groupId, memberId }, 'Failed to add group member');
      setSearchTerm('');
      setSearchResult(null);

      if (!groupMeta.mlsEnabled) {
        refresh();
        return;
      }

      // Load fresh roster and local state
      const groupRes = await openGroupDetails();
      const roster = toRoster(groupRes.members);
      const addedMember = roster.find((m) => String(m.userId) === String(memberId));
      if (!addedMember) throw new Error('Added member missing from refreshed group roster');

      const localState = await loadGroupState(groupId);
      if (!localState) throw new Error('Missing local MLS state for commit generation');

      // Fetch KeyPackages for ALL members in the new roster (including the new member)
      const memberInitKeys = await Promise.all(
        roster.map((m) =>
          new Promise((resolve) => {
            socket.emit('fetchKeyPackage', { userId: m.userId }, (res) => {
              if (res?.success && res.initKeyB64) {
                resolve({ userId: m.userId, leafIndex: m.leafIndex, initKeyB64: res.initKeyB64 });
              } else {
                // If a member has no KeyPackage, they can't receive the new key.
                // Log and skip — applyCommit will set their key to null.
                console.warn(`[GroupHeader] No KeyPackage for member ${m.userId}`);
                resolve(null);
              }
            });
          })
        )
      ).then((results) => results.filter(Boolean));

      const { commit, welcome, nextState } = await buildAddCommit({
        state: localState,
        newMember: addedMember,
        memberInitKeys,       // <-- pass the fetched init keys
      });

      await emitWithAck('sendGroupCommit', { groupId, commit }, 'Failed to send group commit');
      await emitWithAck('sendGroupWelcome', { groupId, recipientUserId: addedMember.userId, welcome }, 'Failed to send group welcome');
          await saveGroupState(groupId, nextState);
      refresh();
    } catch (err) {
      console.error('[GroupHeader] Failed to add member:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId) => {
    if (!memberId) return;
    setLoading(true);

    try {
      if (!groupMeta.mlsEnabled) {
        await emitWithAck(
          "removeGroupMember",
          { groupId, memberId },
          "Failed to remove group member"
        );
        refresh();
        return;
      }

      const localState = await loadGroupState(groupId);
      if (!localState) {
        throw new Error("Missing local MLS state for remove commit generation");
      }

      // Remaining members (excluding the one being removed) need the new epoch key
      const remainingMembers = members.filter((m) => String(m.userId) !== String(memberId));
      const isSelfRemoval = String(memberId) === String(userId);

      // If this is the last member leaving the group, there is no next epoch to
      // distribute. Remove the membership directly instead of forcing an MLS commit.
      if (remainingMembers.length === 0 && isSelfRemoval) {
        await emitWithAck(
          "removeGroupMember",
          { groupId, memberId },
          "Failed to remove group member"
        );
        return;
      }

      const memberInitKeys = await Promise.all(
        remainingMembers.map((m) =>
          new Promise((resolve) => {
            socket.emit('fetchKeyPackage', { userId: m.userId }, (res) => {
              if (res?.success && res.initKeyB64) {
                resolve({ userId: m.userId, leafIndex: m.leafIndex, initKeyB64: res.initKeyB64 });
              } else {
                console.warn(`[GroupHeader] No KeyPackage for member ${m.userId}`);
                resolve(null);
              }
            });
          })
        )
      ).then((results) => results.filter(Boolean));

      const { commit, nextState } = await buildRemoveCommit({
        state: localState,
        targetUserId: memberId,
        memberInitKeys,
      });

      if (isSelfRemoval) {
        await emitWithAck("sendGroupCommit", { groupId, commit }, "Failed to send group commit");
      }

      await emitWithAck(
        "removeGroupMember",
        { groupId, memberId },
        "Failed to remove group member"
      );

      if (!isSelfRemoval) {
        await emitWithAck("sendGroupCommit", { groupId, commit }, "Failed to send group commit");
      }

      await saveGroupState(groupId, nextState);
      refresh();
    } catch (err) {
      console.error("[GroupHeader] Failed to remove member:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 flex justify-between items-center transition-all border-b bg-black border-gray-800">
      <div className="flex items-center gap-4 min-w-0">
        <img
          src={avatarSrc}
          alt={displayName}
          className="w-12 h-12 rounded-full border-2 border-black object-cover bg-gray-700"
          onError={(e) => {
            e.target.src = formatProfileImage("", displayName);
          }}
        />

        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{displayName}</h3>
          <p className="text-sm text-gray-300 truncate">{displayDescription || subtitle}</p>
          {displayDescription && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex gap-4 relative">
        <button
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Group options"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MoreHorizontal className="w-5 h-5 text-gray-400" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-12 w-56 bg-black border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white"
              onClick={() => {
                setMenuOpen(false);
                openProfileModal();
              }}
            >
              Group profile
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white"
              onClick={() => {
                setMenuOpen(false);
                setMembersOpen(true);
              }}
            >
              Members
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-700 text-red-400"
              onClick={() => {
                setMenuOpen(false);
                handleRemove(String(userId));
              }}
            >
              Leave group
            </button>
          </div>
        )}
      </div>

      {profileOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-4 max-w-lg w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Group profile</h3>
              <button onClick={() => setProfileOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={formatProfileImage(profilePictureDraft, displayName)}
                  alt={displayName}
                  className="w-20 h-20 rounded-full border-2 border-black object-cover bg-gray-700"
                  onError={(e) => {
                    e.target.src = formatProfileImage("", displayName);
                  }}
                />
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-800 text-white hover:bg-gray-700 cursor-pointer">
                    <Camera className="w-4 h-4" />
                    Change photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfilePictureChange}
                      disabled={!canEditProfile || savingProfile}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-left text-sm text-gray-400 hover:text-white disabled:opacity-50"
                    onClick={() => {
                      setProfilePictureDraft("");
                      setProfileError("");
                    }}
                    disabled={!canEditProfile || savingProfile}
                  >
                    Remove photo
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-300">Description</label>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  maxLength={280}
                  rows={4}
                  className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8e79f2]"
                  placeholder="Add a description for this group"
                  disabled={!canEditProfile || savingProfile}
                />
                <div className="text-xs text-gray-500 text-right">{descriptionDraft.length}/280</div>
              </div>

              {profileError && (
                <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {profileError}
                </div>
              )}

              {processingProfileImage && (
                <div className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-200">
                  Processing image...
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-white hover:bg-gray-700"
                  onClick={() => setProfileOpen(false)}
                  disabled={savingProfile}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm bg-indigo-700 text-white hover:bg-[#8e79f2] disabled:opacity-50"
                  onClick={handleSaveProfile}
                  disabled={!canEditProfile || savingProfile || processingProfileImage}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {membersOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-4 max-w-xl w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Members</h3>
              <button onClick={() => setMembersOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {canAdd && (
              <div className="space-y-2 mb-4">
                <div className="text-sm text-gray-300">Add member</div>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Search username..."
                      className="w-full p-3 pr-10 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8e79f2]"
                    />
                    <button
                      className="absolute right-3 top-3 text-gray-400 hover:text-white"
                      onClick={handleSearch}
                      disabled={loading}
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {searchResult && (
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={searchResult.profileImage}
                        alt={searchResult.username}
                        className="w-9 h-9 rounded-full object-cover border-2 border-black"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${searchResult.username}&background=8e79f2&color=fff`;
                        }}
                      />
                      <div className="truncate text-white">{searchResult.username}</div>
                    </div>
                    <button
                      className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-indigo-700 text-white hover:bg-[#8e79f2]"
                      disabled={loading}
                      onClick={() => handleAdd(searchResult.id)}
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {members.map((m) => {
                const isSelf = String(m.userId) === String(userId);
                const canKick = role === "admin" && !isSelf && m.role !== "admin";
                const canLeave = isSelf;
                return (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          m.profilePicture
                            ? formatProfileImage(m.profilePicture, m.username || m.userId)
                            : `https://ui-avatars.com/api/?name=${m.username || m.userId}&background=8e79f2&color=fff`
                        }
                        alt={m.username || m.userId}
                        className="w-9 h-9 rounded-full object-cover border-2 border-black"
                      />
                      <div className="min-w-0">
                        <div className="text-white truncate">
                          {m.username || m.userId}{" "}
                          {m.role === "admin" && <span className="text-xs text-indigo-300">(admin)</span>}
                          {isSelf && <span className="text-xs text-gray-300"> (you)</span>}
                        </div>
                      </div>
                    </div>
                    {(canKick || canLeave) && (
                      <button
                        className="px-3 py-2 rounded-lg text-sm bg-red-700 text-white hover:bg-red-600"
                        disabled={loading}
                        onClick={() => handleRemove(m.userId)}
                      >
                        {isSelf ? "Leave" : "Remove"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

GroupHeader.propTypes = {
  groupId: PropTypes.string,
  groupName: PropTypes.string,
  groupDescription: PropTypes.string,
  groupProfilePicture: PropTypes.string,
  userId: PropTypes.string.isRequired,
};

export default GroupHeader;

