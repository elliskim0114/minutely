import { useState } from 'react'
import { useStore } from '../store'
import { todayStr, weekStart, dateStr } from '../utils'
import { DAYS } from '../constants'

interface PlanBlock {
  date: string
  name: string
  start: string
  end: string
  type: string
  reason: string
}

interface Props { onClose: () => void }

type Step = 'reflection' | 'intentions' | 'preview'

export default function WeeklyPlanModal({ onClose }: Props) {
  const { blocks, intentions, anthropicKey, addBlock, showToast, selDate, cfg } = useStore()

  const [step, setStep] = useState<Step>('reflection')
  const [reflectionText, setReflectionText] = useState('')
  const [aiReflection, setAiReflection] = useState('')
  const [priorities, setPriorities] = useState<[string, string, string]>(() => {
    const td = todayStr()
    const int = intentions[td]
    return int?.p ?? ['', '', '']
  })
  const [loading, setLoading] = useState(false)
  const [planResult, setPlanResult] = useState<{ plan: PlanBlock[]; summary: string } | null>(null)
  const [error, setError] = useState('')

  const ws = weekStart(0)
  const weekDates = Array.from({ length: 7 }, (_, i) => dateStr(ws, i))

  // Last week's blocks
  const lwStart = weekStart(-1)
  const lastWeekDates = Array.from({ length: 7 }, (_, i) => dateStr(lwStart, i))
  const lastWeekBlocks = blocks.filter(b => lastWeekDates.includes(b.date))

  // This week's existing blocks
  const existingBlocks = blocks.filter(b => weekDates.includes(b.date))

  const energyLabel = ['not set', 'low', 'medium', 'peak']
  const today = todayStr()
  const energy = energyLabel[intentions[today]?.e ?? 0]

  const generateReflection = async () => {
    if (!lastWeekBlocks.length) {
      setAiReflection("It looks like last week wasn't tracked — that's okay! Let's focus on making this week great.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekDates,
          existingBlocks: existingBlocks.map(b => ({ date: b.date, start: b.start, end: b.end, name: b.name, type: b.type })),
          lastWeekBlocks: lastWeekBlocks.map(b => ({ date: b.date, start: b.start, end: b.end, name: b.name, type: b.type })),
          priorities: priorities.filter(Boolean),
          energy,
          apiKey: anthropicKey || undefined,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiReflection(data.reflection || '')
    } catch (e) {
      setAiReflection('Ready to make this week count.')
    } finally {
      setLoading(false)
    }
  }

  const generateWeekPlan = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekDates,
          existingBlocks: existingBlocks.map(b => ({ date: b.date, start: b.start, end: b.end, name: b.name, type: b.type })),
          lastWeekBlocks: lastWeekBlocks.map(b => ({ date: b.date, start: b.start, end: b.end, name: b.name, type: b.type })),
          priorities: priorities.filter(Boolean),
          energy,
          apiKey: anthropicKey || undefined,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlanResult({ plan: data.plan || [], summary: data.summary || '' })
    } catch (e) {
      const msg = String(e)
      if (msg.includes('fetch') || msg.includes('Failed')) setError('server offline — start it first')
      else setError(String(e).replace('Error: ', ''))
    } finally {
      setLoading(false)
    }
  }

  const applyToWeek = () => {
    if (!planResult?.plan.length) return
    planResult.plan.forEach(b => {
      addBlock({
        name: b.name,
        date: b.date,
        start: b.start,
        end: b.end,
        type: b.type as 'focus' | 'routine' | 'study' | 'free',
        cc: null,
        customName: null,
        repeat: 'none',
      })
    })
    showToast(`${planResult.plan.length} blocks added to your week`)
    onClose()
  }

  const TYPE_DOT: Record<string, string> = { focus: 'tf', routine: 'tr', study: 'ts', free: 'tl' }

  // Group plan blocks by day for display
  const blocksByDay = weekDates.reduce((acc, date) => {
    acc[date] = (planResult?.plan || []).filter(b => b.date === date)
    return acc
  }, {} as Record<string, PlanBlock[]>)

  const dayLabel = (date: string) => {
    const d = new Date(date + 'T12:00:00')
    return `${DAYS[d.getDay()]} ${d.getDate()}`
  }

  return (
    <div className="sc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sc-box wp-box">
        <div className="sc-hdr">
          <div className="sc-hdr-l">
            <div className="sc-icon">◎</div>
            <div>
              <div className="sc-title">plan your week</div>
              <div className="sc-sub">
                {step === 'reflection' && 'step 1 of 3 — reflection'}
                {step === 'intentions' && 'step 2 of 3 — intentions'}
                {step === 'preview' && 'step 3 of 3 — week preview'}
              </div>
            </div>
          </div>
          <button className="sc-close" onClick={onClose}>×</button>
        </div>

        <div className="sc-body">
          {/* Step 1: Reflection */}
          {step === 'reflection' && (
            <>
              <div className="wp-step-title">how did last week go?</div>
              <textarea
                className="wp-textarea"
                placeholder="What went well? What felt off? Any wins or lessons?"
                value={reflectionText}
                onChange={e => setReflectionText(e.target.value)}
                autoFocus
              />
              {aiReflection && (
                <div className="wp-ai-reflection">
                  <span className="wp-ai-icon">✦</span>
                  {aiReflection}
                </div>
              )}
              <div className="sc-foot">
                <button className="sc-cancel" onClick={onClose}>cancel</button>
                <button
                  className="sc-parse"
                  onClick={async () => {
                    await generateReflection()
                    setStep('intentions')
                  }}
                  disabled={loading}
                >
                  {loading
                    ? <><div className="sc-dot" /><div className="sc-dot" /><div className="sc-dot" /><span>reflecting…</span></>
                    : 'next →'
                  }
                </button>
              </div>
            </>
          )}

          {/* Step 2: Intentions */}
          {step === 'intentions' && (
            <>
              {aiReflection && (
                <div className="wp-ai-reflection">
                  <span className="wp-ai-icon">✦</span>
                  {aiReflection}
                </div>
              )}
              <div className="wp-step-title">what matters most this week?</div>
              <div className="wp-prios">
                {([0, 1, 2] as const).map(i => (
                  <div key={i} className="prow">
                    <span className="pnum">{i + 1}</span>
                    <input
                      className="pinp"
                      placeholder={`priority ${i + 1}`}
                      value={priorities[i] || ''}
                      onChange={e => {
                        const p = [...priorities] as [string, string, string]
                        p[i] = e.target.value
                        setPriorities(p)
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  </div>
                ))}
              </div>
              <div className="sc-foot">
                <button className="sc-cancel" onClick={() => setStep('reflection')}>← back</button>
                <button
                  className="sc-parse"
                  onClick={async () => {
                    await generateWeekPlan()
                    setStep('preview')
                  }}
                  disabled={loading}
                >
                  {loading
                    ? <><div className="sc-dot" /><div className="sc-dot" /><div className="sc-dot" /><span>planning…</span></>
                    : '✦ generate week plan'
                  }
                </button>
              </div>
            </>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <>
              {planResult?.summary && (
                <div className="wp-ai-reflection">
                  <span className="wp-ai-icon">✦</span>
                  {planResult.summary}
                </div>
              )}

              {error && <div className="coach-error">{error}</div>}

              {planResult && (
                <div className="wp-week-grid">
                  {weekDates.map(date => {
                    const dayBlocks = blocksByDay[date] || []
                    if (!dayBlocks.length) return null
                    return (
                      <div key={date} className="wp-day">
                        <div className="wp-day-label">{dayLabel(date)}</div>
                        {dayBlocks.map((b, i) => (
                          <div key={i} className="wp-block">
                            <div className="wp-block-main">
                              <span className={`rsch-dot tc ${TYPE_DOT[b.type] || 'tf'}`} />
                              <span className="wp-block-name">{b.name}</span>
                              <span className="wp-block-time">{b.start}–{b.end}</span>
                            </div>
                            {b.reason && <div className="wp-block-reason">{b.reason}</div>}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="sc-foot">
                <button className="sc-cancel" onClick={() => setStep('intentions')}>← back</button>
                <button
                  className="sc-add"
                  onClick={applyToWeek}
                  disabled={!planResult?.plan.length}
                >
                  apply to week
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
