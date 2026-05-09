import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

const TOAST_STYLES = {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.9rem 1.2rem',
    borderRadius: '12px',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(168,85,247,0.2)',
    background: 'rgba(10,10,14,0.85)',
    color: '#f5f5f5',
    boxShadow: '0 8px 30px -8px rgba(0,0,0,0.6)',
    minWidth: '260px',
    maxWidth: '400px',
    position: 'relative',
  },
  icon: { flexShrink: 0, width: 20, height: 20 },
  content: { display: 'flex', flexDirection: 'column', flex: 1, gap: '2px', fontSize: '0.875rem' },
  title: { fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  close: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#a0a0a0', fontSize: '1.2rem', lineHeight: 1, padding: '0 4px',
  },
}

function Toast({ message, type = 'success', onClose }) {
  if (!message) return null

  const config = {
    success: { icon: <CheckCircle style={TOAST_STYLES.icon} color='#22c55e' />, title: 'Success' },
    warning: { icon: <AlertTriangle style={TOAST_STYLES.icon} color='#f59e0b' />, title: 'Warning' },
    error:   { icon: <XCircle style={TOAST_STYLES.icon} color='#ef4444' />, title: 'Error' },
    info:    { icon: <Info style={TOAST_STYLES.icon} color='#60a5fa' />, title: 'Info' },
  }
  const { icon, title } = config[type] ?? config.info

  return (
    <div style={TOAST_STYLES.base} role='alert' aria-live='assertive'>
      {icon}
      <div style={TOAST_STYLES.content}>
        <span style={TOAST_STYLES.title}>{title}</span>
        <span>{message}</span>
      </div>
      <button style={TOAST_STYLES.close} onClick={onClose} aria-label='Close notification'>
        ×
      </button>
    </div>
  )
}

export default Toast
