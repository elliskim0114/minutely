import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { useTypewriter } from '../hooks/useTypewriter'

interface Props { onDone: () => void }

const STEPS = [
  {
    emoji: '✦',
    title: 'AI that actually helps',
    body: '"Build my day" auto-fills your free slots based on energy and priorities.\n"What now?" gives you one specific recommendation — no decision fatigue.',
    grad: 'linear-gradient(135deg, #FF4D1C 0%, #FF8A52 50%, #FFB347 100%)',
    orb1: '#FF6B3C',
    orb2: '#FFB347',
    accent: '#FF4D1C',
  },
  {
    emoji: '🎯',
    title: 'plan health grade',
    body: 'Forget the 99% fill bar. Your plan gets a grade — A through F — that rewards buffer time, focus blocks, and realistic scheduling.',
    grad: 'linear-gradient(135deg, #6C63FF 0%, #A78BFA 50%, #C084FC 100%)',
    orb1: '#7C3AED',
    orb2: '#A78BFA',
    accent: '#7C3AED',
  },
  {
    emoji: '🚨',
    title: 'running late? one tap.',
    body: 'Hit "I\'m running late" → pick how late → AI instantly reshuffles your remaining blocks. No manual dragging, no stress.',
    grad: 'linear-gradient(135deg, #EF4444 0%, #F97316 50%, #FBBF24 100%)',
    orb1: '#DC2626',
    orb2: '#F97316',
    accent: '#EF4444',
  },
  {
    emoji: '🔒',
    title: 'lock in tomorrow',
    body: 'Happy with tomorrow\'s plan? Lock it in. It becomes a real commitment — not just a wishlist you ignore by morning.',
    grad: 'linear-gradient(135deg, #059669 0%, #34D399 50%, #6EE7B7 100%)',
    orb1: '#047857',
    orb2: '#34D399',
    accent: '#059669',
  },
  {
    emoji: '⟳',
    title: 'pattern detection',
    body: 'Keep moving the same block around? minutely notices and nudges you to give it a permanent home in your week.',
    grad: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 50%, #7DD3FC 100%)',
    orb1: '#0369A1',
    orb2: '#38BDF8',
    accent: '#0EA5E9',
  },
]

export default function FeatureTour({ onDone }: Props) {
  const { mode } = useStore()
  const [step, setStep] = useState(0)
  const [animDir, setAnimDir] = useState<'in' | 'out'>('in')
  const [typingTitle, setTypingTitle] = useState(STEPS[0].title)
  const [typingBody, setTypingBody] = useState(STEPS[0].body)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const { displayed: titleText } = useTypewriter(typingTitle, 32)
  const { displayed: bodyText, done: titleDone } = useTypewriter(
    titleText.length >= typingTitle.length ? typingBody : '',
    10
  )

  const goTo = (next: number) => {
    setAnimDir('out')
    setTimeout(() => {
      setStep(next)
      setAnimDir('in')
      setTypingTitle(STEPS[next].title)
      setTypingBody(STEPS[next].body)
    }, 220)
  }

  useEffect(() => {
    setAnimDir('in')
  }, [step])

  return (
    <div className="ft-root" data-mode={mode}>
      {/* Animated background gradient */}
      <div className="ft-bg" style={{ background: current.grad }} />

      {/* Floating orbs */}
      <div className="ft-orb ft-orb1" style={{ background: current.orb1 }} />
      <div className="ft-orb ft-orb2" style={{ background: current.orb2 }} />
      <div className="ft-orb ft-orb3" style={{ background: current.orb1, opacity: 0.4 }} />

      <div className="ft-inner">
        {/* Logo */}
        <div className="ft-logo">minutely</div>

        {/* Card */}
        <div className={`ft-card ft-card-${animDir}`} key={step}>
          {/* Emoji with glow */}
          <div className="ft-emoji-wrap" style={{ '--ft-acc': current.accent } as React.CSSProperties}>
            <div className="ft-emoji-glow" style={{ background: current.accent }} />
            <div className="ft-emoji">{current.emoji}</div>
          </div>

          <div className="ft-title">
            {titleText}<span className="ft-cursor">|</span>
          </div>
          <div className="ft-body">
            {bodyText.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            {bodyText.length > 0 && bodyText.length < typingBody.length && <span className="ft-cursor">|</span>}
          </div>
        </div>

        {/* Progress dots */}
        <div className="ft-dots">
          {STEPS.map((s, i) => (
            <button
              key={i}
              className={`ft-dot${i === step ? ' on' : i < step ? ' done' : ''}`}
              style={i === step ? { background: current.accent, boxShadow: `0 0 10px ${current.accent}80` } : {}}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="ft-foot">
          <button className="ft-skip" onClick={onDone}>skip</button>
          <div className="ft-nav">
            {step > 0 && (
              <button className="ft-back" onClick={() => goTo(step - 1)}>← back</button>
            )}
            <button
              className="ft-next"
              style={{ background: current.grad, boxShadow: `0 6px 24px ${current.accent}60` }}
              onClick={() => isLast ? onDone() : goTo(step + 1)}
            >
              {isLast ? 'start using minutely →' : 'next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
