import React from "react";
import { ShieldCheck } from "lucide-react";
import LegalPage from "@/components/layout/LegalPage";

export default function GdprPage() {
  return (
    <LegalPage
      eyebrow="Legal · GDPR"
      icon={ShieldCheck}
      title={
        <>
          GDPR, in <span className="echo-gradient-text">a nutshell.</span>
        </>
      }
      subtitle="Your rights as a European user — and exactly how to exercise them."
      updatedAt="2025-12-04"
      sections={[
        {
          heading: "Who is the data controller?",
          body: [
            "ECHO Labs OÜ · Telliskivi 60a, 10412 Tallinn, Estonia · registry code 16574321.",
            "Data Protection Officer: dpo@echo.io",
          ],
        },
        {
          heading: "Lawful basis",
          body: [
            { type: "list", items: [
              "Performance of contract (Art. 6(1)(b)) — to provide the messaging service you signed up for.",
              "Legitimate interest (Art. 6(1)(f)) — to keep the relays secure and abuse-free.",
              "Consent (Art. 6(1)(a)) — for optional analytics and marketing emails. Always explicit, always revocable.",
            ]},
          ],
        },
        {
          heading: "Your rights under GDPR",
          body: [
            { type: "list", items: [
              "Right of access — get every byte we hold about you.",
              "Right to rectification — fix incorrect data.",
              "Right to erasure — delete your account and all server-side data.",
              "Right to restriction — pause processing while a complaint is investigated.",
              "Right to data portability — export in machine-readable JSON.",
              "Right to object — opt out of legitimate-interest processing.",
              "Right not to be subject to automated decisions — we don't make any.",
            ]},
            "Every right above is exposed as a one-click action under Settings → Privacy. No tickets, no escalations.",
          ],
        },
        {
          heading: "Data transfers outside the EEA",
          body: [
            "We host primary infrastructure in Frankfurt (DE) and Helsinki (FI). Some replicas run in Virginia (US) for global delivery, under Standard Contractual Clauses and supplementary measures (E2EE makes most of this moot).",
          ],
        },
        {
          heading: "Retention",
          body: [
            "Sealed messages: 30 days max on relays. Account metadata: until deletion. Audit logs: 14 days.",
          ],
        },
        {
          heading: "Complaints",
          body: [
            "If we get something wrong, we want to know. Email dpo@echo.io. You can also lodge a complaint with the Estonian Data Protection Inspectorate (AKI) or your local supervisory authority.",
          ],
        },
      ]}
    />
  );
}