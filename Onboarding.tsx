import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { supabase, supabaseConfigured } from '../supabase'
import type { Mode, UserProfile } from '../types'

type Screen = 's0' | 's1' | 's1b' | 's1c' | 's2' | 's3' | 's4' | 's5' | 's5b'

const DOTS: Record<Screen, number> = {
  s0: 0, s1: 1, s1b: 1, s1c: 1, s2: 2, s3: 3, s4: 4, s5: 5, s5b: 6,
}

const OCCUPATION_PRESETS = [
  'software engineer', 'designer', 'student', 'freelancer',
  'founder / entrepreneur', 'manager', 'researcher', 'teacher',
]

const LIFESTYLE_OPTS = [
  { label: 'daily exercise', value: 'exercise', icon: '🏃' },
  { label: 'deep work blocks', value: 'deep-work', icon: '🎯' },
  { label: 'lots of meetings', value: 'meetings', icon: '📅' },
  { label: 'family time', value: 'family', icon: '🏠' },
  { label: 'daily commute', value: 'commute', icon: '🚇' },
  { label: 'meditation / mindfulness', value: 'meditation', icon: '🧘' },
  { label: 'side projects', value: 'side-projects', icon: '🚀' },
  { label: 'creative work', value: 'creative', icon: '🎨' },
]

const CHALLENGE_OPTS = [
  { label: 'procrastination', value: 'procrastination', icon: '⏳' },
  { label: 'too many meetings', value: 'too-many-meetings', icon: '📞' },
  { label: 'easily distracted', value: 'distractions', icon: '📱' },
  { label: 'overcommitting', value: 'overcommitting', icon: '📋' },
  { label: 'unpredictable days', value: 'unpredictable', icon: '🌀' },
  { label: 'burnout / low energy', value: 'burnout', icon: '🔋' },
]

const GOAL_COLORS = ['#FF4D1C', '#6C63FF', '#059669', '#0EA5E9', '#F59E0B', '#EC4899']
const GOAL_PRESETS = [
  { name: 'deep work', targetHours: 20, color: '#6C63FF', icon: '🎯' },
  { name: 'exercise', targetHours: 5, color: '#059669', icon: '💪' },
  { name: 'learning', targetHours: 7, color: '#0EA5E9', icon: '📚' },
  { name: 'side project', targetHours: 10, color: '#FF4D1C', icon: '🚀' },
  { name: 'family time', targetHours: 8, color: '#EC4899', icon: '🏠' },
  { name: 'reading', targetHours: 4, color: '#F59E0B', icon: '📖' },
]

export default function Onboarding() {
  const { finishOnboarding, addGoal } = useStore()

  // Navigation — track both active screen and the one currently exiting
  const [screen, setScreen] = useState<Screen>('s0')
  const [exiting, setExiting] = useState<Screen | null>(null)

  // Theme
  const [mode, setModeState] = useState<Mode>('light')
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null)

  // Step 1 — user SELECTS first, then presses next
  const [authChoice, setAuthChoice] = useState<'signin' | 'guest' | null>(null)

  // Sign-in form
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pw, setPw] = useState('')
  const [signInMode, setSignInMode] = useState<'signin' | 'signup'>('signin')
  const [signInLoading, setSignInLoading] = useState(false)
  const [signInError, setSignInError] = useState('')

  // Config
  const [tf, setTf] = useState<'12' | '24'>('12')
  const [ds, setDs] = useState('06:00')
  const [de, setDe] = useState('23:00')
  const [wsVal, setWsVal] = useState<0 | 1>(0)

  // Guest name
  const [guestName, setGuestName] = useState('')

  // Goals setup
  const [selectedGoals, setSelectedGoals] = useState<Set<number>>(new Set())
  const [customGoal, setCustomGoal] = useState('')
  const [customGoalColor, setCustomGoalColor] = useState(GOAL_COLORS[0])

  // Coach profile (s5b)
  const [occupation, setOccupation] = useState('')
  const [energyPattern, setEnergyPattern] = useState<UserProfile['energyPattern'] | null>(null)
  const [selectedLifestyle, setSelectedLifestyle] = useState<Set<string>>(new Set())
  const [selectedChallenges, setSelectedChallenges] = useState<Set<string>>(new Set())
  const [profileBio, setProfileBio] = useState('')

  // Resolved user info after auth
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const tagRef = useRef<HTMLParagraphElement>(null)

  // Typewriter effect on mount
  useEffect(() => {
    const el = tagRef.current
    if (!el) return
    const text = 'design your perfect day. live it every minute.'
    let i = 0
    el.innerHTML = ''
    const cursor = document.createElement('span')
    cursor.className = 'cursor'
    el.appendChild(cursor)
    const iv = setInterval(() => {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text[i]), cursor)
        i++
      } else {
        clearInterval(iv)
        setTimeout(() => cursor.remove(), 1200)
      }
    }, 48)
    return () => clearInterval(iv)
  }, [])

  // ── Navigation ──────────────────────────────────────────────
  const goTo = (next: Screen) => {
    setExiting(screen)
    setScreen(next)
    setTimeout(() => setExiting(null), 420)
  }

  // Returns CSS class for each screen (always rendered, transition via CSS)
  const scrCls = (s: Screen) => {
    const base = s === 's0' ? 'ob-screen ob-screen-s0' : 'ob-screen themed'
    if (s === screen) return `${base} ob-active`
    if (s === exiting) return `${base} ob-exiting`
    return base
  }

  // ── Actions ──────────────────────────────────────────────────
  const pickMode = (m: Mode) => {
    setSelectedMode(m)
    setModeState(m)
  }

  const confirmMode = () => {
    if (!selectedMode) return
    goTo('s1')
  }

  const handleNextS1 = () => {
    if (!authChoice) return
    if (authChoice === 'signin') goTo('s1b')
    else goTo('s1c')
  }

  const handleNextS1c = () => {
    if (guestName.trim()) setUserName(guestName.trim())
    goTo('s2')
  }

  const doAuth = async () => {
    if (!email.trim() || !pw.trim()) return
    setSignInLoading(true)
    setSignInError('')

    // ── Real Supabase auth ──
    if (supabase) {
      try {
        if (signInMode === 'signup') {
          const { data, error } = await supabase.auth.signUp({ email, password: pw })
          if (error) throw error
          setUserName(displayName.trim() || data.user?.email?.split('@')[0] || email.split('@')[0])
          setUserEmail(email)
          goTo('s2')
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
          if (error) throw error
          setUserName(data.user?.user_metadata?.display_name || data.user?.email?.split('@')[0] || email.split('@')[0])
          setUserEmail(email)
          goTo('s2')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setSignInError(msg)
      } finally {
        setSignInLoading(false)
      }
      return
    }

    // ── Fallback: local-only (no Supabase configured) ──
    setUserName(displayName.trim() || email.split('@')[0])
    setUserEmail(email)
    setSignInLoading(false)
    goTo('s2')
  }

  const finishSetup = () => {
    const profile: UserProfile | null = (occupation.trim() || energyPattern || selectedLifestyle.size > 0 || selectedChallenges.size > 0 || profileBio.trim())
      ? {
          occupation: occupation.trim(),
          energyPattern: energyPattern || 'morning',
          lifestyle: [...selectedLifestyle],
          challenges: [...selectedChallenges],
          bio: profileBio.trim(),
        }
      : null
    finishOnboarding({ mode, cfg: { tf, ds, de, ws: wsVal }, userName, userEmail, perfectDay: [], userProfile: profile })
    // Add selected preset goals
    selectedGoals.forEach(i => {
      const g = GOAL_PRESETS[i]
      addGoal({ name: g.name, color: g.color, targetHours: g.targetHours })
    })
    if (customGoal.trim()) {
      addGoal({ name: customGoal.trim(), color: customGoalColor, targetHours: 10 })
    }
  }

  const toggleLifestyle = (v: string) => setSelectedLifestyle(prev => {
    const next = new Set(prev); if (next.has(v)) next.delete(v); else next.add(v); return next
  })
  const toggleChallenge = (v: string) => setSelectedChallenges(prev => {
    const next = new Set(prev); if (next.has(v)) next.delete(v); else next.add(v); return next
  })

  const toggleGoal = (i: number) => {
    setSelectedGoals(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const dot = DOTS[screen]
  const totalDots = 7

  return (
    <div className="ob-root" data-mode={screen === 's0' ? undefined : mode}>

      {/* ── Progress dots ── */}
      {screen !== 's0' && (
        <div className="ob-dots-bar">
          {Array.from({ length: totalDots }, (_, i) => (
            <div key={i} className={`ob-dot${i === dot ? ' on' : ''}`} />
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────
          S0 — theme picker
      ───────────────────────────────────────────── */}
      <div className={scrCls('s0')}>
        <div className="s0-inner">
          <div className="ob-progress" style={{ marginBottom: 22 }}>
            {[0, 1, 2, 3, 4].map(i => <div key={i} className={`ob-dot${i === 0 ? ' on' : ''}`} />)}
          </div>
          <div className="ob-wm glow">minutely</div>
          <p className="ob-tag" ref={tagRef} />
          <div className="mc-row">
            <div className={`mc lc${selectedMode === 'light' ? ' sel' : ''}`} onClick={() => pickMode('light')}>
              <div className="mc-prev lp">
                <div className="mc-pb" style={{ top: 7, height: 22, background: '#FFF0EC', border: '1px solid #FFB8A0', color: '#8B2200' }}>deep work</div>
                <div className="mc-pb" style={{ top: 33, height: 14, background: '#EBF5EC', border: '1px solid #95CFA0', color: '#1A4A22' }}>movement</div>
                <div className="mc-pb" style={{ top: 51, height: 22, background: '#FFF8E8', border: '1px solid #F0D080', color: '#5A4000' }}>free time</div>
              </div>
              <div className="mc-footer">
                <div className="mc-name" style={{ color: '#1A1410' }}>light</div>
                <div className="mc-sub" style={{ color: '#9A8A72' }}>warm &amp; editorial</div>
              </div>
            </div>
            <div className={`mc dkc${selectedMode === 'dark' ? ' sel' : ''}`} onClick={() => pickMode('dark')}>
              <div className="mc-prev dp">
                <div className="mc-pb" style={{ top: 7, height: 22, background: '#2A1410', border: '1px solid #8B3520', color: '#FFCAB0' }}>deep work</div>
                <div className="mc-pb" style={{ top: 33, height: 14, background: '#0E2010', border: '1px solid #2A6035', color: '#A0E0A8' }}>movement</div>
                <div className="mc-pb" style={{ top: 51, height: 22, background: '#1E1800', border: '1px solid #7A6000', color: '#F5D870' }}>free time</div>
              </div>
              <div className="mc-footer">
                <div className="mc-name" style={{ color: '#F7F2E4' }}>dark</div>
                <div className="mc-sub" style={{ color: '#A89878' }}>moody &amp; focused</div>
              </div>
            </div>
            <div className={`mc nc${selectedMode === 'night' ? ' sel' : ''}`} onClick={() => pickMode('night')}>
              <div className="mc-prev np">
                <div className="mc-pb" style={{ top: 7, height: 22, background: '#1E1028', border: '1px solid #6A3090', color: '#E8C8FF' }}>deep work</div>
                <div className="mc-pb" style={{ top: 33, height: 14, background: '#0A1828', border: '1px solid #2050A0', color: '#90C8FF' }}>movement</div>
                <div className="mc-pb" style={{ top: 51, height: 22, background: '#281820', border: '1px solid #904060', color: '#FFB0D0' }}>free time</div>
              </div>
              <div className="mc-footer">
                <div className="mc-name" style={{ color: '#EDE8FF' }}>night</div>
                <div className="mc-sub" style={{ color: '#8878B8' }}>cosmic &amp; immersive</div>
              </div>
            </div>
          </div>
          <button
            className="ob-p"
            style={{ marginTop: 22, maxWidth: 200, opacity: selectedMode ? 1 : 0.35, cursor: selectedMode ? 'pointer' : 'default' }}
            onClick={confirmMode}
            disabled={!selectedMode}
          >continue →</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S1 — sign in vs guest  (SELECT then NEXT)
      ───────────────────────────────────────────── */}
      <div className={scrCls('s1')}>
        <div className="ob-card">
          <div className="ob-logo">minutely <span className="acdot" /></div>
          <span className="ob-step">step 1 of 4</span>
          <div className="ob-qh">want your planner to follow you?</div>
          <div className="ob-qs">sign in to sync across devices — or just dive in.</div>
          <div className="ob-opts">
            <button
              className={`ob-opt${authChoice === 'signin' ? ' sel' : ''}`}
              onClick={() => setAuthChoice('signin')}
            >
              <div className="ob-odot" />
              <div>
                <div className="ob-oname">sign in / create account</div>
                <div className="ob-ohint">access minutely on any device</div>
              </div>
            </button>
            <button
              className={`ob-opt${authChoice === 'guest' ? ' sel' : ''}`}
              onClick={() => setAuthChoice('guest')}
            >
              <div className="ob-odot" />
              <div>
                <div className="ob-oname">continue without account</div>
                <div className="ob-ohint">data stays on this device only</div>
              </div>
            </button>
          </div>
          <button
            className="ob-p"
            disabled={!authChoice}
            style={{ opacity: authChoice ? 1 : 0.35, cursor: authChoice ? 'pointer' : 'default' }}
            onClick={handleNextS1}
          >next →</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S1b — sign in / sign up form
      ───────────────────────────────────────────── */}
      <div className={scrCls('s1b')}>
        <div className="ob-card">
          <div className="ob-logo">minutely <span className="acdot" /></div>
          <span className="ob-step">step 1 of 4</span>

          {/* mode toggle */}
          <div className="ob-auth-toggle">
            <button
              className={`ob-auth-tab${signInMode === 'signin' ? ' on' : ''}`}
              onClick={() => { setSignInMode('signin'); setSignInError('') }}
            >sign in</button>
            <button
              className={`ob-auth-tab${signInMode === 'signup' ? ' on' : ''}`}
              onClick={() => { setSignInMode('signup'); setSignInError('') }}
            >create account</button>
          </div>

          <div className="ob-qh" style={{ marginTop: 14 }}>
            {signInMode === 'signin' ? 'welcome back.' : 'join minutely.'}
          </div>
          <div className="ob-qs" style={{ marginBottom: 16 }}>
            {signInMode === 'signin'
              ? 'sign in to pick up where you left off.'
              : 'your data stays private — we just need an email.'}
          </div>

          {signInMode === 'signup' && (
            <input
              className="ob-inp"
              type="text"
              placeholder="your name (optional)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doAuth()}
            />
          )}
          <input
            className="ob-inp"
            type="email"
            placeholder="email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAuth()}
          />
          <input
            className="ob-inp"
            type="password"
            placeholder="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAuth()}
          />

          {!supabaseConfigured && (
            <div className="ob-auth-notice">
              ⓘ Supabase not configured — account saved locally only.
            </div>
          )}

          {signInError && (
            <div className="ob-auth-error">{signInError}</div>
          )}

          <button className="ob-p" onClick={doAuth} disabled={signInLoading}>
            {signInLoading
              ? <><div className="ald" /><div className="ald" /><div className="ald" /></>
              : signInMode === 'signin' ? 'sign in →' : 'create account →'
            }
          </button>
          <div className="ob-div">or</div>
          <button className="ob-g" onClick={() => goTo('s1c')}>continue without account</button>
          <button className="ob-back" onClick={() => goTo('s1')}>← back</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S1c — guest name
      ───────────────────────────────────────────── */}
      <div className={scrCls('s1c')}>
        <div className="ob-card">
          <div className="ob-logo">minutely <span className="acdot" /></div>
          <span className="ob-step">step 1 of 5</span>
          <div className="ob-qh">what should we call you?</div>
          <div className="ob-qs">minutely will use your name to personalise your experience.</div>
          <input
            className="ob-inp ob-name-inp"
            type="text"
            placeholder="your first name…"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNextS1c()}
            autoFocus
          />
          <button className="ob-p" onClick={handleNextS1c}>
            {guestName.trim() ? `hi ${guestName.split(' ')[0]} →` : 'skip →'}
          </button>
          <button className="ob-back" onClick={() => goTo('s1')}>← back</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S2 — time format
      ───────────────────────────────────────────── */}
      <div className={scrCls('s2')}>
        <div className="ob-card">
          <span className="ob-step">step 2 of 5</span>
          <div className="ob-qh">how do you read time?</div>
          <div className="ob-qs">affects how times appear throughout your planner.</div>
          <div className="ob-opts">
            <button className={`ob-opt${tf === '12' ? ' sel' : ''}`} onClick={() => setTf('12')}>
              <div className="ob-odot" /><div><div className="ob-oname">12-hour</div><div className="ob-ohint">9:00 am, 2:30 pm</div></div>
            </button>
            <button className={`ob-opt${tf === '24' ? ' sel' : ''}`} onClick={() => setTf('24')}>
              <div className="ob-odot" /><div><div className="ob-oname">24-hour</div><div className="ob-ohint">09:00, 14:30</div></div>
            </button>
          </div>
          <button className="ob-p" onClick={() => goTo('s3')}>next →</button>
          <button className="ob-back" onClick={() => authChoice === 'signin' ? goTo('s1b') : goTo('s1c')}>← back</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S3 — day hours
      ───────────────────────────────────────────── */}
      <div className={scrCls('s3')}>
        <div className="ob-card">
          <span className="ob-step">step 3 of 5</span>
          <div className="ob-qh">when does your day begin and end?</div>
          <div className="ob-qs">minutely only shows time within this window.</div>
          <div className="ob-tr">
            <div className="ob-tf">
              <label>day starts</label>
              <input className="ob-inp" type="time" value={ds} onChange={e => setDs(e.target.value)} style={{ marginBottom: 0 }} />
            </div>
            <div className="ob-tf">
              <label>day ends</label>
              <input className="ob-inp" type="time" value={de} onChange={e => setDe(e.target.value)} style={{ marginBottom: 0 }} />
            </div>
          </div>
          <button className="ob-p" onClick={() => goTo('s4')}>next →</button>
          <button className="ob-back" onClick={() => goTo('s2')}>← back</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S4 — week start
      ───────────────────────────────────────────── */}
      <div className={scrCls('s4')}>
        <div className="ob-card">
          <span className="ob-step">step 4 of 5</span>
          <div className="ob-qh">when does your week start?</div>
          <div className="ob-qs">sets the first column in your weekly view.</div>
          <div className="ob-opts">
            <button className={`ob-opt${wsVal === 0 ? ' sel' : ''}`} onClick={() => setWsVal(0)}>
              <div className="ob-odot" /><div><div className="ob-oname">Sunday</div><div className="ob-ohint">Sun → Sat</div></div>
            </button>
            <button className={`ob-opt${wsVal === 1 ? ' sel' : ''}`} onClick={() => setWsVal(1)}>
              <div className="ob-odot" /><div><div className="ob-oname">Monday</div><div className="ob-ohint">Mon → Sun</div></div>
            </button>
          </div>
          <button className="ob-p" onClick={() => goTo('s5')}>next →</button>
          <button className="ob-back" onClick={() => goTo('s3')}>← back</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S5 — goals
      ───────────────────────────────────────────── */}
      <div className={scrCls('s5')}>
        <div className="ob-card ob-goals-card">
          <span className="ob-step">step 5 of 5</span>
          <div className="ob-qh">what are you working towards?</div>
          <div className="ob-qs">pick any that resonate — you can edit these anytime from the sidebar.</div>
          <div className="ob-goal-grid">
            {GOAL_PRESETS.map((g, i) => (
              <button
                key={i}
                className={`ob-goal-chip${selectedGoals.has(i) ? ' sel' : ''}`}
                style={selectedGoals.has(i) ? { background: g.color + '22', borderColor: g.color, color: g.color } : {}}
                onClick={() => toggleGoal(i)}
              >
                <span className="ob-goal-icon">{g.icon}</span>
                <div>
                  <div className="ob-goal-name">{g.name}</div>
                  <div className="ob-goal-hint">{g.targetHours}h / week target</div>
                </div>
                {selectedGoals.has(i) && <span className="ob-goal-check">✓</span>}
              </button>
            ))}
          </div>
          <div className="ob-custom-goal">
            <input
              className="ob-inp"
              type="text"
              placeholder="+ add your own goal…"
              value={customGoal}
              onChange={e => setCustomGoal(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            {customGoal.trim() && (
              <div className="ob-custom-colors">
                {GOAL_COLORS.map(c => (
                  <button
                    key={c}
                    className={`ob-cc${customGoalColor === c ? ' on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setCustomGoalColor(c)}
                  />
                ))}
              </div>
            )}
          </div>
          <button className="ob-p" onClick={() => goTo('s5b')}>
            {selectedGoals.size > 0 || customGoal.trim() ? `next →` : 'skip →'}
          </button>
          <button className="ob-back" onClick={() => goTo('s4')}>← back</button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          S5b — coach profile
      ───────────────────────────────────────────── */}
      <div className={scrCls('s5b')}>
        <div className="ob-card ob-profile-card">
          <span className="ob-step">step 6 of 6</span>
          <div className="ob-qh">meet your personal coach ✦</div>
          <div className="ob-qs">a few quick questions so your AI coach can build days that actually fit your life.</div>

          {/* Occupation */}
          <div className="ob-profile-section">
            <div className="ob-profile-lbl">what do you do?</div>
            <input
              className="ob-inp"
              type="text"
              placeholder="e.g. software engineer, student, freelancer…"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div className="ob-chip-row">
              {OCCUPATION_PRESETS.map(p => (
                <button
                  key={p}
                  className={`ob-chip${occupation === p ? ' sel' : ''}`}
                  onClick={() => setOccupation(occupation === p ? '' : p)}
                >{p}</button>
              ))}
            </div>
          </div>

          {/* Energy pattern */}
          <div className="ob-profile-section">
            <div className="ob-profile-lbl">when are you most productive?</div>
            <div className="ob-energy-row">
              {([
                { v: 'morning', label: 'morning person', icon: '🌅' },
                { v: 'afternoon', label: 'afternoon focused', icon: '☀️' },
                { v: 'evening', label: 'evening creative', icon: '🌇' },
                { v: 'night', label: 'night owl', icon: '🌙' },
              ] as const).map(opt => (
                <button
                  key={opt.v}
                  className={`ob-energy-btn${energyPattern === opt.v ? ' sel' : ''}`}
                  onClick={() => setEnergyPattern(energyPattern === opt.v ? null : opt.v)}
                >
                  <span className="ob-energy-icon">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lifestyle */}
          <div className="ob-profile-section">
            <div className="ob-profile-lbl">what's typically part of your day? <span className="ob-profile-hint">(pick all that apply)</span></div>
            <div className="ob-chip-row">
              {LIFESTYLE_OPTS.map(opt => (
                <button
                  key={opt.value}
                  className={`ob-chip${selectedLifestyle.has(opt.value) ? ' sel' : ''}`}
                  onClick={() => toggleLifestyle(opt.value)}
                >{opt.icon} {opt.label}</button>
              ))}
            </div>
          </div>

          {/* Challenges */}
          <div className="ob-profile-section">
            <div className="ob-profile-lbl">what gets in the way? <span className="ob-profile-hint">(pick all that apply)</span></div>
            <div className="ob-chip-row">
              {CHALLENGE_OPTS.map(opt => (
                <button
                  key={opt.value}
                  className={`ob-chip${selectedChallenges.has(opt.value) ? ' sel' : ''}`}
                  onClick={() => toggleChallenge(opt.value)}
                >{opt.icon} {opt.label}</button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="ob-profile-section">
            <div className="ob-profile-lbl">anything else your coach should know? <span className="ob-profile-hint">(optional)</span></div>
            <textarea
              className="ob-inp ob-bio-inp"
              placeholder="e.g. I have a 1-year-old, I work from home, I'm trying to write a novel on the side…"
              value={profileBio}
              onChange={e => setProfileBio(e.target.value)}
            />
          </div>

          <button className="ob-p" onClick={finishSetup}>
            {occupation || energyPattern || selectedLifestyle.size > 0 ? `build my perfect day →` : `skip →`}
          </button>
          <button className="ob-back" onClick={() => goTo('s5')}>← back</button>
        </div>
      </div>

    </div>
  )
}
