import { useEffect, useRef, useState, useMemo } from 'react'
import { useStore } from '../store'
import { todayStr } from '../utils'

interface Cmd {
  id: string
  label: string
  sub?: string
  icon: string
  group: string
  action: () => void
}

function dateOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(ds: string) {
  return new Date(ds + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 40)
  }, [])

  const today = todayStr()
  const tomorrow = dateOffset(1)
  const yesterday = dateOffset(-1)

  // ── Static actions ──────────────────────────────────────────────────────────
  const ACTIONS: Cmd[] = useMemo(() => [
    {
      id: 'new-block', label: 'New block', sub: 'add to today', icon: '+', group: 'Actions',
      action: () => {
        const now = new Date()
        const h = now.getHours()
        const m = now.getMinutes() < 30 ? '00' : '30'
        const startH = String(h).padStart(2, '0')
        const endH = String(h + 1).padStart(2, '0')
        store.openBlockModalNew(today, `${startH}:${m}`, `${endH}:${m}`)
        onClose()
      },
    },
    {
      id: 'coach', label: 'Open AI coach', sub: 'chat with your coach', icon: '✦', group: 'Actions',
      action: () => { store.openCoach(); onClose() },
    },
    {
      id: 'focus', label: 'Focus mode', sub: 'distraction-free session', icon: '◎', group: 'Actions',
      action: () => { store.openFocus(); onClose() },
    },
    {
      id: 'capture', label: 'Smart capture', sub: 'add from free text', icon: '⊕', group: 'Actions',
      action: () => { store.openCapture(); onClose() },
    },
    {
      id: 'mpd', label: 'My perfect day', sub: 'blueprint view', icon: '✶', group: 'Actions',
      action: () => { store.setView('mpd'); onClose() },
    },
    {
      id: 'goals', label: 'Goals & projects', sub: 'track progress', icon: '◉', group: 'Actions',
      action: () => { store.setView('goals'); onClose() },
    },
    {
      id: 'analytics', label: 'Analytics', sub: 'stats & patterns', icon: '↗', group: 'Actions',
      action: () => { store.setView('analytics'); onClose() },
    },
    {
      id: 'week', label: 'Week view', sub: 'see the full week', icon: '▦', group: 'Actions',
      action: () => { store.setView('week'); onClose() },
    },
    {
      id: 'templates', label: 'Templates', sub: 'apply or manage', icon: '⊡', group: 'Actions',
      action: () => { store.openTemplates(); onClose() },
    },
    {
      id: 'settings', label: 'Settings', sub: 'preferences & profile', icon: '⚙', group: 'Actions',
      action: () => { store.openSettings(); onClose() },
    },
  ], [])

  // ── Date jumps ──────────────────────────────────────────────────────────────
  const DATE_CMDS: Cmd[] = useMemo(() => {
    const jumps: Cmd[] = [
      { id: 'today', label: 'Today', sub: fmtDate(today), icon: '→', group: 'Jump to', action: () => { store.setSelDate(today); store.setView('day'); onClose() } },
      { id: 'tomorrow', label: 'Tomorrow', sub: fmtDate(tomorrow), icon: '→', group: 'Jump to', action: () => { store.setSelDate(tomorrow); store.setView('day'); onClose() } },
      { id: 'yesterday', label: 'Yesterday', sub: fmtDate(yesterday), icon: '→', group: 'Jump to', action: () => { store.setSelDate(yesterday); store.setView('day'); onClose() } },
    ]
    // Next 5 days
    for (let i = 2; i <= 6; i++) {
      const ds = dateOffset(i)
      const label = new Date(ds + 'T12:00').toLocaleDateString('en', { weekday: 'long' })
      jumps.push({ id: `day-${i}`, label, sub: fmtDate(ds), icon: '→', group: 'Jump to', action: () => { store.setSelDate(ds); store.setView('day'); onClose() } })
    }
    return jumps
  }, [today, tomorrow, yesterday])

  // ── Goals as commands ────────────────────────────────────────────────────────
  const goalCmds: Cmd[] = useMemo(() =>
    store.goals.map(g => ({
      id: `goal-${g.id}`,
      label: g.name,
      sub: `goal · ${g.targetHours}h target`,
      icon: '◉',
      group: 'Goals',
      action: () => { store.setView('goals'); onClose() },
    }))
  , [store.goals])

  // ── Templates as commands ────────────────────────────────────────────────────
  const templateCmds: Cmd[] = useMemo(() =>
    store.templates.map(t => ({
      id: `tmpl-${t.id}`,
      label: `Apply "${t.name}"`,
      sub: `${t.blocks.length} blocks → today`,
      icon: '⊡',
      group: 'Templates',
      action: () => { store.applyTemplate(t.id, today, 0); store.showToast(`"${t.name}" applied`); onClose() },
    }))
  , [store.templates, today])

  // ── Recent blocks (unique names, sorted recent-first) ───────────────────────
  const recentCmds: Cmd[] = useMemo(() => {
    const seen = new Set<string>()
    return store.blocks
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || 0)
      .filter(b => {
        const key = (b.customName || b.name).toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 25)
      .map(b => ({
        id: `block-${b.id}`,
        label: b.customName || b.name,
        sub: fmtDate(b.date),
        icon: '·',
        group: 'Recent blocks',
        action: () => { store.setSelDate(b.date); store.setView('day'); onClose() },
      }))
  }, [store.blocks])

  const allCmds = [...ACTIONS, ...DATE_CMDS, ...goalCmds, ...templateCmds, ...recentCmds]

  // ── Filter & group ───────────────────────────────────────────────────────────
  const filtered: Cmd[] = useMemo(() => {
    if (!query.trim()) {
      // Default view: top actions + date jumps + recent blocks
      return [
        ...ACTIONS.slice(0, 7),
        ...DATE_CMDS.slice(0, 3),
        ...recentCmds.slice(0, 6),
      ]
    }
    const q = query.toLowerCase()
    return allCmds.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.sub?.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    )
  }, [query, recentCmds, goalCmds, templateCmds])

  const grouped = useMemo(() => {
    const g: Record<string, Cmd[]> = {}
    filtered.forEach(c => { if (!g[c.group]) g[c.group] = []; g[c.group].push(c) })
    return g
  }, [filtered])

  useEffect(() => { setSel(0) }, [query])

  const run = (cmd: Cmd) => cmd.action()

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[sel]) run(filtered[sel]) }
    else if (e.key === 'Escape') onClose()
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  return (
    <div className="cp-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cp-box">
        {/* Search */}
        <div className="cp-search-row">
          <svg className="cp-search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className="cp-inp"
            placeholder="search blocks, jump to a date, run any action…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {query && <button className="cp-clear" onClick={() => setQuery('')}>×</button>}
        </div>

        {/* Results */}
        <div className="cp-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="cp-empty">no results for "{query}"</div>
          ) : (
            Object.entries(grouped).map(([group, cmds]) => (
              <div key={group} className="cp-group">
                <div className="cp-group-lbl">{group}</div>
                {cmds.map(cmd => {
                  const idx = filtered.indexOf(cmd)
                  return (
                    <button
                      key={cmd.id}
                      className={`cp-item${idx === sel ? ' sel' : ''}`}
                      data-idx={idx}
                      onClick={() => run(cmd)}
                      onMouseEnter={() => setSel(idx)}
                    >
                      <span className="cp-icon">{cmd.icon}</span>
                      <span className="cp-label">{cmd.label}</span>
                      {cmd.sub && <span className="cp-sub">{cmd.sub}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="cp-footer">
          <span className="cp-hint"><kbd>↑↓</kbd> navigate</span>
          <span className="cp-hint"><kbd>↵</kbd> open</span>
          <span className="cp-hint"><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
