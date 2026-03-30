import { useRef, useState, useMemo } from 'react'
import { useStore } from '../store'
import type { PDBlock, UserProfile, Goal } from '../types'

const TYPE_DOT: Record<string, string> = {
  focus: 'tf', routine: 'tr', study: 'ts', free: 'tl', custom: 'td',
}

const ENERGY_MAP: Record<UserProfile['energyPattern'], string> = {
  morning: 'most productive in the morning',
  afternoon: 'most productive in the afternoon',
  evening: 'most creative in the evening',
  night: 'a night owl who does my best work late',
}

function buildPersonalizedPrompt(
  userProfile: UserProfile | null,
  goals: Goal[],
  recentEnergy: number | null,
  recentBlockNames: string[],
): string {
  const parts: string[] = []
  if (userProfile?.occupation) parts.push(`I'm a ${userProfile.occupation}`)
  if (userProfile?.energyPattern) parts.push(ENERGY_MAP[userProfile.energyPattern])
  if (userProfile?.lifestyle?.length) parts.push(`my daily life includes ${userProfile.lifestyle.map((l: string) => l.replace(/-/g, ' ')).join(', ')}`)
  if (userProfile?.challenges?.length) parts.push(`I struggle with ${userProfile.challenges.map((c: string) => c.replace(/-/g, ' ')).join(' and ')}`)
  if (goals.length) parts.push(`my current goals are: ${goals.map((g: Goal) => g.name).join(', ')}`)
  if (recentEnergy !== null) {
    const desc = recentEnergy < 1 ? 'low energy lately' : recentEnergy < 2 ? 'moderate energy' : 'high energy lately'
    parts.push(`I've had ${desc}`)
  }
  if (recentBlockNames.length) parts.push(`my recent schedule typically includes: ${recentBlockNames.slice(0, 5).join(', ')}`)
  if (userProfile?.bio) parts.push(userProfile.bio)
  return parts.length > 0 ? parts.join('. ') + '.' : ''
}

interface Props { onClose: () => void }

export default function PDWizardModal({ onClose }: Props) {
  const { cfg, anthropicKey, setAnthropicKey, setPerfectDay, showToast,
    userProfile, goals, intentions, blocks } = useStore()
  const [step, setStep] = useState<'describe' | 'preview'>('describe')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PDBlock[]>([])
  const [keyDraft, setKeyDraft] = useState('')
  const [showKey, setShowKey] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Build personalized prompt from profile + goals + recent data
  const { personalizedPrompt, recentEnergy } = useMemo(() => {
    // Average energy from last 7 days
    const today = new Date()
    let totalE = 0, countE = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const int = intentions[key]
      if (int && int.e > 0) { totalE += int.e; countE++ }
    }
    const avgEnergy = countE > 0 ? totalE / countE : null

    // Most common block names from last 14 days
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 14)
    const recentBlocks = blocks.filter(b => new Date(b.date) >= cutoff)
    const nameCounts: Record<string, number> = {}
    recentBlocks.forEach(b => { nameCounts[b.name] = (nameCounts[b.name] || 0) + 1 })
    const topNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n)
      .slice(0, 6)

    return {
      personalizedPrompt: buildPersonalizedPrompt(userProfile, goals, avgEnergy, topNames),
      recentEnergy: avgEnergy,
    }
  }, [userProfile, goals, intentions, blocks])

  const hasProfile = !!personalizedPrompt

  const generate = async (promptOverride?: string) => {
    const txt = (promptOverride ?? input).trim()
    if (!txt) { textRef.current?.focus(); return }
    setLoading(true)
    try {
      const res = await fetch('/api/perfect-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: txt,
          dayStart: cfg.ds,
          dayEnd: cfg.de,
          apiKey: anthropicKey || undefined,
          userProfile: userProfile || undefined,
          goals: goals.map(g => ({ name: g.name, targetHours: g.targetHours })),
          recentEnergy,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setPreview(data)
        setStep('preview')
      } else {
        throw new Error('empty')
      }
    } catch (err) {
      const msg = String(err)
      if (msg.includes('401')) showToast('API key issue — check your key')
      else if (msg.includes('429')) showToast('rate limited — wait a moment')
      else showToast('generation failed — try a different description')
    } finally {
      setLoading(false)
    }
  }

  const apply = () => {
    setPerfectDay(preview)
    showToast('blueprint updated with AI schedule')
    onClose()
  }

  const totalMins = preview.reduce((s, b) => {
    const [sh, sm] = b.start.split(':').map(Number)
    const [eh, em] = b.end.split(':').map(Number)
    return s + (eh * 60 + em) - (sh * 60 + sm)
  }, 0)

  return (
    <div className="pdw-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pdw-box">
        {/* Header */}
        <div className="pdw-hdr">
          <div className="pdw-hdr-l">
            <span className="pdw-spark">✦</span>
            <div>
              <div className="pdw-title">AI day designer</div>
              <div className="pdw-sub">
                {hasProfile ? 'personalized to your profile' : 'describe your lifestyle — AI builds your blueprint'}
              </div>
            </div>
          </div>
          <button className="pdw-close" onClick={onClose}>×</button>
        </div>

        {step === 'describe' && (
          <div className="pdw-body">
            {/* API key row */}
            <div className="pdw-key-row">
              <button
                className={`pdw-key-btn${anthropicKey ? ' set' : ''}`}
                onClick={() => { setShowKey(v => !v); setKeyDraft(anthropicKey) }}
              >
                {anthropicKey ? '🔑 key set' : '🔑 add API key'}
              </button>
              {showKey && (
                <div className="pdw-key-inp-row">
                  <input
                    className="pdw-key-inp"
                    type="password"
                    placeholder="sk-ant-api03-…"
                    value={keyDraft}
                    onChange={e => setKeyDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { setAnthropicKey(keyDraft.trim()); setShowKey(false); showToast('API key saved') }
                      if (e.key === 'Escape') setShowKey(false)
                    }}
                    autoFocus
                  />
                  <button className="pdw-key-save" onClick={() => { setAnthropicKey(keyDraft.trim()); setShowKey(false); showToast('API key saved') }}>save</button>
                </div>
              )}
            </div>

            {/* Personalized prompt card */}
            {hasProfile && (
              <div className="pdw-personal-card">
                <div className="pdw-personal-hdr">
                  <span className="pdw-personal-icon">✦</span>
                  <span className="pdw-personal-ttl">built from your profile</span>
                </div>
                <p className="pdw-personal-body">{personalizedPrompt}</p>
                <button
                  className="pdw-personal-use"
                  onClick={() => {
                    setInput(personalizedPrompt)
                    setTimeout(() => textRef.current?.focus(), 50)
                  }}
                >use this prompt</button>
                <button
                  className="pdw-personal-gen"
                  onClick={() => generate(personalizedPrompt)}
                  disabled={loading}
                >
                  {loading
                    ? <><div className="pdw-dot" /><div className="pdw-dot" /><div className="pdw-dot" /><span>designing…</span></>
                    : '✦ generate my day now'
                  }
                </button>
              </div>
            )}

            <label className="pdw-lbl">{hasProfile ? 'or describe it yourself' : 'describe your ideal day'}</label>
            <textarea
              ref={textRef}
              className="pdw-textarea"
              placeholder="e.g. I'm a freelance designer who needs deep focus mornings, daily workouts, and buffer time for client calls in the afternoon…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) generate() }}
            />
            <div className="pdw-hint">⌘↵ to generate</div>

            <div className="pdw-foot">
              <button className="pdw-cancel" onClick={onClose}>cancel</button>
              <button className="pdw-gen" onClick={() => generate()} disabled={loading || !input.trim()}>
                {loading
                  ? <><div className="pdw-dot" /><div className="pdw-dot" /><div className="pdw-dot" /><span>designing…</span></>
                  : '✦ generate schedule'
                }
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="pdw-body">
            <div className="pdw-prev-hdr">
              <span className="pdw-prev-ttl">{preview.length} blocks · {Math.floor(totalMins / 60)}h{totalMins % 60 ? ` ${totalMins % 60}m` : ''} planned</span>
              <button className="pdw-regen" onClick={() => setStep('describe')}>← edit prompt</button>
            </div>
            <div className="pdw-blocks">
              {preview.map((b, i) => (
                <div key={i} className="pdw-block">
                  <div className={`pdw-blk-dot tc ${TYPE_DOT[b.type] || 'td'}`} />
                  <div className="pdw-blk-info">
                    <span className="pdw-blk-name">{b.name}</span>
                    <span className="pdw-blk-type">{b.type}</span>
                  </div>
                  <span className="pdw-blk-time">{b.start} – {b.end}</span>
                </div>
              ))}
            </div>
            <div className="pdw-foot">
              <button className="pdw-cancel" onClick={() => { setStep('describe'); setPreview([]) }}>regenerate</button>
              <button className="pdw-apply" onClick={apply}>apply to blueprint</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
