import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { todayStr, weekStart, dateStr } from '../utils'
import { fmt } from '../utils'

// Simple markdown renderer: bold, italic, underline, bullet lists, headings
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { elements.push(<div key={key++} className="sum-gap" />); continue }

    // Heading: ## or #
    if (line.startsWith('## ')) {
      elements.push(<div key={key++} className="sum-h2">{parseInline(line.slice(3))}</div>)
    } else if (line.startsWith('# ')) {
      elements.push(<div key={key++} className="sum-h1">{parseInline(line.slice(2))}</div>)
    // Bold section label (standalone **Text** line — NOT a bullet)
    } else if (/^\*\*[^*]+\*\*$/.test(line)) {
      elements.push(<div key={key++} className="sum-section-lbl">{parseInline(line)}</div>)
    // Bullet: must be "- text" or "* text" (star+space), not **bold**
    } else if (/^[-•]\s/.test(line) || /^\*\s/.test(line)) {
      elements.push(
        <div key={key++} className="sum-bullet">
          <span className="sum-dot">·</span>
          <span>{parseInline(line.replace(/^[-*•]\s*/, ''))}</span>
        </div>
      )
    } else {
      elements.push(<p key={key++} className="sum-p">{parseInline(line)}</p>)
    }
  }
  return elements
}

// Parse inline formatting: **bold**, *italic*, __underline__
function parseInline(text: string): React.ReactNode[] {
  // Split on **bold**, *italic*, __underline__ tokens in order
  const tokens: React.ReactNode[] = []
  let remaining = text
  let k = 0
  // Process all inline markers in one pass using a combined regex
  const regex = /\*\*(.+?)\*\*|\*([^*]+?)\*|__(.+?)__|_([^_]+?)_/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(remaining.slice(lastIdx, match.index))
    }
    if (match[1] !== undefined) {
      tokens.push(<strong key={k++}>{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      tokens.push(<em key={k++}>{match[2]}</em>)
    } else if (match[3] !== undefined) {
      tokens.push(<u key={k++}>{match[3]}</u>)
    } else if (match[4] !== undefined) {
      tokens.push(<em key={k++}>{match[4]}</em>)
    }
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < remaining.length) tokens.push(remaining.slice(lastIdx))
  return tokens
}

const EXPLORE_PROMPTS = [
  'how can I protect deep work time this week?',
  'what does an ideal high-energy day look like for me?',
  'am I leaving enough recovery time between tasks?',
  'how should I structure my mornings for peak focus?',
  'what would a 4-hour workday look like for me?',
]

export default function SummaryModal() {
  const { closeSummary, sumMode, setSumMode, blocks, focuses, cfg, wOff, anthropicKey } = useStore()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generate = async (mode: 'day' | 'week') => {
    setLoading(true)
    setText('')
    let blist
    if (mode === 'day') {
      blist = blocks.filter(b => b.date === todayStr())
    } else {
      const ws = weekStart(wOff)
      const dates = Array.from({ length: 7 }, (_, i) => dateStr(ws, i))
      blist = blocks.filter(b => dates.includes(b.date))
    }
    if (!blist.length) {
      setText('no blocks to summarise yet — add some tasks to your calendar first.')
      setLoading(false)
      setGenerated(true)
      return
    }
    const focus = focuses[todayStr()] || '(none set)'
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: blist, mode, focus, apiKey: anthropicKey || undefined }),
      })
      if (!res.ok) throw new Error('server error ' + res.status)
      const data = await res.json()
      setText(data.text || 'could not generate summary.')
    } catch (err) {
      const msg = String(err)
      if (msg.includes('fetch')) {
        const total = blist.reduce((s, b) => {
          const [sh, sm] = b.start.split(':').map(Number)
          const [eh, em] = b.end.split(':').map(Number)
          return s + (eh * 60 + em) - (sh * 60 + sm)
        }, 0)
        const h = Math.floor(total / 60)
        const m = total % 60
        const byType: Record<string, number> = {}
        blist.forEach(b => { byType[b.type] = (byType[b.type] || 0) + 1 })
        const typeStr = Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(', ')
        setText(`## ${mode === 'day' ? "Today" : "This week"}\n- **${blist.length} blocks** · ${h}h${m ? ` ${m}m` : ''} total\n- ${typeStr}\n\n⚠️ AI summary unavailable — start the server on port 3001.`)
      } else {
        setText('could not generate summary. ' + msg)
      }
    } finally {
      setLoading(false)
      setGenerated(true)
    }
  }

  useEffect(() => {
    if (!generated) generate(sumMode)
  }, [])

  const switchMode = (m: 'day' | 'week') => {
    setSumMode(m)
    generate(m)
  }

  return (
    <div className="mb on" id="sum-m" onClick={e => { if (e.target === e.currentTarget) closeSummary() }}>
      <div className="mbox">
        <div className="mhdr">
          <span className="mttl">{sumMode === 'day' ? "today's summary" : "week summary"}</span>
          <button className="mx" onClick={closeSummary}>×</button>
        </div>
        <div className="sum-mode-row">
          <button className={`sum-mode-btn${sumMode === 'day' ? ' on' : ''}`} onClick={() => switchMode('day')}>today</button>
          <button className={`sum-mode-btn${sumMode === 'week' ? ' on' : ''}`} onClick={() => switchMode('week')}>this week</button>
          <button
            className={`sum-regen${loading ? ' spinning' : ''}`}
            onClick={() => generate(sumMode)}
            disabled={loading}
            title="regenerate summary"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M9.5 5.5A4 4 0 111.5 5.5M9.5 5.5V2M9.5 5.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {loading ? 'generating…' : 'regenerate'}
          </button>
        </div>
        <div id="sum-content">
          {loading ? (
            <div className="sum-loading">
              <div className="ald" /><div className="ald" /><div className="ald" />
              <span>generating your summary…</span>
            </div>
          ) : (
            <div className="sum-section">
              <div className="sum-md">{renderMarkdown(text)}</div>
              {generated && text && (
                <div className="sum-explore">
                  <div className="sum-explore-lbl">explore with AI →</div>
                  <div className="sum-prompts">
                    {EXPLORE_PROMPTS.map(p => (
                      <button key={p} className="sum-prompt-btn" onClick={() => {
                        useStore.getState().setPendingAIPrompt(p)
                        useStore.getState().setView('mpd')
                        closeSummary()
                        useStore.getState().showToast('prompt loaded — hit ✦ design my perfect day')
                      }}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
