import { useEffect } from 'react'
import { useStore } from '../store'

const THEME_PALETTES: Record<string, string[]> = {
  ember:  ['#0A0602', '#FF8C40', '#FFB870', '#FFA040', '#FF6010'],
  ocean:  ['#020810', '#00B4FF', '#40CCFF', '#0088CC', '#006090'],
  forest: ['#030A04', '#22C55E', '#4ADE80', '#16A34A', '#052E16'],
  aurora: ['#04030C', '#A855F7', '#C084FC', '#7C3AED', '#3B0764'],
  neon:   ['#020202', '#39FF14', '#80FF50', '#00CC00', '#004400'],
}

export default function UnlockCelebration() {
  const { unlockPopup, clearUnlockPopup, setMode, triggerCelebration, unlockedModes } = useStore()

  useEffect(() => {
    if (!unlockPopup) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') clearUnlockPopup() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [unlockPopup, clearUnlockPopup])

  if (!unlockPopup) return null

  const { type, name, label, description, emoji } = unlockPopup
  const palette = THEME_PALETTES[name]
  const isTheme = type === 'theme'
  const isAnimal = type === 'animal'

  const handleTryTheme = () => {
    if (isTheme && unlockedModes.includes(name as any)) {
      setMode(name as any)
    }
    clearUnlockPopup()
  }

  const handleTryAnimal = () => {
    triggerCelebration(name)
    clearUnlockPopup()
  }

  return (
    <div className="uc-overlay" onClick={e => { if (e.target === e.currentTarget) clearUnlockPopup() }}>
      <div className="uc-panel">
        {/* Sparkle burst background */}
        <div className="uc-sparkles" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="uc-spark" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>

        {/* Badge */}
        <div className="uc-badge">
          <div className="uc-badge-inner">
            <span className="uc-emoji">{emoji}</span>
          </div>
          <div className="uc-badge-ring" />
        </div>

        {/* Headline */}
        <div className="uc-tag">you unlocked</div>
        <div className="uc-title">{label}</div>
        <div className="uc-desc">{description}</div>

        {/* Theme preview swatches */}
        {isTheme && palette && (
          <div className="uc-swatches">
            {palette.map((c, i) => (
              <div key={i} className="uc-swatch" style={{ background: c }} />
            ))}
          </div>
        )}

        {/* Animal preview hint */}
        {isAnimal && (
          <div className="uc-animal-hint">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ opacity: .6 }}>
              <path d="M9 2C7 2 5 4 5 7s2 5 4 5 4-2 4-5-2-5-4-5z" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M3 16c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            preview it by clicking the button below
          </div>
        )}

        {/* Actions */}
        <div className="uc-actions">
          {isTheme && (
            <button className="uc-try" onClick={handleTryTheme}>
              apply theme now
            </button>
          )}
          {isAnimal && (
            <button className="uc-try" onClick={handleTryAnimal}>
              show me the {name}!
            </button>
          )}
          {type === 'legendary' && (
            <button className="uc-try" onClick={clearUnlockPopup}>
              accept your crown 👑
            </button>
          )}
          <button className="uc-later" onClick={clearUnlockPopup}>
            {isTheme ? 'keep current theme' : 'nice, thanks!'}
          </button>
        </div>
      </div>
    </div>
  )
}
