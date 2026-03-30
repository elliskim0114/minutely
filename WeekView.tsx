import { useStore } from '../store'
import { DAYS, MONTHS } from '../constants'
import { weekStart, dateStr, todayStr, parseLocalDate } from '../utils'
import CalendarGrid from './CalendarGrid'

export default function WeekView() {
  const { wOff, cfg, focuses, setFocus, setView, setSelDate } = useStore()

  const ws = weekStart(wOff)
  const dates = Array.from({ length: 7 }, (_, i) => dateStr(ws, i))
  const td = todayStr()

  const getDate = (i: number) => dateStr(weekStart(wOff), i)

  const handleDateClick = (date: string) => {
    setSelDate(date)
    setView('day')
  }

  return (
    <div id="week-view" style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      {/* Week header */}
      <div id="wk-head" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
        <div className="whs" />
        {dates.map((date, i) => {
          const dt = parseLocalDate(date)
          const isToday = date === td
          const focus = focuses[date] || ''
          return (
            <div key={date} className={`whd${isToday ? ' tod' : ''}`}>
              <div
                className={`whd-name${isToday ? ' t' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleDateClick(date)}
              >
                {DAYS[dt.getDay()]}
              </div>
              <div
                className={`whd-num${isToday ? ' t' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleDateClick(date)}
              >
                {dt.getDate()}
              </div>
              <div className="whd-foc">
                <FocusInput date={date} value={focus} onChange={v => setFocus(date, v)} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Scroll container */}
      <div id="gs" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <div id="cal-wrap">
          <CalendarGrid
            scrollId="gs"
            numDays={7}
            getDate={getDate}
          />
        </div>
      </div>
    </div>
  )
}

function FocusInput({ date, value, onChange }: { date: string; value: string; onChange: (v: string) => void }) {
  if (value) {
    return (
      <div
        className="wfd"
        onClick={e => {
          const el = e.currentTarget as HTMLElement
          el.outerHTML = `<input class="wff" placeholder="focus…" value="${value.replace(/"/g, '&quot;')}" autofocus>`
        }}
      >
        {value}
      </div>
    )
  }
  return (
    <input
      className="wff"
      placeholder="focus…"
      defaultValue={value}
      onBlur={e => onChange(e.target.value)}
      onChange={e => onChange(e.target.value)}
    />
  )
}
