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

export default function Settings({ initialSection = null }) {
  const { t } = useI18n()
  // Allow dashboard to open a specific section on mount (e.g., devices)
  const [openSection, setOpenSection] = useState(initialSection)
  const active = SECTIONS.find((s) => s.id === openSection)

  return (
    <div className='echo-floating relative flex flex-1 flex-col overflow-hidden'>
      <div className='flex items-center gap-3 border-b border-white/[0.05] px-10 pb-6 pt-9'>
        {active ? (
          <button
            data-testid='settings-back'
            onClick={() => setOpenSection(null)}
            className='grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-white/65 hover:bg-white/[0.05] hover:text-white transition'
            title={t('common.back')}
          >
            <ChevronLeft size={16} />
          </button>
        ) : null}
        <div className='flex-1'>
          {active ? (
            <h1 className='echo-display text-[28px]'>{t(active.titleKey)}</h1>
          ) : (
            <>
              <h1 className='echo-display text-[34px]'>
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
              <p className='mt-2 text-[13px] text-white/45'>{t('settings.subtitle')}</p>
            </>
          )}
        </div>
      </div>

      <div className='flex-1 overflow-y-auto px-10 py-7'>
        {active ? (
          <active.Component />
        ) : (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {SECTIONS.map(({ id, icon: Icon, titleKey, descKey }) => (
              <button
                key={id}
                data-testid={`settings-card-${id}`}
                onClick={() => setOpenSection(id)}
                className='echo-hover-lift group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 text-left'
              >
                <div
                  className='grid h-10 w-10 place-items-center rounded-xl ring-1'
                  style={{
                    background: 'rgba(var(--echo-accent-rgb), 0.10)',
                    borderColor: 'rgba(var(--echo-accent-rgb), 0.20)',
                    color: 'var(--echo-accent-soft)',
                  }}
                >
                  <Icon size={16} />
                </div>
                <div className='flex-1'>
                  <div className='text-[13.5px] font-medium'>{t(titleKey)}</div>
                  <div className='text-[11.5px] text-white/40'>{t(descKey)}</div>
                </div>
                <ChevronRight
                  size={14}
                  className='text-white/30 group-hover:text-[color:var(--echo-accent-soft)] group-hover:translate-x-0.5 transition'
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
}
