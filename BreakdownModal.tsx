import { useState } from 'react'
import { useStore } from '../store'
import { todayStr, weekStart, dateStr } from '../utils'

interface BreakdownBlock {
  name: string
  start: string
  end: string
  date: string
  type: string
  note?: string
}

interface Props { onClose: () => void }

export default function BreakdownModal({ onClose }: Props) {
  const { blocks, cfg, anthropicKey, addBlock, showToast, selDate } = useStore()

  const [goal, setGoal] = useState('')
  const [totalHours, setTotalHours] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ blocks: BreakdownBlock[]; plan: string } | null>(null)
  const [editedBlocks, setEditedBlocks] = useState<BreakdownBlock[]>([])
  const [error, setError] = useState('')

  const date = selDate || todayStr()
  const ws = weekStart(0)
  const weekDates = Array.from({ length: 7 }, (_, i) => dateStr(ws, i))
  const existingWeekBlocks = blocks.filter(b => weekDates.includes(b.date))

  const breakdown = async () => {
    if (!goal.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal.trim(),
          totalHours: totalHours ? Number(totalHours) : undefined,
          deadline: deadline || undefined,
          date,
          dayStart: cfg.ds,
          dayEnd: cfg.de,
          existingWeekBlocks: existingWeekBlocks.map(b => ({
            date: b.date, start: b.start, end: b.end, name: b.name, type: b.type,
          })),
          apiKey: anthropicKey || undefined,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      setEditedBlocks(data.blocks || [])
    } catch (e) {
      const msg = String(e)
      if (msg.includes('fetch') || msg.includes('Failed')) setError('server offline — start it first')
      else setError(String(e).replace('Error: ', ''))
    } finally {
      setLoading(false)
    }
  }

  const updateBlock = (i: number, field: keyof BreakdownBlock, value: string) => {
    setEditedBlocks(prev => prev.map((b, j) => j === i ? { ...b, [field]: value } : b))
  }

  const scheduleAll = () => {
    if (!editedBlocks.length) return
    editedBlocks.forEach(b => {
      addBlock({
        name: b.name,
        date: b.date || date,
        start: b.start,
        end: b.end,
        type: b.type as 'focus' | 'routine' | 'study' | 'free',
        cc: null,
        customName: null,
        repeat: 'none',
      })
    })
    showToast(`${editedBlocks.length} sessions added to your week`)
    onClose()
  }

  const TYPE_DOT: Record<string, string> = { focus: 'tf', routine: 'tr', study: 'ts', free: 'tl' }

  return (
    <div className="sc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sc-box">
        <div className="sc-hdr">
          <div className="sc-hdr-l">
            <div className="sc-icon">◈</div>
            <div>
              <div className="sc-title">break it down</div>
              <div className="sc-sub">turn a big goal into focused sessions across the week</div>
            </div>
          </div>
          <button className="sc-close" onClick={onClose}>×</button>
        </div>

        <div className="sc-body">
          {!result ? (
            <>
              <div className="bd-form">
                <label className="bd-label">what's the goal?</label>
                <input
                  className="bd-input"
                  placeholder="e.g. write thesis chapter 3, prepare presentation, learn React..."
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && goal.trim()) breakdown() }}
                  autoFocus
                />
                <div className="bd-row2">
                  <div className="bd-field">
                    <label className="bd-label-sm">total hours (optional)</label>
                    <input
                      className="bd-input-sm"
                      type="number"
                      min="1"
                      max="40"
                      placeholder="e.g. 6"
                      value={totalHours}
                      onChange={e => setTotalHours(e.target.value)}
                    />
                  </div>
                  <div className="bd-field">
                    <label className="bd-label-sm">deadline (optional)</label>
                    <input
                      className="bd-input-sm"
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && <div className="coach-error">{error}</div>}

              <div className="sc-foot">
                <button className="sc-cancel" onClick={onClose}>cancel</button>
                <button className="sc-parse" onClick={breakdown} disabled={loading || !goal.trim()}>
                  {loading
                    ? <><div className="sc-dot" /><div className="sc-dot" /><div className="sc-dot" /><span>planning…</span></>
                    : '◈ break it down'
                  }
                </button>
              </div>
            </>
          ) : (
            <>
              {result.plan && (
                <div className="bd-plan-text">{result.plan}</div>
              )}

              <div className="bd-blocks-lbl">
                {editedBlocks.length} sessions — edit any field, then schedule
              </div>

              <div className="sc-blocks">
                {editedBlocks.map((b, i) => (
                  <div key={i} className="sc-block on">
                    <div className="sc-block-body">
                      <div className="sc-block-row">
                        <input
                          className="sc-name-inp"
                          value={b.name}
                          onChange={e => updateBlock(i, 'name', e.target.value)}
                        />
                        <span className={`sc-type-dot tc ${TYPE_DOT[b.type] || 'tf'}`} />
                      </div>
                      <div className="sc-block-row sc-block-meta">
                        <input
                          className="bd-date-inp"
                          type="date"
                          value={b.date}
                          onChange={e => updateBlock(i, 'date', e.target.value)}
                        />
                        <input
                          className="sc-time-inp"
                          type="time"
                          value={b.start}
                          onChange={e => updateBlock(i, 'start', e.target.value)}
                        />
                        <span className="sc-sep">–</span>
                        <input
                          className="sc-time-inp"
                          type="time"
                          value={b.end}
                          onChange={e => updateBlock(i, 'end', e.target.value)}
                        />
                      </div>
                      {b.note && <div className="bd-note">{b.note}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {error && <div className="coach-error">{error}</div>}

              <div className="sc-foot">
                <button className="sc-cancel" onClick={() => { setResult(null); setEditedBlocks([]) }}>← try again</button>
                <button className="sc-add" onClick={scheduleAll} disabled={editedBlocks.length === 0}>
                  schedule all {editedBlocks.length} sessions
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
