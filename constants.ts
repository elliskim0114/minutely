import type { CustomColor } from './types'

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const SLOT = 15 // minutes per slot
export const SH = 60  // slot height in pixels (increased for better readability)
export const GUTTER = 56 // time gutter width in pixels

export const CCOLS: CustomColor[] = [
  // reds → pinks
  { bg: '#FFE5E5', bd: '#F87171', ink: '#7F1D1D', n: 'crimson' },
  { bg: '#FFF0F4', bd: '#FB7185', ink: '#881337', n: 'rose' },
  // oranges → yellows
  { bg: '#FFF7ED', bd: '#FBBF24', ink: '#78350F', n: 'amber' },
  { bg: '#FEFCE8', bd: '#FDE047', ink: '#713F12', n: 'lemon' },
  // greens
  { bg: '#F0FDF4', bd: '#86EFAC', ink: '#14532D', n: 'sage' },
  { bg: '#DCFCE7', bd: '#4ADE80', ink: '#052E16', n: 'grove' },
  // blues
  { bg: '#E0F2FE', bd: '#38BDF8', ink: '#0C4A6E', n: 'sky' },
  { bg: '#EEF2FF', bd: '#818CF8', ink: '#1E1B4B', n: 'periwinkle' },
  // purples
  { bg: '#FAF5FF', bd: '#C084FC', ink: '#3B0764', n: 'lavender' },
  { bg: '#F3E8FF', bd: '#A855F7', ink: '#4C1D95', n: 'purple' },
  // neutrals
  { bg: '#F8FAFC', bd: '#94A3B8', ink: '#1E293B', n: 'silver' },
  { bg: '#FAF6F0', bd: '#C4A882', ink: '#3A2A18', n: 'sand' },
  // darks
  { bg: '#1A1A2E', bd: '#4A4A7A', ink: '#C0C8FF', n: 'midnight' },
  { bg: '#0D2818', bd: '#2A6038', ink: '#6EE7A0', n: 'forest' },
  { bg: '#2A1A10', bd: '#7A4A20', ink: '#FBBF80', n: 'espresso' },
  { bg: '#1A0A24', bd: '#6B21A8', ink: '#E879F9', n: 'galaxy' },
]

export const ENERGY_TIPS = [
  'set your energy level to get a personalised schedule suggestion.',
  'low energy today. perfect for admin, reading, gentle tasks. avoid scheduling deep work.',
  'solid energy. a good mix of focused work and normal tasks will work well.',
  'peak energy! block this time for your hardest, most important work. protect it.',
]
