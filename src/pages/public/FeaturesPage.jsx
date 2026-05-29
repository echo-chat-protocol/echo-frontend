import React from "react";
import {
  Lock,
  EyeOff,
  Zap,
  Fingerprint,
  GitBranch,
  Network,
  Globe2,
  ShieldCheck,
  KeyRound,
  Server,
  FileLock2,
  Users,
} from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const PRIMARY = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    desc: "Curve25519 + XChaCha20-Poly1305. Keys are forged on your device and never reconstructed anywhere else.",
  },
  {
    icon: EyeOff,
    title: "Zero-Knowledge Servers",
    desc: "Our relays only ever see ciphertext. Even if seized, our servers literally cannot decrypt anything.",
  },
  {
    icon: Zap,
    title: "Sub-100ms Delivery",
    desc: "Multi-region mesh routes sealed packets through the fastest hop. No batching, no analytics tax.",
  },
  {
    icon: Fingerprint,
    title: "Verifiable Identities",
    desc: "Public fingerprints. Verify in person, by QR, or via the safety-numbers protocol.",
  },
  {
    icon: GitBranch,
    title: "Auditable",
    desc: "Independent firms run quarterly audits — published in full.",
  },
  {
    icon: Network,
    title: "Federated by design",
    desc: "Run your own ECHO node. Compatible with Matrix-style federation while keeping E2EE intact.",
  },
  {
    icon: Globe2,
    title: "Metadata Minimisation",
    desc: "No phone number required. Sealed sender, padded packet sizes, randomised timing.",
  },
  {
    icon: ShieldCheck,
    title: "Quantum-resistant ready",
    desc: "Hybrid Kyber-768 + X25519 handshake. Future-proof against harvest-now-decrypt-later attacks.",
  },
];

const SECONDARY = [
  {
    icon: KeyRound,
    title: "Hardware key support",
    desc: "YubiKey, Solo, Nitrokey. Enforce 2-factor at the device level.",
  },
  {
    icon: Server,
    title: "Self-hosting",
    desc: "Single binary. SQLite or Postgres. Runs on a $5 VPS.",
  },
  {
    icon: FileLock2,
    title: "Encrypted vault",
    desc: "5–100 GB sealed storage with per-folder ratchets and versioning.",
  },
  {
    icon: Users,
    title: "Group epochs",
    desc: "MLS-inspired group ratchet. Forward secrecy at any group size.",
  },
];

export default function FeaturesPage() {
  return (
    <PageShell
      eyebrow="Product · Features"
      icon={ShieldCheck}
      title={
        <>
          Eight pillars.{" "}
          <span className="echo-gradient-text">Zero compromises.</span>
        </>
      }
      subtitle="Every feature in ECHO exists for one reason: to make surveillance — corporate or governmental — mathematically impossible."
    >
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PRIMARY.map(({ icon: Icon, title, desc }, i) => (
          <article
            key={title}
            className="cyber-border glass rounded-2xl p-6 anim-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
              <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              {title}
            </h3>
            <p className="mt-2 text-sm text-[#a8a8b8] leading-relaxed">
              {desc}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-20">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Built for the long game
        </h2>
        <p className="mt-3 text-[#b9b9c4] max-w-2xl">
          Beyond the headline pillars, ECHO ships the unglamorous tooling
          that makes security usable.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {SECONDARY.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-5">
              <Icon className="h-5 w-5 text-[#c4a8ff]" />
              <h3 className="mt-3 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-[#a8a8b8]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 glass cyber-border rounded-[20px] p-8 sm:p-12 text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Ready to switch?
        </h2>
        <p className="mt-3 text-[#b9b9c4] max-w-xl mx-auto">
          Generate a Curve25519 keypair, scan a QR, and start whispering. No
          phone number, no email cascade.
        </p>
        <a href="/register" className="btn-primary mt-7 inline-flex">
          Create my identity
        </a>
      </section>
    </PageShell>
  );
}