import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import PropTypes from "prop-types";
import eld from "../../utils/storage/EncryptedLocalDatabase";

const passKeyForUser = (userId) => `eld-pass-${userId}`;

const safeDecode = (token) => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

const EldUnlockGate = ({ token, children }) => {
  const navigate = useNavigate();
  const decoded = useMemo(() => (token ? safeDecode(token) : null), [token]);
  const userId = decoded?.id || "";
  const username = decoded?.username || "";

  const [status, setStatus] = useState("checking"); 
  const [password, setPassword] = useState("");
  const [rememberForTab, setRememberForTab] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    if (!userId) return;

    let cancelled = false;

    const run = async () => {
      setError("");
      setStatus("checking");

      try {
        // If ELD is already unlocked for a different user, lock it.
        if (eld.isUnlocked() && eld.getCurrentUserId?.() && eld.getCurrentUserId() !== userId) {
          eld.lock();
        }

        if (eld.isUnlocked() && eld.getCurrentUserId?.() === userId) {
          if (!cancelled) setStatus("unlocked");
          return;
        }

        const savedPassword = sessionStorage.getItem(passKeyForUser(userId));
        if (savedPassword) {
          try {
            await eld.unlock(userId, savedPassword);
            if (!cancelled) setStatus("unlocked");
            return;
          } catch {
            sessionStorage.removeItem(passKeyForUser(userId));
          }
        }

        if (!cancelled) setStatus("needs_password");
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || String(e));
          setStatus("needs_password");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  if (!token) return <Navigate to="/login" replace />;
  if (!userId) return <Navigate to="/login" replace />;

  if (status === "unlocked") return children;

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("checking");

    try {
      await eld.unlock(userId, password);
      if (rememberForTab) {
        sessionStorage.setItem(passKeyForUser(userId), password);
      } else {
        sessionStorage.removeItem(passKeyForUser(userId));
      }
      setStatus("unlocked");
    } catch (err) {
      setError(err?.message || "Failed to unlock encrypted storage");
      setStatus("needs_password");
    }
  };

  const handleLogout = () => {
    try {
      eld.lock();
    } catch {
      // ignore
    }
    sessionStorage.removeItem(passKeyForUser(userId));
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-1000 p-4">
      <div className="w-full max-w-md bg-[var(--color-background)]/50 backdrop-blur-md rounded-xl p-6 border border-[var(--color-primary)]/30 shadow-xl">
        <h2 className="text-2xl font-bold text-center mb-2 text-white">
          Unlock Chat
        </h2>
        <p className="text-sm text-gray-200 mb-6 text-center">
          {username ? `${username}, ` : ""}Enter your password to unlock chat.
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label htmlFor="eld-password" className="block text-sm font-medium text-white mb-2">
              Password
            </label>
            <input
              id="eld-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-background)]/20 border border-[var(--color-primary)]/30 rounded-lg text-black placeholder-black/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={rememberForTab}
              onChange={(e) => setRememberForTab(e.target.checked)}
            />
            Remember for this tab
          </label>

          <button
            type="submit"
            disabled={status === "checking"}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-60"
          >
            {status === "checking" ? "Unlocking..." : "Unlock"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full border border-white/20 hover:border-white/40 text-white py-3 rounded-lg font-semibold transition-all"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
};

EldUnlockGate.propTypes = {
  token: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default EldUnlockGate;

