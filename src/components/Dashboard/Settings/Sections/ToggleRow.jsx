import React from "react";

/**
 * Generic switch row with a persistent boolean stored in localStorage.
 */
export default function ToggleRow({ id, icon, title, desc, defaultValue = false, danger = false }) {
  const storageKey = `echo:toggle:${id}`;
  const [on, setOn] = React.useState(() => {
    const v = localStorage.getItem(storageKey);
    return v == null ? defaultValue : v === "1";
  });

  React.useEffect(() => {
    localStorage.setItem(storageKey, on ? "1" : "0");
  }, [on, storageKey]);

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {icon && (
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${danger ? "bg-red-500/10 text-red-300" : "bg-white/[0.04] text-white/65"}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-[13.5px] font-medium ${danger ? "text-red-300" : ""}`}>{title}</div>
        {desc && <div className="text-[11.5px] text-white/40 mt-0.5">{desc}</div>}
      </div>
      <button
        data-testid={`toggle-${id}`}
        onClick={() => setOn(!on)}
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: on ? "var(--echo-accent)" : "rgba(255,255,255,0.08)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{
            left: on ? "22px" : "2px",
            boxShadow: on ? "0 4px 12px -2px rgba(var(--echo-accent-rgb), 0.65)" : "0 2px 6px rgba(0,0,0,0.4)",
          }}
        />
      </button>
    </div>
  );
}
