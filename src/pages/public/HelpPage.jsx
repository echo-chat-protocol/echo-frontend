import React, { useState } from "react";
import { LifeBuoy, ChevronDown, MessageCircle, Mail } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const FAQ = [
  {
    q: "I lost my recovery key. Can ECHO get my account back?",
    a: "No — and that's by design. We never see your keys, so we cannot reset them. Use Shamir 3-of-5 across trusted devices/people to avoid this scenario.",
  },
  {
    q: "Is ECHO actually open source?",
    a: "Yes. The clients, server and protocol are AGPL. Builds are reproducible — you can compile the exact binary we ship.",
  },
  {
    q: "Why no phone number?",
    a: "Phone numbers are perfect identifiers for surveillance. ECHO uses asymmetric keys with a human-readable handle (@you).",
  },
  {
    q: "Can I run my own ECHO server?",
    a: "Yes. A single binary, ~70 MB RAM idle. Federate with other nodes or stay private.",
  },
  {
    q: "How do I verify someone's fingerprint?",
    a: "Open the contact, tap the lock icon. Compare the 12-block safety number in person, by QR, or read it aloud.",
  },
  {
    q: "Does ECHO use any third-party cloud?",
    a: "No. We rent bare-metal in EU + US. Encryption happens on your device, so the underlying provider never sees plaintext anyway.",
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState(0);

  return (
    <PageShell
      eyebrow="Resources · Help"
      icon={LifeBuoy}
      title={
        <>
          Answers, <span className="echo-gradient-text">not chatbots.</span>
        </>
      }
      subtitle="Real humans who actually understand cryptography. Average response time: 4h."
    >
      <section className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">
          Frequently asked
        </h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className={`glass rounded-2xl transition-colors ${
                  isOpen ? "border-[#a855f7]/40" : ""
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-medium">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${
                      isOpen ? "rotate-180 text-[#c4a8ff]" : "text-[#a0a0a0]"
                    }`}
                  />
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

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a
            href="mailto:hello@echo.io"
            className="glass cyber-border rounded-2xl p-6 flex items-center gap-4 hover:bg-white/[0.04]"
          >
            <Mail className="h-6 w-6 text-[#c4a8ff]" />
            <div>
              <div className="font-semibold">Email support</div>
              <div className="text-xs text-[#a8a8b8]">hello@echo.io · 4h SLA</div>
            </div>
          </a>
          <a
            href="#"
            className="glass cyber-border rounded-2xl p-6 flex items-center gap-4 hover:bg-white/[0.04]"
          >
            <MessageCircle className="h-6 w-6 text-[#c4a8ff]" />
            <div>
              <div className="font-semibold">Live chat (E2EE)</div>
              <div className="text-xs text-[#a8a8b8]">Mon–Fri · 09–21 CET</div>
            </div>
          </a>
        </div>
      </section>
    </PageShell>
  );
}