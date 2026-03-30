import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { todayStr } from '../utils'

const MORNING_MSGS = [
  "One good plan beats ten good intentions.",
  "Small steps, big days. Let's go.",
  "Your best day starts with a clear intention.",
  "A focused morning sets the tone for everything.",
  "Progress, not perfection. Let's build today.",
  "You showed up. That's already half the battle.",
]

const EVENING_MSGS = [
  "Rest is part of the work. You've earned it.",
  "Tomorrow gets a fresh start. Tonight, recharge.",
  "Good work deserves good rest. Wind down well.",
  "Every day done is a day learned. Good night.",
  "Let today go. Tomorrow is a clean slate.",
]

const DAY_LABELS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function DayGreeting() {
  const { greetingOpen, greetingType, closeGreeting, userName, blocks, intentions, openCoachAt } = useStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (greetingOpen) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(closeGreeting, greetingType === 'eodcheck' ? 24000 : 14000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [greetingOpen, greetingType])

  if (!greetingOpen) return null

  const isMorning = greetingType === 'morning'
  const isEodCheck = greetingType === 'eodcheck'
  const name = userName ? `, ${userName.split(' ')[0]}` : ''
  const today = new Date()
  const dayLabel = DAY_LABELS[today.getDay()]
  const td = todayStr()
  const int = intentions[td] || { e: 0, p: ['', '', ''] }
  const todayBlockCount = blocks.filter(b => b.date === td).length
  const topPriority = int.p.find(Boolean)
  const priorities = int.p.filter(Boolean)

  // EOD check-in
  if (isEodCheck) {
    return (
      <div className="greeting-banner greeting-eodcheck" role="status">
        <div className="gb-left">
          <div className="gb-emoji-svg">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 6v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="gb-content">
            <div className="gb-headline">
              1 hour left{name}
              <span className="gb-day">{dayLabel}</span>
            </div>
            <div className="gb-msg">how are your priorities going?</div>
            {priorities.length > 0 && (
              <div className="gb-priorities">
                {priorities.map((p, i) => (
                  <div key={i} className="gb-prow">
                    <span className="gb-pnum">{i + 1}</span>
                    <span className="gb-ptxt">{p}</span>
                  </div>
                ))}
              </div>
            )}
            {!priorities.length && (
              <div className="gb-detail">no priorities set — your coach can help you reflect and prep for tomorrow.</div>
            )}
          </div>
        </div>
        <div className="gb-actions">
          <button className="gb-coach-btn" onClick={() => { closeGreeting(); openCoachAt('analyze') }}>
            review today
          </button>
          <button className="gb-coach-btn gb-coach-btn-alt" onClick={() => { closeGreeting(); openCoachAt('design') }}>
            plan tomorrow
          </button>
          <button className="gb-close" onClick={closeGreeting} aria-label="dismiss">×</button>
        </div>
      </div>
    )
  }

  const msg = pick(isMorning ? MORNING_MSGS : EVENING_MSGS)

  // Contextual detail
  let detail = ''
  if (isMorning) {
    if (topPriority) detail = `Top priority: "${topPriority}"`
    else if (todayBlockCount > 0) detail = `${todayBlockCount} block${todayBlockCount !== 1 ? 's' : ''} already planned — let's make sure they count.`
    else detail = 'No blocks yet — your coach can design the whole day for you.'
  } else {
    const focusMins = blocks
      .filter(b => b.date === td && b.type === 'focus')
      .reduce((s, b) => {
        const [sh, sm] = b.start.split(':').map(Number)
        const [eh, em] = b.end.split(':').map(Number)
        return s + (eh * 60 + em) - (sh * 60 + sm)
      }, 0)
    if (focusMins > 0) detail = `You focused for ${Math.round(focusMins / 60 * 10) / 10}h today. Solid work.`
    else if (todayBlockCount > 0) detail = `${todayBlockCount} block${todayBlockCount !== 1 ? 's' : ''} in the books. Rest well.`
    else detail = 'Even quiet days have value. Rest up.'
  }

  return (
    <div className={`greeting-banner greeting-${greetingType}`} role="status">
      <div className="gb-left">
        <div className="gb-emoji">{isMorning ? '☀️' : '🌙'}</div>
        <div className="gb-content">
          <div className="gb-headline">
            {isMorning ? `time to plan your day${name}` : `good evening${name}`}
            <span className="gb-day">{dayLabel}</span>
          </div>
          <div className="gb-msg">{msg}</div>
          {detail && <div className="gb-detail">{detail}</div>}
        </div>
      </div>
      <div className="gb-actions">
        {isMorning && (
          <button className="gb-coach-btn" onClick={() => { closeGreeting(); openCoachAt('design') }}>
            plan my day →
          </button>
        )}
        {!isMorning && (
          <button className="gb-coach-btn" onClick={() => { closeGreeting(); openCoachAt('analyze') }}>
            wind down with coach
          </button>
        )}
        <button className="gb-close" onClick={closeGreeting} aria-label="dismiss">×</button>
      </div>
    </div>
  )
}
