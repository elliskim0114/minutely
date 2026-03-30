import { useState } from 'react'
import { useStore } from '../store'
import { toM } from '../utils'

const COLORS = ['#FF4D1C','#6C63FF','#059669','#0EA5E9','#F59E0B','#EC4899','#8B5CF6','#14B8A6']

function ProgressRing({ pct, color, size = 80, stroke = 7 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(1, pct / 100))
  const cx = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bd)" strokeWidth={stroke}/>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.34,1.56,.64,1)' }}
      />
    </svg>
  )
}

export default function GoalsView() {
  const { view, goals, blocks, addGoal, openGoals } = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[1])
  const [targetHours, setTargetHours] = useState(10)
  const [desc, setDesc] = useState('')

  const now = new Date()

  const getSinceDate = (period: 'daily' | 'weekly' | 'monthly') => {
    const d = new Date(now)
    if (period === 'daily') return d.toISOString().slice(0, 10)
    if (period === 'monthly') { d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
    d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
  }

  const goalActualMins = (gid: number, period: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
    const since = getSinceDate(period)
    return blocks.filter(b => b.goalId === gid && (period === 'daily' ? b.date === since : b.date >= since))
      .reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
  }

  const goalActual = (gid: number, unit: 'hours' | 'minutes' = 'hours', period: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
    const mins = goalActualMins(gid, period)
    return unit === 'minutes' ? mins : Math.round(mins / 60 * 10) / 10
  }

  const goalBlocks = (gid: number, period: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
    const since = getSinceDate(period)
    return blocks.filter(b => b.goalId === gid && (period === 'daily' ? b.date === since : b.date >= since))
      .sort((a, b) => b.date.localeCompare(a.date) || toM(a.start) - toM(b.start))
      .slice(0, 5)
  }

  const saveGoal = () => {
    if (!name.trim()) return
    addGoal({ name: name.trim(), color, targetHours, targetUnit: 'hours', targetPeriod: 'weekly', description: desc.trim() || undefined })
    setName(''); setDesc(''); setTargetHours(10); setColor(COLORS[1]); setAdding(false)
  }

  const totalWeekHrs = goals.reduce((s, g) => {
    const unit = g.targetUnit || 'hours'
    const period = g.targetPeriod || 'weekly'
    const val = goalActual(g.id, unit, period)
    return s + (unit === 'minutes' ? val / 60 : val)
  }, 0)
  const totalTargetHrs = goals.reduce((s, g) => {
    const unit = g.targetUnit || 'hours'
    return s + (unit === 'minutes' ? g.targetHours / 60 : g.targetHours)
  }, 0)

  return (
    <div id="goals-view" className={view === 'goals' ? 'on' : ''}>
      <div className="gv-inner">

        {/* ── Hero ── */}
        <div className="gv-hero">
          <div className="gv-hero-left">
            <div className="gv-tag">goals & projects</div>
            <h1 className="gv-title">what you're building towards</h1>
            <p className="gv-sub">link blocks to goals to track your focused hours week by week</p>
          </div>
          {goals.length > 0 && (
            <div className="gv-hero-kpi">
              <div className="gv-kpi">
                <div className="gv-kpi-val">{totalWeekHrs}h</div>
                <div className="gv-kpi-lbl">logged this week</div>
              </div>
              <div className="gv-kpi-div" />
              <div className="gv-kpi">
                <div className="gv-kpi-val">{totalTargetHrs}h</div>
                <div className="gv-kpi-lbl">weekly target</div>
              </div>
              <div className="gv-kpi-div" />
              <div className="gv-kpi">
                <div className="gv-kpi-val">{goals.length}</div>
                <div className="gv-kpi-lbl">active goals</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Empty state ── */}
        {goals.length === 0 && !adding && (
          <div className="gv-empty">
            <div className="gv-empty-ring">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="33" stroke="var(--bd)" strokeWidth="4"/>
                <circle cx="40" cy="40" r="20" stroke="var(--bd2)" strokeWidth="3"/>
                <circle cx="40" cy="40" r="7" stroke="var(--bd2)" strokeWidth="2.5"/>
                <circle cx="40" cy="40" r="2.5" fill="var(--ink4)"/>
              </svg>
            </div>
            <div className="gv-empty-title">no goals yet</div>
            <div className="gv-empty-sub">set a goal, link blocks to it, and watch your<br/>focused hours accumulate week by week.</div>
            <button className="gv-add-first" onClick={() => setAdding(true)}>+ add your first goal</button>
          </div>
        )}

        {/* ── Goal cards ── */}
        {goals.length > 0 && (
          <div className="gv-grid">
            {goals.map(g => {
              const unit = g.targetUnit || 'hours'
              const period = g.targetPeriod || 'weekly'
              const actual = goalActual(g.id, unit, period)
              const pct = Math.min(100, Math.round((actual / g.targetHours) * 100))
              const gBlocks = goalBlocks(g.id, period)
              const isComplete = pct >= 100
              const unitSuffix = unit === 'minutes' ? 'min' : 'h'
              const periodLabel = period === 'daily' ? 'today' : period === 'monthly' ? 'this month' : 'this week'

              return (
                <div key={g.id} className={`gv-card${isComplete ? ' complete' : ''}`}
                  style={{ '--gv-col': g.color } as React.CSSProperties}>

                  <div className="gv-card-accent" style={{ background: g.color }} />

                  <div className="gv-card-body">
                    <div className="gv-card-top">
                      <div className="gv-ring-area">
                        <ProgressRing pct={pct} color={g.color} size={78} stroke={6} />
                        <div className="gv-ring-center">
                          <div className="gv-ring-pct" style={{ color: g.color }}>{pct}%</div>
                          {isComplete && <div className="gv-ring-done">✓</div>}
                        </div>
                      </div>
                      <div className="gv-card-info">
                        <div className="gv-card-name">{g.name}</div>
                        {g.description && <div className="gv-card-desc">{g.description}</div>}
                        <div className="gv-hrs-row">
                          <span className="gv-hrs-actual" style={{ color: g.color }}>{actual}{unitSuffix}</span>
                          <span className="gv-hrs-sep">/</span>
                          <span className="gv-hrs-target">{g.targetHours}{unitSuffix} target</span>
                        </div>
                        <div className="gv-bar">
                          <div className="gv-bar-fill" style={{ width: `${pct}%`, background: g.color }} />
                        </div>
                        <div className="gv-bar-lbl">{periodLabel}</div>
                      </div>
                      <button className="gv-edit-btn" onClick={openGoals} title="manage goals">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M9 2L11 4L4.5 10.5H2.5V8.5L9 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>

                    {gBlocks.length > 0 && (
                      <div className="gv-blocks">
                        <div className="gv-blocks-lbl">recent blocks</div>
                        {gBlocks.map(b => (
                          <div key={b.id} className="gv-brow">
                            <div className="gv-bdot" style={{ background: g.color }} />
                            <span className="gv-bname">{b.name}</span>
                            <span className="gv-btime">{b.start}–{b.end}</span>
                            <span className="gv-bday">
                              {new Date(b.date + 'T12:00').toLocaleDateString('en', { weekday: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {gBlocks.length === 0 && (
                      <div className="gv-no-blocks">
                        no blocks tagged yet — edit any block and link it to this goal
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Add new card */}
            {!adding && (
              <button className="gv-card gv-add-card" onClick={() => setAdding(true)}>
                <div className="gv-add-plus">+</div>
                <div className="gv-add-card-lbl">add goal</div>
              </button>
            )}
          </div>
        )}

        {/* ── Add goal form ── */}
        {adding && (
          <div className="gv-form-card">
            <div className="gv-form-hdr">
              <div className="gv-form-title">new goal</div>
              <button className="gv-form-close" onClick={() => { setAdding(false); setName('') }}>×</button>
            </div>
            <input
              className="gv-form-inp"
              placeholder="goal name…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveGoal()}
              autoFocus
            />
            <input
              className="gv-form-inp gv-form-desc"
              placeholder="short description (optional)…"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
            <div className="gv-form-row">
              <div className="gv-form-colors">
                {COLORS.map(c => (
                  <button key={c}
                    className={`gv-cc${color === c ? ' on' : ''}`}
                    style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--bg), 0 0 0 5px ${c}` : 'none' }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <div className="gv-form-target">
                <span className="gv-form-target-lbl">weekly target</span>
                <input type="number" className="gv-form-target-inp" min={1} max={168}
                  value={targetHours} onChange={e => setTargetHours(Number(e.target.value))} />
                <span className="gv-form-target-unit">h</span>
              </div>
            </div>
            <div className="gv-form-preview" style={{ borderColor: color, background: color + '12' }}>
              <ProgressRing pct={0} color={color} size={44} stroke={4} />
              <div>
                <div className="gv-form-prev-name" style={{ color }}>{name || 'goal name'}</div>
                <div className="gv-form-prev-hrs">0 / {targetHours}h target</div>
              </div>
            </div>
            <div className="gv-form-actions">
              <button className="gv-form-cancel" onClick={() => { setAdding(false); setName('') }}>cancel</button>
              <button className="gv-form-save" style={{ background: color }} onClick={saveGoal} disabled={!name.trim()}>
                save goal →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
