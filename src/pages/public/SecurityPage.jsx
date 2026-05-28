import React from "react";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Cpu,
  Server,
  GitBranch,
  ScrollText,
  AlertTriangle,
} from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const STACK = [
  {
    layer: "Identity",
    primitive: "Ed25519 + X25519",
    role: "Long-term identity & key-exchange keypairs, generated on-device.",
  },
  {
    layer: "Handshake",
    primitive: "Hybrid Kyber-768 + X25519",
    role: "Post-quantum-resistant session establishment.",
  },
  {
    layer: "Ratchet",
    primitive: "Double Ratchet + MLS epochs",
    role: "Forward secrecy & post-compromise security at any group size.",
  },
  {
    layer: "Message",
    primitive: "XChaCha20-Poly1305",
    role: "Authenticated encryption with 192-bit nonces. AEAD across the wire.",
  },
  {
    layer: "Transport",
    primitive: "QUIC + Sealed Sender",
    role: "Padded, fixed-size packets. Server never learns the sender ID.",
  },
  {
    layer: "Storage",
    primitive: "Argon2id + AES-256-GCM",
    role: "Local vault sealed by a key derived from your device passphrase.",
  },
];

const AUDITS = [
  { firm: "Trail of Bits", scope: "Crypto core review", year: "2025-Q3" },
  { firm: "Cure53", scope: "Mobile clients & ratchet", year: "2025-Q1" },
  { firm: "NCC Group", scope: "Federation & relays", year: "2024-Q4" },
];

export default function SecurityPage() {
  return (
    <PageShell
      eyebrow="Product · Security"
      icon={ShieldCheck}
      title={
        <>
          Don't trust us.{" "}
          <span className="echo-gradient-text">Verify everything.</span>
        </>
      }
      subtitle="A radically transparent look at the cryptographic stack, threat model, and audits behind ECHO."
    >
      {/* Crypto stack */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          The cryptographic stack
        </h2>
        <p className="mt-3 text-[#b9b9c4] max-w-2xl">
          Six layers. Each one boring, well-understood, and battle-tested.
          Boring is the point.
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-[#a8a8b8] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3">Layer</th>
                <th className="px-5 py-3">Primitive</th>
                <th className="px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {STACK.map((row, i) => (
                <tr
                  key={row.layer}
                  className={i % 2 ? "bg-white/[0.02]" : "bg-transparent"}
                >
                  <td className="px-5 py-4 font-medium text-white">
                    {row.layer}
                  </td>
                  <td className="px-5 py-4 font-mono text-[#c4a8ff]">
                    {row.primitive}
                  </td>
                  <td className="px-5 py-4 text-[#cfcfdc]">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Threat model */}
      <section className="mt-20 grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Threat model
          </h2>
          <p className="mt-3 text-[#b9b9c4]">
            What we defend against and what we can't. Honesty matters more
            than marketing.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-[#cfcfdc]">
            {[
              "Network adversary inspecting all relays (passive + active)",
              "Compromised ECHO server (we publish reproducible builds)",
              "Stolen device after the fact (forward secrecy / ratchet)",
              "Government legal order against ECHO Labs (zero plaintext)",
              "Harvest-now-decrypt-later (hybrid PQ handshake)",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Lock className="h-4 w-4 text-[#a855f7] shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="glass cyber-border rounded-2xl p-6">
          <div className="flex items-center gap-2 text-[#fbbf24]">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">We do NOT defend against</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-[#cfcfdc]">
            <li>Malware on your device with screen / keyboard access</li>
            <li>A coerced participant in the conversation</li>
            <li>Operating-system level compromise (kernel, secure enclave)</li>
            <li>Endpoint compromise via shoulder-surfing or phishing</li>
          </ul>
          <p className="mt-5 text-xs text-[#7a7a8a]">
            E2EE protects messages in transit and at rest, not the human at
            the keyboard. Pair ECHO with strong endpoint hygiene.
          </p>
        </div>
      </section>

      {/* Audits */}
      <section className="mt-20">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Independent audits
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {AUDITS.map((a) => (
            <a
              key={a.firm}
              href="#"
              className="glass cyber-border rounded-2xl p-6 group"
            >
              <div className="flex items-center justify-between">
                <ScrollText className="h-5 w-5 text-[#c4a8ff]" />
                <span className="font-mono text-[10px] text-[#a0a0a0]">
                  {a.year}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{a.firm}</h3>
              <p className="text-sm text-[#a8a8b8]">{a.scope}</p>
              <span className="mt-4 inline-flex text-sm text-[#e9d5ff] group-hover:underline">
                Read full report →
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Bug bounty */}
      <section className="mt-20 glass cyber-border rounded-2xl p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start gap-4">
          <KeyRound className="h-7 w-7 text-[#c4a8ff]" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Bug bounty program
            </h2>
            <p className="mt-1 text-sm text-[#b9b9c4]">
              Up to $50,000 for cryptographic findings · $5,000 for app-layer ·
              Hall of Fame for everything else.
            </p>
          </div>
        </div>
        <a href="mailto:security@echo.app" className="btn-primary !py-2.5">
          security@echo.app
        </a>
      </section>
    </PageShell>
  );
}