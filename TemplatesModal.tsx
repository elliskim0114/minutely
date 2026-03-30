import { useState } from 'react'
import { useStore } from '../store'
import { todayStr, toM } from '../utils'

export default function TemplatesModal({ onClose }: { onClose: () => void }) {
  const { templates, deleteTemplate, applyTemplate, saveAsTemplate, selDate, blocks } = useStore()
  const [applyDate, setApplyDate] = useState(selDate || todayStr())
  const [startTime, setStartTime] = useState('09:00')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleApply = (id: number) => {
    applyTemplate(id, applyDate, toM(startTime))
    onClose()
  }

  const todayBlocks = blocks.filter(b => b.date === (selDate || todayStr()))

  const handleSaveToday = () => {
    if (!saveName.trim()) return
    saveAsTemplate(saveName.trim(), todayBlocks.map(b => ({
      name: b.name,
      type: b.type,
      duration: toM(b.end) - toM(b.start),
      cc: b.cc ?? null,
      customName: b.customName ?? null,
    })))
    setSaveName('')
    setSaving(false)
    useStore.getState().showToast(`template "${saveName.trim()}" saved`)
  }

  return (
    <div className="tmpl-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tmpl-box">
        <div className="tmpl-hdr">
          <div className="tmpl-title">templates</div>
          <button className="tmpl-close" onClick={onClose}>×</button>
        </div>

        <div className="tmpl-sub">save any day's schedule as a reusable template.</div>

        {/* Save current day */}
        {todayBlocks.length > 0 && (
          <div className="tmpl-save-row">
            {saving ? (
              <>
                <input
                  className="tmpl-save-inp"
                  placeholder="template name…"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveToday(); if (e.key === 'Escape') setSaving(false) }}
                  autoFocus
                />
                <button className="tmpl-save-btn" onClick={handleSaveToday}>save</button>
                <button className="tmpl-save-cancel" onClick={() => setSaving(false)}>cancel</button>
              </>
            ) : (
              <button className="tmpl-save-today" onClick={() => setSaving(true)}>
                + save today as template
              </button>
            )}
          </div>
        )}

        {/* Apply controls */}
        <div className="tmpl-apply-row">
          <input
            className="tmpl-inp"
            type="date"
            value={applyDate}
            onChange={e => setApplyDate(e.target.value)}
          />
          <input
            className="tmpl-inp"
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />
        </div>

        {templates.length === 0 ? (
          <div className="tmpl-empty">no templates yet — use "save today as template" or right-click blocks to save a group</div>
        ) : (
          <div className="tmpl-list">
            {templates.map(t => (
              <div key={t.id} className="tmpl-item">
                <div className="tmpl-info">
                  <div className="tmpl-name">{t.name}</div>
                  <div className="tmpl-meta">{t.blocks.length} block{t.blocks.length !== 1 ? 's' : ''} · {Math.round(t.blocks.reduce((s, b) => s + b.duration, 0) / 60 * 10) / 10}h total</div>
                  <div className="tmpl-block-list">
                    {t.blocks.slice(0, 3).map((b, i) => (
                      <span key={i} className="tmpl-blk-chip">{b.name}</span>
                    ))}
                    {t.blocks.length > 3 && <span className="tmpl-blk-chip tmpl-more">+{t.blocks.length - 3} more</span>}
                  </div>
                </div>
                <div className="tmpl-acts">
                  <button className="tmpl-apply-btn" onClick={() => handleApply(t.id)}>apply</button>
                  <button className="tmpl-del-btn" onClick={() => deleteTemplate(t.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
