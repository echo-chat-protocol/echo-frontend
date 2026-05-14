import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", name: "English", native: "English", flag: "US" },
  { code: "es", name: "Spanish", native: "Español", flag: "ES" },
  // Add more here as they become available
];

export default function Language() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");

  const language = i18n.language || "en";
  const setLanguage = (code) => i18n.changeLanguage(code);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return LANGUAGES;
    return LANGUAGES.filter((l) => 
      l.name.toLowerCase().includes(s) || 
      l.native.toLowerCase().includes(s) || 
      l.code.includes(s)
    );
  }, [q]);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          data-testid="language-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("settings.language.search")}
          className="echo-input w-full rounded-full py-2.5 pl-10 pr-3 text-[13px] echo-focus-ring bg-white/[0.03] border-white/[0.08]"
        />
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
        {filtered.map((l, idx) => {
          const active = language.startsWith(l.code);
          return (
            <button
              key={l.code}
              data-testid={`language-${l.code}`}
              onClick={() => setLanguage(l.code)}
              className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors ${
                idx > 0 ? "border-t border-white/[0.04]" : ""
              } ${active ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"}`}
            >
              <span className="mono text-[10px] font-semibold uppercase tracking-[0.18em] rounded-md border border-white/[0.08] px-2 py-1 text-white/65">
                {l.flag}
              </span>
              <div className="flex-1">
                <div className="text-[13.5px] font-medium text-white">{l.native}</div>
                <div className="text-[11px] text-white/40">{l.name}</div>
              </div>
              {active && (
                <span
                  className="grid h-6 w-6 place-items-center rounded-full"
                  style={{ background: "var(--echo-accent)", color: "#fff", boxShadow: "0 4px 12px -2px rgba(var(--echo-accent-rgb), 0.6)" }}
                >
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-[12px] text-white/40">
            {t("settings.noMatch")}
          </div>
        )}
      </div>
    </div>
  );
}
