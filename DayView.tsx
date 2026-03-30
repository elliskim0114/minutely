import { useStore } from '../store'
import { DAYS, MONTHS } from '../constants'
import { todayStr, parseLocalDate } from '../utils'
import CalendarGrid from './CalendarGrid'

export default function DayView() {
  const { selDate, focuses, setFocus } = useStore()
  const date = selDate || todayStr()
  const dt = parseLocalDate(date)

  return (
    <div id="day-view" style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      {/* Day header */}
      <div id="dv-hdr">
        <div>
          <div className="dvh-d">{dt.getDate()} {MONTHS[dt.getMonth()]}</div>
          <div className="dvh-n">{DAYS[dt.getDay()]} {dt.getFullYear()}</div>
        </div>
        <div className="dvh-fw">
          <span className="dvh-fl">focus —</span>
          <input
            className="dvh-fi"
            placeholder="what matters most?"
            defaultValue={focuses[date] || ''}
            key={date}
            onBlur={e => setFocus(date, e.target.value)}
            onChange={e => setFocus(date, e.target.value)}
          />
        </div>
      </div>

      {/* Scroll container */}
      <div id="ds" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <CalendarGrid
          scrollId="ds"
          numDays={1}
          getDate={() => date}
        />
      </div>
    </div>
  )
}
