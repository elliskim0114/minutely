import { useState } from 'react'
import { useStore } from '../store'
import { todayStr } from '../utils'
import { toM } from '../utils'

const GOAL_COLORS = ['#FF4D1C', '#6C63FF', '#059669', '#0EA5E9', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6']

function getDateRange(period: 'daily' | 'weekly' | 'monthly'): string {
  const d = new Date()
  if (period === 'daily') return d.toISOString().slice(0, 10)
  if (period === 'monthly') { d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export default function GoalsModal({ onClose }: { onClose: () => void }) {
  const { goals, blocks, addGoal, updateGoal, deleteGoal } = useStore()
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(GOAL_COLORS[0])
  const [targetAmount, setTargetAmount] = useState(10)
  const [targetUnit, setTargetUnit] = useState<'hours' | 'minutes'>('hours')
  const [targetPeriod, setTargetPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [description, setDescription] = useState('')

  const today = todayStr()

  const goalActual = (gid: number, unit: 'hours' | 'minutes' = 'hours', period: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
    const since = getDateRange(period)
    const filtered = blocks.filter(b =>
      b.goalId === gid && (period === 'daily' ? b.date === since : b.date >= since)
    )
    const totalMins = filtered.reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
    return unit === 'minutes' ? totalMins : Math.round((totalMins / 60) * 10) / 10
  }

  const periodLabel = (p: 'daily' | 'weekly' | 'monthly') =>
    p === 'daily' ? 'today' : p === 'weekly' ? 'this week' : 'this month'

  const resetForm = () => {
    setName(''); setColor(GOAL_COLORS[0]); setTargetAmount(10)
    setTargetUnit('hours'); setTargetPeriod('weekly'); setDescription('')
    setAdding(false); setEditId(null)
  }

  const save = () => {
    if (!name.trim()) return
    const payload = { name: name.trim(), color, targetHours: targetAmount, targetUnit, targetPeriod, description: description.trim() || undefined }
    if (editId !== null) updateGoal(editId, payload)
    else addGoal(payload)
    resetForm()
  }

  const startEdit = (g: typeof goals[0]) => {
    setEditId(g.id); setName(g.name); setColor(g.color)
    setTargetAmount(g.targetHours); setTargetUnit(g.targetUnit || 'hours')
    setTargetPeriod(g.targetPeriod || 'weekly'); setDescription(g.description || '')
    setAdding(true)
  }

  return (
    <div className="goals-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="goals-box">
        <div className="goals-hdr">
          <div className="goals-title">goals</div>
          <button className="goals-close" onClick={onClose}>×</button>
        </div>

        <div className="goals-sub">track your bigger-picture objectives. link blocks to goals to measure progress.</div>

        {goals.length === 0 && !adding && (
          <div className="goals-empty">no goals yet — add one to start tracking your progress</div>
        )}

        <div className="goals-list">
          {goals.map(g => {
            const unit = g.targetUnit || 'hours'
            const period = g.targetPeriod || 'weekly'
            const actual = goalActual(g.id, unit, period)
            const pct = Math.min(100, Math.round((actual / g.targetHours) * 100))
            const unitSuffix = unit === 'minutes' ? 'min' : 'h'
            return (
              <div key={g.id} className="goal-item">
                <div className="gi-top">
                  <div className="gi-dot" style={{ background: g.color }} />
                  <div className="gi-info">
                    <div className="gi-name">{g.name}</div>
                    {g.description && <div className="gi-desc">{g.description}</div>}
                  </div>
                  <div className="gi-stat">
                    <span className="gi-actual">{actual}{unitSuffix}</span>
                    <span className="gi-sep">/</span>
                    <span className="gi-target">{g.targetHours}{unitSuffix} / {period === 'daily' ? 'day' : period === 'monthly' ? 'mo' : 'wk'}</span>
                  </div>
                  <div className="gi-acts">
                    <button className="gi-edit" onClick={() => startEdit(g)}>edit</button>
                    <button className="gi-del" onClick={() => { if (confirm(`Delete "${g.name}"?`)) deleteGoal(g.id) }}>×</button>
                  </div>
                </div>
                <div className="gi-bar">
                  <div className="gi-fill" style={{ width: `${pct}%`, background: g.color }} />
                </div>
                <div className="gi-pct-row">
                  <span className="gi-pct">{pct}% of {period} target ({periodLabel(period)})</span>
                  {pct >= 100 && <span className="gi-done">✓ done!</span>}
                </div>
              </div>
            )
          })}
        </div>

        {adding ? (
          <div className="goal-form">
            <div className="gf-ttl">{editId !== null ? 'edit goal' : 'new goal'}</div>
            <input
              className="gf-inp"
              placeholder="goal name (e.g. deep work, fitness, reading)"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') resetForm() }}
              autoFocus
            />
            <input
              className="gf-inp"
              placeholder="description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />

            {/* Period selector */}
            <div className="gf-row" style={{ marginBottom: 8 }}>
              <span className="gf-lbl" style={{ marginBottom: 4, display: 'block' }}>tracking period</span>
              <div className="gf-period-tabs">
                {(['daily', 'weekly', 'monthly'] as const).map(p => (
                  <button key={p} className={`gf-period-tab${targetPeriod === p ? ' on' : ''}`} onClick={() => setTargetPeriod(p)}>{p}</button>
                ))}
              </div>
            </div>

            <div className="gf-row">
              <div className="gf-field">
                <span className="gf-lbl">target amount</span>
                <div className="gf-amount-row">
                  <input
                    className="gf-num"
                    type="number"
                    min={1}
                    max={targetUnit === 'minutes' ? 1440 : 168}
                    value={targetAmount}
                    onChange={e => setTargetAmount(Number(e.target.value))}
                  />
                  <div className="gf-unit-tabs">
                    <button className={`gf-unit-tab${targetUnit === 'hours' ? ' on' : ''}`} onClick={() => setTargetUnit('hours')}>h</button>
                    <button className={`gf-unit-tab${targetUnit === 'minutes' ? ' on' : ''}`} onClick={() => setTargetUnit('minutes')}>min</button>
                  </div>
                </div>
                <span className="gf-amt-hint">per {targetPeriod === 'daily' ? 'day' : targetPeriod === 'monthly' ? 'month' : 'week'}</span>
              </div>
              <div className="gf-field">
                <span className="gf-lbl">color</span>
                <div className="gf-colors">
                  {GOAL_COLORS.map(c => (
                    <button
                      key={c}
                      className={`gf-color${color === c ? ' on' : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="gf-foot">
              <button className="gf-cancel" onClick={resetForm}>cancel</button>
              <button className="gf-save" onClick={save} style={{ background: color }}>
                {editId !== null ? 'update' : 'add goal'}
              </button>
            </div>
          </div>
        ) : (
          <button className="goals-add-btn" onClick={() => setAdding(true)}>+ add goal</button>
        )}
      </div>
    </div>
  )
}
