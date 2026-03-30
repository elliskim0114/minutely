import { useStore } from '../store'

// SVG icons matching the app's geometric style
const ICONS: Record<string, React.ReactNode> = {
  day: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  week: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="2" height="10" rx="1" fill="currentColor" opacity=".5"/>
      <rect x="4.5" y="1" width="2" height="14" rx="1" fill="currentColor"/>
      <rect x="8" y="4" width="2" height="8" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="11.5" y="2" width="2" height="12" rx="1" fill="currentColor" opacity=".85"/>
    </svg>
  ),
  mpd: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L9.5 6H14.5L10.5 9L12 14L8 11L4 14L5.5 9L1.5 6H6.5L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  goals: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
    </svg>
  ),
  analytics: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 12L5.5 7.5L8.5 9.5L12 4.5L14 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="14" cy="6" r="1.5" fill="currentColor"/>
    </svg>
  ),
}

const TABS = [
  { id: 'day',       label: 'today'    },
  { id: 'week',      label: 'week'     },
  { id: 'mpd',       label: 'plan'     },
  { id: 'goals',     label: 'goals'    },
  { id: 'analytics', label: 'stats'    },
] as const

export default function MobileNav() {
  const { view, setView } = useStore()
  return (
    <nav className="mob-nav">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`mob-nav-tab${view === t.id ? ' on' : ''}`}
          onClick={() => setView(t.id)}
        >
          <span className="mob-nav-icon">{ICONS[t.id]}</span>
          <span className="mob-nav-lbl">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
