import { FaGithub, FaXTwitter } from "react-icons/fa6";
import { FiUsers, FiMessageSquare, FiCalendar, FiRss, FiSend } from "react-icons/fi";
import PageShell from "@/components/layout/PageShell";

const CHANNELS = [
  {
    icon: FiMessageSquare,
    name: "Matrix #echo:echo.io",
    sub: "12,400 members · always-on chat",
    cta: "Join Matrix",
  },
  {
    icon: FaGithub,
    name: "GitHub Discussions",
    sub: "Protocol RFCs, plugin showcase, Q&A",
    cta: "Open Discussions",
  },
  {
    icon: FiSend,
    name: "Telegram (mirrored)",
    sub: "Read-only announcements channel",
    cta: "Subscribe",
  },
  {
    icon: FaXTwitter,
    name: "@echoprivacy on X",
    sub: "Engineering threads, audit drops",
    cta: "Follow",
  },
];

const EVENTS = [
  {
    date: "Mar 14",
    title: "ECHO Privacy Summit · Berlin",
    desc: "Two days of talks on PQ crypto, sealed metadata and federation.",
  },
  {
    date: "Apr 02",
    title: "Hackathon: Build with @echo/sdk",
    desc: "$25k in bounties for the best plugin built on the open relay protocol.",
  },
  {
    date: "May 21",
    title: "AMA with the protocol team",
    desc: "Live audit walkthrough of the upcoming MLS epochs release.",
  },
];

export default function CommunityPage() {
  return (
    <PageShell
      eyebrow="Resources · Community"
      icon={FiUsers}
      title={
        <>
          A community that{" "}
          <span className="echo-gradient-text">verifies before it trusts.</span>
        </>
      }
      subtitle="Researchers, journalists, engineers and curious humans. Pick your channel."
    >
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {CHANNELS.map(({ icon: Icon, name, sub, cta }) => (
          <article
            key={name}
            className="glass cyber-border rounded-2xl p-6 flex items-center justify-between gap-5"
          >
            <div className="flex items-center gap-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                <Icon className="h-5 w-5 text-white" />
              </span>
              <div>
                <h3 className="text-base font-semibold">{name}</h3>
                <p className="text-xs text-[#a8a8b8]">{sub}</p>
              </div>
            </div>
            <a href="#" className="btn-ghost !py-2 text-sm">
              {cta}
            </a>
          </article>
        ))}
      </section>

      <section className="mt-20">
        <div className="flex items-center gap-2">
          <FiCalendar className="h-5 w-5 text-[#c4a8ff]" />
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Upcoming events
          </h2>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {EVENTS.map((e) => (
            <article key={e.title} className="glass rounded-2xl p-6">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#a855f7]">
                {e.date}
              </div>
              <h3 className="mt-3 text-lg font-semibold">{e.title}</h3>
              <p className="mt-2 text-sm text-[#a8a8b8]">{e.desc}</p>
              <a
                href="#"
                className="mt-4 inline-flex text-sm text-[#e9d5ff] hover:underline"
              >
                Reserve a seat →
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 glass cyber-border rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-start gap-4">
          <FiRss className="h-6 w-6 text-[#c4a8ff]" />
          <div>
            <h2 className="text-xl font-semibold">Stay in the loop</h2>
            <p className="mt-1 text-sm text-[#b9b9c4]">
              One short email per release. Zero tracking pixels. No spam — that
              would be ironic.
            </p>
          </div>
        </div>
        <form className="flex w-full sm:w-auto gap-2">
          <input
            type="email"
            placeholder="you@privacy.io"
            className="flex-1 sm:w-64 rounded-full border border-white/10 bg-black/40 px-4 py-2.5 text-sm outline-none focus:border-[#a855f7]/55"
          />
          <button type="submit" className="btn-primary !py-2.5 text-sm">
            Subscribe
          </button>
        </form>
      </section>
    </PageShell>
  );
}