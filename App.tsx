import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { todayStr, toM } from './utils'
import Onboarding from './components/Onboarding'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import MPDView from './components/MPDView'
import BlockModal from './components/BlockModal'
import ContextMenu from './components/ContextMenu'
import NotifModal from './components/NotifModal'
import ShareModal from './components/ShareModal'
import ShortcutsModal from './components/ShortcutsModal'
import SignInModal from './components/SignInModal'
import Toast from './components/Toast'
import Confetti from './components/Confetti'
import QuickAdd from './components/QuickAdd'
import FocusMode from './components/FocusMode'
import TemplatesModal from './components/TemplatesModal'
import WeekReview from './components/WeekReview'
import AICoach from './components/AICoach'
import SmartCaptureModal from './components/SmartCaptureModal'
import RescheduleModal from './components/RescheduleModal'
import FeatureTour from './components/FeatureTour'
import AnalyticsView from './components/AnalyticsView'
import GoalsView from './components/GoalsView'
import GoalsModal from './components/GoalsModal'
import DayGreeting from './components/DayGreeting'
import CommandPalette from './components/CommandPalette'
import SettingsModal from './components/SettingsModal'
import MobileNav from './components/MobileNav'
import CelebrationAnimal from './components/CelebrationAnimal'
import UnlockCelebration from './components/UnlockCelebration'

export default function App() {
  const {
    onboarded, mode, view, sbCol,
    blockModal, kbdOpen, notifOpen, shareOpen, signInOpen,
    copyBlock, pasteBlock, ctxMenu, blocks, selDate, notifSettings, hoveredBlockId,
    addToQueue,
    openKbd, closeKbd, closeNotif, closeShare, closeSignIn,
    setView, navWeek, navDay, goToday,
    hideCtxMenu,
    weekReviewOpen, closeWeekReview,
    undo, redo,
    coachOpen, closeCoach, openCoach,
    focusOpen, closeFocus, openFocus,
    templatesOpen, closeTemplates, openTemplates,
    captureOpen, openCapture, closeCapture,
    clearDay,
    timeBlindn,
    rescheduleOpen, closeReschedule,
    tourDone, completeTour,
    moodPrompt, blockMoods, rateMood, clearMoodPrompt, setMoodPrompt,
    repeatHint, clearRepeatHint, makeBlockRecurring,
    goalsOpen, closeGoals,
    settingsOpen, closeSettings,
    showGreeting, cfg,
    seedRecurring, wOff,
  } = useStore()

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Apply data-mode to <body> whenever mode changes
  useEffect(() => {
    document.body.setAttribute('data-mode', mode)
  }, [mode])

  // Apply .sbcol to <body> for the topbar toggle rotation
  useEffect(() => {
    document.body.classList.toggle('sbcol', sbCol)
  }, [sbCol])

  // Seed recurring blocks forward on mount and week navigation
  useEffect(() => {
    seedRecurring()
  }, [wOff])

  // Global keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === 'Escape') {
        if (paletteOpen) { setPaletteOpen(false); return }
        if (blockModal.open) { useStore.getState().closeBlockModal(); return }
        if (quickAddOpen) { setQuickAddOpen(false); return }
        if (focusOpen) { closeFocus(); return }
        if (goalsOpen) { closeGoals(); return }
        if (settingsOpen) { closeSettings(); return }
        if (templatesOpen) { closeTemplates(); return }
        if (weekReviewOpen) { closeWeekReview(); return }
        if (kbdOpen) { closeKbd(); return }
        if (shareOpen) { closeShare(); return }
        if (notifOpen) { closeNotif(); return }
        if (signInOpen) { closeSignIn(); return }
        hideCtxMenu()
        return
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'k') { e.preventDefault(); setPaletteOpen(true); return }
        if (e.key === 'z') { e.shiftKey ? redo() : undo(); return }
        if (e.key === 'y') { redo(); return }
        if (e.key === 'c' && ctxMenu.block) { copyBlock(ctxMenu.block); return }
        if (e.key === 'v') {
          const s = useStore.getState()
          if (s.copiedBlock) {
            pasteBlock(s.selDate || s.blocks.find(b => b)?.date || new Date().toISOString().slice(0, 10))
          }
          return
        }
        return
      }
      if (blockModal.open) return
      const k = e.key.toLowerCase()
      if (k === 'w') setView('week')
      else if (k === 'd') setView('day')
      else if (k === 'p') setView('mpd')
      else if (k === 'a') setView('analytics')
      else if (k === 't') goToday()
      else if (k === 'n') setQuickAddOpen(true)
      else if (k === 'i') openCapture()
      else if (k === 'f') openFocus()
      else if (k === 'q') {
        const hid = useStore.getState().hoveredBlockId
        const hb = hid !== null ? useStore.getState().blocks.find(b => b.id === hid) : null
        if (hb) {
          const dur = (() => { const [sh,sm]=hb.start.split(':').map(Number); const [eh,em]=hb.end.split(':').map(Number); return (eh*60+em)-(sh*60+sm) })()
          addToQueue({ name: hb.customName || hb.name, type: hb.type, duration: dur, cc: hb.cc ?? null, customName: hb.customName ?? null })
          useStore.getState().showToast(`"${hb.customName || hb.name}" added to queue`)
        }
      }
      else if (k === 'c') {
        const date = useStore.getState().selDate || todayStr()
        const count = useStore.getState().blocks.filter(b => b.date === date).length
        if (count > 0) {
          clearDay(date)
          useStore.getState().showToast(`cleared ${count} block${count > 1 ? 's' : ''} — ⌘Z to undo`)
        }
      }
      else if (e.key === 'T' && e.shiftKey) openTemplates()
      else if (k === '?') openKbd()
      else if (k === 'arrowleft') { if (view === 'week') navWeek(-1); else if (view === 'day') navDay(-1) }
      else if (k === 'arrowright') { if (view === 'week') navWeek(1); else if (view === 'day') navDay(1) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [blockModal.open, kbdOpen, shareOpen, notifOpen, signInOpen, ctxMenu, view, quickAddOpen, focusOpen, templatesOpen, weekReviewOpen, hoveredBlockId])

  // Click outside to close context menu
  useEffect(() => {
    const handler = () => hideCtxMenu()
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Handle Google Calendar OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (code && state === 'gcal_auth') {
      const verifier = sessionStorage.getItem('gcal_verifier')
      sessionStorage.removeItem('gcal_verifier')
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      if (verifier) {
        import('./gcalUtils').then(async ({ exchangeCodeForToken, fetchGcalEvents }) => {
          const s = useStore.getState()
          const token = await exchangeCodeForToken(code, s.gcalClientId, verifier, window.location.origin + window.location.pathname)
          if (token) {
            useStore.setState({ gcalAccessToken: token.access_token, gcalTokenExpiry: Date.now() + token.expires_in * 1000, gcalDone: true })
            const events = await fetchGcalEvents(token.access_token)
            const s2 = useStore.getState()
            events.forEach(ev => {
              if (!ev.start.dateTime) return // skip all-day
              const date = ev.start.dateTime.slice(0, 10)
              const start = ev.start.dateTime.slice(11, 16)
              const end = ev.end.dateTime?.slice(11, 16) || start
              const alreadyExists = s2.blocks.some(b => b.date === date && b.start === start && b.name === ev.summary)
              if (!alreadyExists) {
                s2.addBlock({ date, name: ev.summary, type: 'gcal', start, end, cc: null, customName: null })
              }
            })
            useStore.getState().showToast(`google calendar synced — ${events.length} events imported`)
          }
        })
      }
    }
  }, [])

  // Notification chime — plays a soft tone 5 min before each block starts
  // Also fires browser notifications if permission is granted
  const notifiedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!notifSettings.blocks) return
    const check = () => {
      const now = new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const todayDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      blocks.forEach(b => {
        if (b.date !== todayDate) return
        const [bh, bm] = b.start.split(':').map(Number)
        const blockMins = bh * 60 + bm
        // Fire when we're within [4, 6] minutes of the block start
        const diff = blockMins - nowMins
        if (diff >= 4 && diff <= 6) {
          const key = `${b.id}-${b.start}`
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key)
            playChime()
            useStore.getState().showToast(`⏰ in 5 min: ${b.customName || b.name}`)
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('minutely', {
                body: `Starting soon: ${b.customName || b.name} at ${b.start}`,
                icon: '/icon-192.png',
              })
            }
          }
        }
      })
    }
    check()
    const iv = setInterval(check, 30000)
    return () => clearInterval(iv)
  }, [blocks, notifSettings.blocks])

  // Gem reward — award a gem when a focus block completes naturally
  const activeFocusIdRef = useRef<number | null>(null)
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const nowM = now.getHours() * 60 + now.getMinutes()
      const td = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      const liveBlock = useStore.getState().blocks.find(b =>
        b.date === td && toM(b.start) <= nowM && toM(b.end) > nowM && b.type === 'focus'
      )
      const liveId = liveBlock?.id ?? null
      // If we were tracking a focus block and it's no longer active → it completed
      if (activeFocusIdRef.current !== null && activeFocusIdRef.current !== liveId) {
        useStore.getState().earnGem()
        useStore.getState().updateFocusStreak()
        useStore.getState().showToast('💎 focus block complete — gem earned!')
      }
      activeFocusIdRef.current = liveId
    }
    check()
    const iv = setInterval(check, 30000)
    return () => clearInterval(iv)
  }, [blocks])

  // Time blindness: nudge every 10 min when a block is active
  const tbnRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!timeBlindn) return
    const check = () => {
      const now = new Date()
      const nowM = now.getHours() * 60 + now.getMinutes()
      const td = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      const live = useStore.getState().blocks.find(b => b.date === td && toM(b.start) <= nowM && toM(b.end) > nowM)
      if (!live) return
      // Fire at each 10-min mark within the block
      if (nowM % 10 === 0) {
        const key = `${live.id}-${nowM}`
        if (!tbnRef.current.has(key)) {
          tbnRef.current.add(key)
          const minsLeft = toM(live.end) - nowM
          useStore.getState().showToast(`⏱ ${minsLeft}m left in ${live.name}`)
          if (navigator.vibrate) navigator.vibrate([100, 50, 100])
        }
      }
    }
    check()
    const iv = setInterval(check, 30000)
    return () => clearInterval(iv)
  }, [timeBlindn])

  // Mood prompt: fire when a block ends
  const moodFiredRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const nowM = now.getHours() * 60 + now.getMinutes()
      const td = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      const s = useStore.getState()
      // Find blocks that ended in the last 3 minutes and haven't been prompted
      s.blocks
        .filter(b => b.date === td)
        .forEach(b => {
          const endM = toM(b.end)
          const diff = nowM - endM
          if (diff >= 0 && diff <= 3 && !moodFiredRef.current.has(b.id) && !s.blockMoods[b.id]) {
            moodFiredRef.current.add(b.id)
            useStore.getState().setMoodPrompt({ blockId: b.id, name: b.name })
          }
        })
    }
    check()
    const iv = setInterval(check, 60000)
    return () => clearInterval(iv)
  }, [blocks])

  // Morning brief browser notification — fires between 8:00–8:05 AM if app is open
  const morningFiredRef = useRef<string | null>(null)
  useEffect(() => {
    if (!notifSettings.morning) return
    const check = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      const todayKey = now.toISOString().slice(0, 10)
      if (h === 8 && m >= 0 && m <= 4 && morningFiredRef.current !== todayKey) {
        morningFiredRef.current = todayKey
        new Notification('minutely', {
          body: 'Good morning! Your day is planned and ready.',
          icon: '/icon-192.png',
        })
      }
    }
    check()
    const iv = setInterval(check, 60000)
    return () => clearInterval(iv)
  }, [notifSettings.morning])

  // Day start / end greeting — fires at cfg.ds and cfg.de
  const greetingFiredRef = useRef<{ morning: string | null; evening: string | null; eodcheck: string | null }>({ morning: null, evening: null, eodcheck: null })
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const todayKey = now.toISOString().slice(0, 10)
      const h = now.getHours()
      const m = now.getMinutes()
      const cur = h * 60 + m
      const [dsH, dsM] = cfg.ds.split(':').map(Number)
      const [deH, deM] = cfg.de.split(':').map(Number)
      const startM = dsH * 60 + dsM
      const endM = deH * 60 + deM
      if (cur >= startM + 60 && cur <= startM + 65 && greetingFiredRef.current.morning !== todayKey) {
        greetingFiredRef.current.morning = todayKey
        showGreeting('morning')
      }
      if (cur >= endM && cur <= endM + 4 && greetingFiredRef.current.evening !== todayKey) {
        greetingFiredRef.current.evening = todayKey
        showGreeting('evening')
      }
      // Check-in 1 hour before end of day
      const eodCheckM = endM - 60
      if (eodCheckM > startM && cur >= eodCheckM && cur <= eodCheckM + 4 && greetingFiredRef.current.eodcheck !== todayKey) {
        greetingFiredRef.current.eodcheck = todayKey
        showGreeting('eodcheck')
      }
    }
    check()
    const iv = setInterval(check, 60000)
    return () => clearInterval(iv)
  }, [cfg.ds, cfg.de])

  if (!onboarded) return <Onboarding />
  if (!tourDone) return <FeatureTour onDone={completeTour} />

  return (
    <div id="app" className="on" data-mode={mode}>
      <Sidebar />
      {/* Mobile overlay to close sidebar */}
      <div id="sb-overlay" onClick={() => useStore.getState().toggleSidebar()} />
      <div id="main">
        <Topbar />
        {view === 'week' && <WeekView />}
        {view === 'day' && <DayView />}
        <MPDView />
        <AnalyticsView />
        <GoalsView />
      </div>

      {blockModal.open && <BlockModal />}
      {ctxMenu.visible && <ContextMenu />}
      {notifOpen && <NotifModal />}
      {shareOpen && <ShareModal />}
      {kbdOpen && <ShortcutsModal />}
      {signInOpen && <SignInModal />}
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
      {coachOpen && <AICoach onClose={closeCoach} />}
      {focusOpen && <FocusMode onClose={closeFocus} />}
      {templatesOpen && <TemplatesModal onClose={closeTemplates} />}
      {captureOpen && <SmartCaptureModal onClose={closeCapture} />}
      {rescheduleOpen && <RescheduleModal onClose={closeReschedule} />}
      {goalsOpen && <GoalsModal onClose={closeGoals} />}
      {settingsOpen && <SettingsModal />}
      <DayGreeting />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <CelebrationAnimal />
      <UnlockCelebration />
      {weekReviewOpen && <WeekReview />}
      <Toast />
      {moodPrompt && (
        <div className="mood-prompt">
          <div className="mp-hdr">
            <span className="mp-title">how was <strong>{moodPrompt.name}</strong>?</span>
            <button className="mp-dismiss" onClick={clearMoodPrompt}>×</button>
          </div>
          <div className="mp-opts">
            {['😤', '😐', '😊', '🔥'].map(emoji => (
              <button key={emoji} className="mp-opt" onClick={() => rateMood(moodPrompt.blockId, emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      {repeatHint && (
        <div className="repeat-hint">
          <span className="rh-text">"{repeatHint.name}" appears often — make it daily?</span>
          <div className="rh-acts">
            <button className="rh-yes" onClick={() => { makeBlockRecurring(repeatHint.blockId); clearRepeatHint(); useStore.getState().showToast(`"${repeatHint.name}" set to repeat daily`) }}>make daily</button>
            <button className="rh-no" onClick={clearRepeatHint}>not now</button>
          </div>
        </div>
      )}
      <Confetti />
      <MobileNav />
    </div>
  )
}

// Soft chime via Web Audio API — no external library needed
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99] // C5 E5 G5 major chord
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
      osc.start(t)
      osc.stop(t + 0.9)
    })
    setTimeout(() => ctx.close(), 2000)
  } catch {
    // AudioContext not available
  }
}
