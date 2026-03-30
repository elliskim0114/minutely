export type Mode = 'light' | 'dark' | 'night' | 'ember' | 'ocean' | 'forest' | 'aurora' | 'neon'
export type View = 'week' | 'day' | 'mpd' | 'analytics' | 'goals'

export interface Goal {
  id: number
  name: string
  color: string     // hex color
  targetHours: number             // the target amount (hours or minutes depending on targetUnit)
  targetUnit?: 'hours' | 'minutes'    // default: 'hours'
  targetPeriod?: 'daily' | 'weekly' | 'monthly'  // default: 'weekly'
  description?: string
}
export type BlockType = 'focus' | 'routine' | 'study' | 'free' | 'gcal' | 'custom'

export interface CustomColor {
  bg: string
  bd: string
  ink: string
  n: string
}

export interface Block {
  id: number
  date: string // YYYY-MM-DD
  name: string
  type: BlockType
  start: string // HH:MM
  end: string   // HH:MM
  cc?: CustomColor | null
  customName?: string | null
  timerStart?: number | null
  totalTracked?: number
  repeat?: 'none' | 'daily' | 'weekdays' | 'weekly'
  goalId?: number | null
}

export interface PDBlock {
  name: string
  type: BlockType
  start: string
  end: string
  cc?: CustomColor | null
  customName?: string | null
}

export interface Intentions {
  e: number // energy 0-3
  p: [string, string, string] // priorities
}

export interface Config {
  tf: '12' | '24'
  ds: string // day start HH:MM
  de: string // day end HH:MM
  ws: 0 | 1  // week start: 0=Sun, 1=Mon
  tz?: string // IANA timezone e.g. 'America/New_York' (optional, defaults to system tz)
}

export interface UserProfile {
  occupation: string            // e.g. "software engineer", "student"
  energyPattern: 'morning' | 'afternoon' | 'evening' | 'night'
  lifestyle: string[]           // e.g. ['exercise', 'family', 'commute']
  challenges: string[]          // e.g. ['procrastination', 'meetings']
  bio: string                   // free-text extra context
}

export interface NotifSettings {
  blocks: boolean
  morning: boolean
  eod: boolean
  energy: boolean
}

export interface BlockModalState {
  open: boolean
  isNew: boolean
  isForPD: boolean
  pdIdx: number
  date: string | null
  initStart: string
  initEnd: string
  block: Block | null
}

export interface CtxMenuState {
  visible: boolean
  x: number
  y: number
  block: Block | null
  date: string | null
  mins: number | null
}

export interface QueueItem {
  id: number
  name: string
  type: BlockType
  duration: number // minutes
  cc?: CustomColor | null
  customName?: string | null
}

export interface BlockTemplate {
  id: number
  name: string
  blocks: Array<{ name: string; type: string; duration: number; cc?: CustomColor | null; customName?: string | null }>
}
