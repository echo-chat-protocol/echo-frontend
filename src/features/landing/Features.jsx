import React from "react";
import {
  Lock,
  Zap,
  EyeOff,
  Fingerprint,
  Network,
  GitBranch,
  Globe2,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    desc: "Curve25519 + XChaCha20-Poly1305. Keys are forged on your device and never reconstructed anywhere else.",
    accent: "from-[#a855f7] to-[#8b5cf6]",
  },
  {
    icon: EyeOff,
    title: "Zero-Knowledge Servers",
    desc: "Our relays only ever see ciphertext. Even if seized, our servers literally cannot decrypt your messages.",
    accent: "from-[#7c3aed] to-[#a855f7]",
  },
  {
    icon: Zap,
    title: "Sub-100ms Delivery",
    desc: "A multi-region mesh routes your sealed packets through the fastest hop. No batching, no analytics taxation.",
    accent: "from-[#8b5cf6] to-[#a855f7]",
  },
  {
    icon: Fingerprint,
    title: "Verifiable Identities",
    desc: "Every contact has a public fingerprint. Verify in person, by QR or via the safety-numbers protocol.",
    accent: "from-[#7c3aed] to-[#a855f7]",
  },
  {
    icon: GitBranch,
    title: "Open & Auditable",
    desc: "Every line of crypto code is open-source. Independent firms run quarterly black-box audits — published in full.",
    accent: "from-[#a855f7] to-[#8b5cf6]",
  },
  {
    icon: Network,
    title: "Federated by design",
    desc: "Run your own ECHO node. Compatible with the Matrix-style federation while keeping E2EE intact.",
    accent: "from-[#8b5cf6] to-[#a855f7]",
  },
  {
    icon: Globe2,
    title: "Metadata Minimisation",
    desc: "No phone number required. Sealed sender, padded packet sizes, randomised timing. We can't profile you.",
    accent: "from-[#7c3aed] to-[#a855f7]",
  },
  {
    icon: ShieldCheck,
    title: "Quantum-resistant ready",
    desc: "Hybrid Kyber-768 + X25519 handshake. Future-proof against harvest-now-decrypt-later attacks.",
    accent: "from-[#7c3aed] to-[#a855f7]",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      data-testid="features-section"
      className="relative py-24 sm:py-32 section-fade overflow-hidden"
    >
      <div className="absolute inset-0">
        <div className="aurora-bg opacity-50" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">

          <h2 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.02]">
            Privacy isn't a setting. <br />
            <span className="echo-gradient-text">It's the architecture.</span>
          </h2>
          <p className="mt-5 text-[#b9b9c4] leading-relaxed max-w-2xl">
            Eight non-negotiable pillars that turn a chat app into a true
            zero-trust communication layer.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, accent }, i) => (
            <article
              key={title}
              data-testid={`feature-card-${i}`}
              className="group cyber-border glass rounded-2xl p-6 anim-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-[0_8px_30px_-8px_rgba(168,85,247,0.6)]`}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm text-[#a8a8b8] leading-relaxed">
                {desc}
              </p>
              <div className="mt-5 flex items-center text-xs text-[#cfcfdc]">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more →
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}