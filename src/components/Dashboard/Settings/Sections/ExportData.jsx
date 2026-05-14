import React, { useState } from "react";
import { Download, FileJson, Lock, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ExportData() {
  const { t } = useTranslation();
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    const payload = {
      app: "ECHO",
      version: "3.2.0",
      generated_at: new Date().toISOString(),
      identity: { handle: "maria.echo", fingerprint: "9F4D 1E20 7AB1 C8E3 55F0 22DA 9C4B 7E10" },
      sealed: true,
      note: "This is a local mock export — your real keys never leave the device.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo-vault-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl"
               style={{ background: "rgba(var(--echo-accent-rgb), 0.12)", color: "var(--echo-accent-soft)" }}>
            <FileJson size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
              {t("settings.export.title")}
            </h3>
            <p className="mt-1 text-[12.5px] text-white/50">
              {t("settings.export.desc")}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] mono uppercase tracking-[0.16em] text-emerald-300/80">
              <Lock size={11} /> argon2id · x25519 · ed25519
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            data-testid="export-btn"
            onClick={handleExport}
            className="echo-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12.5px] font-medium"
          >
            {exported ? <Check size={14} /> : <Download size={14} />}
            {exported ? t("settings.export.exported") : t("settings.export.btn")}
          </button>
          <span className="text-[11px] text-white/35">{t("settings.export.info")}</span>
        </div>
      </div>
    </div>
  );
}
