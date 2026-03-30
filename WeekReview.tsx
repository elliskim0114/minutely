import { useStore } from '../store'
import { todayStr, toM, weekStart, dateStr, totalDayMinutes } from '../utils'

const TYPE_COLORS: Record<string, string> = {
  focus: '#FFB8A0', routine: '#95CFA0', study: '#A0AAFF',
  free: '#F0D080', custom: '#FF4D1C', gcal: '#A0AAFF',
}

export default function WeekReview() {
  const { blocks, cfg, closeWeekReview } = useStore()

  const ws = weekStart(0)
  const weekDates = Array.from({ length: 7 }, (_, i) => dateStr(ws, i))
  const weekBlocks = blocks.filter(b => weekDates.includes(b.date))

  const totalMins = weekBlocks.reduce((s, b) => s + toM(b.end) - toM(b.start), 0)
  const totalHrs = (totalMins / 60).toFixed(1)

  // Breakdown by type
  const typeBreakdown: Record<string, number> = {}
  weekBlocks.forEach(b => {
    const t = b.cc ? 'custom' : b.type
    typeBreakdown[t] = (typeBreakdown[t] || 0) + (toM(b.end) - toM(b.start))
  })

  // Busiest day
  const dayMins: Record<string, number> = {}
  weekBlocks.forEach(b => {
    dayMins[b.date] = (dayMins[b.date] || 0) + (toM(b.end) - toM(b.start))
  })
  const busiestDate = Object.entries(dayMins).sort((a, b) => b[1] - a[1])[0]
  const busiestDay = busiestDate
    ? new Date(busiestDate[0] + 'T00:00:00').toLocaleDateString('en', { weekday: 'long' })
    : 'none'

  // Motivational summary
  const tm = totalDayMinutes(cfg)
  const weekPct = tm > 0 ? Math.round((totalMins / (7 * tm)) * 100) : 0
  const summary = weekPct >= 70
    ? 'Outstanding week! Your schedule is packed with purpose.'
    : weekPct >= 40
    ? 'Solid week. Keep building on this momentum.'
    : 'Light week — plenty of room to grow next week.'

  const today = todayStr()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="wr-overlay" onClick={e => { if (e.target === e.currentTarget) closeWeekReview() }}>
      <div className="wr-box">
        <div className="wr-hdr">
          <div className="wr-title">week review</div>
          <button className="wr-close" onClick={closeWeekReview}>×</button>
        </div>

        <div className="wr-hero">
          <div className="wr-hrs">{totalHrs}h</div>
          <div className="wr-sub">planned this week · {weekPct}% filled</div>
        </div>

        <div className="wr-summary">{summary}</div>

        {/* Type breakdown */}
        <div className="wr-section">
          <div className="wr-sec-ttl">by type</div>
          {Object.entries(typeBreakdown).map(([type, mins]) => {
            const pct = totalMins > 0 ? (mins / totalMins) * 100 : 0
            return (
              <div key={type} className="wr-row">
                <div className="wr-dot" style={{ background: TYPE_COLORS[type] || '#ccc' }} />
                <div className="wr-type">{type}</div>
                <div className="wr-bar-wrap">
                  <div className="wr-bar-fill" style={{ width: `${pct}%`, background: TYPE_COLORS[type] || '#ccc' }} />
                </div>
                <div className="wr-mins">{(mins / 60).toFixed(1)}h</div>
              </div>
            )
          })}
        </div>

        {/* Daily bar chart */}
        <div className="wr-section">
          <div className="wr-sec-ttl">daily breakdown</div>
          <div className="wr-days">
            {weekDates.map((d, i) => {
              const mins = dayMins[d] || 0
              const pct = tm > 0 ? Math.min(100, (mins / tm) * 100) : 0
              const isToday = d === today
              return (
                <div key={d} className="wr-day-col">
                  <div className="wr-day-bar-wrap">
                    <div
                      className={`wr-day-bar${isToday ? ' today' : ''}`}
                      style={{ height: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  <div className={`wr-day-lbl${isToday ? ' today' : ''}`}>{dayNames[i]}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="wr-busiest">busiest day: <strong>{busiestDay}</strong></div>
      </div>
    </div>
  )
}
