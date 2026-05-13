import React from "react";
import { Cookie } from "lucide-react";
import LegalPage from "@/components/layout/LegalPage";

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Legal · Cookies"
      icon={Cookie}
      title={
        <>
          Almost no cookies.{" "}
          <span className="echo-gradient-text">Honest.</span>
        </>
      }
      subtitle="We don't sell ads, so we don't need a tracking machine. Here's the short list."
      updatedAt="2025-12-04"
      sections={[
        {
          heading: "What is a cookie?",
          body: [
            "A small piece of data stored by your browser. The web depends on a few of them for basic functionality — auth, session continuity, language preference. We avoid the rest.",
          ],
        },
        {
          heading: "Cookies we use on echo.io",
          body: [
            { type: "list", items: [
              "echo_sid · Session cookie · Strict · 30 days · Keeps you signed in to the marketing site.",
              "echo_lang · Preference · 1 year · Stores your language choice (en/es/fr/de).",
              "echo_consent · Preference · 1 year · Records your cookie banner choice.",
            ]},
          ],
        },
        {
          heading: "What we explicitly don't use",
          body: [
            { type: "list", items: [
              "Google Analytics, Facebook Pixel, LinkedIn Insight, TikTok Pixel.",
              "Cross-site retargeting cookies of any kind.",
              "Session-replay tools (Hotjar, FullStory…).",
            ]},
          ],
        },
        {
          heading: "Inside the ECHO app",
          body: [
            "The ECHO desktop, mobile and web apps do not use cookies for analytics. The web client uses IndexedDB to store your encrypted message cache locally.",
          ],
        },
        {
          heading: "Changing or revoking consent",
          body: [
            "Open the cookie panel from the footer at any time, or clear cookies via your browser settings. ECHO will keep working — most pages don't require any.",
          ],
        },
      ]}
    />
  );
}