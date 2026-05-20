import React from "react";
import { Monitor, Smartphone, Tablet, X, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const DEVICES = [
  { id: "d1", name: "MacBook Pro 16″",       kind: "desktop", last: "Active now",       current: true },
  { id: "d2", name: "iPhone 17 Pro",         kind: "mobile",  last: "2 minutes ago",    current: false },
  { id: "d3", name: "iPad Air",              kind: "tablet",  last: "Yesterday",        current: false },
  { id: "d4", name: "Linux workstation",     kind: "desktop", last: "3 days ago",       current: false },
];

function DeviceIcon({ kind }) {
  if (kind === "mobile") return <Smartphone size={16} className="text-[color:var(--echo-accent-soft)]" />;
  if (kind === "tablet") return <Tablet size={16} className="text-[color:var(--echo-accent-soft)]" />;
  return <Monitor size={16} className="text-[color:var(--echo-accent-soft)]" />;
}

export default function Devices() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
        {DEVICES.map((d) => (
          <div key={d.id} className="flex items-center gap-4 px-5 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/[0.04]">
              <DeviceIcon kind={d.kind} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium">{d.name}</span>
                {d.current && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-[0.16em] mono"
                        style={{ background: "rgba(var(--echo-accent-rgb), 0.12)", color: "var(--echo-accent-soft)" }}>
                    <ShieldCheck size={10} /> {t("settings.devices.thisDevice")}
                  </span>
                )}
              </div>
              <div className="text-[11.5px] text-white/40">{d.last}</div>
            </div>
            {!d.current && (
              <button data-testid={`device-revoke-${d.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/[0.05] px-3.5 py-1.5 text-[11.5px] text-red-300 hover:bg-red-500/[0.10] transition">
                <X size={12} /> {t("settings.devices.revoke")}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="px-2 text-[11.5px] text-white/40">
        {t("settings.devices.desc")}
      </p>
    </div>
  );
}
