import { useStore } from '../store'
import { fmt } from '../utils'

function blkClass(b: { cc?: unknown; type: string }) {
  if (b.cc) return 'td'
  const map: Record<string, string> = { focus: 'tf', routine: 'tr', study: 'ts', free: 'tl' }
  return map[b.type] || 'td'
}

export default function ShareModal() {
  const { closeShare, perfectDay, cfg, showToast } = useStore()

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    showToast('link copied — share your perfect day!')
    closeShare()
  }

  return (
    <div className="mb on" id="share-m" onClick={e => { if (e.target === e.currentTarget) closeShare() }}>
      <div className="mbox">
        <div className="sc-logo">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--acc)', display: 'inline-block' }} />
          minutely
        </div>
        <div className="sc-ttl">my perfect day</div>
        <div className="sc-sub">{perfectDay.length} blocks · {cfg.ds} – {cfg.de}</div>
        <div id="sc-blocks">
          {perfectDay.slice(0, 6).map((b, i) => {
            const customStyle = b.cc
              ? { background: b.cc.bg, borderColor: b.cc.bd, color: b.cc.ink }
              : {}
            return (
              <div key={i} className={`sc-blk ${blkClass(b)}`} style={customStyle}>
                <span className="sc-time">{fmt(b.start, cfg.tf)}</span>
                {b.name}
              </div>
            )
          })}
        </div>
        <div className="sh-acts">
          <button className="shb" onClick={closeShare}>close</button>
          <button className="shb p" onClick={copyLink}>copy link</button>
        </div>
      </div>
    </div>
  )
}
