import { useState } from 'react'
import { useStore } from '../store'
import { todayStr } from '../utils'

interface RescheduledBlock {
  name: string
  start: string
  end: string
  type: string
  oldStart?: string
  oldEnd?: string
}

interface Props { onClose: () => void }

export default function RescheduleModal({ onClose }: Props) {
  const { blocks, selDate, cfg, anthropicKey, clearDay, addBlock, showToast, rescheduleDelay } = useStore()
  const date = selDate || todayStr()

  // Support "running late" offset: shift current time forward by rescheduleDelay minutes
  const now = new Date(Date.now() + (rescheduleDelay || 0) * 60 * 1000)
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const isLate = (rescheduleDelay || 0) > 0

  // Blocks that haven't started yet (relative to currentTime which may be offset)
  const remainingBlocks = blocks
    .filter(b => b.date === date && b.start >= currentTime)
    .sort((a, b) => a.start.localeCompare(b.start))

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ blocks: RescheduledBlock[]; reasoning: string } | null>(null)
  const [error, setError] = useState('')

  const reschedule = async () => {
    if (!remainingBlocks.length) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          currentTime,
          blocks: remainingBlocks.map(b => ({ name: b.name, start: b.start, end: b.end, type: b.type })),
          apiKey: anthropicKey || undefined,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Merge old times for diff view
      const newBlocks: RescheduledBlock[] = (data.blocks || []).map((nb: RescheduledBlock, i: number) => ({
        ...nb,
        oldStart: remainingBlocks[i]?.start,
        oldEnd: remainingBlocks[i]?.end,
      }))
      setResult({ blocks: newBlocks, reasoning: data.reasoning })
    } catch (e) {
      const msg = String(e)
      if (msg.includes('fetch') || msg.includes('Failed')) setError('server offline — start it first')
      else setError(String(e).replace('Error: ', ''))
    } finally {
      setLoading(false)
    }
  }

  const apply = () => {
    if (!result) return
    // Remove the original remaining blocks
    const idsToRemove = remainingBlocks.map(b => b.id)
    const otherBlocks = blocks.filter(b => !idsToRemove.includes(b.id))

    // We need to set blocks directly via store internals
    // Use clearDay approach: set state with updated blocks
    const store = useStore.getState()
    useStore.setState({
      blockHistory: [...store.blockHistory.slice(-29), store.blocks],
      blockFuture: [],
      blocks: [
        ...otherBlocks,
        ...result.blocks.map((nb, i) => ({
          id: store.nid + i,
          date,
          name: nb.name,
          type: nb.type as 'focus' | 'routine' | 'study' | 'free',
          start: nb.start,
          end: nb.end,
          cc: null,
          customName: null,
          repeat: 'none' as const,
        })),
      ],
      nid: store.nid + result.blocks.length,
    })
    showToast(`rescheduled ${result.blocks.length} blocks`)
    onClose()
  }

  const changed = (b: RescheduledBlock) => b.oldStart && b.oldStart !== b.start

  return (
    <div className="sc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sc-box">
        <div className="sc-hdr">
          <div className="sc-hdr-l">
            <div className="sc-icon">⏱</div>
            <div>
              <div className="sc-title">{isLate ? `running ${rescheduleDelay}m late` : 'running late?'}</div>
              <div className="sc-sub">AI will reschedule your remaining blocks from {currentTime}{isLate ? ` (+${rescheduleDelay}m)` : ''}</div>
            </div>
          </div>
          <button className="sc-close" onClick={onClose}>×</button>
        </div>

        <div className="sc-body">
          {remainingBlocks.length === 0 ? (
            <div className="rsch-empty">no upcoming blocks for today</div>
          ) : (
            <>
              {!result && (
                <>
                  <div className="rsch-list-lbl">remaining blocks today</div>
                  <div className="rsch-blocks">
                    {remainingBlocks.map((b, i) => (
                      <div key={i} className="rsch-block">
                        <span className={`rsch-dot tc ${b.type === 'focus' ? 'tf' : b.type === 'routine' ? 'tr' : b.type === 'study' ? 'ts' : 'tl'}`} />
                        <span className="rsch-name">{b.name}</span>
                        <span className="rsch-time">{b.start}–{b.end}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {result && (
                <>
                  <div className="rsch-reasoning">{result.reasoning}</div>
                  <div className="rsch-list-lbl">proposed schedule</div>
                  <div className="rsch-blocks">
                    {result.blocks.map((b, i) => (
                      <div key={i} className={`rsch-block${changed(b) ? ' changed' : ''}`}>
                        <span className={`rsch-dot tc ${b.type === 'focus' ? 'tf' : b.type === 'routine' ? 'tr' : b.type === 'study' ? 'ts' : 'tl'}`} />
                        <span className="rsch-name">{b.name}</span>
                        <div className="rsch-times">
                          {changed(b) && (
                            <span className="rsch-old-time">{b.oldStart}–{b.oldEnd}</span>
                          )}
                          <span className={`rsch-time${changed(b) ? ' new' : ''}`}>{b.start}–{b.end}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {error && <div className="coach-error">{error}</div>}

              <div className="sc-foot">
                {result ? (
                  <>
                    <button className="sc-cancel" onClick={() => setResult(null)}>← try again</button>
                    <button className="sc-add" onClick={apply}>apply schedule</button>
                  </>
                ) : (
                  <>
                    <button className="sc-cancel" onClick={onClose}>cancel</button>
                    <button className="sc-parse" onClick={reschedule} disabled={loading}>
                      {loading
                        ? <><div className="sc-dot" /><div className="sc-dot" /><div className="sc-dot" /><span>rescheduling…</span></>
                        : '⏱ reschedule'
                      }
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
