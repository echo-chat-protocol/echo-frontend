import React from "react";
import { Fingerprint, ShieldCheck, KeyRound, RotateCcw, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import ToggleRow from "./ToggleRow";

const FINGERPRINT = "9F4D 1E20 7AB1 C8E3 55F0 22DA 9C4B 7E10";

export default function Security() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl space-y-5">
      {/* Identity card */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Fingerprint size={15} className="text-[color:var(--echo-accent-soft)]" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            {t("settings.security.identity")}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-300 mono">
            <ShieldCheck size={11} /> {t("settings.security.verified")}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {FINGERPRINT.split(" ").map((g, i) => (
            <div key={i} className="rounded-md border border-white/[0.06] bg-black/40 py-1.5 text-center text-[11px] mono tracking-widest text-[color:var(--echo-accent-soft)]">
              {g}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-white/45">
          {t("settings.security.keysDesc")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-[12px] text-white/80 hover:bg-white/[0.05] transition">
            <ScanLine size={13} /> {t("settings.security.showQr")}
          </button>
          <button className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-[12px] text-white/80 hover:bg-white/[0.05] transition">
            <RotateCcw size={13} /> {t("settings.security.rotateKeys")}
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
        <ToggleRow 
          id="sec.appLock"       
          icon={<KeyRound size={15} />}    
          title={t("settings.security.appLock")}               
          desc={t("settings.security.appLockDesc")} 
          defaultValue={false} 
        />
        <ToggleRow 
          id="sec.safetyChange"  
          icon={<ShieldCheck size={15} />} 
          title={t("settings.security.safetyChange")}  
          desc={t("settings.security.safetyChangeDesc")} 
          defaultValue={true} 
        />
        <ToggleRow 
          id="sec.lockOnSleep"   
          icon={<RotateCcw size={15} />}   
          title={t("settings.security.lockOnSleep")}     
          desc={t("settings.security.lockOnSleepDesc")} 
          defaultValue={true} 
        />
      </div>
    </div>
  );
}
