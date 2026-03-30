import { useEffect, useRef, useCallback, useState } from 'react'
import { useStore } from '../store'
import { SLOT, SH, CCOLS } from '../constants'
import { toM, toT, fmt, snap, m2y, y2m, totalHeight, nowMinutes, todayStr } from '../utils'
import type { Block } from '../types'

// Format elapsed seconds as mm:ss or hh:mm:ss
function fmtElapsed(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

interface Props {
  scrollId: string        // id for the scrolling container
  numDays: number         // 1 (day view) or 7 (week view)
  getDate: (di: number) => string  // date string for column index
}

export default function CalendarGrid({ scrollId, numDays, getDate }: Props) {
  const {
    cfg, blocks, wOff,
    openBlockModalNew, openBlockModalEdit, updateBlock,
    showCtxMenu, scheduleQueueItem, trackTime, stopTimer, applyRecurring,
    setHoveredBlock, typeColorOverrides, blockMoods,
  } = useStore()

  // Ticker for live timer display
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const hasRunning = blocks.some(b => b.timerStart)
    if (!hasRunning) return
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [blocks])

  const containerRef = useRef<HTMLDivElement>(null)
  const dragFillRef = useRef<HTMLDivElement | null>(null)
  const nowLineRef = useRef<HTMLDivElement | null>(null)
  const didDragRef = useRef(false)
  const [dragOverCol, setDragOverCol] = useState<number | null>(null)

  const startM = toM(cfg.ds)
  const endM = toM(cfg.de)
  const totalH = totalHeight(cfg)
  const slotCount = Math.ceil((endM - startM) / SLOT)
  const td = todayStr()

  // Build date list
  const dates = Array.from({ length: numDays }, (_, i) => getDate(i))

  // Scroll to now on mount
  useEffect(() => {
    const el = document.getElementById(scrollId)
    if (!el) return
    const y = Math.max(0, m2y(nowMinutes(), cfg.ds) - 180)
    el.scrollTop = y
  }, [scrollId, cfg.ds])

  // Update now-line every minute
  useEffect(() => {
    const update = () => {
      const nl = nowLineRef.current
      if (!nl) return
      const cont = containerRef.current
      if (!cont) return
      const cw = (cont.offsetWidth - 56) / numDays
      const todayIdx = dates.findIndex(d => d === td)
      if (todayIdx < 0) { nl.style.display = 'none'; return }
      nl.style.display = ''
      nl.style.top = m2y(nowMinutes(), cfg.ds) + 'px'
      nl.style.left = 56 + todayIdx * cw + 'px'
      nl.style.width = cw + 'px'
    }
    update()
    const iv = setInterval(update, 60000)
    return () => clearInterval(iv)
  }, [dates, numDays, cfg.ds, td])

  // Drag-to-create on empty column
  const handleColumnMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, date: string, colLeft: number) => {
    if ((e.target as HTMLElement).closest('.blk')) return
    e.preventDefault()
    didDragRef.current = false
    const cont = containerRef.current
    if (!cont) return
    const rect = cont.getBoundingClientRect()
    const startMins = snap(y2m(e.clientY - rect.top, cfg.ds))
    let endMins = startMins + SLOT

    const cw = (cont.offsetWidth - 56) / numDays
    const df = document.createElement('div')
    df.className = 'dft'
    df.style.cssText = `top:${m2y(startMins, cfg.ds)}px;left:${colLeft + 2}px;width:${cw - 4}px;height:${SH}px`
    df.textContent = '+'
    dragFillRef.current = df
    cont.appendChild(df)

    const onMove = (mv: MouseEvent) => {
      didDragRef.current = true
      document.body.classList.add('dragging')
      endMins = Math.max(startMins + SLOT, snap(y2m(mv.clientY - rect.top, cfg.ds)))
      df.style.height = Math.max(SH, m2y(endMins, cfg.ds) - m2y(startMins, cfg.ds)) + 'px'
      df.textContent = fmt(toT(startMins), cfg.tf) + ' – ' + fmt(toT(endMins), cfg.tf)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('dragging')
      df.remove()
      dragFillRef.current = null
      if (didDragRef.current) {
        openBlockModalNew(date, toT(startMins), toT(endMins))
      } else {
        openBlockModalNew(date, toT(startMins), toT(Math.min(endM, startMins + SLOT * 4)))
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [cfg, numDays, openBlockModalNew, endM])

  // Block drag-move
  const handleBlockDragMove = useCallback((e: React.MouseEvent, block: Block, colIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    didDragRef.current = false
    const cont = containerRef.current
    if (!cont) return
    const el = cont.querySelector<HTMLDivElement>(`.blk[data-id="${block.id}"]`)
    if (!el) return
    const sY = e.clientY
    const sX = e.clientX
    const origStart = toM(block.start)
    const dur = toM(block.end) - origStart
    const origLeft = parseFloat(el.style.left)
    const cw = (cont.offsetWidth - 56) / numDays
    el.classList.add('drag')

    let pendingStart = origStart
    let pendingDate = block.date

    const onMove = (mv: MouseEvent) => {
      didDragRef.current = true
      document.body.classList.add('dragging')
      const dy = mv.clientY - sY
      const dx = mv.clientX - sX
      const newStart = Math.max(startM, Math.min(endM - SLOT, snap(origStart + (dy / SH) * SLOT)))
      const colDelta = Math.round(dx / cw)
      el.style.top = m2y(newStart, cfg.ds) + 'px'
      el.style.left = origLeft + colDelta * cw + 'px'
      pendingStart = newStart
      if (numDays > 1) {
        const newColIdx = Math.max(0, Math.min(numDays - 1, colIdx + colDelta))
        pendingDate = getDate(newColIdx)
      }
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('dragging')
      el.classList.remove('drag')
      if (didDragRef.current) {
        updateBlock(block.id, {
          start: toT(pendingStart),
          end: toT(Math.min(endM, pendingStart + dur)),
          date: pendingDate,
        })
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [cfg, numDays, getDate, startM, endM, updateBlock])

  // Block drag-resize (bottom edge)
  const handleBlockResize = useCallback((e: React.MouseEvent, block: Block) => {
    e.preventDefault()
    e.stopPropagation()
    didDragRef.current = false
    const cont = containerRef.current
    if (!cont) return
    const el = cont.querySelector<HTMLDivElement>(`.blk[data-id="${block.id}"]`)
    if (!el) return
    const sY = e.clientY
    const origEnd = toM(block.end)
    let pendingEnd = origEnd

    const onMove = (mv: MouseEvent) => {
      didDragRef.current = true
      document.body.classList.add('dragging')
      const newEnd = snap(origEnd + ((mv.clientY - sY) / SH) * SLOT)
      pendingEnd = Math.max(toM(block.start) + SLOT, Math.min(endM, newEnd))
      el.style.height = m2y(pendingEnd, cfg.ds) - m2y(toM(block.start), cfg.ds) + 'px'
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('dragging')
      if (didDragRef.current) updateBlock(block.id, { end: toT(pendingEnd) })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [cfg, endM, updateBlock])

  // Block drag-resize (top edge — adjusts start)
  const handleBlockResizeTop = useCallback((e: React.MouseEvent, block: Block) => {
    e.preventDefault()
    e.stopPropagation()
    didDragRef.current = false
    const cont = containerRef.current
    if (!cont) return
    const el = cont.querySelector<HTMLDivElement>(`.blk[data-id="${block.id}"]`)
    if (!el) return
    const sY = e.clientY
    const origStart = toM(block.start)
    let pendingStart = origStart

    const onMove = (mv: MouseEvent) => {
      didDragRef.current = true
      document.body.classList.add('dragging')
      const newStart = snap(origStart + ((mv.clientY - sY) / SH) * SLOT)
      pendingStart = Math.max(startM, Math.min(toM(block.end) - SLOT, newStart))
      const newTop = m2y(pendingStart, cfg.ds)
      el.style.top = newTop + 'px'
      el.style.height = m2y(toM(block.end), cfg.ds) - newTop + 'px'
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('dragging')
      if (didDragRef.current) updateBlock(block.id, { start: toT(pendingStart) })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [cfg, startM, updateBlock])

  // Queue drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, di: number) => {
    if (!e.dataTransfer.types.includes('queue-item-id')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverCol(di)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, date: string) => {
    setDragOverCol(null)
    const idStr = e.dataTransfer.getData('queue-item-id')
    if (!idStr) return
    e.preventDefault()
    const id = parseInt(idStr)
    const cont = containerRef.current
    if (!cont) return
    const rect = cont.getBoundingClientRect()
    const startMins = snap(y2m(e.clientY - rect.top, cfg.ds))

    // Get item duration from store
    const item = useStore.getState().queue.find(q => q.id === id)
    if (!item) return
    const endMins = Math.min(endM, startMins + item.duration)
    scheduleQueueItem(id, date, toT(startMins), toT(endMins))
  }, [cfg, endM, scheduleQueueItem])

  const blkClass = (b: Block) => {
    if (b.cc) return 'td'
    return ({ focus: 'tf', routine: 'tr', study: 'ts', free: 'tl', gcal: 'tg2', custom: 'td' }[b.type] || 'td')
  }

  const cw = containerRef.current ? (containerRef.current.offsetWidth - 56) / numDays : 0

  // Time gutter labels
  const timeLabels: { top: number; text: string; isHour: boolean; anchor: 'start' | 'mid' | 'end' }[] = []
  for (let i = 0; i <= slotCount; i++) {
    const m = startM + i * SLOT
    if (m > endM) break
    const isHour = m % 60 === 0
    if (isHour || i === 0) {
      const anchor = m === startM ? 'start' : m === endM ? 'end' : 'mid'
      timeLabels.push({ top: m2y(m, cfg.ds), text: fmt(toT(m), cfg.tf), isHour, anchor })
    }
  }
  // Always include the day-end label
  if (!timeLabels.find(l => l.anchor === 'end')) {
    timeLabels.push({ top: m2y(endM, cfg.ds), text: fmt(toT(endM), cfg.tf), isHour: true, anchor: 'end' })
  }

  // Grid lines
  const hLines: { top: number; isHour: boolean }[] = []
  for (let i = 0; i <= slotCount; i++) {
    const m = startM + i * SLOT
    if (m > endM) break
    hLines.push({ top: m2y(m, cfg.ds), isHour: m % 60 === 0 })
  }

  return (
    <div
      className="cg"
      ref={containerRef}
      style={{ height: totalH + 16 }}
    >
      {/* Time gutter */}
      <div className="tg">
        {timeLabels.map(({ top, text, isHour, anchor }) => (
          <div key={top} className={`tt${isHour ? ' hr' : ''}`} style={{ top, transform: anchor === 'start' ? 'translateY(0)' : anchor === 'end' ? 'translateY(-100%)' : 'translateY(-50%)' }}>
            {text}
          </div>
        ))}
      </div>

      {/* Grid lines */}
      <div className="gll">
        {hLines.map(({ top, isHour }) => (
          <div key={top} className={`glh ${isHour ? 'hour' : 'slot'}`} style={{ top }} />
        ))}
        {Array.from({ length: numDays - 1 }, (_, i) => (
          <div key={i} className="glv" style={{ left: `${((i + 1) / numDays) * 100}%` }} />
        ))}
      </div>

      {/* Day columns */}
      <div className="dcl">
        {dates.map((date, di) => {
          const isToday = date === td
          const isPast = date < td
          const pastY = isPast ? totalH : isToday ? m2y(nowMinutes(), cfg.ds) : 0
          const nowSlot = isToday ? Math.floor(nowMinutes() / SLOT) * SLOT : null

          return (
            <div
              key={date}
              className={`dc${dragOverCol === di ? ' queue-drop-active' : ''}`}
              data-date={date}
              style={{
                left: `${(di / numDays) * 100}%`,
                width: `${(1 / numDays) * 100}%`,
              }}
              onMouseDown={e => {
                const contW = containerRef.current?.offsetWidth ?? 756
                const colLeft = 56 + di * (contW - 56) / numDays
                handleColumnMouseDown(e, date, colLeft)
              }}
              onContextMenu={e => {
                if ((e.target as HTMLElement).closest('.blk')) return
                e.preventDefault()
                const rect = containerRef.current!.getBoundingClientRect()
                const mins = snap(y2m(e.clientY - rect.top, cfg.ds))
                showCtxMenu(e.clientX, e.clientY, null, date, mins)
              }}
              onDragOver={e => handleDragOver(e, di)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, date)}
            >
              <div className="dch" />
              {isToday && <div className="today-tint" />}
              {isToday && <div className="today-bar" />}
              {pastY > 0 && <div className="pov" style={{ height: pastY }} />}
              {isToday && nowSlot !== null && nowSlot >= startM && nowSlot < endM && (
                <div className="nss" style={{ top: m2y(nowSlot, cfg.ds), height: SH }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Now line (positioned after columns so it's on top) */}
      {dates.some(d => d === td) && (
        <div className="nl" ref={nowLineRef} />
      )}

      {/* Blocks */}
      {blocks
        .filter(b => dates.includes(b.date))
        .map(b => {
          const di = dates.indexOf(b.date)
          if (di < 0) return null
          const contW = containerRef.current?.offsetWidth ?? 756
          const colW = (contW - 56) / numDays
          const sm = toM(b.start)
          const em2 = toM(b.end)
          const top = m2y(sm, cfg.ds)
          const height = Math.max(m2y(em2, cfg.ds) - top, SH - 2)
          const left = 56 + di * colW + 2
          const width = colW - 4

          // compact mode for very short blocks (under 45px = < 1 slot worth)
          const isCompact = height < 50

          const overrideIdx = !b.cc && typeColorOverrides[b.type] !== undefined ? typeColorOverrides[b.type] : null
          const overrideColor = overrideIdx !== null ? CCOLS[overrideIdx] : null
          const customStyle = b.cc
            ? { background: b.cc.bg, borderColor: b.cc.bd, color: b.cc.ink }
            : overrideColor
            ? { background: overrideColor.bg, borderColor: overrideColor.bd, color: overrideColor.ink }
            : {}

          return (
            <div
              key={b.id}
              className={`blk ${blkClass(b)}${isCompact ? ' compact' : ''}${b.timerStart ? ' tracking' : ''}`}
              data-id={b.id}
              style={{ top, left, width, height, ...customStyle }}
              onMouseEnter={() => setHoveredBlock(b.id)}
              onMouseLeave={() => setHoveredBlock(null)}
              onContextMenu={e => {
                e.preventDefault()
                e.stopPropagation()
                showCtxMenu(e.clientX, e.clientY, b, b.date, toM(b.start))
              }}
            >
              <div
                className="bdh"
                onMouseDown={e => handleBlockDragMove(e, b, di)}
                onClick={e => {
                  if (didDragRef.current) return
                  e.stopPropagation()
                  openBlockModalEdit(b)
                }}
              >
                <div className="bn">{b.name}</div>
                {!isCompact && (
                  <div className="bt">{fmt(b.start, cfg.tf)} – {fmt(b.end, cfg.tf)}</div>
                )}
                {blockMoods[b.id] && <span className="blk-mood">{blockMoods[b.id]}</span>}
                {b.timerStart && !isCompact && (
                  <div className="bt blk-timer">
                    {fmtElapsed(Math.floor((Date.now() - b.timerStart) / 1000) + (b.totalTracked || 0))}
                  </div>
                )}
              </div>
              <button
                className={`blk-play-btn${b.timerStart ? ' active' : ''}`}
                title={b.timerStart ? 'stop timer' : 'start timer'}
                onClick={e => {
                  e.stopPropagation()
                  if (b.timerStart) stopTimer(b.id)
                  else trackTime(b.id)
                }}
              >
                {b.timerStart ? '⏹' : '▶'}
              </button>
              <div className="brz brz-top" onMouseDown={e => handleBlockResizeTop(e, b)} />
              <div className="brz" onMouseDown={e => handleBlockResize(e, b)} />
            </div>
          )
        })}

      {/* Ghost blocks for recurring — show on dates without a real instance */}
      {blocks
        .filter(b => (b.repeat === 'daily' || b.repeat === 'weekdays' || b.repeat === 'weekly') && !dates.includes(b.date))
        .flatMap(b => {
          const ghosts: { date: string; b: typeof b }[] = []
          dates.forEach(date => {
            const tgtDay = new Date(date + 'T00:00:00').getDay()
            if (b.repeat === 'daily') {
              const alreadyExists = blocks.some(r => r.date === date && r.name === b.name && r.start === b.start && r.id !== b.id)
              if (!alreadyExists) ghosts.push({ date, b })
            } else if (b.repeat === 'weekdays') {
              // Mon–Fri only (getDay 1–5)
              if (tgtDay >= 1 && tgtDay <= 5) {
                const alreadyExists = blocks.some(r => r.date === date && r.name === b.name && r.start === b.start && r.id !== b.id)
                if (!alreadyExists) ghosts.push({ date, b })
              }
            } else if (b.repeat === 'weekly') {
              // Same weekday
              const srcDay = new Date(b.date + 'T00:00:00').getDay()
              if (srcDay === tgtDay) {
                const alreadyExists = blocks.some(r => r.date === date && r.name === b.name && r.start === b.start && r.id !== b.id)
                if (!alreadyExists) ghosts.push({ date, b })
              }
            }
          })
          return ghosts
        })
        .map(({ date, b }) => {
          const di = dates.indexOf(date)
          if (di < 0) return null
          const contW = containerRef.current?.offsetWidth ?? 756
          const colW = (contW - 56) / numDays
          const sm = toM(b.start)
          const em2 = toM(b.end)
          const top = m2y(sm, cfg.ds)
          const height = Math.max(m2y(em2, cfg.ds) - top, SH - 2)
          const left = 56 + di * colW + 2
          const width = colW - 4
          const customStyle = b.cc
            ? { background: b.cc.bg, borderColor: b.cc.bd, color: b.cc.ink, opacity: 0.35 }
            : { opacity: 0.35 }

          return (
            <div
              key={`ghost-${b.id}-${date}`}
              className={`blk ${blkClass(b)} ghost-blk`}
              style={{ top, left, width, height, ...customStyle }}
              title={`recurring: ${b.name} — click to apply`}
              onClick={e => {
                e.stopPropagation()
                applyRecurring(b.id, date)
              }}
            >
              <div className="bdh">
                <div className="bn">{b.name}</div>
              </div>
            </div>
          )
        })}
    </div>
  )
}
