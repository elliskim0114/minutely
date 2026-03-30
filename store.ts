import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Mode, View, Block, PDBlock, Config, Intentions,
  BlockModalState, CtxMenuState, NotifSettings, QueueItem, BlockTemplate, Goal, UserProfile,
} from './types'
import { todayStr, weekStart, dateStr, toM, toT, snap, setAppTz } from './utils'
import { CCOLS } from './constants'

const DEFAULT_CFG: Config = { tf: '12', ds: '06:00', de: '23:00', ws: 0 }

const DEFAULT_PD: PDBlock[] = [
  { name: 'morning routine', type: 'routine', start: '06:30', end: '07:00' },
  { name: 'deep work', type: 'focus', start: '07:00', end: '09:00' },
  { name: 'email', type: 'free', start: '09:00', end: '09:30' },
  { name: 'lunch', type: 'free', start: '12:00', end: '12:45' },
  { name: 'study', type: 'study', start: '13:00', end: '15:00' },
  { name: 'movement', type: 'routine', start: '17:00', end: '18:00' },
  { name: 'wind down', type: 'free', start: '21:00', end: '22:00' },
]

function makeSeedBlocks(nid: { v: number }): Block[] {
  const ws = weekStart(0)
  const a = (di: number, name: string, type: Block['type'], start: string, end: string): Block =>
    ({ id: nid.v++, date: dateStr(ws, di), name, type, start, end, cc: null, customName: null })
  return [
    a(1, 'morning routine', 'routine', '06:30', '07:00'),
    a(1, 'deep work', 'focus', '07:00', '09:00'),
    a(1, 'email + comms', 'free', '09:00', '09:30'),
    a(1, 'lunch', 'free', '12:00', '12:45'),
    a(1, 'study session', 'study', '13:00', '15:00'),
    a(2, 'morning routine', 'routine', '06:30', '07:00'),
    a(2, 'deep work', 'focus', '07:00', '08:30'),
    a(2, 'coffee w/ julian', 'focus', '10:00', '11:00'),
    a(2, 'lunch', 'free', '12:00', '12:45'),
    a(3, 'morning routine', 'routine', '06:30', '07:00'),
    a(3, 'planning', 'focus', '07:00', '07:30'),
    a(3, 'gym', 'routine', '17:00', '18:00'),
  ]
}

// ── Transient UI state (not persisted) ──
interface UIState {
  toast: string
  toastVisible: boolean
  blockModal: BlockModalState
  ctxMenu: CtxMenuState
  copiedBlock: Block | null
  summaryOpen: boolean
  sumMode: 'day' | 'week'
  notifOpen: boolean
  shareOpen: boolean
  kbdOpen: boolean
  signInOpen: boolean
  gcalDone: boolean
  pendingAIPrompt: string | null  // energy → MPD AI handoff
  confettiKey: number             // increments to trigger confetti burst
  celebrationAnimal: string | null  // currently active celebration animal
  unlockPopup: { type: 'theme' | 'animal' | 'legendary'; name: string; label: string; description: string; emoji: string } | null
  weekReviewOpen: boolean
  blockHistory: Block[][]         // undo stack
  blockFuture: Block[][]          // redo stack
  hoveredBlockId: number | null
  coachOpen: boolean
  coachDefaultTab: string
  settingsOpen: boolean
  repeatHint: { blockId: number; name: string } | null
  moodPrompt: { blockId: number; name: string } | null
  focusOpen: boolean
  focusMinimized: boolean
  templatesOpen: boolean
  captureOpen: boolean
  rescheduleOpen: boolean
  breakdownOpen: boolean
  weeklyPlanOpen: boolean
  emailIntakeOpen: boolean
  rescheduleDelay: number  // minutes to offset current time for "running late" feature
  goalsOpen: boolean
  greetingOpen: boolean
  greetingType: 'morning' | 'evening' | 'eodcheck'
}

// ── Persisted state ──
interface PersistedState {
  onboarded: boolean
  tourDone: boolean
  mode: Mode
  view: View
  wOff: number
  selDate: string | null
  sbCol: boolean
  cfg: Config
  blocks: Block[]
  focuses: Record<string, string>
  intentions: Record<string, Intentions>
  perfectDay: PDBlock[]
  nid: number
  userName: string | null
  userEmail: string | null
  notifSettings: NotifSettings
  queue: QueueItem[]
  qid: number
  customLabels: string[]
  customLabelColors: Record<string, number>  // label name → ccIdx
  typeColorOverrides: Record<string, number>  // type name → ccIdx override
  templates: BlockTemplate[]
  tid: number
  anthropicKey: string  // user's Anthropic API key, stored locally
  gcalClientId: string
  gcalAccessToken: string
  gcalTokenExpiry: number
  focusGems: number
  unlockedModes: string[]
  unlockedCelebrations: string[]  // 'unicorn' | 'fox' | 'dragon' | 'rocket'
  timeBlindn: boolean
  blockMoods: Record<number, string>
  hideBuiltinCustom: boolean
  hiddenBuiltinTypes: string[]  // e.g. ['focus','routine'] — preset types hidden from picker
  lockedDays: Record<string, boolean>      // date → true when user has committed to that plan
  blockMoveCounts: Record<string, number>  // block name → times moved this week (pattern detection)
  goals: Goal[]
  gid: number
  userProfile: UserProfile | null
  profileSummary: string | null
  focusStreak: number
  focusStreakDate: string | null
}

const defaultBlockModal: BlockModalState = {
  open: false, isNew: true, isForPD: false, pdIdx: -1,
  date: null, initStart: '09:00', initEnd: '10:00', block: null,
}

const defaultCtxMenu: CtxMenuState = {
  visible: false, x: 0, y: 0, block: null, date: null, mins: null,
}

type Actions = {
  // Onboarding
  finishOnboarding: (params: {
    mode: Mode
    cfg: Config
    userName: string | null
    userEmail: string | null
    perfectDay: PDBlock[]
    userProfile?: UserProfile | null
  }) => void

  // Profile
  setUserProfile: (p: UserProfile | null) => void

  // Time blindness
  setTimeBlindn: (v: boolean) => void
  clearRepeatHint: () => void
  makeBlockRecurring: (blockId: number) => void

  // Mood tagging
  rateMood: (blockId: number, mood: string) => void
  clearMoodPrompt: () => void
  setMoodPrompt: (prompt: { blockId: number; name: string } | null) => void

  // Theme / UI
  toggleMode: () => void
  setMode: (mode: Mode) => void
  clearUnlockPopup: () => void
  toggleSidebar: () => void

  // Navigation
  setView: (v: View) => void
  navWeek: (dir: number) => void
  navDay: (dir: number) => void
  goToday: () => void
  setSelDate: (d: string) => void

  // Data
  addBlock: (b: Omit<Block, 'id'>) => void
  updateBlock: (id: number, patch: Partial<Block>) => void
  deleteBlock: (id: number) => void
  setFocus: (date: string, text: string) => void
  setEnergy: (date: string, e: number) => void
  setPriority: (date: string, idx: number, val: string) => void
  setPerfectDay: (pd: PDBlock[]) => void
  applyPDTo: (date: string) => void
  applyPDToday: () => void

  // Block modal
  openBlockModalNew: (date: string, start: string, end: string) => void
  openBlockModalEdit: (block: Block) => void
  openBlockModalForPD: (startMins: number) => void
  openBlockModalEditPD: (idx: number) => void
  closeBlockModal: () => void
  saveBlockModal: (params: {
    name: string; start: string; end: string
    type: Block['type']; ccIdx: number | null; customName: string | null
    repeat?: Block['repeat']; goalId?: number | null
  }) => void
  deleteFromBlockModal: () => void

  // Context menu
  showCtxMenu: (x: number, y: number, block: Block | null, date: string, mins: number) => void
  hideCtxMenu: () => void
  ctxCopy: () => void
  ctxPaste: () => void
  ctxDelete: () => void

  // Copy/paste (keyboard)
  copyBlock: (b: Block) => void
  pasteBlock: (date: string, startMins?: number) => void

  // API key
  setAnthropicKey: (key: string) => void
  setGcalClientId: (id: string) => void
  syncGcal: () => Promise<void>
  disconnectGcal: () => void

  // AI prompt handoff
  setPendingAIPrompt: (prompt: string | null) => void

  // UI toggles
  showToast: (msg: string) => void
  openSummary: () => void
  closeSummary: () => void
  setSumMode: (m: 'day' | 'week') => void
  openNotif: () => void
  closeNotif: () => void
  openShare: () => void
  closeShare: () => void
  openKbd: () => void
  closeKbd: () => void
  openSignIn: () => void
  closeSignIn: () => void
  doLateSignIn: (email: string, name?: string) => void
  connectGCal: () => void
  toggleNotif: (key: keyof NotifSettings) => void

  // Queue
  addToQueue: (item: Omit<QueueItem, 'id'>) => void
  removeFromQueue: (id: number) => void
  scheduleQueueItem: (id: number, date: string, start: string, end: string) => void

  // Custom labels
  addCustomLabel: (label: string, ccIdx?: number) => void
  removeCustomLabel: (label: string) => void
  reorderCustomLabels: (from: number, to: number) => void
  setHoveredBlock: (id: number | null) => void

  // Type color overrides
  setTypeColorOverride: (typeName: string, ccIdx: number) => void

  // Templates
  saveAsTemplate: (name: string, selectedBlocks: BlockTemplate['blocks']) => void
  deleteTemplate: (id: number) => void
  applyTemplate: (id: number, date: string, startMins: number) => void

  // Time tracking
  trackTime: (id: number) => void
  stopTimer: (id: number) => void

  // Recurring
  applyRecurring: (id: number, targetDate: string) => void

  // Undo / Redo
  undo: () => void
  redo: () => void

  // Week review
  openWeekReview: () => void
  closeWeekReview: () => void

  // Seed
  seedIfEmpty: () => void
  seedRecurring: () => void
  getIntentions: (date: string) => Intentions

  // Settings
  openSettings: () => void
  closeSettings: () => void
  setCfg: (cfg: Config) => void
  setUserName: (name: string) => void

  // Coach / Focus / Templates / Capture modals
  openCoach: () => void
  openCoachAt: (tab: string) => void
  closeCoach: () => void
  openFocus: () => void
  closeFocus: () => void
  minimizeFocus: () => void
  maximizeFocus: () => void
  openTemplates: () => void
  closeTemplates: () => void
  openCapture: () => void
  closeCapture: () => void

  // New AI modals
  openReschedule: () => void
  closeReschedule: () => void
  openBreakdown: () => void
  closeBreakdown: () => void
  openWeeklyPlan: () => void
  closeWeeklyPlan: () => void
  openEmailIntake: () => void
  closeEmailIntake: () => void

  // Clear day
  clearDay: (date: string) => void

  // Focus gems & streak
  earnGem: () => void
  triggerCelebration: (animal: string) => void
  clearCelebration: () => void
  updateFocusStreak: () => void

  // Emergency valve / running late
  setRescheduleDelay: (delay: number) => void

  // Hide built-in custom type
  setHideBuiltinCustom: (hide: boolean) => void
  hideBuiltinType: (t: string) => void
  showBuiltinType: (t: string) => void

  // Commitment / lock tomorrow
  lockDay: (date: string) => void
  unlockDay: (date: string) => void

  // Feature tour
  completeTour: () => void

  // Goals
  addGoal: (goal: Omit<Goal, 'id'>) => void
  updateGoal: (id: number, patch: Partial<Goal>) => void
  deleteGoal: (id: number) => void
  openGoals: () => void
  closeGoals: () => void
  showGreeting: (type: 'morning' | 'evening' | 'eodcheck') => void
  closeGreeting: () => void
}

type Store = PersistedState & UIState & Actions

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ── Persisted defaults ──
      onboarded: false,
      tourDone: false,
      mode: 'light',
      view: 'week',
      wOff: 0,
      selDate: null,
      sbCol: false,
      cfg: DEFAULT_CFG,
      blocks: [],
      focuses: {},
      intentions: {},
      perfectDay: [],
      nid: 1,
      userName: null,
      userEmail: null,
      notifSettings: { blocks: false, morning: false, eod: false, energy: false },
      queue: [],
      qid: 1,
      customLabels: [],
      customLabelColors: {},
      typeColorOverrides: {},
      templates: [],
      tid: 1,
      anthropicKey: '',
      gcalClientId: '',
      gcalAccessToken: '',
      gcalTokenExpiry: 0,
      focusGems: 0,
      unlockedModes: ['light', 'dark', 'night'],
      unlockedCelebrations: [],
      timeBlindn: false,
      blockMoods: {},
      hideBuiltinCustom: false,
      hiddenBuiltinTypes: [],
      lockedDays: {},
      blockMoveCounts: {},
      goals: [],
      gid: 1,
      userProfile: null,
      profileSummary: null,
      focusStreak: 0,
      focusStreakDate: null,

      // ── UI defaults (not persisted) ──
      toast: '',
      toastVisible: false,
      blockModal: defaultBlockModal,
      ctxMenu: defaultCtxMenu,
      copiedBlock: null,
      summaryOpen: false,
      sumMode: 'day',
      notifOpen: false,
      shareOpen: false,
      kbdOpen: false,
      signInOpen: false,
      gcalDone: false,
      pendingAIPrompt: null,
      confettiKey: 0,
      celebrationAnimal: null,
      unlockPopup: null,
      weekReviewOpen: false,
      blockHistory: [],
      blockFuture: [],
      hoveredBlockId: null,
      coachOpen: false,
      coachDefaultTab: 'analyze',
      settingsOpen: false,
      repeatHint: null,
      moodPrompt: null,
      captureOpen: false,
      focusOpen: false,
      focusMinimized: false,
      templatesOpen: false,
      rescheduleOpen: false,
      breakdownOpen: false,
      weeklyPlanOpen: false,
      emailIntakeOpen: false,
      rescheduleDelay: 0,
      goalsOpen: false,
      greetingOpen: false,
      greetingType: 'morning' as const,

      // ── Actions ──
      finishOnboarding: ({ mode, cfg, userName, userEmail, perfectDay, userProfile }) => {
        set({ onboarded: true, mode, cfg, userName, userEmail, perfectDay, view: 'mpd', ...(userProfile ? { userProfile } : {}) })
        get().seedIfEmpty()
      },
      setUserProfile: (p) => set({ userProfile: p }),

      setMode: (m) => set({ mode: m }),
      clearUnlockPopup: () => set({ unlockPopup: null }),
      toggleMode: () => set(s => {
        const modes = s.unlockedModes.length > 0 ? s.unlockedModes : ['light', 'dark', 'night']
        const idx = modes.indexOf(s.mode)
        return { mode: (modes[(idx + 1) % modes.length]) as any }
      }),
      toggleSidebar: () => set(s => ({ sbCol: !s.sbCol })),

      setView: (v) => set({ view: v }),
      navWeek: (dir) => set(s => ({ wOff: s.wOff + dir })),
      navDay: (dir) => set(s => {
        const d = new Date(s.selDate || todayStr())
        d.setDate(d.getDate() + dir)
        return { selDate: d.toISOString().slice(0, 10) }
      }),
      goToday: () => set({ wOff: 0, selDate: todayStr() }),
      setSelDate: (d) => set({ selDate: d }),

      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setGcalClientId: (id) => set({ gcalClientId: id }),
      disconnectGcal: () => set({ gcalDone: false, gcalAccessToken: '', gcalTokenExpiry: 0 }),
      syncGcal: async () => {
        const { gcalClientId, gcalAccessToken, gcalTokenExpiry } = get()
        if (!gcalClientId) {
          get().showToast('add your Google Client ID in GCal settings first')
          return
        }
        // Check if token is still valid
        if (gcalAccessToken && gcalTokenExpiry > Date.now()) {
          const { fetchGcalEvents } = await import('./gcalUtils')
          const events = await fetchGcalEvents(gcalAccessToken)
          const s = get()
          events.forEach(ev => {
            if (!ev.start.dateTime) return
            const date = ev.start.dateTime.slice(0, 10)
            const start = ev.start.dateTime.slice(11, 16)
            const end = ev.end.dateTime?.slice(11, 16) || start
            const alreadyExists = s.blocks.some(b => b.date === date && b.start === start && b.name === ev.summary)
            if (!alreadyExists) {
              s.addBlock({ date, name: ev.summary, type: 'gcal', start, end, cc: null, customName: null })
            }
          })
          get().showToast(`google calendar synced — ${events.length} events imported`)
          return
        }
        // Initiate OAuth2 PKCE flow
        const { generateCodeVerifier, generateCodeChallenge } = await import('./gcalUtils')
        const verifier = generateCodeVerifier()
        const challenge = await generateCodeChallenge(verifier)
        sessionStorage.setItem('gcal_verifier', verifier)
        const params = new URLSearchParams({
          client_id: gcalClientId,
          redirect_uri: window.location.origin + window.location.pathname,
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
          state: 'gcal_auth',
        })
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
      },

      setPendingAIPrompt: (prompt) => set({ pendingAIPrompt: prompt }),

      addBlock: (b) => {
        set(s => {
          const newId = s.nid
          const allBlocks = [...s.blocks, { ...b, id: newId }]
          // Check for repeat pattern: 3+ blocks with same name (case-insensitive), none already recurring
          const sameName = allBlocks.filter(bl => bl.name.toLowerCase() === b.name.toLowerCase() && (!bl.repeat || bl.repeat === 'none'))
          const shouldHint = sameName.length >= 3 && !allBlocks.some(bl => bl.name.toLowerCase() === b.name.toLowerCase() && bl.repeat && bl.repeat !== 'none')
          return {
            blockHistory: [...s.blockHistory.slice(-29), s.blocks],
            blockFuture: [],
            blocks: allBlocks,
            nid: s.nid + 1,
            confettiKey: s.confettiKey + 1,
            repeatHint: shouldHint ? { blockId: newId, name: b.name } : s.repeatHint,
          }
        })
      },
      updateBlock: (id, patch) => set(s => {
        const orig = s.blocks.find(b => b.id === id)
        // Track move counts for pattern detection (when time changes)
        const isMoved = orig && (patch.start !== undefined || patch.end !== undefined) &&
          (patch.start !== orig.start || patch.end !== orig.end)
        const blockMoveCounts = isMoved && orig
          ? { ...s.blockMoveCounts, [orig.name]: (s.blockMoveCounts[orig.name] || 0) + 1 }
          : s.blockMoveCounts
        return {
          blockHistory: [...s.blockHistory.slice(-29), s.blocks],
          blockFuture: [],
          blocks: s.blocks.map(b => b.id === id ? { ...b, ...patch } : b),
          blockMoveCounts,
        }
      }),
      deleteBlock: (id) => set(s => ({
        blockHistory: [...s.blockHistory.slice(-29), s.blocks],
        blockFuture: [],
        blocks: s.blocks.filter(b => b.id !== id),
      })),
      setFocus: (date, text) => set(s => ({ focuses: { ...s.focuses, [date]: text } })),
      setEnergy: (date, e) => set(s => {
        const int = s.intentions[date] || { e: 0, p: ['', '', ''] }
        return { intentions: { ...s.intentions, [date]: { ...int, e } } }
      }),
      setPriority: (date, idx, val) => set(s => {
        const int = s.intentions[date] || { e: 0, p: ['', '', ''] }
        const p = [...int.p] as [string, string, string]
        p[idx] = val
        return { intentions: { ...s.intentions, [date]: { ...int, p } } }
      }),
      setPerfectDay: (pd) => set({ perfectDay: pd }),
      applyPDTo: (date) => {
        const { blocks, perfectDay, nid } = get()
        const next = blocks.filter(b => b.date !== date)
        let id = nid
        perfectDay.forEach(b => next.push({ ...b, id: id++, date, cc: b.cc ? { ...b.cc } : null }))
        set({ blocks: next, nid: id })
        get().showToast(`perfect day applied to ${date === todayStr() ? 'today' : date}`)
      },
      applyPDToday: () => get().applyPDTo(todayStr()),

      openBlockModalNew: (date, start, end) => set({
        blockModal: { open: true, isNew: true, isForPD: false, pdIdx: -1, date, initStart: start, initEnd: end, block: null },
      }),
      openBlockModalEdit: (block) => set({
        blockModal: { open: true, isNew: false, isForPD: false, pdIdx: -1, date: block.date, initStart: block.start, initEnd: block.end, block },
      }),
      openBlockModalForPD: (startMins) => {
        const { cfg } = get()
        set({
          blockModal: {
            open: true, isNew: true, isForPD: true, pdIdx: -1, date: null,
            initStart: toT(startMins),
            initEnd: toT(Math.min(toM(cfg.de), startMins + 60)),
            block: null,
          },
        })
      },
      openBlockModalEditPD: (idx) => {
        const { perfectDay } = get()
        if (idx < 0 || idx >= perfectDay.length) return
        const b = perfectDay[idx]
        set({
          blockModal: {
            open: true, isNew: false, isForPD: true, pdIdx: idx, date: null,
            initStart: b.start, initEnd: b.end,
            block: { ...b, id: -idx, date: '' },
          },
        })
      },
      closeBlockModal: () => set({ blockModal: { ...get().blockModal, open: false } }),
      saveBlockModal: ({ name, start, end, type, ccIdx, customName, repeat, goalId }) => {
        const { blockModal, blocks, perfectDay, nid } = get()
        const cc = type === 'custom' && ccIdx !== null ? { ...CCOLS[ccIdx] } : null
        const actualType = type === 'custom' ? 'custom' : type

        if (blockModal.isForPD) {
          const newBlock: PDBlock = { name, type: actualType, start, end, cc, customName }
          if (blockModal.pdIdx >= 0) {
            const pd = [...perfectDay]
            pd[blockModal.pdIdx] = newBlock
            set({ perfectDay: pd })
          } else {
            set({ perfectDay: [...perfectDay, newBlock] })
          }
          get().closeBlockModal()
          return
        }

        const MEETING_KEYWORDS = ['meeting', 'call', 'sync', 'standup', 'interview', 'demo', 'review', 'presentation', '1:1', 'one-on-one', 'oneon-one']

        if (blockModal.isNew) {
          const newBlocks: Block[] = [{ id: nid, date: blockModal.date!, name, type: actualType, start, end, cc, customName, repeat: repeat || 'none', goalId: goalId ?? null }]
          let nextNid = nid + 1

          // Meeting Prep Auto-block: if it's a routine block with a meeting keyword, add a 10-min prep before it
          if (type === 'routine' && MEETING_KEYWORDS.some(kw => name.toLowerCase().includes(kw))) {
            const startMins = toM(start)
            const prepEnd = start
            const prepStart = toT(startMins - 10)
            // Only add prep if the slot is free (no existing block overlaps)
            const slotFree = !blocks.some(b =>
              b.date === blockModal.date &&
              toM(b.start) < startMins &&
              toM(b.end) > startMins - 10
            )
            if (startMins >= 10 && slotFree) {
              newBlocks.unshift({ id: nextNid, date: blockModal.date!, name: `prep: ${name}`, type: 'focus', start: prepStart, end: prepEnd, cc: null, customName: null, repeat: 'none' })
              nextNid++
              setTimeout(() => get().showToast(`added prep time before ${name}`), 100)
            }
          }

          set({
            blocks: [...blocks, ...newBlocks],
            nid: nextNid,
            confettiKey: get().confettiKey + 1,
          })
        } else if (blockModal.block) {
          set({
            blocks: blocks.map(b => b.id === blockModal.block!.id
              ? { ...b, name, type: actualType, start, end, cc, customName, repeat: repeat || b.repeat || 'none', goalId: goalId !== undefined ? goalId : b.goalId }
              : b
            ),
          })
        }
        get().closeBlockModal()
      },
      deleteFromBlockModal: () => {
        const { blockModal, perfectDay } = get()
        if (blockModal.isForPD && blockModal.pdIdx >= 0) {
          const pd = [...perfectDay]
          pd.splice(blockModal.pdIdx, 1)
          set({ perfectDay: pd })
          get().closeBlockModal()
          return
        }
        if (blockModal.block) {
          get().deleteBlock(blockModal.block.id)
        }
        get().closeBlockModal()
      },

      showCtxMenu: (x, y, block, date, mins) => set({
        ctxMenu: { visible: true, x, y, block, date, mins },
      }),
      hideCtxMenu: () => set({ ctxMenu: { ...get().ctxMenu, visible: false } }),
      ctxCopy: () => {
        const { ctxMenu } = get()
        if (ctxMenu.block) {
          set({ copiedBlock: { ...ctxMenu.block } })
          get().showToast('block copied')
        }
        get().hideCtxMenu()
      },
      ctxPaste: () => {
        const { copiedBlock, ctxMenu, cfg, nid, blocks } = get()
        get().hideCtxMenu()
        if (!copiedBlock) return
        const dur = toM(copiedBlock.end) - toM(copiedBlock.start)
        const start = ctxMenu.mins != null ? ctxMenu.mins : toM(copiedBlock.start)
        const end = Math.min(toM(cfg.de), start + dur)
        set(s => ({
          blockHistory: [...s.blockHistory.slice(-29), s.blocks],
          blockFuture: [],
          blocks: [...blocks, {
            id: nid,
            date: ctxMenu.date || todayStr(),
            name: copiedBlock.name,
            type: copiedBlock.type,
            start: toT(start),
            end: toT(end),
            cc: copiedBlock.cc ? { ...copiedBlock.cc } : null,
            customName: copiedBlock.customName || null,
          }],
          nid: nid + 1,
        }))
        get().showToast('block pasted')
      },
      ctxDelete: () => {
        const { ctxMenu } = get()
        get().hideCtxMenu()
        if (ctxMenu.block) get().deleteBlock(ctxMenu.block.id)
      },

      copyBlock: (b) => {
        set({ copiedBlock: { ...b } })
        get().showToast('block copied')
      },
      pasteBlock: (date, startMins) => {
        const { copiedBlock, cfg, nid, blocks } = get()
        if (!copiedBlock) return
        const dur = toM(copiedBlock.end) - toM(copiedBlock.start)
        const start = startMins != null ? startMins : snap(toM(copiedBlock.start))
        const end = Math.min(toM(cfg.de), start + dur)
        set(s => ({
          blockHistory: [...s.blockHistory.slice(-29), s.blocks],
          blockFuture: [],
          blocks: [...blocks, {
            id: nid,
            date,
            name: copiedBlock.name,
            type: copiedBlock.type,
            start: toT(start),
            end: toT(end),
            cc: copiedBlock.cc ? { ...copiedBlock.cc } : null,
            customName: copiedBlock.customName || null,
          }],
          nid: nid + 1,
        }))
        get().showToast('block pasted')
      },

      showToast: (msg) => {
        set({ toast: msg, toastVisible: true })
        setTimeout(() => set({ toastVisible: false }), 2700)
      },
      openSummary: () => { set({ summaryOpen: true, sumMode: 'day' }) },
      closeSummary: () => set({ summaryOpen: false }),
      setSumMode: (m) => set({ sumMode: m }),
      openNotif: () => set({ notifOpen: true }),
      closeNotif: () => set({ notifOpen: false }),
      openShare: () => set({ shareOpen: true }),
      closeShare: () => set({ shareOpen: false }),
      openKbd: () => set({ kbdOpen: true }),
      closeKbd: () => set({ kbdOpen: false }),
      openSignIn: () => set({ signInOpen: true }),
      closeSignIn: () => set({ signInOpen: false }),
      doLateSignIn: (email, name) => {
        set({
          userName: name || (email ? email.split('@')[0] : 'guest'),
          userEmail: email || null,
          signInOpen: false,
        })
        get().showToast('signed in — data saved locally')
      },
      connectGCal: () => {
        const { gcalDone, nid, blocks } = get()
        if (gcalDone) { get().showToast('already synced'); return }
        get().showToast('connecting…')
        setTimeout(() => {
          const td = todayStr()
          set({
            gcalDone: true,
            blocks: [
              ...blocks,
              { id: nid, date: td, name: 'team standup', type: 'gcal', start: '09:00', end: '09:30', cc: null, customName: null },
              { id: nid + 1, date: td, name: 'design review', type: 'gcal', start: '14:00', end: '15:00', cc: null, customName: null },
            ],
            nid: nid + 2,
          })
          get().showToast('Google Calendar synced')
        }, 1200)
      },
      toggleNotif: (key) => set(s => ({
        notifSettings: { ...s.notifSettings, [key]: !s.notifSettings[key] },
      })),

      addToQueue: (item) => set(s => ({
        queue: [...s.queue, { ...item, id: s.qid }],
        qid: s.qid + 1,
      })),
      removeFromQueue: (id) => set(s => ({ queue: s.queue.filter(q => q.id !== id) })),
      scheduleQueueItem: (id, date, start, end) => {
        const { queue, nid, blocks } = get()
        const item = queue.find(q => q.id === id)
        if (!item) return
        set({
          blocks: [...blocks, {
            id: nid,
            date,
            name: item.name,
            type: item.type,
            start,
            end,
            cc: item.cc ? { ...item.cc } : null,
            customName: item.customName || null,
          }],
          nid: nid + 1,
          queue: queue.filter(q => q.id !== id),
        })
        get().showToast(`"${item.name}" added to ${date === todayStr() ? 'today' : date}`)
      },

      addCustomLabel: (label, ccIdx) => set(s => ({
        customLabels: s.customLabels.includes(label) ? s.customLabels : [...s.customLabels, label],
        customLabelColors: ccIdx !== undefined ? { ...s.customLabelColors, [label]: ccIdx } : s.customLabelColors,
      })),
      removeCustomLabel: (label) => set(s => {
        const colors = { ...s.customLabelColors }
        delete colors[label]
        return { customLabels: s.customLabels.filter(l => l !== label), customLabelColors: colors }
      }),
      reorderCustomLabels: (from, to) => set(s => {
        const arr = [...s.customLabels]
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        return { customLabels: arr }
      }),
      setHoveredBlock: (id) => set({ hoveredBlockId: id }),

      setTypeColorOverride: (typeName, ccIdx) => set(s => ({
        typeColorOverrides: { ...s.typeColorOverrides, [typeName]: ccIdx },
      })),

      saveAsTemplate: (name, blocks) => set(s => ({
        templates: [...s.templates, { id: s.tid, name, blocks }],
        tid: s.tid + 1,
      })),
      deleteTemplate: (id) => set(s => ({ templates: s.templates.filter(t => t.id !== id) })),
      applyTemplate: (id, date, startMins) => {
        const { templates, blocks, nid, cfg } = get()
        const tmpl = templates.find(t => t.id === id)
        if (!tmpl) return
        let cur = startMins
        let newId = nid
        const newBlocks = tmpl.blocks.map(tb => {
          const start = toT(cur)
          const end = toT(Math.min(toM(cfg.de), cur + tb.duration))
          cur += tb.duration
          return { id: newId++, date, name: tb.name, type: tb.type as Block['type'], start, end, cc: tb.cc || null, customName: tb.customName || null }
        })
        set({ blocks: [...blocks, ...newBlocks], nid: newId })
        get().showToast(`template "${tmpl.name}" applied`)
      },

      undo: () => {
        const { blockHistory, blocks, blockFuture } = get()
        if (blockHistory.length === 0) { get().showToast('nothing to undo'); return }
        const prev = blockHistory[blockHistory.length - 1]
        set({
          blocks: prev,
          blockHistory: blockHistory.slice(0, -1),
          blockFuture: [blocks, ...blockFuture.slice(0, 29)],
        })
        get().showToast('undone')
      },
      redo: () => {
        const { blockHistory, blocks, blockFuture } = get()
        if (blockFuture.length === 0) { get().showToast('nothing to redo'); return }
        const next = blockFuture[0]
        set({
          blocks: next,
          blockHistory: [...blockHistory.slice(-29), blocks],
          blockFuture: blockFuture.slice(1),
        })
        get().showToast('redone')
      },

      openWeekReview: () => set({ weekReviewOpen: true }),
      closeWeekReview: () => set({ weekReviewOpen: false }),

      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
      setCfg: (cfg) => { setAppTz(cfg.tz || null); set({ cfg }) },
      setUserName: (name) => set({ userName: name }),

      openCoach: () => set({ coachOpen: true, coachDefaultTab: 'analyze' }),
      openCoachAt: (tab) => set({ coachOpen: true, coachDefaultTab: tab }),
      closeCoach: () => set({ coachOpen: false }),
      openCapture: () => set({ captureOpen: true }),
      closeCapture: () => set({ captureOpen: false }),
      openFocus: () => set({ focusOpen: true, focusMinimized: false }),
      closeFocus: () => set({ focusOpen: false, focusMinimized: false }),
      minimizeFocus: () => set({ focusMinimized: true }),
      maximizeFocus: () => set({ focusMinimized: false }),
      openTemplates: () => set({ templatesOpen: true }),
      closeTemplates: () => set({ templatesOpen: false }),
      openReschedule: () => set({ rescheduleOpen: true }),
      closeReschedule: () => set({ rescheduleOpen: false, rescheduleDelay: 0 }),
      setRescheduleDelay: (delay) => set({ rescheduleDelay: delay }),
      setHideBuiltinCustom: (hide) => set({ hideBuiltinCustom: hide }),
      hideBuiltinType: (t) => set(s => ({ hiddenBuiltinTypes: [...(s.hiddenBuiltinTypes || []), t] })),
      showBuiltinType: (t) => set(s => ({ hiddenBuiltinTypes: (s.hiddenBuiltinTypes || []).filter(x => x !== t) })),
      completeTour: () => set({ tourDone: true }),

      showGreeting: (type) => set({ greetingOpen: true, greetingType: type }),
      closeGreeting: () => set({ greetingOpen: false }),

      addGoal: (goal) => set(s => ({ goals: [...s.goals, { ...goal, id: s.gid }], gid: s.gid + 1 })),
      updateGoal: (id, patch) => set(s => ({ goals: s.goals.map(g => g.id === id ? { ...g, ...patch } : g) })),
      deleteGoal: (id) => set(s => ({ goals: s.goals.filter(g => g.id !== id) })),
      openGoals: () => set({ goalsOpen: true }),
      closeGoals: () => set({ goalsOpen: false }),
      lockDay: (date) => set(s => ({ lockedDays: { ...s.lockedDays, [date]: true } })),
      unlockDay: (date) => set(s => {
        const ld = { ...s.lockedDays }
        delete ld[date]
        return { lockedDays: ld }
      }),
      openBreakdown: () => set({ breakdownOpen: true }),
      closeBreakdown: () => set({ breakdownOpen: false }),
      openWeeklyPlan: () => set({ weeklyPlanOpen: true }),
      closeWeeklyPlan: () => set({ weeklyPlanOpen: false }),
      openEmailIntake: () => set({ emailIntakeOpen: true }),
      closeEmailIntake: () => set({ emailIntakeOpen: false }),

      clearDay: (date) => set(s => ({
        blockHistory: [...s.blockHistory.slice(-29), s.blocks],
        blockFuture: [],
        blocks: s.blocks.filter(b => b.date !== date),
      })),

      trackTime: (id) => set(s => ({
        blocks: s.blocks.map(b => b.id === id ? { ...b, timerStart: Date.now() } : b),
      })),
      stopTimer: (id) => set(s => ({
        blocks: s.blocks.map(b => {
          if (b.id !== id || !b.timerStart) return b
          const elapsed = Math.floor((Date.now() - b.timerStart) / 1000)
          return { ...b, timerStart: null, totalTracked: (b.totalTracked || 0) + elapsed }
        }),
      })),

      applyRecurring: (id, targetDate) => {
        const { blocks, nid } = get()
        const src = blocks.find(b => b.id === id)
        if (!src) return
        const already = blocks.some(b => b.date === targetDate && b.name === src.name && b.start === src.start)
        if (already) { get().showToast('block already exists on that date'); return }
        set({
          blocks: [...blocks, { ...src, id: nid, date: targetDate, timerStart: null, totalTracked: 0 }],
          nid: nid + 1,
        })
        get().showToast(`block copied to ${targetDate}`)
      },

      seedIfEmpty: () => {
        const { blocks, perfectDay, nid } = get()
        if (blocks.length) return
        const nidRef = { v: nid }
        const seeded = makeSeedBlocks(nidRef)
        const ws = weekStart(0)
        const td = todayStr()
        set({
          blocks: seeded,
          nid: nidRef.v,
          perfectDay: perfectDay.length ? perfectDay : DEFAULT_PD,
          focuses: {
            [dateStr(ws, 0)]: 'rest & recharge',
            [dateStr(ws, 1)]: 'ship the redesign',
            [dateStr(ws, 2)]: 'coffee chat w/ julian',
          },
          intentions: {
            [td]: { e: 2, p: ['launch redesign', 'reply to all DMs', 'evening walk'] },
          },
        })
      },

      getIntentions: (date) => {
        const { intentions } = get()
        return intentions[date] || { e: 0, p: ['', '', ''] }
      },

      seedRecurring: () => {
        const s = get()
        const recurring = s.blocks.filter(b => b.repeat && b.repeat !== 'none')
        if (!recurring.length) return
        const today = new Date()
        const newBlocks: Block[] = []
        let nextId = s.nid
        const LIMIT = 50

        recurring.forEach(template => {
          if (newBlocks.length >= LIMIT) return
          const repeat = template.repeat!

          const targets: string[] = []
          if (repeat === 'daily') {
            for (let i = 1; i <= 21 && targets.length < 21; i++) {
              const d = new Date(today)
              d.setDate(d.getDate() + i)
              targets.push(d.toISOString().slice(0, 10))
            }
          } else if (repeat === 'weekdays') {
            for (let i = 1; i <= 30 && targets.length < 21; i++) {
              const d = new Date(today)
              d.setDate(d.getDate() + i)
              const dow = d.getDay()
              if (dow >= 1 && dow <= 5) targets.push(d.toISOString().slice(0, 10))
            }
          } else if (repeat === 'weekly') {
            const templateDate = new Date(template.date)
            const templateDow = templateDate.getDay()
            for (let i = 1; i <= 4 && targets.length < 4; i++) {
              const d = new Date(today)
              // Find next occurrence of same day of week
              const daysUntil = (templateDow - d.getDay() + 7) % 7 || 7
              d.setDate(d.getDate() + daysUntil + (i - 1) * 7)
              targets.push(d.toISOString().slice(0, 10))
            }
          }

          targets.forEach(dateTarget => {
            if (newBlocks.length >= LIMIT) return
            // Check if already exists (same name + start on that date)
            const alreadyExists = s.blocks.some(b => b.date === dateTarget && b.name === template.name && b.start === template.start)
            const alreadyInNew = newBlocks.some(b => b.date === dateTarget && b.name === template.name && b.start === template.start)
            if (!alreadyExists && !alreadyInNew) {
              newBlocks.push({
                ...template,
                id: nextId++,
                date: dateTarget,
              })
            }
          })
        })

        if (newBlocks.length > 0) {
          set(st => ({
            blocks: [...st.blocks, ...newBlocks],
            nid: nextId,
          }))
        }
      },

      setTimeBlindn: (v) => set({ timeBlindn: v }),
      clearRepeatHint: () => set({ repeatHint: null }),
      makeBlockRecurring: (blockId) => set(s => ({
        blockHistory: [...s.blockHistory.slice(-29), s.blocks],
        blockFuture: [],
        blocks: s.blocks.map(b => b.id === blockId ? { ...b, repeat: 'daily' } : b),
      })),

      rateMood: (blockId, mood) => set(s => ({
        blockMoods: { ...s.blockMoods, [blockId]: mood },
        moodPrompt: null,
      })),
      clearMoodPrompt: () => set({ moodPrompt: null }),
      setMoodPrompt: (prompt) => set({ moodPrompt: prompt }),

      earnGem: () => {
        // Guard: max 1 gem per 30 seconds to prevent double-fire
        const now = Date.now()
        const s = useStore.getState()
        if ((s as any)._lastGemTime && now - (s as any)._lastGemTime < 30_000) return
        ;(useStore.getState() as any)._lastGemTime = now

        set(s => {
          const gems = s.focusGems + 1
          const newModes = [...s.unlockedModes]
          const newCelebrations = [...(s.unlockedCelebrations || [])]
          let toastMsg = `◆ gem #${gems} earned`
          let triggerAnimal = ''
          let doConfetti = false
          let popup: typeof s.unlockPopup = null

          // ── Milestone rewards ──
          if (gems === 5 && !newModes.includes('ember')) {
            newModes.push('ember')
            toastMsg = '◆ ×5 — ember theme unlocked!'
            doConfetti = true
            popup = { type: 'theme', name: 'ember', label: 'Ember Theme', description: 'A warm amber-gold theme that glows like a campfire at dusk.', emoji: '🔥' }
          } else if (gems === 10 && !newCelebrations.includes('unicorn')) {
            newCelebrations.push('unicorn')
            triggerAnimal = 'unicorn'
            doConfetti = true
            popup = { type: 'animal', name: 'unicorn', label: 'Unicorn Celebration', description: 'A unicorn will prance across your screen every time you earn a gem!', emoji: '🦄' }
          } else if (gems === 12 && !newModes.includes('ocean')) {
            newModes.push('ocean')
            doConfetti = true
            popup = { type: 'theme', name: 'ocean', label: 'Ocean Theme', description: 'A deep ocean blue theme — cool, immersive, and focused.', emoji: '🌊' }
          } else if (gems === 20 && !newModes.includes('forest')) {
            newModes.push('forest')
            newCelebrations.push('fox')
            triggerAnimal = 'fox'
            doConfetti = true
            popup = { type: 'theme', name: 'forest', label: 'Forest Theme + Fox', description: 'A mossy dark green theme AND a fox that trots across your screen!', emoji: '🌿' }
          } else if (gems === 35 && !newModes.includes('aurora')) {
            newModes.push('aurora')
            doConfetti = true
            popup = { type: 'theme', name: 'aurora', label: 'Aurora Theme', description: 'A dark purple-teal aurora theme — mysterious and beautiful.', emoji: '✨' }
          } else if (gems === 50 && !newCelebrations.includes('dragon')) {
            newCelebrations.push('dragon')
            triggerAnimal = 'dragon'
            doConfetti = true
            popup = { type: 'animal', name: 'dragon', label: 'Dragon Celebration', description: 'A dragon will soar across your screen when you earn gems!', emoji: '🐉' }
          } else if (gems === 75 && !newModes.includes('neon')) {
            newModes.push('neon')
            newCelebrations.push('rocket')
            triggerAnimal = 'rocket'
            doConfetti = true
            popup = { type: 'theme', name: 'neon', label: 'Neon Theme + Rocket', description: 'An electric neon theme AND a rocket that blasts across your screen!', emoji: '🚀' }
          } else if (gems === 100) {
            toastMsg = '◆ ×100 — absolute focus master!'
            doConfetti = true
            popup = { type: 'legendary', name: 'master', label: 'Focus Master', description: '100 focus gems. You\'ve achieved something truly rare. Legendary.', emoji: '💎' }
          }

          setTimeout(() => useStore.getState().showToast(toastMsg), 50)
          if (doConfetti) setTimeout(() => useStore.setState({ confettiKey: s.confettiKey + 1 }), 200)
          if (popup) setTimeout(() => useStore.setState({ unlockPopup: popup }), 400)

          // On non-milestone gems, run an animal if celebrations are unlocked (every 5 gems)
          const finalCelebrations = newCelebrations.length > 0 ? newCelebrations : s.unlockedCelebrations
          if (!popup && !triggerAnimal && finalCelebrations.length > 0 && gems > 10 && gems % 5 === 0) {
            triggerAnimal = finalCelebrations[Math.floor(Math.random() * finalCelebrations.length)]
          }
          if (triggerAnimal) {
            setTimeout(() => useStore.setState({ celebrationAnimal: triggerAnimal }), 600)
            setTimeout(() => useStore.setState({ celebrationAnimal: null }), 5600)
          }

          return { focusGems: gems, unlockedModes: newModes, unlockedCelebrations: newCelebrations }
        })
      },
      triggerCelebration: (animal) => {
        useStore.setState({ celebrationAnimal: animal })
        setTimeout(() => useStore.setState({ celebrationAnimal: null }), 5000)
      },
      clearCelebration: () => set({ celebrationAnimal: null }),
      updateFocusStreak: () => {
        const today = new Date().toISOString().slice(0, 10)
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
        const { focusStreak, focusStreakDate } = get()
        if (focusStreakDate === today) return // already counted today
        const newStreak = focusStreakDate === yesterday ? (focusStreak || 0) + 1 : 1
        set({ focusStreak: newStreak, focusStreakDate: today })
      },
    }),
    {
      name: 'mn-store',
      partialize: (state) => ({
        onboarded: state.onboarded,
        mode: state.mode,
        view: state.view,
        wOff: state.wOff,
        selDate: state.selDate,
        sbCol: state.sbCol,
        cfg: state.cfg,
        blocks: state.blocks,
        focuses: state.focuses,
        intentions: state.intentions,
        perfectDay: state.perfectDay,
        nid: state.nid,
        userName: state.userName,
        userEmail: state.userEmail,
        notifSettings: state.notifSettings,
        queue: state.queue,
        qid: state.qid,
        customLabels: state.customLabels,
        customLabelColors: state.customLabelColors,
        typeColorOverrides: state.typeColorOverrides,
        templates: state.templates,
        tid: state.tid,
        anthropicKey: state.anthropicKey,
        gcalClientId: state.gcalClientId,
        gcalAccessToken: state.gcalAccessToken,
        gcalTokenExpiry: state.gcalTokenExpiry,
        focusGems: state.focusGems,
        unlockedModes: state.unlockedModes,
        unlockedCelebrations: state.unlockedCelebrations,
        timeBlindn: state.timeBlindn,
        blockMoods: state.blockMoods,
        hideBuiltinCustom: state.hideBuiltinCustom,
        hiddenBuiltinTypes: state.hiddenBuiltinTypes,
        tourDone: state.tourDone,
        lockedDays: state.lockedDays,
        blockMoveCounts: state.blockMoveCounts,
        goals: state.goals,
        gid: state.gid,
        userProfile: state.userProfile,
        focusStreak: state.focusStreak,
        focusStreakDate: state.focusStreakDate,
      }),
      onRehydrateStorage: () => (state) => {
        // Re-apply timezone on page load from persisted cfg
        if (state?.cfg?.tz) setAppTz(state.cfg.tz)

        // Retroactively grant any milestones the user earned before this feature existed
        // (e.g. users who already had 18 gems but never hit gems===10 with the new code)
        if (state) {
          const gems = state.focusGems || 0
          const modes = [...(state.unlockedModes || [])]
          const celebrations = [...(state.unlockedCelebrations || [])]
          let changed = false
          const grantMode = (m: string) => { if (!modes.includes(m)) { modes.push(m); changed = true } }
          const grantCel  = (c: string) => { if (!celebrations.includes(c)) { celebrations.push(c); changed = true } }
          if (gems >= 5)  grantMode('ember')
          if (gems >= 10) grantCel('unicorn')
          if (gems >= 12) grantMode('ocean')
          if (gems >= 20) { grantMode('forest'); grantCel('fox') }
          if (gems >= 35) grantMode('aurora')
          if (gems >= 50) grantCel('dragon')
          if (gems >= 75) { grantMode('neon'); grantCel('rocket') }
          if (changed) {
            // Schedule microtask so the store is fully ready
            Promise.resolve().then(() =>
              useStore.setState({ unlockedModes: modes, unlockedCelebrations: celebrations })
            )
          }
        }
      },
    }
  )
)
