import React from "react";
import { Building2, Heart, Sparkles, Users } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const VALUES = [
  {
    icon: Heart,
    title: "Privacy is a human right",
    desc: "We treat metadata, attention, and conversation as sacred — not as inventory.",
  },
  {
    icon: Sparkles,
    title: "Boring crypto, bold UX",
    desc: "Algorithms should be the most boring thing about a messenger. The product should be a delight.",
  },
  {
    icon: Users,
    title: "Open, audited, owned",
    desc: "Every line of crypto code is independently audited. Eventually we'll transition into a foundation.",
  },
];

const TEAM = [
  { name: "Mira Holloway", role: "Co-founder · Crypto", initials: "MH" },
  { name: "Idris Ben-Achour", role: "Co-founder · Product", initials: "IB" },
  { name: "Yuna Park", role: "Engineering · Mobile", initials: "YP" },
  { name: "Theo Lindgren", role: "Engineering · Backend", initials: "TL" },
  { name: "Aïsha Whisper", role: "Security researcher", initials: "AW" },
  { name: "Rafael Costa", role: "Design · Brand", initials: "RC" },
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="Company · About"
      icon={Building2}
      title={
        <>
          Built by people who <br className="hidden sm:block" />
          <span className="echo-gradient-text">refuse to be the product.</span>
        </>
      }
      subtitle="ECHO Labs is a small, deliberate team. No VCs sitting on our cap table demanding ad revenue. Funded by users, that's the whole business model."
    >
      <section>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Our values
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {VALUES.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="glass cyber-border rounded-2xl p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                <Icon className="h-5 w-5 text-white" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-[#a8a8b8]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          The humans behind ECHO
        </h2>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {TEAM.map((p) => (
            <article key={p.name} className="glass rounded-2xl p-5 text-center">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-base font-semibold">
                {p.initials}
              </span>
              <div className="mt-3 text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-[#a8a8b8]">{p.role}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20 grid grid-cols-3 sm:grid-cols-6 gap-4">
        {[
          { k: "2.4M", v: "active identities" },
          { k: "0", v: "data breaches" },
          { k: "12", v: "countries · staff" },
          { k: "8", v: "independent audits" },
          { k: "100%", v: "audited" },
          { k: "$0", v: "ad revenue" },
        ].map((s) => (
          <div key={s.v} className="glass rounded-2xl p-5 text-center">
            <div className="text-2xl font-semibold tracking-tight">
              <span className="echo-gradient-text">{s.k}</span>
            </div>
            <div className="mt-1 text-xs text-[#a8a8b8]">{s.v}</div>
          </div>
        ))}
      </section>
    </PageShell>
  );
}