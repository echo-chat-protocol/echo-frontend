import React from "react";
import { Newspaper, Clock, ArrowUpRight } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const POSTS = [
  {
    tag: "Engineering",
    title: "How we shipped post-quantum to 2.4 million devices",
    desc: "Inside the rollout of the hybrid Kyber-768 + X25519 handshake — and the migration story that almost wasn't.",
    author: "Mira Holloway",
    date: "Dec 04, 2025",
    read: "9 min",
    accent: "from-[#7c3aed] to-[#a855f7]",
    featured: true,
  },
  {
    tag: "Crypto",
    title: "Sealed sender: hiding who is talking, not just what",
    desc: "A 7-minute primer on metadata reduction in modern E2EE messengers.",
    author: "Theo Lindgren",
    date: "Nov 22, 2025",
    read: "7 min",
    accent: "from-[#a855f7] to-[#c4a8ff]",
  },
  {
    tag: "Trust",
    title: "Our first transparency report",
    desc: "12 government requests received, 0 plaintext produced — and exactly how that's possible.",
    author: "Idris Ben-Achour",
    date: "Nov 11, 2025",
    read: "5 min",
    accent: "from-[#7c3aed] to-[#c4a8ff]",
  },
  {
    tag: "Design",
    title: "Designing the safety-numbers screen",
    desc: "Why we threw away 3 prototypes before landing on something both verifiable and beautiful.",
    author: "Rafael Costa",
    date: "Oct 28, 2025",
    read: "6 min",
    accent: "from-[#8b5cf6] to-[#a855f7]",
  },
  {
    tag: "Engineering",
    title: "MLS group epochs, in plain English",
    desc: "Forward secrecy at 50,000 participants — without melting your phone's battery.",
    author: "Yuna Park",
    date: "Oct 03, 2025",
    read: "11 min",
    accent: "from-[#a855f7] to-[#7c3aed]",
  },
];

export default function BlogPage() {
  const [hero, ...rest] = POSTS;
  return (
    <PageShell
      eyebrow="Company · Blog"
      icon={Newspaper}
      title={
        <>
          Field notes from the{" "}
          <span className="echo-gradient-text">privacy frontier.</span>
        </>
      }
      subtitle="Engineering deep dives, transparency reports and the occasional rant about ad-driven UX."
    >
      {/* Featured */}
      <article className="glass cyber-border rounded-3xl overflow-hidden">
        <div className="grid lg:grid-cols-2">
          <div
            className={`relative min-h-[260px] bg-gradient-to-br ${hero.accent}`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_60%)]" />
            <div className="absolute bottom-5 left-5 font-mono text-[11px] uppercase tracking-wider text-white/80">
              Featured · {hero.tag}
            </div>
          </div>
          <div className="p-8 sm:p-10 flex flex-col">
            <h2 className="text-3xl font-semibold tracking-tight leading-tight">
              {hero.title}
            </h2>
            <p className="mt-4 text-[#b9b9c4]">{hero.desc}</p>
            <div className="mt-auto pt-8 flex items-center justify-between text-xs text-[#a0a0a0]">
              <span>
                {hero.author} · {hero.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {hero.read}
              </span>
            </div>
            <a
              href="#"
              className="mt-5 inline-flex items-center gap-1.5 text-[#e9d5ff]"
            >
              Read article <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </article>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
        {rest.map((p) => (
          <article
            key={p.title}
            className="glass cyber-border rounded-2xl overflow-hidden flex flex-col"
          >
            <div className={`h-32 bg-gradient-to-br ${p.accent} relative`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_60%)]" />
              <span className="absolute top-3 left-3 rounded-full bg-black/40 backdrop-blur px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-white">
                {p.tag}
              </span>
            </div>
            <div className="p-6 flex flex-col flex-1">
              <h3 className="text-lg font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-sm text-[#a8a8b8] flex-1">{p.desc}</p>
              <div className="mt-5 flex items-center justify-between text-xs text-[#a0a0a0]">
                <span>
                  {p.author} · {p.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {p.read}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </PageShell>
  );
}