/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ACCENTS = {
  violet: { name: 'Violet', hex: '#a855f7', soft: '#c084fc', dark: '#7c3aed' },
  blue: { name: 'Blue', hex: '#3b82f6', soft: '#60a5fa', dark: '#1d4ed8' },
  emerald: { name: 'Emerald', hex: '#10b981', soft: '#34d399', dark: '#047857' },
  amber: { name: 'Amber', hex: '#f59e0b', soft: '#fbbf24', dark: '#b45309' },
  rose: { name: 'Rose', hex: '#f43f5e', soft: '#fb7185', dark: '#be123c' },
  cyan: { name: 'Cyan', hex: '#06b6d4', soft: '#22d3ee', dark: '#0e7490' },
  slate: { name: 'Slate', hex: '#94a3b8', soft: '#cbd5e1', dark: '#475569' },
}

const WALLPAPERS = {
  constellation: { name: 'Constellation', kind: 'constellation' },
  void: { name: 'Void', kind: 'solid' },
  noise: { name: 'Noise', kind: 'noise' },
  grid: { name: 'Grid', kind: 'grid' },
  aurora: { name: 'Aurora', kind: 'aurora' },
  mesh: { name: 'Mesh', kind: 'mesh' },
}

// Pre-built theme presets (combination of accent + wallpaper)
const THEMES = [
  { id: 'echo', name: 'ECHO', accent: 'violet', wallpaper: 'constellation' },
  { id: 'aurora', name: 'Aurora', accent: 'emerald', wallpaper: 'aurora' },
  { id: 'solar', name: 'Solar', accent: 'amber', wallpaper: 'mesh' },
  { id: 'mono', name: 'Mono', accent: 'slate', wallpaper: 'void' },
  { id: 'cyber', name: 'Cyber', accent: 'cyan', wallpaper: 'grid' },
  { id: 'rose', name: 'Bloom', accent: 'rose', wallpaper: 'noise' },
  { id: 'deepsea', name: 'Deep Sea', accent: 'blue', wallpaper: 'aurora' },
]

const ThemeContext = createContext(null)

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16
  )
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function applyCssVars(accentKey, wallpaperKey) {
  const a = ACCENTS[accentKey] || ACCENTS.violet
  const { r, g, b } = hexToRgb(a.hex)
  const root = document.documentElement
  root.style.setProperty('--echo-accent', a.hex)
  root.style.setProperty('--echo-accent-soft', a.soft)
  root.style.setProperty('--echo-accent-dark', a.dark)
  root.style.setProperty('--echo-accent-rgb', `${r}, ${g}, ${b}`)
  root.setAttribute('data-wallpaper', wallpaperKey)
}

export function ThemeProvider({ children }) {
  const [accent, setAccent] = useState(() => localStorage.getItem('echo:accent') || 'violet')
  const [wallpaper, setWallpaper] = useState(
    () => localStorage.getItem('echo:wallpaper') || 'constellation'
  )

  useEffect(() => {
    applyCssVars(accent, wallpaper)
    localStorage.setItem('echo:accent', accent)
    localStorage.setItem('echo:wallpaper', wallpaper)
  }, [accent, wallpaper])

  const applyTheme = (themeId) => {
    const t = THEMES.find((x) => x.id === themeId)
    if (!t) return
    setAccent(t.accent)
    setWallpaper(t.wallpaper)
  }

  const currentThemeId = useMemo(() => {
    const m = THEMES.find((t) => t.accent === accent && t.wallpaper === wallpaper)
    return m?.id ?? null
  }, [accent, wallpaper])

  const value = useMemo(
    () => ({
      accent,
      wallpaper,
      setAccent,
      setWallpaper,
      applyTheme,
      currentThemeId,
      accents: ACCENTS,
      wallpapers: WALLPAPERS,
      themes: THEMES,
    }),
    [accent, wallpaper, currentThemeId]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

export { ACCENTS, WALLPAPERS, THEMES }
