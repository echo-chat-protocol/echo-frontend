import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  Edit,
  X,
  Check,
  Trash2,
  Key,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { getSocket } from "../socket";
import Toast from "./Toast";
import ParticlesBackground from "./HomepageComponents/ParticlesBackground.jsx";

const UserProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const socket = getSocket();

  // Get user ID from params, location state, or token
  let userId = params.userId || (location.state && location.state.userId);

  // Get logged in user ID from token
  let loggedInUserId = "";
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const decoded = jwtDecode(token);
      loggedInUserId = decoded.id || decoded.userId || decoded._id;
    } catch {}
  }

  if (!userId && loggedInUserId) userId = loggedInUserId;
  const isOwnProfile = userId === loggedInUserId;

  // State
  const [loading, setLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [originalProfileImage, setOriginalProfileImage] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [originalAbout, setOriginalAbout] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [popupMsg, setPopupMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const fileInputRef = useRef(null);

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    currentUsername
  )}&background=random&color=fff&bold=true`;

  // Check if there are changes to save
  const hasChanges = () => {
    return (
      currentUsername !== originalUsername ||
      aboutMe !== originalAbout ||
      (profileImage !== originalProfileImage &&
        profileImage !== defaultAvatar) ||
      (showPasswordChange && (oldPassword || newPassword || confirmPassword))
    );
  };

  // Load user data
  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }

    setLoading(true);

    // Check cache first
    const cachedProfile = localStorage.getItem(`profile-${userId}`);
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        setCurrentUsername(parsed.username || "");
        setOriginalUsername(parsed.username || "");
        setAboutMe(parsed.aboutme || "");
        setOriginalAbout(parsed.aboutme || "");
        setProfileImage(parsed.profilePicture || "");
        setOriginalProfileImage(parsed.profilePicture || "");
      } catch {}
    }

    // Fetch from server
    socket.emit("getUserInfo", { userId }, (response) => {
      if (response && response.success && response.user) {
        setCurrentUsername(response.user.username || "");
        setOriginalUsername(response.user.username || "");
        setAboutMe(response.user.aboutme || "");
        setOriginalAbout(response.user.aboutme || "");
        setProfileImage(response.user.profilePicture || "");
        setOriginalProfileImage(response.user.profilePicture || "");
        localStorage.setItem(
          `profile-${userId}`,
          JSON.stringify({
            username: response.user.username || "",
            aboutme: response.user.aboutme || "",
            profilePicture: response.user.profilePicture || "",
          })
        );
      }
      setLoading(false);
    });
  }, [userId, socket, navigate]);

  const handleCopy = (value, label) => {
    navigator.clipboard.writeText(value);
    setPopupMsg(`${label} copied!`);
    setTimeout(() => setPopupMsg(""), 1200);
  };

  const handleSave = async () => {
    if (!isOwnProfile) return;

    // Validate password change if showing
    if (showPasswordChange) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        setPasswordError("Please fill all password fields.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
      }
    }

    // Prepare data to send
    let dataToSend = { userId };
    if (currentUsername !== originalUsername)
      dataToSend.username = currentUsername;
    if (aboutMe !== originalAbout) dataToSend.aboutme = aboutMe;
    if (showPasswordChange && oldPassword && newPassword === confirmPassword) {
      dataToSend.oldPassword = oldPassword;
      dataToSend.newPassword = newPassword;
    }

    // Check if image changed
    const isImageChanged =
      profileImage &&
      profileImage !== originalProfileImage &&
      profileImage !== defaultAvatar;

    if (isImageChanged) {
      dataToSend.profilePicture = profileImage;
    }

    // Check if there are any changes to save
    if (Object.keys(dataToSend).length === 1) {
      // Only userId is present, no actual changes
      setPopupMsg("No changes to save");
      setTimeout(() => setPopupMsg(""), 2000);
      return;
    }

    // Show loading state
    setLoading(true);
    setPasswordError("");

    // Set a timeout in case the socket doesn't respond
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setPasswordError("Request timeout. Profile picture may be too large (max 1MB recommended)");
      console.error('❌ updateUserInfo timed out after 10 seconds');
    }, 10000);

    socket.emit("updateUserInfo", dataToSend, (response) => {
      clearTimeout(timeoutId);
      setLoading(false);

      if (response && response.success) {
        // Reset all editing states
        setShowPasswordChange(false);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setEditingUsername(false);
        setEditingAbout(false);

        // Update original values
        setOriginalUsername(currentUsername);
        setOriginalAbout(aboutMe);
        if (isImageChanged) {
          setOriginalProfileImage(profileImage);
        }

        // Show success message
        setPopupMsg("Changes saved successfully");
        setTimeout(() => setPopupMsg(""), 2000);

        // Update cache
        localStorage.setItem(
          `profile-${userId}`,
          JSON.stringify({
            username: response.user.username || "",
            aboutme: response.user.aboutme || "",
            profilePicture: response.user.profilePicture || "",
          })
        );

        // Broadcast profile update to all connected users
        if (isImageChanged || currentUsername !== originalUsername) {
          socket.emit('profileUpdated', {
            userId,
            username: response.user.username,
            profilePicture: response.user.profilePicture
          });
        }

        // Dispatch custom event for local components
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: {
            userId,
            username: response.user.username,
            profilePicture: response.user.profilePicture
          }
        }));
      } else {
        // Handle errors
        if (response && response.error === "Username already taken") {
          // Don't reset username - let user modify and try again
          setPopupMsg("Username already taken");
        } else {
          setPasswordError(
            (response && response.error) || "Error updating profile"
          );
        }
        setTimeout(() => {
          setPopupMsg("");
          setPasswordError("");
        }, 2000);
      }
    });
  };

  const handleCancel = () => {
    setEditingUsername(false);
    setEditingAbout(false);
    setShowPasswordChange(false);
    setPasswordError("");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");

    // Reset to original values
    setCurrentUsername(originalUsername);
    setAboutMe(originalAbout);
    setProfileImage(originalProfileImage);
  };

  const handleImageChange = (e) => {
    if (!isOwnProfile) return;
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setProfileImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAccount = () => {
    socket.emit("deleteAccount", { userId }, (response) => {
      if (response && response.success) {
        setPopupMsg("Account deleted successfully");
        setTimeout(() => {
          localStorage.clear();
          sessionStorage.clear();
          navigate("/login", { replace: true });
        }, 1500);
      } else {
        setPopupMsg((response && response.error) || "Error deleting account");
        setTimeout(() => setPopupMsg(""), 2000);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="mt-4 text-purple-400">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen bg-black text-white">
      {/* Fondo de partículas */}
      <div className="absolute inset-0 z-0">
        <ParticlesBackground />
      </div>

      {/* Contenido principal (encima del fondo de partículas) */}
      <div className="relative z-10 flex-1 flex flex-col overflow-y-auto">
        <Toast
          message={popupMsg}
          type={
            popupMsg.toLowerCase().includes("no changes")
              ? "info"
              : popupMsg.toLowerCase().includes("saved") ||
                popupMsg.toLowerCase().includes("copied") ||
                popupMsg.toLowerCase().includes("deleted")
              ? "success"
              : "warning"
          }
          onClose={() => setPopupMsg("")}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
              <button
                className="px-4 py-2 bg-white/10 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-gray-800"
                onClick={() => navigate(-1)}
                type="button"
              >
                <ArrowLeft size={16} />
                Go Back
              </button>
              <h1 className="text-2xl font-bold text-center text-white">
                User Profile
              </h1>
              <div className="w-28"></div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 mb-6">
              <button
                className={`px-4 py-2 font-medium flex items-center gap-2 ${
                  activeTab === "profile"
                    ? "text-purple-500 border-b-2 border-purple-500"
                    : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setActiveTab("profile")}
              >
                <Edit size={16} />
                Profile
              </button>
              {isOwnProfile && (
                <button
                  className={`px-4 py-2 font-medium flex items-center gap-2 ${
                    activeTab === "security"
                      ? "text-purple-500 border-b-2 border-purple-500"
                      : "text-gray-400 hover:text-white"
                  }`}
                  onClick={() => setActiveTab("security")}
                >
                  <Shield size={16} />
                  Security
                </button>
              )}
            </div>

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="bg-black/20 rounded-xl border border-gray-800 p-6 mb-6">
                <div className="flex items-start gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-white/10 overflow-hidden border-2 border-gray-700">
                      <img
                        src={
                          profileImage
                            ? profileImage.startsWith("/uploads/")
                              ? `http://localhost:3001${profileImage}`
                              : profileImage
                            : defaultAvatar
                        }
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {isOwnProfile && (
                      <>
                        <button
                          className="absolute -bottom-2 -right-2 bg-purple-600 hover:bg-purple-700 rounded-full p-2 transition-colors"
                          onClick={() => fileInputRef.current.click()}
                          disabled={
                            editingUsername ||
                            editingAbout ||
                            showPasswordChange
                          }
                          type="button"
                        >
                          <Edit size={16} />
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Username
                      </label>
                      <div className="flex items-center gap-2">
                        {editingUsername ? (
                          <input
                            className="flex-1 bg-white/10 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            value={currentUsername}
                            onChange={(e) => setCurrentUsername(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <>
                            <span
                              className={`flex-1 bg-white/10 border border-gray-700 rounded-lg px-3 py-2 ${
                                !editingAbout &&
                                !editingUsername &&
                                !showPasswordChange
                                  ? "cursor-pointer hover:bg-gray-750"
                                  : ""
                              }`}
                              onDoubleClick={
                                !editingUsername &&
                                !editingAbout &&
                                !showPasswordChange
                                  ? () =>
                                      handleCopy(currentUsername, "Username")
                                  : undefined
                              }
                            >
                              {currentUsername}
                            </span>
                            {isOwnProfile &&
                              !editingAbout &&
                              !editingUsername &&
                              !showPasswordChange && (
                                <button
                                  className="p-2 text-gray-400 hover:text-white transition-colors"
                                  onClick={() => setEditingUsername(true)}
                                  type="button"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        User ID
                      </label>
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex-1 bg-white/10 border border-gray-700 rounded-lg px-3 py-2 ${
                            !editingAbout &&
                            !editingUsername &&
                            !showPasswordChange
                              ? "cursor-pointer hover:bg-gray-750"
                              : ""
                          }`}
                          onDoubleClick={
                            !editingUsername &&
                            !editingAbout &&
                            !showPasswordChange
                              ? () => handleCopy(userId, "User ID")
                              : undefined
                          }
                        >
                          {userId}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    About me
                  </label>
                  <div className="flex flex-col gap-2">
                    {editingAbout ? (
                      <textarea
                        className="w-full bg-white/10 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={aboutMe}
                        onChange={(e) => setAboutMe(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-start gap-2">
                        <div
                          className={`flex-1 bg-white/10 border border-gray-700 rounded-lg px-3 py-2 min-h-[80px] ${
                            aboutMe ? "" : "text-gray-500 italic"
                          } ${
                            !editingAbout &&
                            !editingUsername &&
                            !showPasswordChange
                              ? "cursor-pointer hover:bg-gray-750"
                              : ""
                          }`}
                          onDoubleClick={
                            !editingAbout &&
                            !editingUsername &&
                            !showPasswordChange
                              ? () => handleCopy(aboutMe, "About me")
                              : undefined
                          }
                        >
                          {aboutMe || "Tell us something about yourself..."}
                        </div>
                        {isOwnProfile &&
                          !editingAbout &&
                          !editingUsername &&
                          !showPasswordChange && (
                            <button
                              className="p-2 text-gray-400 hover:text-white transition-colors"
                              onClick={() => setEditingAbout(true)}
                              type="button"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - only show if there are changes */}
                {hasChanges() && (
                  <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-800">
                    <button
                      className="px-4 py-2 bg-white/10 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-gray-700"
                      onClick={handleCancel}
                      type="button"
                    >
                      <X size={16} /> Cancel
                    </button>
                    <button
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      onClick={handleSave}
                      type="button"
                      disabled={loading}
                    >
                      <Check size={16} /> Save
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && isOwnProfile && (
              <div className="bg-black/30 rounded-xl border border-gray-800 p-6 mb-6">
                <div className="space-y-6">
                  {/* Change Password Section */}
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-4">
                      <Key size={18} />
                      Change Password
                    </h3>

                    {showPasswordChange ? (
                      <div className="space-y-4">
                        <div className="relative">
                          <input
                            className="w-full bg-white/10 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                            type={showPassword ? "text" : "password"}
                            placeholder="Current password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            className="w-full bg-white/10 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            className="w-full bg-white/10 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                        {passwordError && (
                          <div className="text-red-400 text-sm">
                            {passwordError}
                          </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            className="px-4 py-2 bg-white/10 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-gray-700"
                            onClick={() => {
                              setShowPasswordChange(false);
                              setOldPassword("");
                              setNewPassword("");
                              setConfirmPassword("");
                              setPasswordError("");
                            }}
                            type="button"
                          >
                            <X size={16} /> Cancel
                          </button>
                          <button
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                            onClick={handleSave}
                            type="button"
                          >
                            <Check size={16} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="w-full px-4 py-3 bg-white/10 hover:bg-gray-750 text-white rounded-lg transition-colors flex items-center justify-between border border-gray-700"
                        onClick={() => setShowPasswordChange(true)}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <Key size={16} />
                          <span>Change Password</span>
                        </div>
                        <Edit size={16} className="text-gray-400" />
                      </button>
                    )}
                  </div>

                  {/* Delete Account Section */}
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-4">
                      <Shield size={18} />
                      Account Deletion
                    </h3>

                    {showDeleteConfirm ? (
                      <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
                        <p className="text-red-400 font-medium mb-3">
                          Are you sure you want to delete your account? This
                          action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                          <button
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              handleDeleteAccount();
                            }}
                            type="button"
                          >
                            <Check size={16} /> Confirm Delete
                          </button>
                          <button
                            className="flex-1 px-4 py-2 bg-white/10 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-700"
                            onClick={() => setShowDeleteConfirm(false)}
                            type="button"
                          >
                            <X size={16} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="w-full px-4 py-3 bg-white/10 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-lg transition-colors flex items-center justify-between border border-red-500/30"
                        onClick={() => setShowDeleteConfirm(true)}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 size={16} />
                          <span>Delete Account</span>
                        </div>
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center text-xs text-gray-400 mt-8 pt-8 pb-4 border-t border-gray-700">
              <Lock className="w-4 h-4 mr-1.5" />
              <span>Your messages are encrypted using</span>
              <img
                src="/EchoProtocolLogo.png"
                alt="Echo Protocol"
                className="h-12 ml-1.5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
