import { SLOT, SH } from './constants'
import type { Config } from './types'

export const toM = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const toT = (m: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, m))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

export const fmt = (t: string, tf: '12' | '24'): string => {
  if (tf === '24') return t
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const hh = h > 12 ? h - 12 : h || 12
  return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`
}

export const snap = (m: number): number => Math.round(m / SLOT) * SLOT

export const m2y = (m: number, ds: string): number => ((m - toM(ds)) / SLOT) * SH

export const y2m = (y: number, ds: string): number => toM(ds) + Math.round(y / SH) * SLOT

export const totalHeight = (cfg: Config): number =>
  Math.ceil((toM(cfg.de) - toM(cfg.ds)) / SLOT) * SH

// ── Timezone support ──
// Call setAppTz() once on boot (from store) to keep date functions tz-aware.
let _appTz: string | null = null
export const setAppTz = (tz: string | null) => { _appTz = tz || null }

const nowInTz = (): { y: number; mo: number; d: number; h: number; min: number } => {
  if (_appTz) {
    const p = new Intl.DateTimeFormat('en', {
      timeZone: _appTz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date())
    const get = (t: string) => parseInt(p.find(x => x.type === t)?.value || '0')
    return { y: get('year'), mo: get('month') - 1, d: get('day'), h: get('hour'), min: get('minute') }
  }
  const n = new Date()
  return { y: n.getFullYear(), mo: n.getMonth(), d: n.getDate(), h: n.getHours(), min: n.getMinutes() }
}

export const todayStr = (): string => {
  const { y, mo, d } = nowInTz()
  return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export const isToday = (s: string): boolean => s === todayStr()

export const nowMinutes = (): number => {
  const { h, min } = nowInTz()
  return h * 60 + min
}

export const weekStart = (off: number): Date => {
  const { y, mo, d } = nowInTz()
  const date = new Date(y, mo, d)
  date.setDate(date.getDate() - date.getDay() + off * 7)
  date.setHours(0, 0, 0, 0)
  return date
}

export const dateStr = (ws: Date, di: number): string => {
  const d = new Date(ws)
  d.setDate(d.getDate() + di)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const plannedMinutes = (blocks: Array<{ date: string; start: string; end: string }>, date: string): number =>
  blocks.filter(b => b.date === date).reduce((s, b) => s + toM(b.end) - toM(b.start), 0)

export const totalDayMinutes = (cfg: Config): number => toM(cfg.de) - toM(cfg.ds)

// Parse a YYYY-MM-DD string as LOCAL midnight (not UTC)
// Using new Date("2026-03-25") parses as UTC midnight → wrong day in western timezones
export const parseLocalDate = (dateStr: string): Date => new Date(dateStr + 'T00:00:00')

export function getFreeSlots(
  blocks: Array<{ start: string; end: string }>,
  ds: string,
  de: string,
  minDuration = 30
): Array<{ start: string; end: string; duration: number }> {
  const startM = toM(ds)
  const endM = toM(de)
  const occupied = blocks
    .map(b => ({ s: toM(b.start), e: toM(b.end) }))
    .sort((a, b) => a.s - b.s)

  const slots: Array<{ start: string; end: string; duration: number }> = []
  let cursor = startM

  for (const b of occupied) {
    if (b.s > cursor + minDuration) {
      slots.push({ start: toT(cursor), end: toT(b.s), duration: b.s - cursor })
    }
    cursor = Math.max(cursor, b.e)
  }
  if (endM > cursor + minDuration) {
    slots.push({ start: toT(cursor), end: toT(endM), duration: endM - cursor })
  }
  return slots
}
