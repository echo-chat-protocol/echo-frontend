import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  ChevronRight,
  ChevronLeft,
  Bell,
  Lock,
  KeyRound,
  Smartphone,
  Eye,
  Globe,
  Download,
  Menu,
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'

import Appearance from './sections/Appearance'
import Language from './sections/Language'
import Notifications from './sections/Notifications'
import Privacy from './sections/Privacy'
import Security from './sections/Security'
import Devices from './sections/Devices'
import ExportData from './sections/ExportData'

const SECTIONS = [
  {
    id: 'notifications',
    icon: Bell,
    titleKey: 'settings.notifications',
    descKey: 'settings.notifications.desc',
    Component: Notifications,
  },
  {
    id: 'privacy',
    icon: Lock,
    titleKey: 'settings.privacy',
    descKey: 'settings.privacy.desc',
    Component: Privacy,
  },
  {
    id: 'security',
    icon: KeyRound,
    titleKey: 'settings.security',
    descKey: 'settings.security.desc',
    Component: Security,
  },
  {
    id: 'devices',
    icon: Smartphone,
    titleKey: 'settings.devices',
    descKey: 'settings.devices.desc',
    Component: Devices,
  },
  {
    id: 'appearance',
    icon: Eye,
    titleKey: 'settings.appearance',
    descKey: 'settings.appearance.desc',
    Component: Appearance,
  },
  {
    id: 'language',
    icon: Globe,
    titleKey: 'settings.language',
    descKey: 'settings.language.desc',
    Component: Language,
  },
  {
    id: 'export',
    icon: Download,
    titleKey: 'settings.export',
    descKey: 'settings.export.desc',
    Component: ExportData,
  },
]

export default function Settings({ initialSection = null, onOpenMenu }) {
  const { t } = useI18n()
  // Allow dashboard to open a specific section on mount (e.g., devices)
  const [openSection, setOpenSection] = useState(initialSection)
  const active = SECTIONS.find((s) => s.id === openSection)

  return (
    <div className='echo-floating relative flex flex-1 flex-col overflow-hidden'>
      {/* ── Header ── */}
      <div className='flex items-center gap-3 border-b border-white/[0.05] px-4 md:px-10 pb-4 md:pb-6 pt-4 md:pt-9'>
        {/* Mobile hamburger — only when on root grid (not in a sub-section) */}
        {!active && onOpenMenu && (
          <button
            onClick={onOpenMenu}
            aria-label='Open menu'
            className='md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] text-white/70 transition-all active:scale-95 hover:text-white'
          >
            <Menu size={17} />
          </button>
        )}

        {/* Back button — visible when inside a section */}
        {active && (
          <button
            data-testid='settings-back'
            onClick={() => setOpenSection(null)}
            className='grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-white/65 hover:bg-white/[0.05] hover:text-white transition shrink-0'
            title={t('common.back')}
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <div className='flex-1 min-w-0'>
          {active ? (
            <h1 className='echo-display text-[22px] md:text-[28px] truncate'>
              {t(active.titleKey)}
            </h1>
          ) : (
            <>
              <h1 className='echo-display text-[24px] md:text-[34px] leading-tight'>
                {t('settings.title')
                  .split(' ')
                  .map((word, i, arr) =>
                    i === arr.length - 1 ? (
                      <span key={i} className='echo-text-gradient'>
                        {word}
                      </span>
                    ) : (
                      <span key={i}>{word} </span>
                    )
                  )}
              </h1>
              <p className='mt-1 md:mt-2 text-[12px] md:text-[13px] text-white/45 hidden sm:block'>
                {t('settings.subtitle')}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className='flex-1 overflow-y-auto px-3 md:px-10 py-4 md:py-7'>
        {active ? (
          <active.Component />
        ) : (
          <div className='grid grid-cols-1 gap-2.5 md:gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {SECTIONS.map(({ id, icon: Icon, titleKey, descKey }) => (
              <button
                key={id}
                data-testid={`settings-card-${id}`}
                onClick={() => setOpenSection(id)}
                className='echo-hover-lift group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 text-left'
              >
                <div
                  className='grid h-9 w-9 md:h-10 md:w-10 shrink-0 place-items-center rounded-xl ring-1'
                  style={{
                    background: 'rgba(var(--echo-accent-rgb), 0.10)',
                    borderColor: 'rgba(var(--echo-accent-rgb), 0.20)',
                    color: 'var(--echo-accent-soft)',
                  }}
                >
                  <Icon size={15} />
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='text-[13px] md:text-[13.5px] font-medium truncate'>
                    {t(titleKey)}
                  </div>
                  <div className='text-[11px] md:text-[11.5px] text-white/40 truncate'>
                    {t(descKey)}
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className='shrink-0 text-white/30 group-hover:text-[color:var(--echo-accent-soft)] group-hover:translate-x-0.5 transition'
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

Settings.propTypes = {
  // Optional section id to open on mount, e.g. 'devices'
  initialSection: PropTypes.string,
  // Mobile: opens the sidebar drawer
  onOpenMenu: PropTypes.func,
}
