import { useEffect, useState } from "react";
import { X, ShieldAlert, ShieldCheck } from "lucide-react";
import PropTypes from "prop-types";

function base64ToBytes(b64) {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function computeFingerprint(ikA_b64, ikB_b64) {
  // Canonical order: lexicographic on the base64 string so both parties produce the same number
  const [first, second] =
    ikA_b64 <= ikB_b64 ? [ikA_b64, ikB_b64] : [ikB_b64, ikA_b64];
  const combined = new Uint8Array([
    ...base64ToBytes(first),
    ...base64ToBytes(second),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // 8 groups of 8 hex chars — easy to read aloud or compare visually
  return hex.match(/.{8}/g).join(" ");
}

function FingerprintDisplay({ label, ikB64, ourIKB64 }) {
  const [fingerprint, setFingerprint] = useState(null);

  useEffect(() => {
    if (!ikB64 || !ourIKB64) {
      setFingerprint("(key unavailable)");
      return;
    }
    computeFingerprint(ikB64, ourIKB64)
      .then(setFingerprint)
      .catch(() => setFingerprint("(error computing fingerprint)"));
  }, [ikB64, ourIKB64]);

  return (
    <div className="rounded-md bg-gray-800 border border-gray-700 p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <code className="text-sm font-mono text-green-400 break-all tracking-wider">
        {fingerprint ?? "Computing…"}
      </code>
    </div>
  );
}

FingerprintDisplay.propTypes = {
  label: PropTypes.string.isRequired,
  ikB64: PropTypes.string,
  ourIKB64: PropTypes.string,
};

export default function SafetyNumberModal({
  open,
  onClose,
  savedPeer,
  fetchedPeer,
  ourPublicKeyB64,
  onAccept,
  onReject,
}) {
  if (!open) return null;

  const isKeyChange = !!fetchedPeer;
  const currentIK = savedPeer?.publicIdentityKeyX25519 ?? null;
  const newIK = fetchedPeer?.publicIdentityKeyX25519 ?? null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-5 max-w-md w-full mx-4 border border-gray-700 shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isKeyChange ? (
              <ShieldAlert className="w-5 h-5 text-red-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-green-400" />
            )}
            <h3 className="text-base font-semibold text-white">
              {isKeyChange ? "Identity Key Changed" : "Safety Number"}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isKeyChange ? (
          <>
            <p className="text-sm text-red-300 mb-4">
              This contact&apos;s identity key has changed. This could indicate a
              man-in-the-middle attack or a device reset. Compare safety numbers
              with your contact out-of-band before accepting.
            </p>

            <div className="space-y-2 mb-4">
              <FingerprintDisplay
                label="Previous key (trusted)"
                ikB64={currentIK}
                ourIKB64={ourPublicKeyB64}
              />
              <FingerprintDisplay
                label="New key (unverified)"
                ikB64={newIK}
                ourIKB64={ourPublicKeyB64}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={onReject}
                className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Reject
              </button>
              <button
                onClick={() => onAccept(fetchedPeer)}
                className="px-4 py-2 text-sm rounded bg-indigo-700 hover:bg-indigo-600 text-white"
              >
                Accept new key
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-300 mb-4">
              Compare these numbers with your contact using a channel you trust
              (voice call, in person). If they match, the conversation is secure.
            </p>

            <div className="mb-4">
              <FingerprintDisplay
                label="Safety number"
                ikB64={currentIK}
                ourIKB64={ourPublicKeyB64}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

SafetyNumberModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  savedPeer: PropTypes.shape({ publicIdentityKeyX25519: PropTypes.string }),
  fetchedPeer: PropTypes.shape({ publicIdentityKeyX25519: PropTypes.string }),
  ourPublicKeyB64: PropTypes.string,
  onAccept: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
};
