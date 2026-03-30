import { useState } from 'react'
import { useStore } from '../store'
import { DAYS, MONTHS, ENERGY_TIPS } from '../constants'
import { todayStr, plannedMinutes, totalDayMinutes, toM, nowMinutes } from '../utils'
import GCalModal from './GCalModal'

export default function Sidebar() {
  const {
    sbCol, toggleSidebar, toggleMode, mode, view, setView,
    blocks, focuses, setFocus, cfg, intentions, setEnergy, setPriority,
    userName, openNotif, openSignIn, gcalDone, openSettings,
    clearDay, addBlock, selDate,
    timeBlindn, setTimeBlindn, openReschedule, setRescheduleDelay,
    lockedDays, lockDay, unlockDay, blockMoveCounts,
    goals, openGoals,
    templates, openTemplates, applyTemplate,
    openCoachAt,
    focusStreak, focusStreakDate,
  } = useStore()

  const [lateMenuOpen, setLateMenuOpen] = useState(false)
  const [gcalModalOpen, setGcalModalOpen] = useState(false)

  // Mini calendar
  const [miniCalMonth, setMiniCalMonth] = useState(() => new Date())
  const miniCalFirst = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth(), 1).getDay()
  const miniCalDays = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 0).getDate()
  const blockDates = new Set(blocks.map(b => b.date))
  const todayDate = new Date()

  const goToMiniCalDate = (day: number) => {
    const ds = `${miniCalMonth.getFullYear()}-${String(miniCalMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    useStore.getState().setSelDate(ds)
    setView('day')
  }

  const today = new Date()
  const td = todayStr()
  const int = intentions[td] || { e: 0, p: ['', '', ''] }
  const pm = plannedMinutes(blocks, td)
  const tm = totalDayMinutes(cfg)
  const pct = Math.min(100, Math.round((pm / tm) * 100))
  const h = Math.floor(pm / 60)
  const m = pm % 60
  const circumference = 2 * Math.PI * 17
  const strokeDash = circumference - (pct / 100) * circumference

  // Plan health score
  const todayBlocks = blocks.filter(b => b.date === td)
  const hasFocus = todayBlocks.some(b => b.type === 'focus')
  const hasFreeBuffer = todayBlocks.some(b => (b.type === 'free' || b.type === 'routine') && (toM(b.end) - toM(b.start)) >= 15)
  let healthScore = 50
  if (pct >= 60 && pct <= 85) healthScore += 20
  else if (pct > 85 && pct <= 95) healthScore += 5
  else if (pct > 95) healthScore -= 15
  else if (pct >= 40) healthScore += 10
  if (hasFocus) healthScore += 15
  if (hasFreeBuffer) healthScore += 15
  if (int.p.filter(Boolean).length > 0 && todayBlocks.length > 0) healthScore += 10
  if (todayBlocks.length >= 3) healthScore += 5
  if (int.e > 0) healthScore += 5
  healthScore = Math.max(0, Math.min(100, healthScore))
  const grade = healthScore >= 90 ? 'A' : healthScore >= 75 ? 'B' : healthScore >= 60 ? 'C' : healthScore >= 45 ? 'D' : 'F'
  const gradeColor = healthScore >= 90 ? '#4CAF8A' : healthScore >= 75 ? '#7BB3FF' : healthScore >= 60 ? '#E8C24A' : '#FF7070'
  const gradeTip = healthScore >= 90 ? 'solid plan' : healthScore >= 75 ? 'good shape' : healthScore >= 60 ? 'could use buffer' : 'overloaded or sparse'

  // Tomorrow lock
  const tomorrowStr = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const tomorrowBlocks = blocks.filter(b => b.date === tomorrowStr)
  const isTomorrowLocked = !!lockedDays[tomorrowStr]

  // Goal hours — sum block durations for a given goalId in the last 7 days
  const goalHours = (gid: number): number => {
    const since = new Date()
    since.setDate(since.getDate() - 7)
    const sinceStr = since.toISOString().slice(0, 10)
    return blocks
      .filter(b => b.goalId === gid && b.date >= sinceStr)
      .reduce((sum, b) => {
        const [sh, sm] = b.start.split(':').map(Number)
        const [eh, em] = b.end.split(':').map(Number)
        return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60
      }, 0)
  }

  // Pattern insight
  const patternEntry = Object.entries(blockMoveCounts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])[0]

  const handleEnergyAI = () => {
    openCoachAt('design')
  }

  // Live block
  const nowM = nowMinutes()
  const liveBlock = blocks.filter(b => b.date === td && toM(b.start) <= nowM && toM(b.end) > nowM)[0]

  return (
    <div id="sb" className={sbCol ? 'col' : ''}>
      {/* Header */}
      <div id="sb-hdr">
        <div id="sb-logo">
          <svg className="logo-mark" width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9.5" stroke="var(--acc)" strokeWidth="1.5"/>
            <line x1="11" y1="11" x2="11" y2="5" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="11" y1="11" x2="15.5" y2="13.5" stroke="var(--acc)" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="11" cy="11" r="1.5" fill="var(--acc)"/>
          </svg>
          <span className="logo-txt">minutely</span>
        </div>
        <button id="sb-tog" className="sbibtn" onClick={toggleSidebar} title="toggle sidebar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* User badge — click to open settings */}
      <div id="user-badge" onClick={openSettings} title="settings & preferences" style={{ cursor: 'pointer' }}>
        <div className="ub-av">{userName ? userName[0].toUpperCase() : '?'}</div>
        <div className="ub-info">
          <div className="ub-name">{userName || 'guest'}</div>
          <div className="ub-status">settings & preferences</div>
        </div>
        <svg className="ub-settings-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, opacity: .5 }}>
          <path d="M7 1.5C5.07 1.5 3.5 3.07 3.5 5S5.07 8.5 7 8.5 10.5 6.93 10.5 5 8.93 1.5 7 1.5zM1.5 12c0-2.2 2.46-4 5.5-4s5.5 1.8 5.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>

      <div id="sb-body">

        {/* ── TODAY ── */}
        <>

            <div id="sb-today">
              <div className="sb-big-date">{today.getDate()} {MONTHS[today.getMonth()]}</div>
              <div className="sb-dn">{DAYS[today.getDay()].toUpperCase()} · {today.getFullYear()}</div>

              <div className="fill-row">
                <div className="fill-circle-wrap">
                  <svg viewBox="0 0 42 42" width="42" height="42">
                    <circle cx="21" cy="21" r="17" fill="none" stroke="var(--bd2)" strokeWidth="3" />
                    <circle cx="21" cy="21" r="17" fill="none" stroke="var(--acc)" strokeWidth="3"
                      strokeDasharray={circumference} strokeDashoffset={strokeDash} strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
                    />
                  </svg>
                  <div className="fill-pct">{pct}%</div>
                </div>
                <div className="fill-lbl">
                  <div id="fl-main" className="flm">{h}h{m ? ` ${m}m` : ''} planned</div>
                  <div id="fl-sub" className="fls">
                    plan health:&nbsp;
                    <span className="plan-grade" style={{ color: gradeColor }} title={gradeTip}>{grade}</span>
                  </div>
                  {(() => {
                    const today2 = new Date().toISOString().slice(0, 10)
                    const yesterday2 = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
                    const active = focusStreakDate === today2 || focusStreakDate === yesterday2
                    return active && focusStreak > 0 ? (
                      <div className="sb-streak" title={`${focusStreak}-day focus streak`}>
                        🔥 <span className="sb-streak-n">{focusStreak}</span>
                        <span className="sb-streak-lbl">day streak</span>
                      </div>
                    ) : null
                  })()}
                </div>
                <button className="clear-day-btn" title="clear all blocks for today (C)" onClick={() => clearDay(td)}>clear</button>
              </div>

              <span className="sblbl">today's focus</span>
              <input
                id="sb-focus"
                placeholder="what matters most today?"
                defaultValue={focuses[td] || ''}
                key={td}
                onChange={e => setFocus(td, e.target.value)}
                onBlur={e => setFocus(td, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setFocus(td, e.currentTarget.value); e.currentTarget.blur() } }}
              />
            </div>

            {/* Live block tracker */}
            {liveBlock && (() => {
              const elapsed = nowM - toM(liveBlock.start)
              const total = toM(liveBlock.end) - toM(liveBlock.start)
              const livePct = Math.min(100, Math.round((elapsed / total) * 100))
              const minsLeft = toM(liveBlock.end) - nowM
              return (
                <div className="live-block-strip">
                  <div className="lb-row">
                    <div className={`lb-dot tc ${liveBlock.type === 'focus' ? 'tf' : liveBlock.type === 'routine' ? 'tr' : liveBlock.type === 'study' ? 'ts' : 'tl'}`} />
                    <span className="lb-name">{liveBlock.name}</span>
                    <span className="lb-mins">{minsLeft}m left</span>
                    <button className={`lb-blind-btn${timeBlindn ? ' on' : ''}`} onClick={() => setTimeBlindn(!timeBlindn)} title={timeBlindn ? 'turn off nudges' : 'turn on 10-min nudges'}>
                      {timeBlindn ? '🔔' : '🔕'}
                    </button>
                  </div>
                  <div className="lb-bar"><div className="lb-fill" style={{ width: `${livePct}%` }} /></div>
                </div>
              )
            })()}

            {/* Energy */}
            <div id="sb-energy">
              <span className="sblbl">energy today</span>
              <div className="e-row">
                {['—', 'low', 'med', 'peak'].map((lbl, i) => (
                  <button key={i} className={`ebtn${int.e === i ? ' on' : ''}`} onClick={() => setEnergy(td, i)}>{lbl}</button>
                ))}
              </div>
              <div id="energy-tip">{ENERGY_TIPS[int.e] || ENERGY_TIPS[0]}</div>
              {int.e > 0 && (
                <button id="e-ai-btn" className="e-ai-btn show" onClick={handleEnergyAI}>
                  ✦ design day with coach
                </button>
              )}
            </div>

            {/* Priorities */}
            <div id="sb-prio">
              <span className="sblbl">priorities</span>
              <div className="plist">
                {[0, 1, 2].map(i => (
                  <div key={i} className="prow">
                    <span className="pnum">{i + 1}</span>
                    <input
                      className="pinp"
                      placeholder={`priority ${i + 1}`}
                      defaultValue={int.p[i] || ''}
                      key={`${td}-${i}`}
                      onChange={e => setPriority(td, i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Goals section */}
            {goals.length > 0 && (
              <div className="sb-goals-section">
                <div className="sb-goals-hdr">
                  <span className="sblbl">goals</span>
                  <button className="sb-goals-edit" onClick={openGoals}>edit</button>
                </div>
                <div className="sb-goals-list">
                  {goals.map(g => {
                    const actual = goalHours(g.id)
                    const pct = g.targetHours > 0 ? Math.min(100, Math.round((actual / g.targetHours) * 100)) : 0
                    const isComplete = pct >= 100
                    return (
                      <button key={g.id} className={`sb-goal-chip${isComplete ? ' done' : ''}`} onClick={openGoals} title={`${actual.toFixed(1)}h / ${g.targetHours}h this week`}>
                        <div className="sgc-top">
                          <span className="sgc-dot" style={{ background: g.color }} />
                          <span className="sgc-name">{g.name}</span>
                          <span className="sgc-hrs">
                            <span style={{ color: g.color, fontWeight: 600 }}>{actual.toFixed(1)}</span>
                            <span className="sgc-target">/{g.targetHours}h</span>
                            {isComplete && <span className="sgc-done-mark">✓</span>}
                          </span>
                        </div>
                        <div className="sgc-bar">
                          <div className="sgc-fill" style={{ width: `${pct}%`, background: g.color }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {goals.length === 0 && (
              <div className="sb-goals-section">
                <div className="sb-goals-hdr">
                  <span className="sblbl">goals</span>
                </div>
                <button className="sb-goals-add" onClick={openGoals}>+ add goal</button>
              </div>
            )}

            {/* Templates section */}
            <div className="sb-tmpl-section">
              <div className="sb-goals-hdr">
                <span className="sblbl">templates</span>
                <button className="sb-goals-edit" onClick={openTemplates}>manage</button>
              </div>
              <div className="sb-tmpl-list">
                <button className="sb-tmpl-save" onClick={openTemplates}>+ save day</button>
                {templates.map(t => (
                  <button key={t.id} className="sb-tmpl-chip" onClick={() => { applyTemplate(t.id, selDate || td, 0); useStore.getState().showToast(`"${t.name}" applied`) }} title={`apply "${t.name}" to ${selDate || td}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

          {/* Running late emergency valve */}
          <div className="ev-wrap" style={{ marginTop: 6 }}>
            <button className={`ev-main-btn${lateMenuOpen ? ' open' : ''}`} onClick={() => setLateMenuOpen(v => !v)}>
              <span>🚨</span><span>i'm running late</span><span className="ev-arr">{lateMenuOpen ? '▲' : '▼'}</span>
            </button>
            {lateMenuOpen && (
              <div className="ev-options">
                <span className="ev-opts-lbl">how late?</span>
                {[15, 30, 45, 60].map(mins => (
                  <button key={mins} className="ev-opt" onClick={() => { setRescheduleDelay(mins); openReschedule(); setLateMenuOpen(false) }}>
                    +{mins >= 60 ? '1h' : `${mins}m`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pattern insight */}
          {patternEntry && (
            <div className="pattern-card">
              <div className="pc-top">
                <span className="pc-icon">⟳</span>
                <span className="pc-ttl">pattern detected</span>
                <button className="pc-dismiss" onClick={() => useStore.getState().showToast('dismissed')}>×</button>
              </div>
              <div className="pc-body">
                <strong>{patternEntry[0]}</strong> moved {patternEntry[1]}× — find it a permanent slot.
              </div>
            </div>
          )}

          {/* Lock tomorrow */}
          {tomorrowBlocks.length > 0 && (
            <div className="lock-tmrw-wrap" style={{ marginTop: 6 }}>
              {isTomorrowLocked ? (
                <div className="lock-tmrw-locked">
                  <span className="lt-icon">🔒</span>
                  <span className="lt-lbl">tomorrow locked</span>
                  <button className="lt-unlock" onClick={() => unlockDay(tomorrowStr)}>unlock</button>
                </div>
              ) : (
                <button className="lock-tmrw-btn" onClick={() => { lockDay(tomorrowStr); useStore.getState().showToast("tomorrow's plan locked in") }}>
                  <span>🔒</span><span>lock in tomorrow</span>
                </button>
              )}
            </div>
          )}

          {/* Mini calendar */}
          <div id="mini-cal">
            <div className="mc2-hdr">
              <button className="mc2-nav" onClick={() => setMiniCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
              <span className="mc2-title">{MONTHS[miniCalMonth.getMonth()]} {miniCalMonth.getFullYear()}</span>
              <button className="mc2-nav" onClick={() => setMiniCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
            </div>
            <div className="mc2-grid">
              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="mc2-dow">{d}</div>)}
              {Array.from({ length: miniCalFirst }).map((_, i) => <div key={`e${i}`} className="mc2-empty" />)}
              {Array.from({ length: miniCalDays }, (_, i) => i + 1).map(day => {
                const ds = `${miniCalMonth.getFullYear()}-${String(miniCalMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = day === todayDate.getDate() && miniCalMonth.getMonth() === todayDate.getMonth() && miniCalMonth.getFullYear() === todayDate.getFullYear()
                const isSel = ds === (selDate || td)
                const hasBlocks = blockDates.has(ds)
                return (
                  <button key={day} className={`mc2-day${isToday ? ' today' : ''}${isSel ? ' sel' : ''}${hasBlocks ? ' has-blocks' : ''}`} onClick={() => goToMiniCalDate(day)} title={ds}>
                    {day}
                    {hasBlocks && <span className="mc2-dot" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Nav buttons */}
          <div id="sb-nav">
            <button className={`snb${view === 'week' ? ' on' : ''}`} onClick={() => setView('week')}>
              <svg viewBox="0 0 15 15" fill="none">
                <rect x="1" y="3" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1 7h13M5 3V1M10 3V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="snb-t">week</span>
              <span className="snb-k">W</span>
            </button>
            <button className={`snb${view === 'day' ? ' on' : ''}`} onClick={() => setView('day')}>
              <svg viewBox="0 0 15 15" fill="none">
                <rect x="2" y="3" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M2 7h11M5 3V1M10 3V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="snb-t">day</span>
              <span className="snb-k">D</span>
            </button>
          </div>
        </>

      </div>

      {/* Bottom bar */}
      <div id="sb-btm">
        <button
          id="gcal-btn"
          className={`sbb${gcalDone ? ' synced' : ''}`}
          style={{ width: 'auto', padding: '5px 9px', border: `1.5px solid ${gcalDone ? 'var(--brbd)' : 'var(--bd)'}`, borderRadius: 20, fontSize: 11, fontFamily: 'var(--font-u)', fontWeight: 500 }}
          onClick={() => setGcalModalOpen(true)}
        >
          <span className="gcal-t">{gcalDone ? 'synced' : 'gcal'}</span>
        </button>
        <div style={{ flex: 1 }} />
        <button className="sbb" onClick={openNotif} title="notifications">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5C4.5 1.5 3 3.5 3 5.5v3l-1 1.5h10l-1-1.5v-3C11 3.5 9.5 1.5 7 1.5zM5.5 10a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="sbb" id="sb-mode" onClick={toggleMode} title={`theme: ${mode}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {mode === 'light'
              ? <path d="M7 1v1M7 12v1M1 7H2M12 7h1M3 3l.7.7M10.3 10.3l.7.7M3 11l.7-.7M10.3 3.7l.7-.7M7 4a3 3 0 100 6 3 3 0 000-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              : mode === 'dark'
              ? <path d="M11 8A5 5 0 015 2a6 6 0 106 6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              : mode === 'ember'
              ? <path d="M7 2C7 2 4 5 4 8a3 3 0 006 0c0-1.5-1-3-1-3s-.5 2-1.5 2c-.8 0-1-.8-1-1.5C6.5 4.5 7 2 7 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              : mode === 'ocean'
              ? <path d="M1 8c1.5-2 3-2 4.5 0s3 2 4.5 0M1 10.5c1.5-2 3-2 4.5 0s3 2 4.5 0M4 4.5a3 3 0 016 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              : mode === 'forest'
              ? <path d="M7 1L4 6H2L5 9H3L7 13L11 9H9L12 6H10L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
              : mode === 'aurora'
              ? <><path d="M1 9 C3 5 5 3 7 5 C9 7 11 5 13 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/><path d="M2 12 C4 8 6 6 7 8 C8 10 10 8 12 12" stroke="var(--acc2)" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".7"/></>
              : mode === 'neon'
              ? <><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/><circle cx="7" cy="7" r="2" fill="none" stroke="var(--acc)" strokeWidth="1"/><path d="M7 2V1M7 13v-1M2 7H1M13 7h-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>
              : <path d="M7 1v1M7 12v1M1 7H2M12 7h1M3.5 3.5l.7.7M9.8 9.8l.7.7M3.5 10.5l.7-.7M9.8 4.2l.7-.7M5 7a2 2 0 104 0 2 2 0 00-4 0z" stroke="var(--acc)" strokeWidth="1.3" strokeLinecap="round"/>
            }
          </svg>
        </button>
      </div>
      {gcalModalOpen && <GCalModal onClose={() => setGcalModalOpen(false)} />}
    </div>
  )
}
