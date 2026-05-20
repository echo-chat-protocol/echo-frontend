import React from "react";
import { Check, MessageSquare, Image as ImageIcon, Sparkles } from "lucide-react";
import { useTheme, ACCENTS, WALLPAPERS, THEMES } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";

/* Tiny chat preview tile rendered with the theme's accent + wallpaper */
function ThemeTile({ theme, selected, onClick }) {
  const accent = ACCENTS[theme.accent];
  return (
    <button
      data-testid={`theme-tile-${theme.id}`}
      onClick={onClick}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl text-left transition-all"
      style={{
        boxShadow: selected
          ? `0 0 0 2px ${accent.hex}, 0 18px 36px -16px ${accent.hex}66`
          : "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <div data-wallpaper={theme.wallpaper} className="absolute inset-0 bg-black">
        <div className="echo-wallpaper" />
      </div>
      {/* Mini bubbles */}
      <div className="relative flex h-full flex-col justify-end gap-2 p-3">
        <div className="self-start rounded-lg rounded-bl-sm bg-white/[0.07] px-2 py-1 text-[8px] text-white/70 backdrop-blur-sm" style={{ maxWidth: "70%" }}>
          ¡Hola!
        </div>
        <div
          className="self-end rounded-lg rounded-br-sm px-2 py-1 text-[8px] text-white"
          style={{
            background: `linear-gradient(180deg, ${accent.soft}, ${accent.dark})`,
            boxShadow: `0 4px 12px -4px ${accent.hex}77`,
            maxWidth: "70%",
          }}
        >
          ¿Cómo estás?
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="mono text-[8.5px] uppercase tracking-[0.16em] text-white/55">{theme.name}</span>
          {selected && (
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-black">
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ColorSwatch({ accentKey, selected, onClick }) {
  const a = ACCENTS[accentKey];
  return (
    <button
      data-testid={`color-${accentKey}`}
      onClick={onClick}
      title={a.name}
      className="group relative h-10 w-10 rounded-full transition-transform hover:scale-110"
      style={{
        background: `linear-gradient(180deg, ${a.soft}, ${a.dark})`,
        boxShadow: selected
          ? `0 0 0 2px #000, 0 0 0 4px ${a.hex}, 0 10px 24px -8px ${a.hex}88`
          : `0 0 0 1px rgba(255,255,255,0.10), 0 6px 16px -6px ${a.hex}55`,
      }}
    >
      {selected && (
        <span className="absolute inset-0 grid place-items-center">
          <Check size={14} className="text-white" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function WallpaperTile({ wallpaperKey, selected, onClick }) {
  const w = WALLPAPERS[wallpaperKey];
  return (
    <button
      data-testid={`wallpaper-${wallpaperKey}`}
      onClick={onClick}
      className="group relative aspect-[4/3] overflow-hidden rounded-xl text-left"
      style={{
        boxShadow: selected
          ? `0 0 0 2px var(--echo-accent), 0 12px 28px -10px rgba(var(--echo-accent-rgb), 0.55)`
          : "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <div data-wallpaper={wallpaperKey} className="absolute inset-0 bg-black">
        <div className="echo-wallpaper" />
      </div>
      <div className="relative flex h-full items-end p-2.5">
        <span className="mono text-[9.5px] uppercase tracking-[0.18em] text-white/80">{w.name}</span>
        {selected && (
          <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-white text-black">
            <Check size={11} strokeWidth={3} />
          </span>
        )}
      </div>
    </button>
  );
}

export default function Appearance() {
  const { accent, wallpaper, setAccent, setWallpaper, applyTheme, currentThemeId } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="space-y-9">
      {/* Section: Themes */}
      <section data-testid="appearance-themes">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">{t("settings.appearance.themes")}</h2>
          <p className="hidden md:block text-[11px] text-white/40">{t("settings.appearance.themesHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {/* Create with AI — placeholder for future */}
          <button
            data-testid="theme-tile-ai"
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl text-center"
            style={{ background: "linear-gradient(160deg, #1a1133 0%, #2d1b69 50%, #4a2acc 100%)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
            title="Coming soon"
          >
            <div className="flex h-full flex-col items-center justify-center gap-2 px-2">
              <Sparkles size={20} className="text-white/85" />
              <span className="text-[11.5px] font-medium leading-tight text-white">Create<br />with AI</span>
              <span className="mono text-[8px] uppercase tracking-[0.16em] text-white/40">soon</span>
            </div>
          </button>

          {THEMES.map((th) => (
            <ThemeTile key={th.id} theme={th} selected={currentThemeId === th.id} onClick={() => applyTheme(th.id)} />
          ))}
        </div>
      </section>

      {/* Section: Customize */}
      <section data-testid="appearance-customize">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">{t("settings.appearance.customize")}</h2>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015]">
          {/* Chat colour row */}
          <div className="flex flex-col gap-4 border-b border-white/[0.05] px-5 py-5 md:flex-row md:items-center">
            <div className="flex items-center gap-3 md:w-[200px]">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-white/65">
                <MessageSquare size={15} />
              </div>
              <div>
                <div className="text-[13.5px] font-medium">{t("settings.appearance.chatColor")}</div>
                <div className="text-[11px] text-white/40 capitalize">{ACCENTS[accent].name}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:ml-auto">
              {Object.keys(ACCENTS).map((k) => (
                <ColorSwatch key={k} accentKey={k} selected={accent === k} onClick={() => setAccent(k)} />
              ))}
            </div>
          </div>

          {/* Wallpaper row */}
          <div className="px-5 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-white/65">
                <ImageIcon size={15} />
              </div>
              <div>
                <div className="text-[13.5px] font-medium">{t("settings.appearance.wallpaper")}</div>
                <div className="text-[11px] text-white/40 capitalize">{WALLPAPERS[wallpaper].name}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.keys(WALLPAPERS).map((k) => (
                <WallpaperTile key={k} wallpaperKey={k} selected={wallpaper === k} onClick={() => setWallpaper(k)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live preview */}
      <section data-testid="appearance-preview">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">{t("settings.appearance.preview")}</h2>
        <div className="relative h-[220px] overflow-hidden rounded-2xl border border-white/[0.06] bg-black">
          <div className="echo-wallpaper" />
          <div className="relative flex h-full flex-col justify-end gap-2 p-5">
            <div className="self-start rounded-2xl rounded-bl-md bubble-received px-3.5 py-2 text-[12.5px]" style={{ maxWidth: "60%" }}>
              Hey there 👋
            </div>
            <div className="self-end rounded-2xl rounded-br-md bubble-sent px-3.5 py-2 text-[12.5px]" style={{ maxWidth: "60%" }}>
              Looks great — this is your accent applied live.
            </div>
            <div className="self-start rounded-2xl rounded-bl-md bubble-received px-3.5 py-2 text-[12.5px]" style={{ maxWidth: "60%" }}>
              Try a different wallpaper above ☝️
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
