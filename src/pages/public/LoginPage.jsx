import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { connectWithoutAuth } from "../../socket";
import { jwtDecode } from "jwt-decode";
import init from "@mascaro101/echo-protocol";
import eld from "../../utils/storage/EncryptedLocalDatabase";
import AuthLayout from "@/features/auth/AuthLayout";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      await init();
      const socket = connectWithoutAuth();

      socket.once("connect", () => {
        socket.emit("login", { username, password }, async (response) => {
          if (response.success) {
            localStorage.setItem("token", response.token);

            const resolvedUserId =
              response.userId ||
              (() => {
                try {
                  const decoded = jwtDecode(response.token);
                  return decoded?.id || "";
                } catch {
                  return "";
                }
              })();

            localStorage.setItem("userId", resolvedUserId);

            // Unlock the encrypted database
            try {
              const userExists = await eld.userExists(resolvedUserId);

              if (userExists) {
                await eld.unlock(resolvedUserId, password);
              } else {
                console.warn("[ELD] No local database - keys not available locally");
              }

              setSubmitting(false);
              navigate("/dashboard");
            } catch (err) {
              console.error("[ELD] Unlock failed:", err);
              setError("Failed to unlock: " + err.message);
              setSubmitting(false);
              socket.disconnect();
            }
          } else {
            setError(response.error || "Login failed");
            setSubmitting(false);
            socket.disconnect();
          }
        });
      });

      socket.once("connect_error", (err) => {
        console.error("Connection error:", err);
        setError("Failed to connect to authentication server.");
        setSubmitting(false);
      });

    } catch (err) {
      console.error("Login initialization error:", err);
      setError("Crypto initialization failed: " + err.message);
      setSubmitting(false);
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
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? "Verifying…" : "Sign in"}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <p className="mt-6 text-[11px] text-[#7a7a8a] leading-relaxed">
        By continuing, you agree to ECHO's{" "}
        <a href="#" className="underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="underline">
          Privacy Policy
        </a>
        . Your password is hashed with Argon2id on this device — it never
        leaves it in plaintext.
      </p>
    </AuthLayout>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  right,
  value,
  onChange,
  testid,
  ...rest
}) {
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