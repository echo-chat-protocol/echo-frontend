import React, { useState } from "react";
import { Mail, MessageCircle, Building2, Lock } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const REASONS = [
  { v: "general", label: "General question" },
  { v: "press", label: "Press / Media" },
  { v: "sales", label: "Enterprise sales" },
  { v: "security", label: "Security disclosure" },
  { v: "other", label: "Something else" },
];

export default function ContactPage() {
  const [reason, setReason] = useState("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setSent(true);
  };

  return (
    <PageShell
      eyebrow="Company · Contact"
      icon={MessageCircle}
      title={
        <>
          Talk to a{" "}
          <span className="echo-gradient-text">real human.</span>
        </>
      }
      subtitle="No tickets sent into the void. We answer every email — usually within four hours."
    >
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Side info */}
        <aside className="space-y-4">
          {[
            {
              icon: Mail,
              title: "Email",
              v: "hello@echo.io",
              sub: "General · 4h SLA",
            },
            {
              icon: Building2,
              title: "Sales",
              v: "sales@echo.io",
              sub: "Enterprise & self-hosted",
            },
            {
              icon: Lock,
              title: "Security",
              v: "security@echo.io",
              sub: "PGP: 0xECHO320SEC",
            },
          ].map((c) => (
            <article key={c.title} className="glass cyber-border rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <c.icon className="h-5 w-5 text-[#c4a8ff]" />
                <div className="text-sm font-semibold">{c.title}</div>
              </div>
              <div className="mt-3 font-mono text-sm text-[#e9d5ff]">{c.v}</div>
              <div className="text-xs text-[#a8a8b8]">{c.sub}</div>
            </article>
          ))}
        </aside>

        {/* Form */}
        <section className="lg:col-span-2 glass cyber-border rounded-2xl p-6 sm:p-8">
          {sent ? (
            <div className="text-center py-12">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                <Mail className="h-6 w-6 text-white" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold">Sealed and sent.</h2>
              <p className="mt-2 text-[#b9b9c4]">
                We'll reply to <span className="text-white">{email}</span>{" "}
                shortly — usually within 4 hours during European working days.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-[12px] font-medium text-[#cfcfdc] mb-2">
                  What's it about?
                </label>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => setReason(r.v)}
                      className={`rounded-full px-3.5 py-1.5 text-sm transition-all border ${
                        reason === r.v
                          ? "bg-gradient-to-r from-[#7c3aed] to-[#a855f7] border-transparent text-white"
                          : "bg-white/[0.03] border-white/10 text-[#cfcfdc] hover:border-[#a855f7]/40"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Name" value={name} onChange={setName} />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#cfcfdc] mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder="Encryption is fine, but plain English works too."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-[#6f6f7e] outline-none focus:border-[#a855f7]/55 resize-none"
                />
              </div>
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Send sealed message
              </button>
              <p className="text-[11px] text-[#7a7a8a]">
                Submitting transmits over TLS 1.3 to a relay that does not
                store form payloads beyond delivery.
              </p>
            </form>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#cfcfdc] mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[#a855f7]/55"
      />
    </div>
  );
}