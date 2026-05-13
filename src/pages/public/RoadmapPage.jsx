import React from "react";
import { Map, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const ROADMAP = [
  {
    quarter: "Shipped · 2025-Q3",
    status: "done",
    items: [
      "Hybrid Kyber-768 + X25519 handshake",
      "Sealed sender for groups (≤ 256)",
      "Self-hosted ECHO node v1",
    ],
  },
  {
    quarter: "Shipping · 2025-Q4",
    status: "doing",
    items: [
      "MLS group epochs (≤ 50,000 members)",
      "Encrypted video calls (SFU + DTLS-SRTP)",
      "Hardware-key onboarding (FIDO2 / WebAuthn)",
    ],
  },
  {
    quarter: "Next · 2026-Q1",
    status: "next",
    items: [
      "Cross-device key sync via Shamir 3-of-5",
      "Time-locked messages (delayed delivery)",
      "Air-gapped on-device translation (38 langs)",
    ],
  },
  {
    quarter: "Exploring · 2026-Q2+",
    status: "future",
    items: [
      "Anonymous federation discovery",
      "Disappearing photo vaults",
      "Open governance (foundation transition)",
    ],
  },
];

const ICONS = {
  done: CheckCircle2,
  doing: Loader2,
  next: Sparkles,
  future: Map,
};

export default function RoadmapPage() {
  return (
    <PageShell
      eyebrow="Product · Roadmap"
      icon={Map}
      title={
        <>
          Where ECHO is{" "}
          <span className="echo-gradient-text">going next.</span>
        </>
      }
      subtitle="A live roadmap. Updated when reality moves the dates — never to make us look better."
    >
      <div className="relative pl-6 sm:pl-8">
        <div className="absolute left-2 sm:left-3 top-2 bottom-2 w-px bg-gradient-to-b from-[#7c3aed] via-[#a855f7] to-transparent" />
        <ol className="space-y-12">
          {ROADMAP.map((r, i) => {
            const Icon = ICONS[r.status];
            const accent =
              r.status === "done"
                ? "text-[#a8f0c2]"
                : r.status === "doing"
                  ? "text-[#c4a8ff]"
                  : "text-[#e9d5ff]";
            return (
              <li
                key={r.quarter}
                className="relative anim-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span
                  className={`absolute -left-[26px] sm:-left-[34px] top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black ${accent}`}
                >
                  <Icon
                    className={`h-3 w-3 ${
                      r.status === "doing" ? "anim-spin-slow" : ""
                    }`}
                  />
                </span>
                <div className="font-mono text-[12px] uppercase tracking-wider text-[#a0a0a0]">
                  {r.quarter}
                </div>
                <ul className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {r.items.map((it) => (
                    <li
                      key={it}
                      className="glass rounded-xl px-4 py-3 text-sm leading-relaxed text-[#cfcfdc]"
                    >
                      {it}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      <section className="mt-20 glass cyber-border rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-semibold">
          Want to influence the roadmap?
        </h2>
        <p className="mt-2 text-[#b9b9c4]">
          Every quarter we run a public RFC. Anyone with an ECHO identity can
          vote, propose, or sponsor an item.
        </p>
        <a href="/community" className="btn-ghost mt-6 inline-flex">
          Join the next RFC →
        </a>
      </section>
    </PageShell>
  );
}