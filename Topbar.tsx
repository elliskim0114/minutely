import { useStore } from '../store'
import { MONTHS } from '../constants'
import { todayStr, weekStart, parseLocalDate } from '../utils'

export default function Topbar() {
  const {
    view, wOff, selDate,
    toggleSidebar, navWeek, navDay,
    undo, redo, blockHistory, blockFuture,
    openCoach, openFocus, openCapture, openCoachAt,
  } = useStore()

  const getLabel = () => {
    if (view === 'mpd') return 'my perfect day'
    if (view === 'analytics') return 'stats'
    if (view === 'goals') return 'goals & projects'
    if (view === 'day') {
      const d = parseLocalDate(selDate || todayStr())
      return `${MONTHS[d.getMonth()]} ${d.getDate()}`
    }
    const ws = weekStart(wOff)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    return `${MONTHS[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}`
  }

  const handleNav = (dir: number) => {
    if (view === 'week') navWeek(dir)
    else if (view === 'day') navDay(dir)
  }

  const isCalendar = view === 'week' || view === 'day'

  return (
    <div id="topbar">
      {/* Sidebar toggle */}
      <button id="sb-main-tog" className="tnb" onClick={toggleSidebar} title="toggle sidebar">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Left arrow */}
      {isCalendar && (
        <button className="tnb tnb-nav" onClick={() => handleNav(-1)}>‹</button>
      )}

      {/* Date label */}
      <div id="nav-lbl">{getLabel()}</div>

      {/* Right arrow */}
      {isCalendar && (
        <button className="tnb tnb-nav" onClick={() => handleNav(1)}>›</button>
      )}

      <div className="tsp" />

      {/* Undo / Redo */}
      <button className="tnb tnb-ur" onClick={undo} title="undo (⌘Z)" disabled={blockHistory.length === 0}>↺</button>
      <button className="tnb tnb-ur" onClick={redo} title="redo (⌘⇧Z)" disabled={blockFuture.length === 0}>↻</button>

      {/* ── STAR FEATURE BUTTONS ── */}
      <div className="tb-stars">
        {/* What Now — primary star button */}
        <button className="tb-star tb-star-whatnow" onClick={() => openCoachAt('analyze')} title="what should I do right now?">
          <svg className="tb-star-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M8.5 1.5L5 8H9L5.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>what now</span>
        </button>

        <button className="tb-star tb-star-capture" onClick={openCapture} title="smart capture (I)">
          <svg className="tb-star-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 1L5.5 5.5H1L4.5 8.5L3 13L7.5 10.5L12 13L10.5 8.5L14 5.5H9.5L7.5 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
            <path d="M7.5 4.5V7.5M6 6H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>capture</span>
        </button>

        <button className="tb-star tb-star-coach" onClick={openCoach} title="AI coach (C)">
          <svg className="tb-star-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 1.5C4.19 1.5 1.5 4.02 1.5 7.1c0 1.68.77 3.18 2 4.22V13.5l2.4-1.6c.5.12 1.04.18 1.6.18 3.31 0 6-2.52 6-5.58C13.5 4.02 10.81 1.5 7.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M5 6.5h5M5 8.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span>coach</span>
        </button>

        <button className="tb-star tb-star-focus" onClick={openFocus} title="focus mode (F)">
          <svg className="tb-star-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="7.5" cy="7.5" r="0.9" fill="currentColor"/>
            <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span>focus</span>
        </button>
      </div>

    </div>
  )
}
