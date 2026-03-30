import { useRef, useState } from 'react'
import { useStore } from '../store'
import TypedText from './TypedText'
import { todayStr, fmt, toM, toT, weekStart, dateStr } from '../utils'

interface SugAction {
  type: 'add_block'
  name: string
  start: string
  end: string
  blockType: string
}

interface Suggestion {
  text: string
  icon: string
  action?: SugAction
}

interface ProposedBlock {
  name: string
  start: string
  end: string
  date: string
  type: string
  note?: string
  selected: boolean
}

type Tab = 'analyze' | 'design' | 'plan' | 'manage' | 'study' | 'review'

function computeFreeSlots(
  blocks: Array<{ start: string; end: string }>,
  dayStart: string,
  dayEnd: string,
): Array<{ start: string; end: string; duration: number }> {
  const sorted = [...blocks].sort((a, b) => toM(a.start) - toM(b.start))
  const slots: Array<{ start: string; end: string; duration: number }> = []
  let cursor = toM(dayStart)
  const end = toM(dayEnd)
  for (const b of sorted) {
    const bs = toM(b.start)
    if (bs > cursor + 14) slots.push({ start: toT(cursor), end: b.start, duration: bs - cursor })
    cursor = Math.max(cursor, toM(b.end))
  }
  if (end > cursor + 14) slots.push({ start: toT(cursor), end: toT(end), duration: end - cursor })
  return slots
}

function nextDayStr(fromDate: string): string {
  const d = new Date(fromDate + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AICoach({ onClose }: { onClose: () => void }) {
  const { blocks, cfg, anthropicKey, selDate, addBlock, updateBlock, deleteBlock, showToast, goals, intentions } = useStore()
  const coachDefaultTab = useStore(s => s.coachDefaultTab) as Tab
  const date = selDate || todayStr()
  const todayBlocks = blocks
    .filter(b => b.date === date)
    .sort((a, b) => toM(a.start) - toM(b.start))

  const [tab, setTab] = useState<Tab>(coachDefaultTab || 'analyze')

  // Analyze tab
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetched, setFetched] = useState(false)
  const [applied, setApplied] = useState<Set<number>>(new Set())

  // Design my day tab
  const [designLoading, setDesignLoading] = useState(false)
  const [designError, setDesignError] = useState('')
  const [designBlocks, setDesignBlocks] = useState<ProposedBlock[]>([])
  const [designMsg, setDesignMsg] = useState('')
  const [designFetched, setDesignFetched] = useState(false)
  const [designContext, setDesignContext] = useState('')

  // Plan tab
  const [planDesc, setPlanDesc] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [planMessage, setPlanMessage] = useState('')
  const [proposed, setProposed] = useState<ProposedBlock[]>([])
  const [planFetched, setPlanFetched] = useState(false)

  // Study tab
  const [studyGoal, setStudyGoal] = useState('')
  const [studyHours, setStudyHours] = useState('4')
  const [studyDeadline, setStudyDeadline] = useState('')
  const [studyLoading, setStudyLoading] = useState(false)
  const [studyError, setStudyError] = useState('')
  const [studyPlan, setStudyPlan] = useState('')
  const [studyBlocks, setStudyBlocks] = useState<ProposedBlock[]>([])
  const [studyFetched, setStudyFetched] = useState(false)

  // Review tab
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [reviewFetched, setReviewFetched] = useState(false)

  // Manage tab
  const [aiEditInput, setAiEditInput] = useState('')
  const [aiEditLoading, setAiEditLoading] = useState(false)
  const [aiEditResult, setAiEditResult] = useState('')
  const [swapMode, setSwapMode] = useState(false)
  const [swapSelected, setSwapSelected] = useState<number[]>([])
  const [inlineEditId, setInlineEditId] = useState<number | null>(null)
  const [inlineEditVal, setInlineEditVal] = useState('')
  const [inlineTimeId, setInlineTimeId] = useState<number | null>(null)
  const [inlineStart, setInlineStart] = useState('')
  const [inlineEnd, setInlineEnd] = useState('')
  const [moveDateId, setMoveDateId] = useState<number | null>(null)
  const inlineRef = useRef<HTMLInputElement>(null)

  const int = intentions[date] || { e: 0, p: ['', '', ''] }
  const energyLabels = ['not set', 'low', 'medium', 'peak']

  // Build goals context for prompts
  const goalsContext = goals.map(g => {
    const period = g.targetPeriod || 'weekly'
    const unit = g.targetUnit || 'hours'
    const since = new Date()
    if (period === 'monthly') since.setDate(since.getDate() - 30)
    else if (period === 'weekly') since.setDate(since.getDate() - 7)
    const sinceStr = since.toISOString().slice(0, 10)
    const totalMins = blocks
      .filter(b => b.goalId === g.id && (period === 'daily' ? b.date === sinceStr : b.date >= sinceStr))
      .reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
    const actual = unit === 'minutes' ? totalMins : Math.round(totalMins / 60 * 10) / 10
    return { name: g.name, targetAmount: g.targetHours, targetUnit: unit, targetPeriod: period, actualAmount: actual, description: g.description }
  })

  const analyze = async () => {
    setLoading(true); setError(''); setApplied(new Set())
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: todayBlocks.map(b => ({ start: b.start, end: b.end, name: b.name, type: b.type })),
          goals: goalsContext,
          priorities: int.p.filter(Boolean),
          energy: energyLabels[int.e],
          date, apiKey: anthropicKey || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuggestions(data.suggestions || [])
      setFetched(true)
    } catch (e) { setError(String(e).replace('Error: ', '')) }
    finally { setLoading(false) }
  }

  const designDay = async () => {
    setDesignLoading(true); setDesignError(''); setDesignBlocks([]); setDesignMsg(''); setDesignFetched(false)
    try {
      const freeSlots = computeFreeSlots(todayBlocks, cfg.ds, cfg.de)
      const res = await fetch('/api/build-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, dayStart: cfg.ds, dayEnd: cfg.de,
          energy: int.e, priorities: int.p.filter(Boolean),
          goals: goalsContext,
          existingBlocks: todayBlocks.map(b => ({ start: b.start, end: b.end, name: b.name, type: b.type })),
          freeSlots,
          extraContext: designContext.trim() || undefined,
          apiKey: anthropicKey || undefined,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (Array.isArray(data) && data.length > 0) {
        setDesignBlocks(data.map((b: any) => ({ ...b, date, selected: true })))
      } else if (data.blocks) {
        setDesignBlocks(data.blocks.map((b: any) => ({ ...b, date, selected: true })))
        setDesignMsg(data.message || '')
      } else {
        showToast('no free slots to fill')
      }
      setDesignFetched(true)
    } catch (e) {
      const msg = String(e)
      if (msg.includes('fetch') || msg.includes('Failed')) setDesignError('server offline — start it first')
      else setDesignError(msg.replace('Error: ', ''))
    }
    finally { setDesignLoading(false) }
  }

  const addDesignBlocks = () => {
    const toAdd = designBlocks.filter(b => b.selected)
    toAdd.forEach(b => addBlock({ date, name: b.name, type: (b.type as any) || 'focus', start: b.start, end: b.end, cc: null, customName: null }))
    showToast(`added ${toAdd.length} block${toAdd.length !== 1 ? 's' : ''} to your day`)
    setDesignBlocks([]); setDesignFetched(false)
  }

  const reviewDay = async () => {
    setReviewLoading(true); setReviewError(''); setReviewText(''); setReviewFetched(false)
    try {
      const focusMins = todayBlocks.filter(b => b.type === 'focus').reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'review',
          blocks: todayBlocks.map(b => ({ start: b.start, end: b.end, name: b.name, type: b.type })),
          priorities: int.p.filter(Boolean),
          energy: energyLabels[int.e],
          goals: goalsContext,
          focusHours: Math.round(focusMins / 60 * 10) / 10,
          date, apiKey: anthropicKey || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReviewText(data.review || data.suggestions?.map((s: any) => `${s.icon || '•'} ${s.text}`).join('\n\n') || 'no review available')
      setReviewFetched(true)
    } catch (e) { setReviewError(String(e).replace('Error: ', '')) }
    finally { setReviewLoading(false) }
  }

  const applySuggestion = (i: number, action: SugAction) => {
    addBlock({ date, name: action.name, type: (action.blockType as any) || 'routine', start: action.start, end: action.end, cc: null, customName: null })
    setApplied(prev => new Set([...prev, i]))
    showToast(`added "${action.name}" at ${action.start}`)
  }

  const planDay = async () => {
    if (!planDesc.trim()) return
    setPlanLoading(true); setPlanError(''); setPlanMessage(''); setProposed([]); setPlanFetched(false)
    try {
      const freeSlots = computeFreeSlots(todayBlocks, cfg.ds, cfg.de)
      const res = await fetch('/api/fill-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: planDesc, freeSlots,
          existingBlocks: todayBlocks.map(b => ({ start: b.start, end: b.end, name: b.name, type: b.type })),
          date, dayStart: cfg.ds, dayEnd: cfg.de, apiKey: anthropicKey || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setProposed((data.blocks || []).map((b: any) => ({ ...b, date, selected: true })))
      setPlanMessage(data.message || '')
      setPlanFetched(true)
    } catch (e) { setPlanError(String(e).replace('Error: ', '')) }
    finally { setPlanLoading(false) }
  }

  const planStudy = async () => {
    if (!studyGoal.trim()) return
    setStudyLoading(true); setStudyError(''); setStudyPlan(''); setStudyBlocks([]); setStudyFetched(false)
    try {
      const ws = weekStart(0)
      const weekDates = Array.from({ length: 7 }, (_, i) => dateStr(ws, i))
      const weekBlocks = blocks.filter(b => weekDates.includes(b.date))
      const res = await fetch('/api/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: studyGoal, totalHours: parseFloat(studyHours) || undefined,
          deadline: studyDeadline || undefined, date, dayStart: cfg.ds, dayEnd: cfg.de,
          existingWeekBlocks: weekBlocks.map(b => ({ date: b.date, start: b.start, end: b.end, name: b.name, type: b.type })),
          apiKey: anthropicKey || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStudyBlocks((data.blocks || []).map((b: any) => ({ ...b, selected: true })))
      setStudyPlan(data.plan || '')
      setStudyFetched(true)
    } catch (e) { setStudyError(String(e).replace('Error: ', '')) }
    finally { setStudyLoading(false) }
  }

  const addSelected = () => {
    const toAdd = proposed.filter(b => b.selected)
    toAdd.forEach(b => addBlock({ date: b.date || date, name: b.name, type: (b.type as any) || 'focus', start: b.start, end: b.end, cc: null, customName: null }))
    showToast(`added ${toAdd.length} block${toAdd.length !== 1 ? 's' : ''} to your day`)
    setProposed([]); setPlanFetched(false); setPlanDesc('')
  }

  const addStudySessions = () => {
    const toAdd = studyBlocks.filter(b => b.selected)
    toAdd.forEach(b => addBlock({ date: b.date || date, name: b.name, type: 'study', start: b.start, end: b.end, cc: null, customName: null }))
    showToast(`added ${toAdd.length} study session${toAdd.length !== 1 ? 's' : ''} to your calendar`)
    setStudyBlocks([]); setStudyFetched(false); setStudyGoal('')
  }

  // ── Manage helpers ──
  const adjustDuration = (b: typeof todayBlocks[0], deltaMinutes: number) => {
    const newEnd = toT(Math.max(toM(b.start) + 15, Math.min(toM(cfg.de), toM(b.end) + deltaMinutes)))
    updateBlock(b.id, { end: newEnd })
  }

  const setDuration = (b: typeof todayBlocks[0], minutes: number) => {
    const newEnd = toT(Math.min(toM(cfg.de), toM(b.start) + minutes))
    updateBlock(b.id, { end: newEnd })
    showToast(`${b.name} → ${minutes}m`)
  }

  const shiftBlock = (b: typeof todayBlocks[0], deltaMinutes: number) => {
    const newStart = toT(Math.max(toM(cfg.ds), Math.min(toM(cfg.de) - 15, toM(b.start) + deltaMinutes)))
    const dur = toM(b.end) - toM(b.start)
    updateBlock(b.id, { start: newStart, end: toT(Math.min(toM(cfg.de), toM(newStart) + dur)) })
  }

  const moveToDate = (b: typeof todayBlocks[0], targetDate: string) => {
    updateBlock(b.id, { date: targetDate })
    showToast(`"${b.name}" → ${targetDate}`)
    setMoveDateId(null)
  }

  const handleSwapClick = (id: number) => {
    if (!swapMode) return
    const next = swapSelected.includes(id) ? swapSelected.filter(x => x !== id) : [...swapSelected, id]
    if (next.length === 2) {
      const [a, b] = next.map(id => todayBlocks.find(bl => bl.id === id)!)
      if (a && b) {
        updateBlock(a.id, { start: b.start, end: b.end })
        updateBlock(b.id, { start: a.start, end: a.end })
        showToast(`swapped "${a.name}" ↔ "${b.name}"`)
      }
      setSwapSelected([]); setSwapMode(false)
    } else {
      setSwapSelected(next)
    }
  }

  const pushAllRemaining = (deltaMinutes: number) => {
    const now = new Date()
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const remaining = todayBlocks.filter(b => b.start >= nowStr)
    remaining.forEach(b => {
      const newStart = toT(Math.min(toM(cfg.de) - 15, toM(b.start) + deltaMinutes))
      const dur = toM(b.end) - toM(b.start)
      updateBlock(b.id, { start: newStart, end: toT(Math.min(toM(cfg.de), toM(newStart) + dur)) })
    })
    showToast(`shifted ${remaining.length} remaining block${remaining.length !== 1 ? 's' : ''} by +${deltaMinutes}m`)
  }

  const compressGaps = () => {
    const sorted = [...todayBlocks].sort((a, b) => toM(a.start) - toM(b.start))
    let cursor = toM(cfg.ds)
    sorted.forEach(b => {
      const dur = toM(b.end) - toM(b.start)
      if (toM(b.start) > cursor + 14) {
        updateBlock(b.id, { start: toT(cursor), end: toT(cursor + dur) })
        cursor = cursor + dur
      } else {
        cursor = toM(b.end)
      }
    })
    showToast('gaps compressed')
  }

  const aiEdit = async () => {
    if (!aiEditInput.trim()) return
    setAiEditLoading(true); setAiEditResult('')
    try {
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: todayBlocks.map(b => ({ id: b.id, name: b.name, start: b.start, end: b.end, date: b.date, type: b.type })),
          instruction: aiEditInput, date, dayStart: cfg.ds, dayEnd: cfg.de,
          apiKey: anthropicKey || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      ;(data.blocks || []).forEach((nb: { id: number; name: string; start: string; end: string; date: string; type: string }) => {
        const original = todayBlocks.find(b => b.id === nb.id)
        if (original) updateBlock(nb.id, { name: nb.name, start: nb.start, end: nb.end, date: nb.date, type: nb.type as any })
      })
      setAiEditResult(data.summary || 'done')
      setAiEditInput('')
    } catch (e) {
      setAiEditResult(`error: ${String(e).replace('Error: ', '')}`)
    } finally {
      setAiEditLoading(false)
    }
  }

  const commitInlineName = (b: typeof todayBlocks[0]) => {
    const val = inlineEditVal.trim()
    if (val && val !== b.name) { updateBlock(b.id, { name: val }); showToast('renamed') }
    setInlineEditId(null)
  }

  const commitInlineTime = (b: typeof todayBlocks[0]) => {
    if (inlineStart && inlineEnd && inlineStart < inlineEnd) {
      updateBlock(b.id, { start: inlineStart, end: inlineEnd })
      showToast(`rescheduled to ${inlineStart}–${inlineEnd}`)
    }
    setInlineTimeId(null)
  }

  const typeColors: Record<string, string> = {
    focus: '#FFB8A0', routine: '#95CFA0', study: '#A0AAFF', free: '#F0D080',
  }

  const dur = (b: { start: string; end: string }) => toM(b.end) - toM(b.start)

  const MODES: Array<{ id: Tab; icon: string; label: string; desc: string }> = [
    { id: 'analyze',  icon: '✦',  label: 'check in',      desc: 'feedback on today\'s plan' },
    { id: 'design',   icon: '◎',  label: 'design my day', desc: 'build schedule from goals' },
    { id: 'plan',     icon: '＋',  label: 'fill my gaps',  desc: 'fit tasks into free slots' },
    { id: 'manage',   icon: '✏',  label: 'edit schedule', desc: 'change things in plain english' },
    { id: 'study',    icon: '◈',  label: 'study prep',    desc: 'build a focused study plan' },
    { id: 'review',   icon: '◐',  label: 'day review',    desc: 'reflect on how it went' },
  ]

  return (
    <div className="coach-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="coach-box">
        <div className="coach-hdr">
          <div className="coach-title-row">
            <div className="coach-icon">✦</div>
            <div>
              <div className="coach-title">AI coach</div>
              <div className="coach-sub">what would you like to do?</div>
            </div>
          </div>
          <button className="coach-close" onClick={onClose}>×</button>
        </div>

        {/* ── Mode picker cards ── */}
        <div className="coach-mode-grid coach-mode-grid-6">
          {MODES.map(m => (
            <button key={m.id}
              className={`coach-mode-card${tab === m.id ? ' on' : ''}`}
              onClick={() => setTab(m.id)}>
              <span className="cmc-icon">{m.icon}</span>
              <span className="cmc-label">{m.label}</span>
              <span className="cmc-desc">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* ── ANALYZE ── */}
        {tab === 'analyze' && (
          <div className="coach-simple-body">
            {fetched && suggestions.length > 0 && (
              <div className="coach-results">
                <div className="coach-results-lbl">suggestions</div>
                {suggestions.map((s, i) => (
                  <div key={i} className={`coach-suggestion${applied.has(i) ? ' applied' : ''}`}>
                    <span className="coach-sug-icon">{s.icon || '●'}</span>
                    <span className="coach-sug-text">
                      <TypedText text={s.text} speed={12} delay={i * 180} />
                    </span>
                    {s.action && !applied.has(i) && (
                      <button className="coach-sug-apply" onClick={() => applySuggestion(i, s.action!)}
                        title={`Add "${s.action.name}" at ${s.action.start}–${s.action.end}`}>apply</button>
                    )}
                    {applied.has(i) && <span className="coach-sug-done">✓ added</span>}
                  </div>
                ))}
              </div>
            )}
            {error && <div className="coach-error">{error}</div>}
            <button className={`coach-analyze-btn${loading ? ' loading' : ''}`} onClick={analyze} disabled={loading || todayBlocks.length === 0}>
              {loading ? <><span className="coach-spin" />analyzing…</> : fetched ? '↻ analyze again' : '✦ analyze my day'}
            </button>
          </div>
        )}

        {/* ── DESIGN MY DAY ── */}
        {tab === 'design' && (
          <div className="coach-simple-body">
            <div className="coach-design-context">
              {/* Show energy + priorities + goals as context chips */}
              {int.e > 0 && (
                <div className="cdc-row">
                  <span className="cdc-lbl">energy</span>
                  <span className="cdc-chip">{energyLabels[int.e]}</span>
                </div>
              )}
              {int.p.filter(Boolean).length > 0 && (
                <div className="cdc-row">
                  <span className="cdc-lbl">priorities</span>
                  <div className="cdc-chips">
                    {int.p.filter(Boolean).map((p, i) => <span key={i} className="cdc-chip">{p}</span>)}
                  </div>
                </div>
              )}
              {goalsContext.length > 0 && (
                <div className="cdc-row">
                  <span className="cdc-lbl">goals</span>
                  <div className="cdc-chips">
                    {goalsContext.map((g, i) => (
                      <span key={i} className="cdc-chip" style={{ borderColor: goals[i]?.color, color: goals[i]?.color }}>
                        {g.name} · {g.actualAmount}{g.targetUnit === 'minutes' ? 'min' : 'h'}/{g.targetAmount}{g.targetUnit === 'minutes' ? 'min' : 'h'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <textarea
              className="coach-plan-input"
              placeholder='any extra context? (e.g. "i have a meeting at 3pm", "feeling tired today", "need to finish report by EOD")'
              value={designContext}
              onChange={e => setDesignContext(e.target.value)}
              rows={2}
            />
            {designFetched && designBlocks.length > 0 && (
              <div className="coach-proposed">
                <div className="coach-proposed-lbl">your designed day</div>
                {designMsg && <div className="coach-plan-msg"><TypedText text={designMsg} speed={14} /></div>}
                {designBlocks.map((b, i) => (
                  <div key={i} className={`coach-proposed-block coach-chip-${b.type}${b.selected ? ' selected' : ''}`}
                    onClick={() => setDesignBlocks(prev => prev.map((pb, idx) => idx === i ? { ...pb, selected: !pb.selected } : pb))}>
                    <div className={`coach-proposed-check${b.selected ? ' on' : ''}`}>{b.selected ? '✓' : ''}</div>
                    <div className="coach-proposed-info">
                      <span className="coach-chip-time">{b.start}–{b.end}</span>
                      <span className="coach-chip-name">{b.name}</span>
                    </div>
                    <span className={`coach-proposed-tag coach-proposed-tag-${b.type}`}>{b.type}</span>
                  </div>
                ))}
                <button className="coach-add-selected-btn" onClick={addDesignBlocks} disabled={designBlocks.filter(b => b.selected).length === 0}>
                  + add {designBlocks.filter(b => b.selected).length} selected to day
                </button>
              </div>
            )}
            {designError && <div className="coach-error">{designError}</div>}
            <button className={`coach-analyze-btn${designLoading ? ' loading' : ''}`} onClick={designDay} disabled={designLoading}>
              {designLoading ? <><span className="coach-spin" />designing…</> : designFetched ? '↻ redesign' : '◎ design my day'}
            </button>
          </div>
        )}

        {/* ── PLAN ── */}
        {tab === 'plan' && (
          <div className="coach-simple-body">
            <div className="coach-plan-lbl">what do you want to fit in today?</div>
            <textarea
              className="coach-plan-input"
              placeholder={'e.g. "study calculus 2h, call mom 15min, 30min run, write essay 1.5h"'}
              value={planDesc}
              onChange={e => setPlanDesc(e.target.value)}
              rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) planDay() }}
            />
            {planFetched && proposed.length > 0 && (
              <div className="coach-proposed">
                <div className="coach-proposed-lbl">proposed slots</div>
                {planMessage && <div className="coach-plan-msg"><TypedText text={planMessage} speed={14} /></div>}
                {proposed.map((b, i) => (
                  <div key={i} className={`coach-proposed-block coach-chip-${b.type}${b.selected ? ' selected' : ''}`}
                    onClick={() => setProposed(prev => prev.map((pb, idx) => idx === i ? { ...pb, selected: !pb.selected } : pb))}>
                    <div className={`coach-proposed-check${b.selected ? ' on' : ''}`}>{b.selected ? '✓' : ''}</div>
                    <div className="coach-proposed-info">
                      <span className="coach-chip-time">{b.start}–{b.end}</span>
                      <span className="coach-chip-name">{b.name}</span>
                    </div>
                    <span className={`coach-proposed-tag coach-proposed-tag-${b.type}`}>{b.type}</span>
                  </div>
                ))}
                <button className="coach-add-selected-btn" onClick={addSelected} disabled={proposed.filter(b => b.selected).length === 0}>
                  + add {proposed.filter(b => b.selected).length} selected to day
                </button>
              </div>
            )}
            {planError && <div className="coach-error">{planError}</div>}
            <button className={`coach-analyze-btn${planLoading ? ' loading' : ''}`} onClick={planDay} disabled={planLoading || !planDesc.trim()}>
              {planLoading ? <><span className="coach-spin" />finding slots…</> : planFetched ? '↻ re-plan' : '✦ find slots'}
            </button>
          </div>
        )}

        {/* ── STUDY ── */}
        {tab === 'study' && (
          <div className="coach-plan-body">
            <div className="coach-plan-lbl">what's the goal?</div>
            <textarea
              className="coach-plan-input"
              placeholder={'e.g. "organic chemistry final", "investor pitch deck", "half marathon in 6 weeks"'}
              value={studyGoal}
              onChange={e => setStudyGoal(e.target.value)}
              rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) planStudy() }}
            />
            <div className="coach-study-row">
              <div className="coach-study-field">
                <label className="coach-plan-lbl">total hours needed</label>
                <input className="coach-study-inp" type="number" min="1" max="40" step="0.5" value={studyHours}
                  onChange={e => setStudyHours(e.target.value)} placeholder="4" />
              </div>
              <div className="coach-study-field">
                <label className="coach-plan-lbl">deadline (optional)</label>
                <input className="coach-study-inp" type="date" value={studyDeadline} onChange={e => setStudyDeadline(e.target.value)} />
              </div>
            </div>
            {studyFetched && studyBlocks.length > 0 && (
              <div className="coach-proposed">
                <div className="coach-proposed-lbl">study plan · {studyBlocks.length} sessions</div>
                {studyPlan && <div className="coach-plan-msg"><TypedText text={studyPlan} speed={10} /></div>}
                {studyBlocks.map((b, i) => (
                  <div key={i} className={`coach-proposed-block coach-chip-study${b.selected ? ' selected' : ''}`}
                    onClick={() => setStudyBlocks(prev => prev.map((sb, idx) => idx === i ? { ...sb, selected: !sb.selected } : sb))}>
                    <div className={`coach-proposed-check${b.selected ? ' on' : ''}`}>{b.selected ? '✓' : ''}</div>
                    <div className="coach-proposed-info">
                      <span className="coach-chip-time">{b.date} · {b.start}–{b.end}</span>
                      <span className="coach-chip-name">{b.name}</span>
                      {b.note && <span className="coach-study-note">{b.note}</span>}
                    </div>
                  </div>
                ))}
                <button className="coach-add-selected-btn" onClick={addStudySessions}
                  disabled={studyBlocks.filter(b => b.selected).length === 0}>
                  + add {studyBlocks.filter(b => b.selected).length} session{studyBlocks.filter(b => b.selected).length !== 1 ? 's' : ''} to calendar
                </button>
              </div>
            )}
            {studyError && <div className="coach-error">{studyError}</div>}
            <button className={`coach-analyze-btn${studyLoading ? ' loading' : ''}`} onClick={planStudy} disabled={studyLoading || !studyGoal.trim()}>
              {studyLoading ? <><span className="coach-spin" />building plan…</> : studyFetched ? '↻ rebuild plan' : '◈ build prep plan'}
            </button>
          </div>
        )}

        {/* ── REVIEW ── */}
        {tab === 'review' && (
          <div className="coach-simple-body">
            <div className="coach-review-context">
              <div className="coach-plan-lbl" style={{ marginBottom: 8 }}>today's summary</div>
              <div className="crc-stats">
                <div className="crc-stat">
                  <span className="crc-val">{todayBlocks.length}</span>
                  <span className="crc-lbl">blocks</span>
                </div>
                <div className="crc-stat">
                  <span className="crc-val">{Math.round(todayBlocks.filter(b => b.type === 'focus').reduce((s, b) => s + toM(b.end) - toM(b.start), 0) / 60 * 10) / 10}h</span>
                  <span className="crc-lbl">focused</span>
                </div>
                <div className="crc-stat">
                  <span className="crc-val">{int.p.filter(Boolean).length}</span>
                  <span className="crc-lbl">priorities set</span>
                </div>
              </div>
              {goalsContext.length > 0 && (
                <div className="crc-goals">
                  {goalsContext.map((g, i) => {
                    const pct = Math.min(100, Math.round((g.actualAmount / g.targetAmount) * 100))
                    return (
                      <div key={i} className="crc-goal-row">
                        <div className="crc-gdot" style={{ background: goals[i]?.color || 'var(--acc)' }} />
                        <span className="crc-gname">{g.name}</span>
                        <div className="crc-gbar"><div className="crc-gfill" style={{ width: `${pct}%`, background: goals[i]?.color || 'var(--acc)' }} /></div>
                        <span className="crc-gpct">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {reviewFetched && reviewText && (
              <div className="coach-review-output">
                <TypedText text={reviewText} speed={10} />
              </div>
            )}
            {reviewError && <div className="coach-error">{reviewError}</div>}
            <button className={`coach-analyze-btn${reviewLoading ? ' loading' : ''}`} onClick={reviewDay} disabled={reviewLoading || todayBlocks.length === 0}>
              {reviewLoading ? <><span className="coach-spin" />reflecting…</> : reviewFetched ? '↻ review again' : '◐ review my day'}
            </button>
          </div>
        )}

        {/* ── MANAGE ── */}
        {tab === 'manage' && (
          <div className="coach-manage">
            <div className="cmg-ai-row">
              <input
                className="cmg-ai-inp"
                placeholder='e.g. "move deep work to 3pm", "swap my run with lunch", "push everything +30m"'
                value={aiEditInput}
                onChange={e => setAiEditInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') aiEdit() }}
                disabled={aiEditLoading}
              />
              <button className={`cmg-ai-btn${aiEditLoading ? ' loading' : ''}`} onClick={aiEdit} disabled={aiEditLoading || !aiEditInput.trim()}>
                {aiEditLoading ? <span className="coach-spin" /> : '✦'}
              </button>
            </div>
            {aiEditResult && (
              <div className="cmg-ai-result">
                <span className="cmg-ai-check">✓</span> <TypedText text={aiEditResult} speed={14} />
                <button className="cmg-ai-dismiss" onClick={() => setAiEditResult('')}>×</button>
              </div>
            )}
            <div className="cmg-bulk-row">
              <span className="cmg-bulk-lbl">bulk</span>
              <button className="cmg-bulk-btn" onClick={() => pushAllRemaining(15)}>+15m all</button>
              <button className="cmg-bulk-btn" onClick={() => pushAllRemaining(30)}>+30m all</button>
              <button className="cmg-bulk-btn" onClick={compressGaps}>compress</button>
              <button className={`cmg-bulk-btn${swapMode ? ' active' : ''}`} onClick={() => { setSwapMode(v => !v); setSwapSelected([]) }}>
                {swapMode ? `swap (${swapSelected.length}/2)` : 'swap ↔'}
              </button>
            </div>
            <div className="cmg-block-list">
              {todayBlocks.length === 0 ? (
                <div className="coach-empty-sched">no blocks — add some first</div>
              ) : todayBlocks.map(b => {
                const isSwapSel = swapSelected.includes(b.id)
                const isEditingName = inlineEditId === b.id
                const isEditingTime = inlineTimeId === b.id
                const isMovingDate = moveDateId === b.id
                const blockDur = dur(b)
                return (
                  <div key={b.id} className={`cmg-block${isSwapSel ? ' swap-sel' : ''}${swapMode ? ' swap-mode' : ''}`}
                    onClick={() => swapMode && handleSwapClick(b.id)}>
                    <div className="cmg-top">
                      <div className="cmg-dot" style={{ background: typeColors[b.type] || 'var(--bd2)' }} />
                      {isEditingName ? (
                        <input ref={inlineRef} className="cmg-name-inp" value={inlineEditVal}
                          onChange={e => setInlineEditVal(e.target.value)}
                          onBlur={() => commitInlineName(b)}
                          onKeyDown={e => { if (e.key === 'Enter') commitInlineName(b); if (e.key === 'Escape') setInlineEditId(null) }}
                          autoFocus />
                      ) : (
                        <span className="cmg-name" onClick={e => { e.stopPropagation(); setInlineEditId(b.id); setInlineEditVal(b.name) }}
                          title="click to rename">{b.name}</span>
                      )}
                      {isEditingTime ? (
                        <div className="cmg-time-edit" onClick={e => e.stopPropagation()}>
                          <input className="cmg-t-inp" type="time" value={inlineStart} onChange={e => setInlineStart(e.target.value)} />
                          <span>–</span>
                          <input className="cmg-t-inp" type="time" value={inlineEnd} onChange={e => setInlineEnd(e.target.value)} />
                          <button className="cmg-t-save" onClick={() => commitInlineTime(b)}>✓</button>
                          <button className="cmg-t-cancel" onClick={() => setInlineTimeId(null)}>×</button>
                        </div>
                      ) : (
                        <span className="cmg-time" onClick={e => { e.stopPropagation(); setInlineTimeId(b.id); setInlineStart(b.start); setInlineEnd(b.end) }}
                          title="click to edit time">{b.start}–{b.end}
                          <span className="cmg-dur-badge">{blockDur}m</span>
                        </span>
                      )}
                      <button className="cmg-del" onClick={e => { e.stopPropagation(); deleteBlock(b.id); showToast(`deleted "${b.name}"`) }}>×</button>
                    </div>
                    {!swapMode && (
                      <div className="cmg-controls">
                        <div className="cmg-ctrl-grp">
                          <span className="cmg-ctrl-lbl">shift</span>
                          <button className="cmg-ctrl-btn" onClick={e => { e.stopPropagation(); shiftBlock(b, -30) }}>−30m</button>
                          <button className="cmg-ctrl-btn" onClick={e => { e.stopPropagation(); shiftBlock(b, -15) }}>−15m</button>
                          <button className="cmg-ctrl-btn" onClick={e => { e.stopPropagation(); shiftBlock(b, +15) }}>+15m</button>
                          <button className="cmg-ctrl-btn" onClick={e => { e.stopPropagation(); shiftBlock(b, +30) }}>+30m</button>
                        </div>
                        <div className="cmg-ctrl-grp">
                          <span className="cmg-ctrl-lbl">set dur</span>
                          {[30, 45, 60, 90, 120].map(m => (
                            <button key={m} className={`cmg-ctrl-btn${blockDur === m ? ' on' : ''}`}
                              onClick={e => { e.stopPropagation(); setDuration(b, m) }}>
                              {m >= 60 ? `${m / 60}h` : `${m}m`}
                            </button>
                          ))}
                        </div>
                        <div className="cmg-ctrl-grp">
                          <span className="cmg-ctrl-lbl">move to</span>
                          <button className="cmg-ctrl-btn" onClick={e => { e.stopPropagation(); moveToDate(b, nextDayStr(date)) }}>tmrw</button>
                          {isMovingDate ? (
                            <>
                              <input className="cmg-date-inp" type="date" defaultValue={date}
                                onChange={e => { if (e.target.value) moveToDate(b, e.target.value) }}
                                onClick={e => e.stopPropagation()} />
                              <button className="cmg-ctrl-btn" onClick={e => { e.stopPropagation(); setMoveDateId(null) }}>×</button>
                            </>
                          ) : (
                            <button className="cmg-ctrl-btn" onClick={e => { e.stopPropagation(); setMoveDateId(b.id) }}>pick date</button>
                          )}
                        </div>
                      </div>
                    )}
                    {swapMode && isSwapSel && (
                      <div className="cmg-swap-hint">selected — pick one more to swap ↔</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!anthropicKey && (tab === 'analyze' || tab === 'design' || tab === 'plan' || tab === 'study' || tab === 'review') && (
          <div className="coach-nokey">add your Anthropic API key in settings to use AI coach</div>
        )}
      </div>
    </div>
  )
}
