import React from "react";
import { Briefcase, MapPin, ArrowUpRight, Sparkles } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const ROLES = [
  {
    team: "Engineering",
    title: "Senior Cryptography Engineer",
    location: "Remote · EU",
    type: "Full-time",
  },
  {
    team: "Engineering",
    title: "iOS Engineer (Swift, secure enclave)",
    location: "Berlin · Hybrid",
    type: "Full-time",
  },
  {
    team: "Engineering",
    title: "SRE — Federation & Relays",
    location: "Remote · Worldwide",
    type: "Full-time",
  },
  {
    team: "Product",
    title: "Product Designer (privacy UX)",
    location: "Lisbon · Hybrid",
    type: "Full-time",
  },
  {
    team: "Security",
    title: "Application Security Engineer",
    location: "Remote · EU",
    type: "Full-time",
  },
  {
    team: "Trust",
    title: "Trust & Safety Lead",
    location: "Remote · Worldwide",
    type: "Full-time",
  },
];

const PERKS = [
  "Fully remote-first · async by default",
  "5 weeks PTO + winter shutdown",
  "Annual offsite (last one: Lisbon)",
  "€2,000 yearly hardware stipend",
  "Pay transparency · public bands",
  "Equity for everyone, vesting from day 1",
];

export default function CareersPage() {
  return (
    <PageShell
      eyebrow="Company · Careers"
      icon={Briefcase}
      title={
        <>
          Help us build the{" "}
          <span className="echo-gradient-text">privacy default.</span>
        </>
      }
      subtitle="No theatre, no fake urgency. Senior teams, deep work, real impact on millions of conversations."
    >
      <section>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Open roles
        </h2>
        <div className="mt-6 space-y-3">
          {ROLES.map((r) => (
            <a
              key={r.title}
              href="#"
              className="group glass cyber-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <span className="rounded-full border border-[#a855f7]/30 bg-[#a855f7]/10 px-3 py-1 text-[11px] uppercase tracking-wider text-[#e9d5ff] w-fit">
                {r.team}
              </span>
              <div className="flex-1">
                <h3 className="font-semibold">{r.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#a8a8b8]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {r.location}
                  </span>
                  <span>· {r.type}</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm text-[#e9d5ff] sm:opacity-0 group-hover:opacity-100 transition-opacity">
                View role <ArrowUpRight className="h-4 w-4" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#c4a8ff]" />
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            How we treat the team
          </h2>
        </div>
        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PERKS.map((p) => (
            <li
              key={p}
              className="glass rounded-2xl p-5 text-sm text-[#cfcfdc]"
            >
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 glass cyber-border rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-semibold">Don't see your role?</h2>
        <p className="mt-2 text-[#b9b9c4] max-w-xl mx-auto">
          We always read open applications from senior researchers and
          engineers in privacy / cryptography.
        </p>
        <a
          href="mailto:work@echo.io"
          className="btn-primary inline-flex mt-6"
        >
          work@echo.io
        </a>
      </section>
    </PageShell>
  );
}