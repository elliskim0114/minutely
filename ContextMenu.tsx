import { useStore } from '../store'
import { toT, toM } from '../utils'

export default function ContextMenu() {
  const { ctxMenu, hideCtxMenu, ctxCopy, ctxPaste, ctxDelete, copiedBlock, openBlockModalEdit, openBlockModalNew, cfg } = useStore()
  const { x, y, block } = ctxMenu

  const safeX = Math.min(x, window.innerWidth - 210)
  const safeY = Math.min(y, window.innerHeight - 220)

  const handleNewBlock = () => {
    hideCtxMenu()
    if (ctxMenu.date && ctxMenu.mins != null) {
      openBlockModalNew(
        ctxMenu.date,
        toT(ctxMenu.mins),
        toT(Math.min(toM(cfg.de), ctxMenu.mins + 60))
      )
    }
  }

  return (
    <div
      id="ctx-menu"
      className="on"
      style={{ left: safeX, top: safeY }}
      onClick={e => e.stopPropagation()}
    >
      {block && (
        <div className="ctx-item" onClick={() => { hideCtxMenu(); openBlockModalEdit(block) }}>
          <svg viewBox="0 0 13 13" fill="none">
            <path d="M9 2l2 2-7 7H2V9L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
          <div className="ctx-content">
            <div className="ctx-lbl">edit block</div>
            <div className="ctx-sub">change name, time, or type</div>
          </div>
        </div>
      )}
      {block && (
        <div className="ctx-item" onClick={ctxCopy}>
          <svg viewBox="0 0 13 13" fill="none">
            <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M2 9V2h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="ctx-content">
            <div className="ctx-lbl">copy block</div>
            <div className="ctx-sub">duplicate to paste anywhere</div>
          </div>
        </div>
      )}
      {copiedBlock && (
        <div className="ctx-item" onClick={ctxPaste}>
          <svg viewBox="0 0 13 13" fill="none">
            <rect x="1" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 1h8v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="ctx-content">
            <div className="ctx-lbl">paste here</div>
            <div className="ctx-sub">place "{copiedBlock.name}" at this time</div>
          </div>
        </div>
      )}
      {!block && (
        <div className="ctx-item" onClick={handleNewBlock}>
          <svg viewBox="0 0 13 13" fill="none">
            <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div className="ctx-content">
            <div className="ctx-lbl">new block here</div>
            <div className="ctx-sub">add a task at this time slot</div>
          </div>
        </div>
      )}
      {block && (
        <>
          <div className="ctx-sep" />
          <div className="ctx-item red" onClick={ctxDelete}>
            <svg viewBox="0 0 13 13" fill="none">
              <path d="M2 3.5h9M5 3.5V2h3v1.5M4 3.5l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="ctx-content">
              <div className="ctx-lbl">delete block</div>
              <div className="ctx-sub">permanently remove this block</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
