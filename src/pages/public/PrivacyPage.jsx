import React from "react";
import { ScrollText } from "lucide-react";
import LegalPage from "@/components/layout/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal · Privacy Policy"
      icon={ScrollText}
      title={
        <>
          The shortest{" "}
          <span className="echo-gradient-text">privacy policy</span> we could
          honestly write.
        </>
      }
      subtitle="What we collect (almost nothing), how long we keep it, and how to leave."
      updatedAt="2025-12-04"
      sections={[
        {
          heading: "What we collect",
          body: [
            "ECHO is end-to-end encrypted. We literally cannot read your messages, calls, attachments, group memberships, or contact lists. They are encrypted on your device and only you and your conversation partners hold the keys.",
            { type: "list", items: [
              "An optional email or handle so we can route deliveries.",
              "Encrypted payloads in transit (we delete them within 30 days of delivery).",
              "Aggregate, non-identifying telemetry (counts, error categories) — opt-out from settings.",
              "Billing details if you subscribe to Pro or Enterprise (handled by Stripe; we do not store cards).",
            ]},
          ],
        },
        {
          heading: "What we never collect",
          body: [
            { type: "list", items: [
              "Phone numbers (we do not require them).",
              "Address books or social graphs.",
              "Plaintext message content or metadata about who talks to whom.",
              "IP-based location histories (relays log only what's needed to route packets).",
              "Behavioural advertising profiles.",
            ]},
          ],
        },
        {
          heading: "How long we keep things",
          body: [
            "Sealed envelopes are deleted from our relays within 30 days of successful delivery — sooner if you read them. Server logs are kept 14 days for abuse mitigation, then rotated.",
            "Account metadata (email, billing) is kept until you close the account. Deletion is immediate and irreversible.",
          ],
        },
        {
          heading: "Government & legal requests",
          body: [
            "We respond to lawful requests but cannot produce plaintext we never see. Every request is documented in our quarterly Transparency Report.",
            "We will challenge gag orders and notify users where legally possible.",
          ],
        },
        {
          heading: "Your rights (GDPR, CCPA, others)",
          body: [
            "You can export, rectify or delete every piece of data we hold from your settings. There is no escalation path or 'sales process' — the buttons just work.",
            "Data Protection Officer: dpo@echo.io",
          ],
        },
        {
          heading: "Contact",
          body: [
            "Questions? privacy@echo.io. We answer in plain language, usually within 24 hours.",
          ],
        },
      ]}
    />
  );
}