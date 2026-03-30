import { useStore } from '../store'

export default function ShortcutsModal() {
  const { closeKbd } = useStore()

  return (
    <div className="mb on" id="kbd-m" onClick={e => { if (e.target === e.currentTarget) closeKbd() }}>
      <div className="mbox">
        <div className="mhdr">
          <span className="kbd-ttl">shortcuts</span>
          <button className="mx" onClick={closeKbd}>×</button>
        </div>
        <div className="kbd-list">
          <div className="kbd-section">navigation</div>
          <div className="kbd-r"><span className="kbd-d">week view</span><span className="kk">W</span></div>
          <div className="kbd-r"><span className="kbd-d">day view</span><span className="kk">D</span></div>
          <div className="kbd-r"><span className="kbd-d">my perfect day</span><span className="kk">P</span></div>
          <div className="kbd-r"><span className="kbd-d">go to today</span><span className="kk">T</span></div>
          <div className="kbd-r">
            <span className="kbd-d">navigate week / day</span>
            <div className="kbd-ks"><span className="kk">←</span><span className="kk">→</span></div>
          </div>

          <div className="kbd-section">blocks</div>
          <div className="kbd-r"><span className="kbd-d">quick add (natural language)</span><span className="kk">N</span></div>
          <div className="kbd-r"><span className="kbd-d">queue hovered block</span><span className="kk">Q</span></div>
          <div className="kbd-r"><span className="kbd-d">clear current day (undoable)</span><span className="kk">C</span></div>
          <div className="kbd-r">
            <span className="kbd-d">copy block (right-click first)</span>
            <div className="kbd-ks"><span className="kk">⌘</span><span className="kk">C</span></div>
          </div>
          <div className="kbd-r">
            <span className="kbd-d">paste block</span>
            <div className="kbd-ks"><span className="kk">⌘</span><span className="kk">V</span></div>
          </div>
          <div className="kbd-r">
            <span className="kbd-d">undo</span>
            <div className="kbd-ks"><span className="kk">⌘</span><span className="kk">Z</span></div>
          </div>
          <div className="kbd-r">
            <span className="kbd-d">redo</span>
            <div className="kbd-ks"><span className="kk">⌘</span><span className="kk">⇧</span><span className="kk">Z</span></div>
          </div>

          <div className="kbd-section">ai & tools</div>
          <div className="kbd-r"><span className="kbd-d">focus mode</span><span className="kk">F</span></div>
          <div className="kbd-r">
            <span className="kbd-d">templates</span>
            <div className="kbd-ks"><span className="kk">⇧</span><span className="kk">T</span></div>
          </div>

          <div className="kbd-section">other</div>
          <div className="kbd-r"><span className="kbd-d">this shortcuts list</span><span className="kk">?</span></div>
          <div className="kbd-r"><span className="kbd-d">close modal</span><span className="kk">Esc</span></div>
        </div>
      </div>
    </div>
  )
}
