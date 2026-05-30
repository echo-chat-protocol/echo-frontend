import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, ArrowRight, Bug, Loader2, QrCode } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import PropTypes from "prop-types";
import init from "@mascaro101/echo-protocol";
import eld from "../../utils/storage/EncryptedLocalDatabase";
import AuthLayout from "@/features/auth/AuthLayout";
import AuthService from "@services/auth.service";
import { useAuth } from "@store/AuthContext";
import { connectSocket } from "@services/socket";
import { getDeviceMetadata } from "@/features/devices/deviceMetadata";
import { createDebugUserAccount } from "@/features/auth/debugUser";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [debugCreating, setDebugCreating] = useState(false);
  const [debugUser, setDebugUser] = useState(null);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username and password cannot be empty");
      return;
    }

    setSubmitting(true);

    try {
      // Initialize WASM crypto library
      await init();

      // ── REST login ──────────────────────────────────────────────────────────
      const res = await AuthService.login({ username, password, ...getDeviceMetadata() });

      if (!res?.success) {
        setError(res?.error || "Login failed");
        setSubmitting(false);
        return;
      }

      const accessToken  = res.token;
      const refreshToken = res.refreshToken;
      const userId       = res.userId || (() => {
        try { return jwtDecode(accessToken)?.id || ""; } catch { return ""; }
      })();
      if (res.deviceId) localStorage.setItem("echo-device-id", res.deviceId);

      // Update global auth context (stores tokens, decodes user)
      login(accessToken, refreshToken, userId, {
        deviceId: res.deviceId,
        deviceUserId: res.deviceUserId,
      });

      // ── Unlock local encrypted key store (ELD) ────────────────────────────
      try {
        const userExists = await eld.userExists(userId);
        if (userExists) {
          await eld.unlock(userId, password);
        } else {
          console.warn("[ELD] No local database — keys not available locally");
        }
      } catch (err) {
        console.error("[ELD] Unlock failed:", err);
        setError("Failed to unlock local key store: " + err.message);
        setSubmitting(false);
        return;
      }

      // ── Connect socket with the fresh token ───────────────────────────────
      connectSocket();

      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err?.message || "Login failed. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCreateDebugUser = async () => {
    setDebugCreating(true);
    setDebugUser(null);
    setError("");

    try {
      const created = await createDebugUserAccount();
      setUsername(created.username);
      setPassword(created.password);
      setDebugUser(created);

      // Auto-login the freshly created debug account and go to the dashboard.
      // Use the deviceId the server assigned during creation (it may have been
      // collision-renamed), not the stale cached one — otherwise login 401s.
      const meta = getDeviceMetadata();
      const res = await AuthService.login({
        username: created.username,
        password: created.password,
        ...meta,
        deviceId: created.deviceId || meta.deviceId,
      });

      if (!res?.success) {
        setError(res?.error || "Debug user created, but sign-in failed.");
        return;
      }

      const userId = res.userId || created.userId;
      if (res.deviceId) localStorage.setItem("echo-device-id", res.deviceId);

      login(res.token, res.refreshToken, userId, {
        deviceId: res.deviceId,
        deviceUserId: res.deviceUserId,
      });

      try {
        if (await eld.userExists(userId)) {
          await eld.unlock(userId, created.password);
        }
      } catch (unlockErr) {
        console.error("[ELD] Unlock after debug create failed:", unlockErr);
      }

      connectSocket();

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to create debug user.");
    } finally {
      setDebugCreating(false);
    }
  };

  return (
    <AuthLayout
      title={
        <>
          Welcome back to <span className="echo-gradient-text">ECHO</span>
        </>
      }
      subtitle="Sign in with your zero-knowledge identity. We never see your password."
      footerLinkLabel="Don't have an account?"
      footerLinkText="Create one"
      footerLinkTo="/register"
    >
      <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
        <Field
          id="username"
          label="Username"
          icon={User}
          type="text"
          placeholder="your_username"
          value={username}
          onChange={setUsername}
          testid="login-username"
        />

        <Field
          id="password"
          label="Password"
          icon={Lock}
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••••••"
          value={password}
          onChange={setPassword}
          testid="login-password"
          right={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              data-testid="login-toggle-password"
              className="text-[#a0a0a0] hover:text-white"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-[#cfcfdc] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              data-testid="login-remember"
              className="h-4 w-4 rounded border-white/20 bg-black/40 accent-[#a855f7]"
            />
            Remember this device
          </label>
        </div>

        {error && (
          <div
            data-testid="login-error"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="login-submit"
          disabled={submitting || debugCreating}
          className="btn-primary w-full"
        >
          {submitting ? "Verifying…" : "Sign in"}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => navigate("/device-sync")}
          disabled={submitting || debugCreating}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <QrCode className="h-4 w-4" />
          Sync device
        </button>

        <button
          type="button"
          onClick={handleCreateDebugUser}
          disabled={submitting || debugCreating}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {debugCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bug className="h-4 w-4" />
          )}
          {debugCreating ? "Creating debug user..." : "DEBUG"}
        </button>

        {debugUser && (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
            Created <span className="font-mono text-white">{debugUser.username}</span> with{" "}
            <span className="font-mono text-white">Pass123%</span>
          </div>
        )}
      </form>

      <p className="mt-6 text-[11px] text-[#7a7a8a] leading-relaxed">
        By continuing, you agree to ECHO&apos;s{" "}
        <a href="/terms" className="underline hover:text-white">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-white">
          Privacy Policy
        </a>
        . Your password is hashed with Argon2id on this device — it never
        leaves it in plaintext.
      </p>
    </AuthLayout>
  );
}

function Field({ id, label, icon: Icon, right, value, onChange, testid, ...rest }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[12px] font-medium text-[#cfcfdc] mb-2"
      >
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 transition-colors focus-within:border-[#a855f7]/55">
        <Icon className="h-4 w-4 text-[#a0a0a0]" />
        <input
          id={id}
          data-testid={testid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-[#6f6f7e] outline-none"
          {...rest}
        />
        {right}
      </div>
    </div>
  );
}

Field.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  right: PropTypes.node,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  testid: PropTypes.string,
};
