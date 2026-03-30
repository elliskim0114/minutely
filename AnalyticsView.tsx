import { useState } from 'react'
import { useStore } from '../store'
import { toM } from '../utils'
import TypedText from './TypedText'

interface Insight {
  icon: string
  title: string
  body: string
  prompt?: string
}

const TYPE_COLORS: Record<string, string> = {
  focus: 'var(--bfbd)',
  routine: 'var(--brbd)',
  study: 'var(--bsbd)',
  free: 'var(--blbd)',
  custom: 'var(--acc)',
  gcal: 'var(--bd2)',
}

const TYPE_BG: Record<string, string> = {
  focus: 'var(--bfbg)',
  routine: 'var(--brbg)',
  study: 'var(--bsbg)',
  free: 'var(--blbg)',
}

function getDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function AnalyticsView() {
  const { view, blocks, goals, intentions, blockMoveCounts, openGoals, anthropicKey, setView, setPendingAIPrompt } = useStore()
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null)

  // Build last 14 days
  const today = new Date()
  const last14: { date: string; label: string }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    last14.push({
      date: getDateStr(d),
      label: i === 0 ? 'today' : d.toLocaleDateString('en', { weekday: 'short' }).toLowerCase(),
    })
  }
  const last7 = last14.slice(7)

  // Focus hours per day (last 14)
  const focusHoursPerDay = last14.map(({ date }) => {
    const mins = blocks.filter(b => b.date === date && b.type === 'focus')
      .reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
    return Math.round((mins / 60) * 10) / 10
  })
  const maxFocusH = Math.max(...focusHoursPerDay, 1)

  // Block type breakdown (last 7 days)
  const typeMinutes: Record<string, number> = {}
  let totalMins = 0
  last7.forEach(({ date }) => {
    blocks.filter(b => b.date === date).forEach(b => {
      const mins = toM(b.end) - toM(b.start)
      const key = b.cc ? 'custom' : b.type
      typeMinutes[key] = (typeMinutes[key] || 0) + mins
      totalMins += mins
    })
  })

  // Plan health per day (last 7)
  const healthScores = last7.map(({ date }) => {
    const dayBlocks = blocks.filter(b => b.date === date)
    const pm = dayBlocks.reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
    const tm = 17 * 60 // rough total day
    const pct = Math.min(100, Math.round((pm / tm) * 100))
    const hasFocus = dayBlocks.some(b => b.type === 'focus')
    const hasBuffer = dayBlocks.some(b => (b.type === 'free' || b.type === 'routine') && (toM(b.end) - toM(b.start)) >= 15)
    const int = intentions[date] || { e: 0, p: ['', '', ''] }
    let score = 50
    if (pct >= 60 && pct <= 85) score += 20
    else if (pct > 85 && pct <= 95) score += 5
    else if (pct > 95) score -= 15
    else if (pct >= 40) score += 10
    if (hasFocus) score += 15
    if (hasBuffer) score += 15
    if (int.p.filter(Boolean).length > 0 && dayBlocks.length > 0) score += 10
    if (dayBlocks.length >= 3) score += 5
    if (int.e > 0) score += 5
    return Math.max(0, Math.min(100, score))
  })
  const avgHealth = Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
  const avgGrade = avgHealth >= 90 ? 'A' : avgHealth >= 75 ? 'B' : avgHealth >= 60 ? 'C' : avgHealth >= 45 ? 'D' : 'F'
  const gradeColor = avgHealth >= 90 ? '#4CAF8A' : avgHealth >= 75 ? '#7BB3FF' : avgHealth >= 60 ? '#E8C24A' : '#FF7070'

  // Streaks — consecutive days with at least one focus block
  let currentStreak = 0
  for (let i = last14.length - 1; i >= 0; i--) {
    const hasFocus = blocks.some(b => b.date === last14[i].date && b.type === 'focus')
    if (hasFocus) currentStreak++
    else break
  }

  // Most moved blocks
  const topMoved = Object.entries(blockMoveCounts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Goal hours this week (last 7 days)
  const goalHours = (gid: number) => {
    const mins = blocks
      .filter(b => b.goalId === gid && last7.some(d => d.date === b.date))
      .reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
    return Math.round((mins / 60) * 10) / 10
  }

  // Total focus hours this week
  const weekFocusH = Math.round(
    blocks.filter(b => last7.some(d => d.date === b.date) && b.type === 'focus')
      .reduce((s, b) => s + toM(b.end) - toM(b.start), 0) / 60 * 10
  ) / 10

  // Busiest day
  const dayTotals = last7.map(({ date, label }) => ({
    label,
    mins: blocks.filter(b => b.date === date).reduce((s, b) => s + toM(b.end) - toM(b.start), 0),
  }))
  const busiestDay = dayTotals.reduce((a, b) => b.mins > a.mins ? b : a, dayTotals[0])

  const runInsights = async () => {
    setInsightsLoading(true)
    setInsightsError('')
    setAppliedIdx(null)
    try {
      const goalsPayload = goals.map(g => ({
        name: g.name,
        targetHours: g.targetHours,
        actualHours: goalHours(g.id),
        pct: Math.min(100, Math.round((goalHours(g.id) / g.targetHours) * 100)),
      }))
      const analyticsPayload = {
        focusHoursPerDay: last14.map(({ label, date }, i) => ({ label, date, hours: focusHoursPerDay[i] })),
        typeBreakdown: typeMinutes,
        healthScores: last7.map(({ label }, i) => ({
          label,
          score: healthScores[i],
          grade: healthScores[i] >= 90 ? 'A' : healthScores[i] >= 75 ? 'B' : healthScores[i] >= 60 ? 'C' : healthScores[i] >= 45 ? 'D' : 'F',
        })),
        avgHealth,
        currentStreak,
        topMoved,
        weekFocusH,
        energy: last7.map(({ date }) => ({ date, level: (intentions[date] || { e: 0 }).e })),
      }
      const res = await fetch('/api/analytics-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analytics: analyticsPayload, goals: goalsPayload, apiKey: anthropicKey || undefined }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data.insights)) setInsights(data.insights)
      else throw new Error('unexpected response')
    } catch (err) {
      const msg = String(err)
      if (msg.includes('401')) setInsightsError('API key issue — check your key in the MPD view')
      else if (msg.includes('429')) setInsightsError('rate limited — wait a moment and try again')
      else if (msg.includes('fetch') || msg.includes('Failed')) setInsightsError('server offline — run: cd server && npm run dev')
      else setInsightsError('could not generate insights — try again')
    } finally {
      setInsightsLoading(false)
    }
  }

  const applyInsightPrompt = (prompt: string, idx: number) => {
    setPendingAIPrompt(prompt)
    setView('mpd')
    setAppliedIdx(idx)
    useStore.getState().showToast('prompt loaded — hit ✦ design my perfect day')
  }

  return (
    <div id="analytics-view" className={view === 'analytics' ? 'on' : ''}>
      <div className="av-inner">
        <div className="av-hero">
          <div className="av-tag">analytics</div>
          <h1 className="av-title">your week in numbers</h1>
          <p className="av-sub">last 7 days · updated live</p>
        </div>

        {/* KPI row */}
        <div className="av-kpis">
          <div className="av-kpi">
            <div className="av-kpi-val">{weekFocusH}h</div>
            <div className="av-kpi-lbl">focus time</div>
          </div>
          <div className="av-kpi">
            <div className="av-kpi-val" style={{ color: gradeColor }}>{avgGrade}</div>
            <div className="av-kpi-lbl">avg plan health</div>
          </div>
          <div className="av-kpi">
            <div className="av-kpi-val">{currentStreak}</div>
            <div className="av-kpi-lbl">focus streak (days)</div>
          </div>
          <div className="av-kpi">
            <div className="av-kpi-val">{busiestDay?.mins ? `${Math.round(busiestDay.mins / 60 * 10) / 10}h` : '—'}</div>
            <div className="av-kpi-lbl">busiest day ({busiestDay?.label})</div>
          </div>
        </div>

        <div className="av-cols">
          <div className="av-col-main">
            {/* Focus hours bar chart */}
            <div className="av-card">
              <div className="av-card-ttl">focus hours · last 14 days</div>
              <div className="av-bars">
                {last14.map(({ label }, i) => {
                  const h = focusHoursPerDay[i]
                  const pct = (h / maxFocusH) * 100
                  const isToday = i === 13
                  return (
                    <div key={i} className="av-bar-col">
                      <div className="av-bar-val">{h > 0 ? `${h}h` : ''}</div>
                      <div className="av-bar-track">
                        <div
                          className={`av-bar-fill${isToday ? ' today' : ''}`}
                          style={{ height: `${Math.max(2, pct)}%`, background: isToday ? 'var(--acc)' : 'var(--bfbd)' }}
                        />
                      </div>
                      <div className={`av-bar-lbl${isToday ? ' today' : ''}`}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Plan health sparkline */}
            <div className="av-card">
              <div className="av-card-ttl">plan health · last 7 days</div>
              <div className="av-health-bars">
                {last7.map(({ label }, i) => {
                  const score = healthScores[i]
                  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F'
                  const col = score >= 90 ? '#4CAF8A' : score >= 75 ? '#7BB3FF' : score >= 60 ? '#E8C24A' : '#FF7070'
                  return (
                    <div key={i} className="av-health-col">
                      <div className="av-health-grade" style={{ color: col }}>{grade}</div>
                      <div className="av-health-track">
                        <div className="av-health-fill" style={{ height: `${score}%`, background: col }} />
                      </div>
                      <div className="av-health-lbl">{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="av-col-side">
            {/* Time by type */}
            <div className="av-card">
              <div className="av-card-ttl">time by type · this week</div>
              {totalMins === 0 ? (
                <div className="av-empty">no blocks this week</div>
              ) : (
                <div className="av-types">
                  {Object.entries(typeMinutes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, mins]) => {
                      const pct = Math.round((mins / totalMins) * 100)
                      const h = Math.floor(mins / 60)
                      const m = mins % 60
                      return (
                        <div key={type} className="av-type-row">
                          <div className="av-type-hdr">
                            <div className="av-type-dot" style={{ background: TYPE_COLORS[type] || 'var(--bd2)' }} />
                            <span className="av-type-name">{type}</span>
                            <span className="av-type-val">{h}h{m ? ` ${m}m` : ''} · {pct}%</span>
                          </div>
                          <div className="av-type-bar">
                            <div className="av-type-fill" style={{ width: `${pct}%`, background: TYPE_COLORS[type] || 'var(--bd2)' }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Goals progress */}
            <div className="av-card">
              <div className="av-card-hdr">
                <div className="av-card-ttl">goals this week</div>
                <button className="av-goals-btn" onClick={openGoals}>manage</button>
              </div>
              {goals.length === 0 ? (
                <div className="av-empty">
                  <button className="av-add-goal" onClick={openGoals}>+ add a goal</button>
                </div>
              ) : (
                <div className="av-goals">
                  {goals.map(g => {
                    const actual = goalHours(g.id)
                    const pct = Math.min(100, Math.round((actual / g.targetHours) * 100))
                    return (
                      <div key={g.id} className="av-goal-row">
                        <div className="av-goal-hdr">
                          <div className="av-goal-dot" style={{ background: g.color }} />
                          <span className="av-goal-name">{g.name}</span>
                          <span className="av-goal-val">{actual}h / {g.targetHours}h</span>
                        </div>
                        <div className="av-goal-bar">
                          <div className="av-goal-fill" style={{ width: `${pct}%`, background: g.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Most moved blocks */}
            {topMoved.length > 0 && (
              <div className="av-card">
                <div className="av-card-ttl">most rescheduled</div>
                <div className="av-moved">
                  {topMoved.map(([name, count]) => (
                    <div key={name} className="av-moved-row">
                      <span className="av-moved-name">{name}</span>
                      <span className="av-moved-count">{count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* AI Insights section */}
        <div className="av-insights-section">
          <div className="av-insights-hdr">
            <div>
              <div className="av-insights-title">✦ AI scheduling insights</div>
              <div className="av-insights-sub">based on your last 7 days — get specific suggestions for your next schedule</div>
            </div>
            <button
              className={`av-insights-btn${insightsLoading ? ' loading' : ''}`}
              onClick={runInsights}
              disabled={insightsLoading}
            >
              {insightsLoading
                ? <><div className="av-ins-dot" /><div className="av-ins-dot" /><div className="av-ins-dot" /><span>analyzing…</span></>
                : insights.length > 0 ? '↺ refresh' : '✦ analyze my week'
              }
            </button>
          </div>

          {insightsError && (
            <div className="av-ins-error">{insightsError}</div>
          )}

          {insights.length > 0 && (
            <div className="av-insight-cards">
              {insights.map((ins, i) => (
                <div key={i} className="av-insight-card">
                  <div className="av-ins-top">
                    <span className="av-ins-icon">{ins.icon}</span>
                    <div className="av-ins-content">
                      <div className="av-ins-title">
                        <TypedText text={ins.title} speed={28} delay={i * 220} />
                      </div>
                      <div className="av-ins-body">
                        <TypedText text={ins.body} speed={8} delay={i * 220 + ins.title.length * 28} />
                      </div>
                    </div>
                  </div>
                  {ins.prompt && (
                    <div className="av-ins-foot">
                      <div className="av-ins-prompt">"{ins.prompt}"</div>
                      <button
                        className={`av-ins-apply${appliedIdx === i ? ' applied' : ''}`}
                        onClick={() => applyInsightPrompt(ins.prompt!, i)}
                      >
                        {appliedIdx === i ? '✓ applied' : '→ use this'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {insights.length === 0 && !insightsLoading && !insightsError && (
            <div className="av-ins-placeholder">
              <div className="av-ins-ph-icon">✦</div>
              <div className="av-ins-ph-text">click "analyze my week" to get personalized suggestions based on your scheduling patterns, energy levels, and goals</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
