import React from "react";
import { Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const SERVICES = [
  { name: "Relay · EU-Central", uptime: 99.998, status: "ok" },
  { name: "Relay · US-East", uptime: 99.991, status: "ok" },
  { name: "Relay · AP-South", uptime: 99.96, status: "degraded" },
  { name: "Push notifications", uptime: 99.999, status: "ok" },
  { name: "Federation gateway", uptime: 99.97, status: "ok" },
  { name: "App Store / Play distribution", uptime: 100, status: "ok" },
];

const INCIDENTS = [
  {
    date: "2025-12-02 · 14:22 UTC",
    title: "AP-South relay elevated latency",
    desc: "Degraded delivery in APAC for 38 minutes. Mitigated by failing over to AP-Northeast. No messages lost (sealed envelopes are durable).",
    state: "resolved",
  },
  {
    date: "2025-11-09 · 03:11 UTC",
    title: "iOS push token rotation",
    desc: "Apple APNs token rotation caused notification delay (avg 22s) for 14 minutes. Cleared automatically.",
    state: "resolved",
  },
];

function bar(uptime) {
  const days = 60;
  return Array.from({ length: days }, (_, i) => {
    const r = Math.random();
    const ok = r > 1 - uptime / 100 + 0.001;
    return ok;
  });
}

export default function StatusPage() {
  const allOk = SERVICES.every((s) => s.status === "ok");
  return (
    <PageShell
      eyebrow="Resources · Status"
      icon={Activity}
      title={
        allOk ? (
          <>
            All systems{" "}
            <span className="echo-gradient-text">whispering happily.</span>
          </>
        ) : (
          <>
            Some <span className="echo-gradient-text">turbulence detected.</span>
          </>
        )
      }
      subtitle="Live uptime for the past 60 days. Incidents are posted within 5 minutes of detection."
    >
      <div
        className={`glass cyber-border rounded-2xl p-5 flex items-center gap-3 ${
          allOk ? "" : "border-[#fbbf24]/40"
        }`}
      >
        {allOk ? (
          <CheckCircle2 className="h-5 w-5 text-[#a8f0c2]" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-[#fbbf24]" />
        )}
        <div>
          <div className="font-semibold">
            {allOk ? "All systems operational" : "Partial degradation"}
          </div>
          <div className="text-xs text-[#a8a8b8]">
            Last checked just now · refreshes every 30s
          </div>
        </div>
      </div>

      <section className="mt-10 space-y-3">
        {SERVICES.map((s) => (
          <article
            key={s.name}
            className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <div className="flex items-center gap-3 sm:w-72 shrink-0">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  s.status === "ok" ? "bg-[#22c55e]" : "bg-[#fbbf24]"
                }`}
              />
              <span className="font-medium">{s.name}</span>
            </div>
            <div className="flex-1 flex gap-[2px]">
              {bar(s.uptime).map((ok, i) => (
                <span
                  key={i}
                  title={`Day -${60 - i}`}
                  className="flex-1 h-7 rounded-[2px]"
                  style={{
                    background: ok ? "rgba(34,197,94,0.55)" : "rgba(251,191,36,0.7)",
                  }}
                />
              ))}
            </div>
            <div className="font-mono text-sm text-[#cfcfdc] sm:w-20 text-right">
              {s.uptime.toFixed(2)}%
            </div>
          </article>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          Recent incidents
        </h2>
        <div className="mt-6 space-y-4">
          {INCIDENTS.map((i) => (
            <article key={i.date} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#a0a0a0]">
                  {i.date}
                </span>
                <span className="rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-2.5 py-0.5 text-[11px] text-[#a8f0c2]">
                  {i.state}
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{i.title}</h3>
              <p className="mt-1 text-sm text-[#cfcfdc]">{i.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}