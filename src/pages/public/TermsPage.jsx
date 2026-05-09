import React from "react";
import { FileText } from "lucide-react";
import LegalPage from "@/components/layout/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal · Terms of Service"
      icon={FileText}
      title={
        <>
          The deal between{" "}
          <span className="echo-gradient-text">you and ECHO.</span>
        </>
      }
      subtitle="Plain-language Terms of Service. You can read them in 4 minutes — and we recommend you do."
      updatedAt="2025-12-04"
      sections={[
        {
          heading: "Acceptance",
          body: [
            "By creating an ECHO identity or using any ECHO software, you agree to these Terms and to our Privacy Policy. If you don't agree, please don't use ECHO.",
          ],
        },
        {
          heading: "Your account & keys",
          body: [
            "Your ECHO identity is a Curve25519 keypair stored on your device. We never see it. If you lose your keys you lose your account — we cannot recover it. Use Shamir 3-of-5 or hardware backups to mitigate this.",
            "You are responsible for the security of the device hosting your keys.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            "ECHO is for human conversation, not for automated abuse. You agree not to:",
            { type: "list", items: [
              "Distribute child sexual abuse material (CSAM) — reports go to NCMEC.",
              "Operate large-scale spam, phishing or fraud campaigns.",
              "Attempt to break, overload or exfiltrate our infrastructure.",
              "Resell ECHO services without an Enterprise agreement.",
            ]},
            "Violations may result in identity termination. Federation operators set their own additional rules on their nodes.",
          ],
        },
        {
          heading: "Subscriptions & billing",
          body: [
            "Personal is free. Pro and Enterprise are billed monthly or yearly via Stripe. You can cancel any time; we don't refund partial months but you keep access until period end.",
          ],
        },
        {
          heading: "Software warranty",
          body: [
            "ECHO is provided 'as is' under the AGPL license for the open-source clients and server. We do our best — but we make no commercial warranty against bugs, downtime or your data being destroyed by your own actions.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "To the maximum extent allowed by law, ECHO Labs is not liable for indirect or consequential damages. Direct liability is capped at what you paid us in the previous 12 months (so usually nothing — Personal is free).",
          ],
        },
        {
          heading: "Changes to these Terms",
          body: [
            "We will notify you in-app at least 30 days before material changes take effect. Continued use after the effective date constitutes acceptance.",
          ],
        },
        {
          heading: "Governing law & contact",
          body: [
            "These Terms are governed by the laws of Estonia, where ECHO Labs OÜ is incorporated. Disputes go to the courts of Tallinn unless local consumer law says otherwise.",
            "Questions: legal@echo.io",
          ],
        },
      ]}
    />
  );
}