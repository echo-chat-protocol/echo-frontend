import React, { useState } from "react";
import {
  Check,
  Sparkles,
  Building2,
  Users,
  Lock,
  KeyRound,
  Server,
  ShieldCheck,
  ArrowRight,
  Cpu,
  X,
  HelpCircle,
} from "lucide-react";
import PageShell from "@/components/layout/PageShell";

/* =====================================================================
 * Tier data — sourced from the ECHO commercial brief
 * ===================================================================== */
const buildPlans = (yearly) => [
  {
    id: "personal",
    name: "Personal",
    eyebrow: "Freemium",
    icon: Lock,
    desc: "For individuals who refuse to be the product. Privacy-by-default, forever.",
    price: 0,
    currency: "€",
    suffix: "Free, forever",
    sub: "No card · No phone number",
    cta: "Download ECHO",
    ctaHref: "/download",
    highlight: false,
    features: [
      "Unlimited 1:1 & group chats",
      "Native E2EE via the Echo Protocol",
      "On-device key generation (we never see your keys)",
      "Encrypted multi-device sync (phone · tablet · desktop)",
      "5 GB encrypted personal vault for photos, audio & docs",
      "Community + email support",
    ],
  },
  {
    id: "pro",
    name: "Pro / Business",
    eyebrow: "Most loved",
    icon: Users,
    desc: "For SMEs, agencies and offices handling confidential information.",
    price: yearly ? 6 : 8,
    currency: "€",
    suffix: yearly ? "/ user / month · billed yearly" : "/ user / month",
    sub: yearly ? "Equivalent to €72 / user / year" : "Cancel any time",
    cta: "Start 14-day trial",
    ctaHref: "/register",
    highlight: true,
    features: [
      "Everything in Personal",
      "Team admin console · onboard & offboard in seconds",
      "Remote device revocation if a device is lost or stolen",
      "Federated corporate identity (you@yourcompany.com)",
      "Priority relay · ultra-low latency (sub-50 ms)",
      "Preferential technical support · 4h SLA",
      "100 GB encrypted vault per user",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    eyebrow: "Protocol as a Service",
    icon: Server,
    desc: "Full ECHO Protocol embedded in your stack. Sovereign, audited, on-prem.",
    price: null,
    currency: "",
    suffix: "Custom pricing",
    sub: "Quote in 24 hours",
    cta: "Talk to sales",
    ctaHref: "/contact",
    highlight: false,
    features: [
      "Everything in Pro",
      "Embed the Echo Protocol in your own software via API / SDK",
      "On-premise self-hosted nodes for full data sovereignty",
      "SOC 2 & strict GDPR compliance pack",
      "Single Sign-On (Azure AD, Okta, Google Workspace…)",
      "Data Loss Prevention (DLP) policies",
      "Automated legal-hold message retention",
      "Hardware-key enforcement (YubiKey, FIDO2)",
      "99.99% SLA · 24/7 incident response",
      "Dedicated Trust Engineer assigned to your org",
    ],
  },
];

/* =====================================================================
 * Comparison table
 * ===================================================================== */
const COMPARE = [
  {
    section: "Messaging",
    rows: [
      ["Unlimited 1:1 & group chats", true, true, true],
      ["Native E2EE (Echo Protocol)", true, true, true],
      ["On-device key generation", true, true, true],
      ["Sealed sender + metadata padding", true, true, true],
      ["Group epochs up to 50,000 members", false, true, true],
    ],
  },
  {
    section: "Storage & sync",
    rows: [
      ["Encrypted vault", "5 GB", "100 GB / user", "Unlimited"],
      ["Cross-device sealed sync", true, true, true],
      ["Versioned per-folder ratchets", false, true, true],
    ],
  },
  {
    section: "Team & identity",
    rows: [
      ["Admin console", false, true, true],
      ["Remote device revocation", false, true, true],
      ["Federated corporate domain", false, true, true],
      ["SSO (Azure AD, Okta, Google)", false, false, true],
      ["SCIM provisioning", false, false, true],
    ],
  },
  {
    section: "Compliance & control",
    rows: [
      ["DLP policies", false, false, true],
      ["Legal-hold retention", false, false, true],
      ["Hardware-key enforcement", false, "Optional", true],
      ["SOC 2 / strict GDPR pack", false, false, true],
      ["On-premise self-hosted nodes", false, false, true],
      ["API / SDK to embed the protocol", false, false, true],
    ],
  },
  {
    section: "Support",
    rows: [
      ["Community + email", true, true, true],
      ["Preferential support · 4h SLA", false, true, true],
      ["24/7 incident response", false, false, true],
      ["Dedicated Trust Engineer", false, false, true],
      ["99.99% uptime SLA", false, false, true],
    ],
  },
];

/* =====================================================================
 * FAQ
 * ===================================================================== */
const FAQ = [
  {
    q: "How is ECHO funded if Personal is free?",
    a: "Pro and Enterprise revenues fund the entire operation. We do not run ads, do not sell data, and do not have VCs pushing for engagement metrics. The free tier is a permanent commitment — privacy should not require a credit card.",
  },
  {
    q: "What does 'per user' actually mean on Pro?",
    a: "Each active ECHO identity inside your team. Bots, integrations and external guests on your federated domain do not count toward your seat total.",
  },
  {
    q: "Can I switch between yearly and monthly?",
    a: "Yes. You can switch any time. Yearly is billed up-front with a 25% discount; switching to monthly is prorated automatically.",
  },
  {
    q: "What's included in the 14-day Pro trial?",
    a: "Every Pro feature — admin console, federated identity, priority relay, 100 GB vault per user — for up to 50 seats. No card required.",
  },
  {
    q: "How do I qualify for non-profit / journalist discounts?",
    a: "We give 80% off Pro to verified non-profits, investigative newsrooms and human-rights NGOs. Email sales@echo.io with your accreditation.",
  },
  {
    q: "Is Enterprise the only way to self-host?",
    a: "No — the open-source AGPL server runs on any VPS. Enterprise adds the supported, hardened deployment with SSO, DLP, and a dedicated Trust Engineer.",
  },
];

/* =====================================================================
 * Page
 * ===================================================================== */
export default function PricingPage() {
  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState(0);
  const plans = buildPlans(yearly);

  return (
    <PageShell
      eyebrow="Pricing · Three tiers"
      icon={Sparkles}
      title={
        <>
          Pay for the engineering. <br className="hidden sm:block" />
          <span className="echo-gradient-text">Never with your data.</span>
        </>
      }
      subtitle="ECHO is funded by users — not advertisers. Cancel any time, export everything, take your keys with you."
      backgroundColor="#000"
    >
      {/* ============================================================
          Monthly / Yearly toggle
      ============================================================ */}
      <div className="flex justify-center -mt-2">
        <div
          data-testid="pricing-toggle"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1"
        >
          <button
            data-testid="pricing-toggle-monthly"
            onClick={() => setYearly(false)}
            className={`rounded-full px-4 py-1.5 text-sm transition-all ${
              !yearly ? "bg-white text-black" : "text-[#cfcfdc]"
            }`}
          >
            Monthly
          </button>
          <button
            data-testid="pricing-toggle-yearly"
            onClick={() => setYearly(true)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-all ${
              yearly
                ? "bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white"
                : "text-[#cfcfdc]"
            }`}
          >
            Yearly
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                yearly ? "bg-white/20" : "bg-[#a855f7]/30 text-[#e9d5ff]"
              }`}
            >
              –25%
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================
          Plan cards
      ============================================================ */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {plans.map((p, i) => {
          const Icon = p.icon;
          return (
            <article
              key={p.id}
              data-testid={`pricing-card-${p.id}`}
              className={`relative rounded-[20px] p-7 flex flex-col anim-fade-up ${
                p.highlight
                  ? "pricing-pop bg-[#0c0c14] border border-transparent"
                  : "glass cyber-border"
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {p.highlight && (
                <span
                  data-testid="pricing-most-loved"
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                >
                  Most loved
                </span>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a855f7]">
                    {p.eyebrow}
                  </div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight">
                    {p.name}
                  </h3>
                </div>
                {Icon && (
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      p.highlight
                        ? "bg-white/10"
                        : "bg-gradient-to-br from-[#7c3aed] to-[#a855f7]"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm text-[#a8a8b8] leading-relaxed min-h-[48px]">
                {p.desc}
              </p>

              {/* Price */}
              <div className="mt-6 flex items-end gap-2">
                {p.price === null ? (
                  <span className="text-4xl font-semibold">Let&apos;s talk</span>
                ) : (
                  <>
                    <span className="text-5xl font-semibold tracking-tight">
                      {p.currency}
                      {p.price}
                    </span>
                    <span className="pb-1.5 text-sm text-[#a0a0a0]">
                      {p.suffix}
                    </span>
                  </>
                )}
              </div>
              {p.sub && (
                <div className="text-[11px] text-[#7a7a8a]">{p.sub}</div>
              )}

              <div className="my-6 divider-glow" />

              {/* Features */}
              <ul className="space-y-3 text-sm text-[#cfcfdc] flex-1">
                {p.features.map((f, idx) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full shrink-0 ${
                        p.highlight
                          ? "bg-white"
                          : "bg-gradient-to-br from-[#7c3aed] to-[#a855f7]"
                      }`}
                    >
                      <Check
                        className={`h-2.5 w-2.5 ${
                          p.highlight ? "text-[#7c3aed]" : "text-white"
                        }`}
                        strokeWidth={3}
                      />
                    </span>
                    <span className={idx === 0 ? "font-medium text-white" : ""}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                data-testid={`pricing-cta-${p.id}`}
                href={p.ctaHref}
                className={`mt-7 ${p.highlight ? "btn-primary" : "btn-ghost"}`}
              >
                {p.cta}
                <ArrowRight className="h-4 w-4" />
              </a>
            </article>
          );
        })}
      </section>

      {/* ============================================================
          Trust micro-strip
      ============================================================ */}
      <section className="mt-12 glass rounded-2xl p-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-[#a0a0a0]">
        {[
          { icon: ShieldCheck, label: "30-day money-back guarantee" },
          { icon: KeyRound, label: "Keys exportable any time" },
          { icon: Server, label: "EU + US infrastructure" },
          { icon: Cpu, label: "AGPL-3.0 open-source core" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-[#c4a8ff]" />
            {label}
          </span>
        ))}
      </section>

      {/* ============================================================
          Comparison table
      ============================================================ */}
      <section className="mt-20" data-testid="pricing-comparison">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Compare plans, feature by feature
        </h2>
        <p className="mt-2 text-[#b9b9c4] max-w-2xl">
          Every cell is honest. If a feature isn&apost there, it isn&apost there yet —
          we&aposll never ship grey-zone disclaimers.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-white/[0.04] text-[11px] uppercase tracking-wider text-[#a8a8b8]">
            <div className="px-5 py-3.5">Capability</div>
            <div className="px-5 py-3.5 text-center">Personal</div>
            <div className="px-5 py-3.5 text-center bg-[#a855f7]/10 text-white">
              Pro
            </div>
            <div className="px-5 py-3.5 text-center">Enterprise</div>
          </div>

          {COMPARE.map((group) => (
            <React.Fragment key={group.section}>
              <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-black/40 border-t border-white/5">
                <div className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#c4a8ff]">
                  {group.section}
                </div>
                <div />
                <div className="bg-[#a855f7]/[0.05]" />
                <div />
              </div>
              {group.rows.map((row, idx) => (
                <div
                  key={row[0]}
                  className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] border-t border-white/5 text-sm ${
                    idx % 2 ? "bg-white/[0.015]" : ""
                  }`}
                >
                  <div className="px-5 py-3.5 text-[#cfcfdc]">{row[0]}</div>
                  <Cell value={row[1]} />
                  <Cell value={row[2]} highlight />
                  <Cell value={row[3]} />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ============================================================
          Enterprise spotlight
      ============================================================ */}
      <section className="mt-20 relative">
        <div className="absolute -inset-3 rounded-[24px] bg-gradient-to-br from-[#7c3aed]/30 via-transparent to-[#a855f7]/30 blur-2xl pointer-events-none" />
        <div className="relative glass cyber-border rounded-[20px] p-8 sm:p-10 grid lg:grid-cols-[1.2fr_1fr] gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#a855f7]/30 bg-[#a855f7]/10 px-2.5 py-1 text-[11px] uppercase tracking-wider text-[#e9d5ff]">
              <Building2 className="h-3.5 w-3.5" />
              Protocol as a Service
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              Embed the Echo Protocol{" "}
              <span className="echo-gradient-text">inside your stack.</span>
            </h2>
            <p className="mt-4 text-[#b9b9c4] max-w-xl leading-relaxed">
              For organisations that need more than a chat app: a sovereign,
              audited cryptographic core they fully own. Deploy on your own
              metal, plug it into your existing identity stack, and integrate
              the SDK directly inside the apps your employees already use.
            </p>
            <a href="/contact" className="btn-primary mt-6 inline-flex">
              Talk to sales
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 self-center">
            {[
              { icon: Cpu, t: "API / SDK", d: "Embed E2EE in your app" },
              { icon: Server, t: "On-prem", d: "Self-hosted nodes" },
              { icon: ShieldCheck, t: "SOC 2", d: "Strict GDPR pack" },
              { icon: KeyRound, t: "YubiKey", d: "Hardware enforcement" },
              { icon: Users, t: "SSO + SCIM", d: "Azure AD · Okta · Google" },
              { icon: Sparkles, t: "Trust Engineer", d: "Dedicated to you" },
            ].map(({ icon: Icon, t, d }) => (
              <li
                key={t}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
              >
                <Icon className="h-4 w-4 text-[#c4a8ff]" />
                <div className="mt-2 text-sm font-semibold">{t}</div>
                <div className="text-xs text-[#a8a8b8]">{d}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          FAQ
      ============================================================ */}
      <section className="mt-20" data-testid="pricing-faq">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-5 w-5 text-[#c4a8ff]" />
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Pricing FAQ
          </h2>
        </div>
        <div className="mt-8 max-w-3xl grid gap-3">
          {FAQ.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={item.q}
                className={`glass rounded-2xl transition-colors ${
                  isOpen ? "border-[#a855f7]/45" : ""
                }`}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-medium">{item.q}</span>
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[12px] transition-transform ${
                      isOpen
                        ? "bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-white rotate-45"
                        : "border border-white/15 text-[#a0a0a0]"
                    }`}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm leading-relaxed text-[#cfcfdc]">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          Closing CTA strip
      ============================================================ */}
      <section className="mt-20 glass cyber-border rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Still deciding?
          </h2>
          <p className="mt-2 text-[#b9b9c4] max-w-xl">
            Try Pro free for 14 days. Or download Personal in 60 seconds and
            keep it forever — no card, no email cascade.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <a href="/register" className="btn-primary !py-2.5">
            Start free trial
          </a>
          <a href="/download" className="btn-ghost !py-2.5">
            Get Personal · free
          </a>
        </div>
      </section>
    </PageShell>
  );
}

/* =====================================================================
 * Cell — renders a check / cross / text inside the comparison table
 * ===================================================================== */
function Cell({ value, highlight = false }) {
  const wrap = `px-5 py-3.5 flex items-center justify-center ${
    highlight ? "bg-[#a855f7]/[0.05]" : ""
  }`;
  if (value === true)
    return (
      <div className={wrap}>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
      </div>
    );
  if (value === false)
    return (
      <div className={wrap}>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
          <X className="h-3 w-3 text-[#5e5e6c]" strokeWidth={2.5} />
        </span>
      </div>
    );
  return (
    <div className={wrap}>
      <span className="text-sm text-[#e9d5ff] font-medium">{value}</span>
    </div>
  );
}