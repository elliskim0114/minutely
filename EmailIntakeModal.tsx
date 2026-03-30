import { useRef, useState } from 'react'
import { useStore } from '../store'
import { todayStr } from '../utils'

interface ParsedBlock {
  name: string
  date: string
  start: string | null
  end: string | null
  type: 'focus' | 'routine' | 'study' | 'free'
  confidence: 'high' | 'medium' | 'low'
  include: boolean
}

const TYPE_DOT: Record<string, string> = {
  focus: 'tf', routine: 'tr', study: 'ts', free: 'tl',
}

interface Props { onClose: () => void }

export default function EmailIntakeModal({ onClose }: Props) {
  const { anthropicKey, addBlock, showToast } = useStore()
  const [activeTab, setActiveTab] = useState<'gmail' | 'outlook'>('gmail')
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedBlock[]>([])
  const textRef = useRef<HTMLTextAreaElement>(null)

  const parse = async () => {
    if (!text.trim()) { textRef.current?.focus(); return }
    setLoading(true)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: todayStr(), apiKey: anthropicKey || undefined }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setParsed(data.map((b: Omit<ParsedBlock, 'include'>) => ({ ...b, include: true })))
        setStep('preview')
      } else {
        showToast('nothing found — try pasting more of the email')
      }
    } catch (err) {
      const msg = String(err)
      if (msg.includes('fetch') || msg.includes('Failed')) showToast('server offline — start it first')
      else showToast('could not parse — try rephrasing')
    } finally {
      setLoading(false)
    }
  }

  const toggleInclude = (i: number) =>
    setParsed(p => p.map((b, j) => j === i ? { ...b, include: !b.include } : b))

  const updateField = (i: number, field: keyof ParsedBlock, value: string) =>
    setParsed(p => p.map((b, j) => j === i ? { ...b, [field]: value } : b))

  const addToCalendar = () => {
    const toAdd = parsed.filter(b => b.include && b.start && b.end)
    if (!toAdd.length) { showToast('select at least one block with a time'); return }
    toAdd.forEach(b => {
      addBlock({
        name: b.name,
        date: b.date || todayStr(),
        start: b.start!,
        end: b.end!,
        type: b.type,
        cc: null,
        customName: null,
        repeat: 'none',
      })
    })
    showToast(`${toAdd.length} block${toAdd.length !== 1 ? 's' : ''} added to calendar`)
    onClose()
  }

  const selected = parsed.filter(b => b.include).length

  return (
    <div className="sc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sc-box">
        <div className="sc-hdr">
          <div className="sc-hdr-l">
            <div className="sc-icon">⚡</div>
            <div>
              <div className="sc-title">email intake</div>
              <div className="sc-sub">import meetings and tasks from your email</div>
            </div>
          </div>
          <button className="sc-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="ei-tabs">
          <button
            className={`ei-tab${activeTab === 'gmail' ? ' active' : ''}`}
            onClick={() => setActiveTab('gmail')}
          >
            Gmail
          </button>
          <button
            className={`ei-tab${activeTab === 'outlook' ? ' active' : ''}`}
            onClick={() => setActiveTab('outlook')}
          >
            Outlook
          </button>
        </div>

        <div className="sc-body">
          {/* OAuth coming soon section */}
          <div className="ei-oauth-section">
            <div className="ei-oauth-icon">{activeTab === 'gmail' ? '📧' : '📨'}</div>
            <div className="ei-oauth-title">
              {activeTab === 'gmail' ? 'Connect Gmail' : 'Connect Outlook'}
            </div>
            <div className="ei-oauth-coming">coming soon — connecting {activeTab === 'gmail' ? 'Google' : 'Microsoft'} OAuth</div>
            <div className="ei-oauth-note">
              {activeTab === 'gmail'
                ? 'Once connected, minutely will scan your inbox for meetings, deadlines, and events — and let you add them to your calendar in one click.'
                : 'Once connected, minutely will read your Outlook calendar invites and emails to extract events automatically.'
              }
            </div>
            <button className="ei-oauth-btn" disabled>
              {activeTab === 'gmail' ? 'Connect Gmail' : 'Connect Outlook'} (coming soon)
            </button>
          </div>

          <div className="ei-divider">
            <span>or paste email manually</span>
          </div>

          {/* Manual paste fallback */}
          {step === 'input' && (
            <>
              <textarea
                ref={textRef}
                className="sc-textarea"
                style={{ minHeight: 100 }}
                placeholder="Paste an email here — AI will extract any meetings, deadlines, or tasks automatically"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) parse() }}
              />
              <div className="sc-hint">⌘↵ to parse</div>
              <div className="sc-foot">
                <button className="sc-cancel" onClick={onClose}>cancel</button>
                <button className="sc-parse" onClick={parse} disabled={loading || !text.trim()}>
                  {loading
                    ? <><div className="sc-dot" /><div className="sc-dot" /><div className="sc-dot" /><span>extracting…</span></>
                    : '⚡ extract events'
                  }
                </button>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="sc-prev-hdr">
                <span className="sc-prev-ttl">
                  found <strong>{parsed.length}</strong> event{parsed.length !== 1 ? 's' : ''}
                </span>
                <button className="sc-back" onClick={() => setStep('input')}>← edit text</button>
              </div>

              <div className="sc-blocks">
                {parsed.map((b, i) => (
                  <div key={i} className={`sc-block${b.include ? ' on' : ''}`}>
                    <button
                      className={`sc-chk${b.include ? ' on' : ''}`}
                      onClick={() => toggleInclude(i)}
                    >
                      {b.include ? '✓' : ''}
                    </button>
                    <div className="sc-block-body">
                      <div className="sc-block-row">
                        <input
                          className="sc-name-inp"
                          value={b.name}
                          onChange={e => updateField(i, 'name', e.target.value)}
                        />
                        <span className={`sc-conf sc-conf-${b.confidence}`}>{b.confidence}</span>
                      </div>
                      <div className="sc-block-row sc-block-meta">
                        <span className={`sc-type-dot tc ${TYPE_DOT[b.type] || 'td'}`} />
                        <span className="sc-type-lbl">{b.type}</span>
                        <span className="sc-block-date">{b.date || todayStr()}</span>
                        {b.start ? (
                          <>
                            <input
                              className="sc-time-inp"
                              type="time"
                              value={b.start}
                              onChange={e => updateField(i, 'start', e.target.value)}
                            />
                            <span className="sc-sep">–</span>
                            <input
                              className="sc-time-inp"
                              type="time"
                              value={b.end || ''}
                              onChange={e => updateField(i, 'end', e.target.value)}
                            />
                          </>
                        ) : (
                          <span className="sc-no-time">no time — set manually</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sc-foot">
                <button className="sc-cancel" onClick={() => { setStep('input'); setParsed([]) }}>
                  re-parse
                </button>
                <button
                  className="sc-add"
                  onClick={addToCalendar}
                  disabled={selected === 0}
                >
                  add {selected} to calendar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
