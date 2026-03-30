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

const EXAMPLES = [
  'Hey, team standup is at 10am tomorrow, 30 mins',
  'Dr. appointment Thursday 2:30pm–3:30pm',
  'Need to finish the report by Friday, will take ~2h',
  'Lunch with Sarah on Monday at 12:30',
]

const TYPE_DOT: Record<string, string> = {
  focus: 'tf', routine: 'tr', study: 'ts', free: 'tl',
}

interface Props { onClose: () => void }

export default function SmartCaptureModal({ onClose }: Props) {
  const { cfg, anthropicKey, addBlock, showToast } = useStore()
  const [inputTab, setInputTab] = useState<'text' | 'image'>('text')
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedBlock[]>([])
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string>('image/jpeg')
  const [dragOver, setDragOver] = useState(false)
  const [captureError, setCaptureError] = useState('')

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('please upload an image file'); return }
    setCaptureError('')
    // Normalize MIME — some systems omit the exact type for screenshots
    const mime = file.type || 'image/png'
    setImageMime(mime)
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      setImagePreview(result)
      // Strip data URL prefix to get pure base64
      setImageBase64(result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageFile(file)
  }

  const parse = async () => {
    setCaptureError('')
    if (inputTab === 'text') {
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
          showToast('nothing found — try pasting more context')
        }
      } catch (err) {
        const msg = String(err)
        if (msg.includes('fetch') || msg.includes('Failed')) showToast('server offline — start it with: cd server && npm run dev')
        else showToast('could not parse — try rephrasing')
      } finally {
        setLoading(false)
      }
    } else {
      // Image mode
      if (!imageBase64) { showToast('please upload an image first'); return }
      setLoading(true)
      try {
        const res = await fetch('/api/capture-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64, mimeType: imageMime, today: todayStr(), apiKey: anthropicKey || undefined }),
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setParsed(data.map((b: Omit<ParsedBlock, 'include'>) => ({ ...b, include: true })))
          setStep('preview')
        } else {
          showToast('no events found in this image')
        }
      } catch (err) {
        const msg = String(err).replace('Error: ', '')
        if (msg.includes('fetch') || msg.includes('Failed')) setCaptureError('server offline — start it with: cd server && npm run dev')
        else if (msg.includes('API key')) setCaptureError('add your Anthropic API key in settings first')
        else setCaptureError(msg)
      } finally {
        setLoading(false)
      }
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

        {/* Header */}
        <div className="sc-hdr">
          <div className="sc-hdr-l">
            <div className="sc-icon">⚡</div>
            <div>
              <div className="sc-title">smart capture</div>
              <div className="sc-sub">paste text or upload a screenshot — AI extracts events</div>
            </div>
          </div>
          <button className="sc-close" onClick={onClose}>×</button>
        </div>

        {step === 'input' && (
          <div className="sc-body">
            {/* Input type tabs */}
            <div className="sc-input-tabs">
              <button
                className={`sc-input-tab${inputTab === 'text' ? ' active' : ''}`}
                onClick={() => setInputTab('text')}
              >
                ✏ paste text
              </button>
              <button
                className={`sc-input-tab${inputTab === 'image' ? ' active' : ''}`}
                onClick={() => setInputTab('image')}
              >
                🖼 upload image
              </button>
            </div>

            {inputTab === 'text' ? (
              <>
                <textarea
                  ref={textRef}
                  className="sc-textarea"
                  placeholder={"Paste any text here...\n\nExamples:\n• An email: \"Team sync tomorrow at 2pm for 45 minutes\"\n• A message: \"Don't forget dentist on Thursday 3:30pm\"\n• A task list: \"Need to finish slides, write blog post (~1h), review PRs\"\n• A calendar invite body\n\nAI will extract all the events and help you schedule them."}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) parse() }}
                  autoFocus
                />
                <div className="sc-hint">⌘↵ to parse</div>
                <div className="sc-exs-row">
                  <span className="sc-exs-lbl">quick examples</span>
                  {EXAMPLES.map(ex => (
                    <button key={ex} className="sc-ex" onClick={() => setText(ex)}>{ex}</button>
                  ))}
                </div>
              </>
            ) : (
              <div
                className={`sc-img-drop${dragOver ? ' drag-over' : ''}${imagePreview ? ' has-img' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => !imagePreview && fileRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} className="sc-img-preview" alt="screenshot to analyze" />
                    <button
                      className="sc-img-clear"
                      onClick={e => { e.stopPropagation(); setImagePreview(null); setImageBase64(null) }}
                    >× remove</button>
                  </>
                ) : (
                  <div className="sc-img-placeholder">
                    <div className="sc-img-icon">🖼</div>
                    <div className="sc-img-txt">drag & drop a screenshot here</div>
                    <div className="sc-img-sub">or click to browse · PNG, JPG, WEBP</div>
                    <button className="sc-img-browse" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>browse files</button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
                />
              </div>
            )}

            {captureError && (
              <div className="sc-capture-err">
                <span className="sc-err-icon">⚠</span>
                <span>{captureError}</span>
                <button className="sc-err-dismiss" onClick={() => setCaptureError('')}>×</button>
              </div>
            )}

            <div className="sc-foot">
              <button className="sc-cancel" onClick={onClose}>cancel</button>
              <button
                className="sc-parse"
                onClick={parse}
                disabled={loading || (inputTab === 'text' ? !text.trim() : !imageBase64)}
              >
                {loading
                  ? <><div className="sc-dot" /><div className="sc-dot" /><div className="sc-dot" /><span>extracting…</span></>
                  : inputTab === 'text' ? '⚡ extract events' : '⚡ analyze image'
                }
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="sc-body">
            <div className="sc-prev-hdr">
              <span className="sc-prev-ttl">
                found <strong>{parsed.length}</strong> event{parsed.length !== 1 ? 's' : ''}
              </span>
              <button className="sc-back" onClick={() => { setStep('input'); setParsed([]) }}>← edit</button>
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
          </div>
        )}
      </div>
    </div>
  )
}
