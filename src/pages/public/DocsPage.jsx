import React, { useState } from "react";
import {
  BookOpen,
  Code2,
  Server,
  KeyRound,
  Search,
  ArrowRight,
  Terminal,
} from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const SECTIONS = [
  {
    icon: BookOpen,
    title: "Getting started",
    items: [
      "Install ECHO in 60 seconds",
      "Generate your first keypair",
      "Verify a contact's fingerprint",
      "Create your first group",
    ],
  },
  {
    icon: Code2,
    title: "Developer SDK",
    items: [
      "@echo/sdk for TypeScript",
      "echo-rs (Rust crate)",
      "echo-swift",
      "echo-kotlin",
      "REST relay protocol",
    ],
  },
  {
    icon: Server,
    title: "Self-hosting",
    items: [
      "Deploy a relay on Docker",
      "Federation with other nodes",
      "Backups & disaster recovery",
      "Observability (Prometheus / OTLP)",
    ],
  },
  {
    icon: KeyRound,
    title: "Cryptography",
    items: [
      "Key derivation (Argon2id)",
      "Double Ratchet specification",
      "MLS group epochs",
      "Hybrid PQ handshake (Kyber + X25519)",
    ],
  },
];

export default function DocsPage() {
  const [q, setQ] = useState("");

  return (
    <PageShell
      eyebrow="Resources · Documentation"
      icon={BookOpen}
      title={
        <>
          Everything you need to{" "}
          <span className="echo-gradient-text">build, deploy, audit.</span>
        </>
      }
      subtitle="Concepts, recipes, full protocol reference. Search 240+ pages."
    >
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#a855f7]/55">
          <Search className="h-4 w-4 text-[#a0a0a0]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search docs — try 'verify fingerprint' or 'self-host'…"
            className="w-full bg-transparent py-3.5 text-sm text-white placeholder:text-[#6f6f7e] outline-none"
          />
          <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-[#a0a0a0]">
            ⌘K
          </span>
        </div>
      </div>

      <section className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
        {SECTIONS.map(({ icon: Icon, title, items }) => (
          <article key={title} className="glass cyber-border rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                <Icon className="h-5 w-5 text-white" />
              </span>
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <ul className="mt-5 space-y-3 text-sm">
              {items.map((it) => (
                <li key={it}>
                  <a
                    href="#"
                    className="group flex items-center justify-between text-[#cfcfdc] hover:text-white"
                  >
                    {it}
                    <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-16 glass cyber-border rounded-2xl p-8">
        <div className="flex items-center gap-2 text-sm text-[#cfcfdc]">
          <Terminal className="h-4 w-4 text-[#c4a8ff]" />
          <span className="font-mono">curl -fsSL https://echo.io/cli | sh</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold">
          Prefer the terminal? So do we.
        </h2>
        <p className="mt-2 text-[#b9b9c4]">
          The <span className="font-mono text-[#c4a8ff]">echo</span> CLI gives
          you scriptable encryption: send messages, verify keys, audit relays —
          all from a TTY.
        </p>
      </section>
    </PageShell>
  );
}