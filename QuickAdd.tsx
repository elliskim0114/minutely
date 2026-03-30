import { useState } from 'react'
import { useStore } from '../store'
import { toT, toM } from '../utils'

// Parse natural language like "meeting 2pm 1h", "deep work 9am-11am", "gym 6pm 45m"
function parseQuickAdd(input: string, ds: string, de: string) {
  const s = input.trim().toLowerCase()
  let startMins: number | null = null
  let endMins: number | null = null
  let name = input.trim()

  // Match time patterns
  const timeRange = s.match(/(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*[-–to]+\s*(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?/)
  const singleTime = s.match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)?/)
  const durMatch = s.match(/(\d+)\s*(h|hr|hour|m|min|minute)/)

  const parseTime = (t: string, meridiem?: string): number => {
    const parts = t.split(':').map(Number)
    const h = parts[0]
    const m = parts[1] ?? 0
    let hours = h
    if (meridiem === 'pm' && hours < 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0
    return hours * 60 + m
  }

  if (timeRange) {
    const ampmMatch = s.match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/)
    if (ampmMatch) {
      startMins = parseTime(ampmMatch[1], ampmMatch[2])
      endMins = parseTime(ampmMatch[3], ampmMatch[4] || ampmMatch[2])
    } else {
      startMins = parseTime(timeRange[1])
      endMins = parseTime(timeRange[2])
      if (endMins < startMins) endMins += 12 * 60
    }
    name = input.replace(new RegExp(timeRange[0], 'i'), '').trim()
  } else if (singleTime) {
    const ampm = s.match(new RegExp(singleTime[1].replace(':', '\\:') + '\\s*(am|pm)'))
    startMins = parseTime(singleTime[1], ampm?.[1])
    if (durMatch) {
      const durMins = durMatch[2].startsWith('h') ? parseInt(durMatch[1]) * 60 : parseInt(durMatch[1])
      endMins = startMins + durMins
      name = input.replace(new RegExp(durMatch[0], 'i'), '').replace(new RegExp(singleTime[0] + '\\s*(am|pm)?', 'i'), '').trim()
    } else {
      endMins = startMins + 60
      name = input.replace(new RegExp(singleTime[0] + '\\s*(am|pm)?', 'i'), '').trim()
    }
  }

  if (startMins === null) startMins = toM(ds)
  if (endMins === null) endMins = startMins + 60
  startMins = Math.max(toM(ds), Math.min(toM(de) - 15, startMins))
  endMins = Math.max(startMins + 15, Math.min(toM(de), endMins))

  // Detect block type from keywords
  const routineKw = ['gym', 'run', 'walk', 'eat', 'shower', 'commute', 'exercise', 'coffee', 'morning', 'routine', 'yoga']
  const freeKw = ['lunch', 'break', 'relax', 'free', 'nap', 'rest', 'chill', 'email']
  const lname = name.toLowerCase()
  let type: 'focus' | 'routine' | 'study' | 'free' = 'focus'
  if (routineKw.some(k => lname.includes(k))) type = 'routine'
  else if (freeKw.some(k => lname.includes(k))) type = 'free'
  else if (['class', 'lecture', 'read', 'review', 'learn'].some(k => lname.includes(k))) type = 'study'

  return { name: name || input.trim(), start: toT(startMins), end: toT(endMins), type }
}

export default function QuickAdd({ onClose }: { onClose: () => void }) {
  const { cfg, selDate, addBlock, showToast, blocks } = useStore()
  const [input, setInput] = useState('')
  const today = selDate || new Date().toISOString().slice(0, 10)

  // Smart suggestions based on current time patterns
  const suggestions = (() => {
    const nowM = new Date().getHours() * 60 + new Date().getMinutes()
    const freq: Record<string, { count: number; type: string; start: string; end: string }> = {}
    blocks.forEach(b => {
      const diff = Math.abs(toM(b.start) - nowM)
      if (diff > 90) return
      const key = b.name.toLowerCase()
      if (!freq[key]) freq[key] = { count: 0, type: b.type, start: b.start, end: b.end }
      freq[key].count++
      freq[key].start = b.start
      freq[key].end = b.end
      freq[key].type = b.type
    })
    return Object.entries(freq)
      .filter(([, v]) => v.count >= 2)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 3)
      .map(([name, v]) => ({ name: blocks.find(b => b.name.toLowerCase() === name)?.name || name, ...v }))
  })()

  const preview = input.trim() ? parseQuickAdd(input, cfg.ds, cfg.de) : null

  const handleSubmit = () => {
    if (!input.trim()) return
    const parsed = parseQuickAdd(input, cfg.ds, cfg.de)
    addBlock({ date: today, ...parsed, cc: null, customName: null })
    showToast(`"${parsed.name}" added`)
    onClose()
  }

  return (
    <div className="qa-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="qa-box">
        <div className="qa-hint">quick add — type naturally</div>
        <input
          className="qa-inp"
          placeholder="e.g. deep work 9am 2h, gym 6pm-7pm, meeting 2pm 45m"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') onClose()
          }}
          autoFocus
        />
        {preview && (
          <div className="qa-preview">
            <span className={`qa-dot ${preview.type === 'focus' ? 'tf' : preview.type === 'routine' ? 'tr' : preview.type === 'study' ? 'ts' : 'tl'}`} />
            <span className="qa-pname">{preview.name}</span>
            <span className="qa-ptime">{preview.start} – {preview.end}</span>
            <span className="qa-ptyp">{preview.type}</span>
          </div>
        )}
        {suggestions.length > 0 && !input.trim() && (
          <div className="qa-suggests">
            <div className="qa-sug-lbl">often at this time</div>
            <div className="qa-sug-row">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="qa-sug-chip"
                  onClick={() => {
                    addBlock({ date: today, name: s.name, type: s.type as any, start: s.start, end: s.end, cc: null, customName: null })
                    showToast(`"${s.name}" added`)
                    onClose()
                  }}
                >
                  <span className={`qa-dot ${s.type === 'focus' ? 'tf' : s.type === 'routine' ? 'tr' : s.type === 'study' ? 'ts' : 'tl'}`} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="qa-acts">
          <button className="qa-cancel" onClick={onClose}>cancel</button>
          <button className="qa-add" onClick={handleSubmit} disabled={!input.trim()}>add block</button>
        </div>
        <div className="qa-tips">
          <span>9am-10am</span><span>2pm 90m</span><span>gym 6pm 1h</span><span>deep work 8am-12pm</span>
        </div>
      </div>
    </div>
  )
}
