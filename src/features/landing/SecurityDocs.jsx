import React from "react";
import { FileText, ShieldCheck, ScrollText, ArrowUpRight } from "lucide-react";

const DOCS = [
  {
    icon: ShieldCheck,
    tag: "Audit · 2025-Q3",
    title: "Trail of Bits — Cryptographic Core Review",
    desc: "Full-scope audit of the X25519 + Kyber-768 hybrid handshake and message-layer XChaCha20-Poly1305 implementation.",
    cta: "Read the report",
  },
  {
    icon: ScrollText,
    tag: "Whitepaper",
    title: "ECHO Protocol v3.2",
    desc: "Specification of sealed sender, double-ratchet variant, group epochs and metadata padding strategies.",
    cta: "Open whitepaper",
  },
  {
    icon: FileText,
    tag: "Transparency",
    title: "Government Requests · 2025",
    desc: "Every legal request received and how exactly zero plaintext was ever produced. Updated quarterly, signed by the team.",
    cta: "View report",
  },
];

export default function SecurityDocs() {
  return (
    <section
      id="security"
      data-testid="security-docs"
      className="relative py-24 sm:py-32 section-fade overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">

            <h2 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Don't trust us. <br />
              <span className="echo-gradient-text">Verify everything.</span>
            </h2>
          </div>
          <p className="text-[#b9b9c4] leading-relaxed lg:max-w-md">
            We publish every audit, every protocol revision and every legal
            request. If a vendor can't show you these documents — they don't
            deserve your secrets.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {DOCS.map(({ icon: Icon, tag, title, desc, cta }, i) => (
            <a
              data-testid={`security-doc-${i}`}
              key={title}
              href="#"
              className="group glass cyber-border rounded-2xl p-6 flex flex-col anim-fade-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="font-mono text-[10px] text-[#a0a0a0]">
                  {tag}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm text-[#a8a8b8] leading-relaxed flex-1">
                {desc}
              </p>
              <div className="mt-5 inline-flex items-center gap-1.5 text-sm text-[#e9d5ff]">
                {cta}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}