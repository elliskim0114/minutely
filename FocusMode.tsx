import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { fmt, toM, nowMinutes, todayStr } from '../utils'

const WORK_PRESETS = [10, 15, 20, 25, 30, 45, 50, 60, 90]

export default function FocusMode({ onClose }: { onClose: () => void }) {
  const { blocks, cfg, showToast, focusGems, earnGem, focusMinimized, minimizeFocus, maximizeFocus } = useStore()
  const today = todayStr()

  const nowM = nowMinutes()
  const todayBlocks = blocks
    .filter(b => b.date === today)
    .sort((a, b) => toM(a.start) - toM(b.start))

  const currentBlock = todayBlocks.find(b => toM(b.start) <= nowM && toM(b.end) > nowM)
  const nextBlock = todayBlocks.find(b => toM(b.start) > nowM)
  const activeBlock = currentBlock || nextBlock

  const [pomMode, setPomMode] = useState<'work' | 'break' | 'long'>('work')
  const [workDuration, setWorkDuration] = useState(25)           // minutes, editable
  const [secs, setSecs] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [cycles, setCycles] = useState(0)
  const [gemFlash, setGemFlash] = useState(false)
  const [editingDur, setEditingDur] = useState(false)
  const [durInput, setDurInput] = useState('25')
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durInputRef = useRef<HTMLInputElement>(null)

  const POM_DURATIONS = { work: workDuration * 60, break: 5 * 60, long: 15 * 60 }

  useEffect(() => {
    if (running) {
      ivRef.current = setInterval(() => {
        setSecs(s => {
          if (s <= 1) {
            setRunning(false)
            if (pomMode === 'work') {
              const newCycles = cycles + 1
              setCycles(newCycles)
              earnGem()
              setGemFlash(true)
              setTimeout(() => setGemFlash(false), 1800)
              const next = newCycles % 4 === 0 ? 'long' : 'break'
              setPomMode(next)
              setSecs(POM_DURATIONS[next])
              showToast(next === 'long' ? '🎉 Long break! Great session.' : '✓ Break time!')
            } else {
              setPomMode('work')
              setSecs(POM_DURATIONS.work)
              showToast('Back to focus!')
            }
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [running, pomMode, cycles, workDuration])

  const mins = Math.floor(secs / 60)
  const sec = secs % 60
  const total = POM_DURATIONS[pomMode]
  const progress = 1 - secs / total
  const r = 95
  const circ = 2 * Math.PI * r

  const reset = () => {
    setRunning(false)
    setSecs(POM_DURATIONS[pomMode])
  }

  const skip = () => {
    setRunning(false)
    if (pomMode === 'work') {
      const next = (cycles + 1) % 4 === 0 ? 'long' : 'break'
      setPomMode(next); setSecs(POM_DURATIONS[next])
    } else {
      setPomMode('work'); setSecs(POM_DURATIONS.work)
    }
  }

  const applyWorkDuration = (newMins: number) => {
    const clamped = Math.max(1, Math.min(180, newMins))
    setWorkDuration(clamped)
    if (pomMode === 'work') setSecs(clamped * 60)
    setEditingDur(false)
    setRunning(false)
  }

  const switchMode = (m: 'work' | 'break' | 'long') => {
    setPomMode(m)
    setSecs(m === 'work' ? workDuration * 60 : POM_DURATIONS[m])
    setRunning(false)
  }

  // ── Minimized bar ──────────────────────────────────────────
  if (focusMinimized) {
    const pillR = 20
    const pillCirc = 2 * Math.PI * pillR
    return (
      <div className="fm-bar">
        <div className="fm-bar-left" onClick={maximizeFocus}>
          {/* ring */}
          <div className="fm-bar-ring-wrap">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r={pillR} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3.5"/>
              <circle cx="25" cy="25" r={pillR} fill="none" stroke="#fff" strokeWidth="3.5"
                strokeDasharray={pillCirc}
                strokeDashoffset={pillCirc * (1 - progress)}
                strokeLinecap="round"
                transform="rotate(-90 25 25)"
                style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
              />
            </svg>
          </div>
          <div className="fm-bar-info">
            <div className="fm-bar-time">{String(mins).padStart(2, '0')}:{String(sec).padStart(2, '0')}</div>
            <div className="fm-bar-sub">
              {pomMode === 'work' ? '◆ focus session' : pomMode === 'break' ? '☁ short break' : '☁ long break'}
              {activeBlock ? ` · ${activeBlock.name}` : ''}
            </div>
          </div>
        </div>

        <div className="fm-bar-right">
          <div className="fm-bar-cycles">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`fm-bar-pip${i < cycles % 4 || (cycles > 0 && cycles % 4 === 0 && i < 4) ? ' on' : ''}`} />
            ))}
          </div>
          <button
            className="fm-bar-play"
            onClick={e => { e.stopPropagation(); setRunning(r => !r) }}
          >{running ? '⏸' : '▶'}</button>
          <button className="fm-bar-expand" onClick={maximizeFocus} title="expand">⤢</button>
          <button className="fm-bar-close" onClick={e => { e.stopPropagation(); onClose() }}>×</button>
        </div>
      </div>
    )
  }

  const modeGrad = pomMode === 'work'
    ? 'linear-gradient(135deg,#6C63FF 0%,#A78BFA 100%)'
    : pomMode === 'break'
    ? 'linear-gradient(135deg,#059669 0%,#34D399 100%)'
    : 'linear-gradient(135deg,#0EA5E9 0%,#7DD3FC 100%)'

  const modeColor = pomMode === 'work' ? '#A78BFA' : pomMode === 'break' ? '#34D399' : '#7DD3FC'

  // ── Full modal ──────────────────────────────────────────────
  return (
    <div className="fm-overlay" onClick={e => { if (e.target === e.currentTarget) minimizeFocus() }}>
      <div className="fm-box">
        {/* Header */}
        <div className="fm-header">
          <div className="fm-mode-row">
            {(['work', 'break', 'long'] as const).map(m => (
              <button key={m} className={`fm-mode-btn${pomMode === m ? ' on' : ''}`}
                style={pomMode === m ? { background: modeGrad, borderColor: 'transparent', color: '#fff' } : {}}
                onClick={() => switchMode(m)}>
                {m === 'work' ? 'focus' : m === 'break' ? 'short break' : 'long break'}
              </button>
            ))}
          </div>
          <button className="fm-close" onClick={onClose}>×</button>
        </div>

        {/* Block context */}
        {activeBlock && (
          <div className="fm-block">
            <div className={`fm-bdot ${activeBlock.type === 'focus' ? 'tf' : activeBlock.type === 'routine' ? 'tr' : activeBlock.type === 'study' ? 'ts' : 'tl'}`} />
            <div className="fm-binfo">
              <div className="fm-bname">{activeBlock.name}</div>
              <div className="fm-btime">{fmt(activeBlock.start, cfg.tf)} – {fmt(activeBlock.end, cfg.tf)} · {currentBlock ? 'in progress' : 'up next'}</div>
            </div>
          </div>
        )}

        {/* Big ring + timer */}
        <div className="fm-ring-wrap">
          {/* Glow backdrop */}
          <div className="fm-ring-glow" style={{ background: modeColor }} />
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10"/>
            <circle cx="110" cy="110" r={r} fill="none"
              stroke="url(#fmGrad)" strokeWidth="10"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset .3s' }}
            />
            <defs>
              <linearGradient id="fmGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={pomMode === 'work' ? '#6C63FF' : pomMode === 'break' ? '#059669' : '#0EA5E9'}/>
                <stop offset="100%" stopColor={pomMode === 'work' ? '#C084FC' : pomMode === 'break' ? '#6EE7B7' : '#7DD3FC'}/>
              </linearGradient>
            </defs>
          </svg>
          <div className="fm-center">
            <div className="fm-time">{String(mins).padStart(2, '0')}:{String(sec).padStart(2, '0')}</div>
            <div className="fm-mode-lbl">{pomMode === 'work' ? 'FOCUS' : pomMode === 'break' ? 'SHORT BREAK' : 'LONG BREAK'}</div>
            <div className="fm-cycles">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={`fm-pip${i < cycles % 4 || (cycles > 0 && cycles % 4 === 0 && i < 4) ? ' on' : ''}`}
                  style={i < cycles % 4 || (cycles > 0 && cycles % 4 === 0) ? { background: modeColor } : {}} />
              ))}
            </div>
          </div>
        </div>

        {/* Duration presets */}
        {pomMode === 'work' && (
          <div className="fm-dur-row">
            {editingDur ? (
              <div className="fm-dur-edit">
                <input
                  ref={durInputRef}
                  className="fm-dur-inp"
                  type="number"
                  min={1}
                  max={180}
                  value={durInput}
                  onChange={e => setDurInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') applyWorkDuration(parseInt(durInput) || 25)
                    if (e.key === 'Escape') setEditingDur(false)
                  }}
                  onBlur={() => applyWorkDuration(parseInt(durInput) || 25)}
                  autoFocus
                />
                <span className="fm-dur-unit">min</span>
              </div>
            ) : (
              <>
                {WORK_PRESETS.map(p => (
                  <button
                    key={p}
                    className={`fm-dur-chip${workDuration === p ? ' on' : ''}`}
                    style={workDuration === p ? { background: modeGrad, borderColor: 'transparent', color: '#fff' } : {}}
                    onClick={() => applyWorkDuration(p)}
                  >{p}m</button>
                ))}
                <button
                  className="fm-dur-chip fm-dur-custom"
                  onClick={() => { setDurInput(String(workDuration)); setEditingDur(true) }}
                  title="custom duration"
                >…</button>
              </>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="fm-btns">
          <button className="fm-ctrl" onClick={reset} title="reset">↺</button>
          <button className={`fm-play${running ? ' pause' : ''}`}
            style={{ background: running ? 'rgba(255,255,255,.12)' : modeGrad, boxShadow: running ? 'none' : `0 8px 24px ${modeColor}55` }}
            onClick={() => setRunning(r => !r)}>
            {running ? '⏸' : '▶'}
          </button>
          <button className="fm-ctrl" onClick={skip} title="skip">⏭</button>
        </div>

        {/* Gems */}
        <div className={`fm-gems${gemFlash ? ' flash' : ''}`}>
          <span className="fm-gem-icon" style={{ color: modeColor }}>◆</span>
          <span className="fm-gem-count">{focusGems}</span>
          <span className="fm-gem-lbl">gems earned</span>
          {gemFlash && <span className="fm-gem-earned" style={{ color: modeColor }}>+1 ◆</span>}
        </div>
        <div className="fm-gem-hint">
          {focusGems < 5
            ? `${5 - focusGems} more to unlock ember theme 🔥`
            : focusGems < 12
            ? `${12 - focusGems} more to unlock ocean theme 🌊`
            : '✓ all themes unlocked — keep the streak going!'}
        </div>

        <div className="fm-minimize-hint">click outside to minimize</div>
      </div>
    </div>
  )
}
