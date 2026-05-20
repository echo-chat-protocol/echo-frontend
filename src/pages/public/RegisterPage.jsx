import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buffer } from "buffer";
import {
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  Check,
} from "lucide-react";
import PropTypes from "prop-types";
import AuthLayout from "@/features/auth/AuthLayout";
import eld from "../../utils/storage/EncryptedLocalDatabase";
import { generateOneTimePreKeys } from "@/components/Dashboard/Chat/utils/crypto/opk";
import AuthService from "@services/auth.service";

import init, {
  generate_ed25519_private_key,
  generate_public_prekey,
  generate_private_prekey,
  derive_x25519_from_ed25519_private,
  convert_x25519_to_xeddsa,
  compute_determenistic_nonce,
  compute_nonce_point,
  derive_ed25519_keypair_from_x25519,
  compute_challenge_hash,
  compute_signature_scaler,
  compute_signature,
  verify_signature,
} from "@mascaro101/echo-protocol";

const STRENGTH = [
  { label: "Too weak", color: "#ef4444" },
  { label: "Weak", color: "#f59e0b" },
  { label: "Okay", color: "#eab308" },
  { label: "Strong", color: "#a855f7" },
  { label: "Excellent", color: "#c4a8ff" },
];

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateUsername = (user) => {
    const validChars = /^[a-zA-Z0-9_]+$/;
    const letterMatch = user.match(/[a-zA-Z]/g) || [];
    return user.length >= 3 && validChars.test(user) && letterMatch.length >= 2;
  };

  const getPasswordStrength = (pw) => {
    let strength = 0;
    if (pw.length >= 8) strength++;
    if (/[a-z]/.test(pw)) strength++;
    if (/[A-Z]/.test(pw)) strength++;
    if (/\d/.test(pw)) strength++;
    if (/[^A-Za-z0-9]/.test(pw)) strength++;
    return strength;
  };

  const score = useMemo(() => {
    const str = getPasswordStrength(password);
    return Math.min(str, 4);
  }, [password]);

  const meta = STRENGTH[score];

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !password) {
      setError("Username and password cannot be empty");
      return;
    }

    if (!validateUsername(username)) {
      setError("Invalid username. Use only letters, numbers, underscores, and at least 2 letters (minimum 3 chars).");
      return;
    }

    if (getPasswordStrength(password) < 5) {
      setError("Password is too weak. Must be 8+ chars and contain lowercase, uppercase, a digit, and a special character.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!accept) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    setSubmitting(true);

    try {
      // ── 1. Initialize WASM ───────────────────────────────────────────────────
      await init();

      // ── 2. Generate identity keypair (Ed25519 + X25519) ──────────────────────
      const randomBytes_IK  = crypto.getRandomValues(new Uint8Array(32));
      const randomBytes_SPK = crypto.getRandomValues(new Uint8Array(32));

      const privateKey    = generate_ed25519_private_key(randomBytes_IK);
      const privatePreKey = generate_private_prekey(randomBytes_SPK);
      const publicPreKey  = generate_public_prekey(privatePreKey);

      const x25519_key_pair                   = derive_x25519_from_ed25519_private(privateKey);
      const { x25519_private_key, x25519_public_key } = x25519_key_pair;

      const xeddsaKey           = convert_x25519_to_xeddsa(x25519_private_key);
      const edPrivScaler        = xeddsaKey.slice(0, 32);
      const prefix              = xeddsaKey.slice(32, 64);
      const deterministicNonce  = compute_determenistic_nonce(prefix, publicPreKey);
      const noncePoint          = compute_nonce_point(deterministicNonce);
      const publicEdKey         = derive_ed25519_keypair_from_x25519(x25519_private_key);
      const challenge_hash      = compute_challenge_hash(noncePoint, publicEdKey, publicPreKey);
      const signature_scaler    = compute_signature_scaler(deterministicNonce, challenge_hash, edPrivScaler);
      const signature           = compute_signature(noncePoint, signature_scaler);

      const valid = verify_signature(signature, publicPreKey, publicEdKey);
      if (!valid) throw new Error("Failed to verify the generated signed pre-key");

      // ── 3. Generate OPK bundle ──────────────────────────────────────────────
      const { privateKeys: opkPrivateKeys, publicBundle: opkPublicBundle } =
        await generateOneTimePreKeys(100);

      // ── 4. Encode keys to Base64 strings ────────────────────────────────────
      const arrayBufferToBase64 = (buffer) =>
        btoa(String.fromCharCode(...new Uint8Array(buffer)));

      const publicKeyStringX25519 = Buffer.from(x25519_public_key).toString("base64");
      const publicKeyStringED25519 = Buffer.from(publicEdKey).toString("base64");
      const publicPreKeyString    = Buffer.from(publicPreKey).toString("base64");
      const signatureString       = Buffer.from(signature).toString("base64");

      const privatePreKeyBase64       = arrayBufferToBase64(privatePreKey);
      const ed25519PrivateKeyBase64   = arrayBufferToBase64(privateKey);
      const x25519PrivateKeyBase64    = arrayBufferToBase64(x25519_private_key);
      const x25519PublicKeyBase64     = arrayBufferToBase64(x25519_public_key);

      // ── 5. Build keyBundle (matches backend schema exactly) ──────────────────
      const keyBundle = {
        publicIdentityKeyX25519:  publicKeyStringX25519,
        publicIdentityKeyEd25519: publicKeyStringED25519,
        publicSignedPreKey:       [publicPreKeyString, signatureString],
        oneTimePreKeys:           opkPublicBundle,  // [{ opkId, opkPub, publicKey }]
      };

      // ── 6. Register via REST ─────────────────────────────────────────────────
      const res = await AuthService.register({
        username,
        password,
        keyBundle,
        aboutme: "",
        profilePicture: "",
      });

      if (!res?.success) {
        setError(res?.error || "Registration failed on server");
        setSubmitting(false);
        return;
      }

      const userId = res.userId;

      // ── 7. Create and populate encrypted local database ──────────────────────
      await eld.createUser(userId, password);
      await eld.storeIdentityKeys({
        privateKeyEd25519: ed25519PrivateKeyBase64,
        privateKeyX25519:  x25519PrivateKeyBase64,
        publicKeyX25519:   x25519PublicKeyBase64,
        publicKeyEd25519:  publicKeyStringED25519,
        privatePreKey:     privatePreKeyBase64,
      });
      await eld.storeOPKs(opkPrivateKeys);
      eld.lock();

      setSuccess("Registration successful! Redirecting to login…");
      setTimeout(() => {
        setSubmitting(false);
        navigate("/login");
      }, 1200);

    } catch (err) {
      console.error("Registration failed:", err);
      setError(err?.message || "Registration flow failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={
        <>
          Create your <span className="echo-gradient-text">ECHO identity</span>
        </>
      }
      subtitle="Generates a fresh Curve25519 keypair on this device. No phone number required."
      footerLinkLabel="Already have an account?"
      footerLinkText="Sign in"
      footerLinkTo="/login"
      testimonial={{
        quote:
          "Onboarding took 38 seconds. No SMS, no email verification cascade. Just keys.",
        initials: "JK",
        name: "Jonas Klein",
        role: "Investigative journalist · Berlin",
      }}
    >
      <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
        <Field
          id="username"
          label="Username"
          icon={User}
          type="text"
          placeholder="your_username"
          value={username}
          onChange={setUsername}
          testid="register-name"
        />

        <div>
          <label
            htmlFor="password"
            className="block text-[12px] font-medium text-[#cfcfdc] mb-2"
          >
            Password
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 transition-colors focus-within:border-[#a855f7]/55">
            <Lock className="h-4 w-4 text-[#a0a0a0]" />
            <input
              id="password"
              data-testid="register-password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-[#6f6f7e] outline-none"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="text-[#a0a0a0] hover:text-white"
              aria-label={show ? "Hide password" : "Show password"}
              data-testid="register-toggle-password"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Strength meter */}
          <div className="mt-3 flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full transition-all"
                style={{
                  background:
                    i <= score && password
                      ? meta.color
                      : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-[#a0a0a0]">
              {password ? meta.label : "Type to start"}
            </span>
            <span className="font-mono text-[#7a7a8a]">
              hashed with Argon2id locally
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-[12px] font-medium text-[#cfcfdc] mb-2"
          >
            Confirm Password
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 transition-colors focus-within:border-[#a855f7]/55">
            <Lock className="h-4 w-4 text-[#a0a0a0]" />
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-[#6f6f7e] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              className="text-[#a0a0a0] hover:text-white"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-[#cfcfdc] cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="register-accept"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 accent-[#a855f7]"
          />
          <span>
            I accept the{" "}
            <a href="/terms" className="underline hover:text-white">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-white">
              Privacy Policy
            </a>
            . I understand that ECHO cannot recover my account if I lose my
            keys.
          </span>
        </label>

        {error && (
          <div
            data-testid="register-error"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
          >
            {success}
          </div>
        )}

        <button
          type="submit"
          data-testid="register-submit"
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? "Forging keys…" : "Create my identity"}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>

        <ul className="grid grid-cols-2 gap-2 text-[11px] text-[#a0a0a0]">
          {[
            "Curve25519 keypair on-device",
            "Zero-knowledge by design",
            "No phone number ever",
            "Export & rotate any time",
          ].map((txt) => (
            <li key={txt} className="flex items-center gap-1.5">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                <Check className="h-2 w-2 text-white" strokeWidth={3} />
              </span>
              {txt}
            </li>
          ))}
        </ul>
      </form>
    </AuthLayout>
  );
}

function Field({ id, label, icon: Icon, value, onChange, testid, ...rest }) {
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
      </div>
    </div>
  );
}

Field.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  testid: PropTypes.string,
};