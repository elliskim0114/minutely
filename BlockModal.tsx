import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store'
import { CCOLS } from '../constants'
import { toM, getFreeSlots } from '../utils'
import type { Block } from '../types'

// ── Smart type prediction ──────────────────────────────────────────────────
type Prediction = { type: string; customName?: string; label: string }

const TYPE_PATTERNS: Array<{ words: string[]; type: string }> = [
  { words: ['hang out','hangout','hang with','catching up','catch up','lunch with','dinner with','coffee with','drinks with','date with','meet with','chat with','birthday','party','game night','family time','friends','social','picnic','bbq','brunch with'], type: 'free' },
  { words: ['deep work','focus session','focus time','focused work','writing session','coding session','design session','work on','work session','build','implement','debug','ship','develop','programming','drafting','producing'], type: 'focus' },
  { words: ['standup','stand-up','all-hands','meeting','1:1','one on one','sync','client call','team call','interview','review session','check-in','admin','commute','appointment','errands','planning session'], type: 'routine' },
  { words: ['study','studying','learning','lesson','flashcards','homework','revision','revising','reading session','research session','tutorial','online course','workshop','practice session','training session'], type: 'study' },
  { words: ['gym','workout','run','running','yoga','pilates','walk','hike','hiking','swim','swimming','exercise','cycling','weights','strength training','cardio','stretching','sport','tennis','basketball','football'], type: 'free' },
  { words: ['rest','relax','break','nap','meditation','meditate','journal','journaling','wind down','self care','personal time','downtime','reading','read book'], type: 'free' },
]

function predictType(
  name: string,
  customLabels: string[],
  recentBlocks: Array<{ name: string; type: string; customName?: string | null }>,
): Prediction | null {
  if (!name.trim() || name.length < 3) return null
  const n = name.toLowerCase().trim()

  // 1. History — same name used before → use that type
  const counts: Record<string, number> = {}
  recentBlocks.forEach(b => {
    if (b.name.toLowerCase() === n) {
      const key = b.type + (b.customName ? ':' + b.customName : '')
      counts[key] = (counts[key] || 0) + 1
    }
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (top) {
    const [typeKey, freq] = top
    if (freq >= 1) {
      const [type, customName] = typeKey.split(':')
      return { type, customName, label: customName || type }
    }
  }

  // 2. Keyword patterns
  for (const { words, type } of TYPE_PATTERNS) {
    if (words.some(w => n.includes(w))) return { type, label: type }
  }

  // 3. Fuzzy match against saved custom labels
  const lbl = customLabels.find(l => {
    const ll = l.toLowerCase()
    return n.includes(ll) || ll.split(' ').some(w => w.length > 3 && n.includes(w))
  })
  if (lbl) return { type: 'custom', customName: lbl, label: lbl }

  return null
}

const DARK_THRESHOLD = ['midnight', 'forest', 'espresso', 'galaxy']

type BType = Block['type'] | 'custom'

const TYPE_ACTIVE: Record<string, string> = {
  focus: 'af', routine: 'ar', study: 'as', free: 'al', custom: 'ad',
}

const ALL_BUILTIN: Array<{ key: BType; dot: string }> = [
  { key: 'focus',   dot: 'tf' },
  { key: 'routine', dot: 'tr' },
  { key: 'study',   dot: 'ts' },
  { key: 'free',    dot: 'tl' },
]

export default function BlockModal() {
  const {
    blockModal, closeBlockModal, saveBlockModal, deleteFromBlockModal,
    customLabels, customLabelColors, addCustomLabel, removeCustomLabel, reorderCustomLabels, saveAsTemplate,
    blocks, cfg, setTypeColorOverride, hideBuiltinCustom, setHideBuiltinCustom,
    hiddenBuiltinTypes, hideBuiltinType, showBuiltinType,
    goals,
  } = useStore()
  const { isNew, isForPD, block, initStart, initEnd } = blockModal

  const nameRef = useRef<HTMLInputElement>(null)
  const newLabelRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(block?.name || '')
  const [start, setStart] = useState(initStart)
  const [end, setEnd] = useState(initEnd)
  const [type, setType] = useState<BType>(() => {
    if (!block) return 'focus'
    if (block.cc) return 'custom'
    return (block.type as BType) || 'focus'
  })
  const [ccIdx, setCcIdx] = useState(0)
  const [customName, setCustomName] = useState(block?.customName || '')
  const [repeat, setRepeat] = useState<Block['repeat']>(block?.repeat || 'none')
  const [goalId, setGoalId] = useState<number | null>(block?.goalId ?? null)
  const [savedTmpl, setSavedTmpl] = useState(false)
  const [showNewLabelInput, setShowNewLabelInput] = useState(false)
  const [newLabelVal, setNewLabelVal] = useState('')
  const [suggestion, setSuggestion] = useState<Prediction | null>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Drag-to-reorder: pure ref/DOM approach — zero React re-renders during drag ──
  const dragFromIdx = useRef<number | null>(null)
  const dragOverEl  = useRef<HTMLElement | null>(null)

  const onLblDragStart = useCallback((i: number) => {
    dragFromIdx.current = i
  }, [])

  const onLblDragOver = useCallback((e: React.DragEvent<HTMLElement>, i: number) => {
    e.preventDefault()
    const el = e.currentTarget
    if (dragOverEl.current && dragOverEl.current !== el) {
      dragOverEl.current.classList.remove('drag-over-lbl')
    }
    el.classList.add('drag-over-lbl')
    dragOverEl.current = el
  }, [])

  const onLblDrop = useCallback((e: React.DragEvent<HTMLElement>, i: number) => {
    e.currentTarget.classList.remove('drag-over-lbl')
    dragOverEl.current = null
    if (dragFromIdx.current !== null && dragFromIdx.current !== i) {
      reorderCustomLabels(dragFromIdx.current, i)
    }
    dragFromIdx.current = null
  }, [reorderCustomLabels])

  const onLblDragEnd = useCallback(() => {
    if (dragOverEl.current) {
      dragOverEl.current.classList.remove('drag-over-lbl')
      dragOverEl.current = null
    }
    dragFromIdx.current = null
  }, [])

  // Free slots for smart scheduling (only for new blocks)
  const dateBlocks = isNew && blockModal.date
    ? blocks.filter(b => b.date === blockModal.date && (!block || b.id !== block.id))
    : []
  const freeSlots = isNew && blockModal.date
    ? getFreeSlots(dateBlocks, cfg.ds, cfg.de).slice(0, 4)
    : []

  // Initialize ccIdx from block's cc
  useEffect(() => {
    if (block?.cc) {
      const idx = CCOLS.findIndex(c => c.bg === block.cc!.bg)
      if (idx >= 0) setCcIdx(idx)
    }
  }, [])

  // Focus name input on open
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isNew) nameRef.current?.focus()
      else nameRef.current?.select()
    }, 150)
    return () => clearTimeout(timer)
  }, [isNew])

  // Focus new label input when it appears
  useEffect(() => {
    if (showNewLabelInput) {
      setTimeout(() => newLabelRef.current?.focus(), 50)
    }
  }, [showNewLabelInput])

  const title = isForPD
    ? (isNew ? 'add to blueprint' : 'edit blueprint block')
    : (isNew ? 'new block' : 'edit block')

  // When selecting a saved custom label, set type=custom, customName, and load its saved color
  const pickSavedLabel = (lbl: string) => {
    setType('custom')
    setCustomName(lbl)
    const savedIdx = customLabelColors[lbl]
    if (savedIdx !== undefined) setCcIdx(savedIdx)
  }

  const commitNewLabel = () => {
    const lbl = newLabelVal.trim()
    if (lbl) {
      addCustomLabel(lbl, ccIdx)
      pickSavedLabel(lbl)
    }
    setShowNewLabelInput(false)
    setNewLabelVal('')
  }

  const handleSave = () => {
    if (!name.trim()) { nameRef.current?.focus(); return }
    // Auto-save custom label with its current color
    if (type === 'custom' && customName.trim()) {
      addCustomLabel(customName.trim(), ccIdx)
    }
    // Always pass ccIdx — for built-in types it applies if set as override; for custom it's the block color
    const effectiveCcIdx = type === 'custom' ? ccIdx : null
    saveBlockModal({
      name: name.trim(),
      start,
      end,
      type: type === 'custom' ? 'custom' : type,
      ccIdx: effectiveCcIdx,
      customName: type === 'custom' ? customName || null : null,
      repeat,
      goalId,
    })
  }

  const isBuiltin = type !== 'custom' && ALL_BUILTIN.some(b => b.key === type)

  return (
    <div className="mb on" id="bm" onClick={e => { if (e.target === e.currentTarget) closeBlockModal() }}>
      <div className="mbox">
        <div className="mhdr">
          <span className="mttl">{title}</span>
          <button className="mx" onClick={closeBlockModal}>×</button>
        </div>

        <span className="mlbl" style={{ marginTop: 0 }}>name</span>
        <input
          ref={nameRef}
          className="minp"
          placeholder="block name"
          value={name}
          onChange={e => {
            const val = e.target.value
            setName(val)
            setSuggestion(null)
            if (suggestTimer.current) clearTimeout(suggestTimer.current)
            suggestTimer.current = setTimeout(() => {
              const pred = predictType(val, customLabels, blocks)
              // Only suggest if it differs from current selection
              if (pred && !(pred.type === type && pred.customName === customName)) {
                setSuggestion(pred)
              }
            }, 420)
          }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        />
        {suggestion && (
          <button
            className="blk-type-suggest"
            onClick={() => {
              setType(suggestion.type as BType)
              if (suggestion.customName) {
                setCustomName(suggestion.customName)
                const savedIdx = customLabelColors[suggestion.customName]
                if (savedIdx !== undefined) setCcIdx(savedIdx)
              } else {
                setCustomName('')
              }
              setSuggestion(null)
            }}
          >
            ✦ looks like <strong>{suggestion.label}</strong> — apply?
          </button>
        )}

        <span className="mlbl">time</span>
        <div className="mrow">
          <input className="minp" type="time" value={start} onChange={e => setStart(e.target.value)} />
          <input className="minp" type="time" value={end} onChange={e => setEnd(e.target.value)} />
        </div>

        {isNew && freeSlots.length > 0 && (
          <div className="free-slots">
            <span className="free-slots-lbl">free slots</span>
            <div className="free-slots-row">
              {freeSlots.map(s => (
                <button
                  key={s.start}
                  className="free-slot-btn"
                  onClick={() => { setStart(s.start); setEnd(s.end) }}
                >
                  {s.start}–{s.end}
                  <span className="fsd">{s.duration >= 60 ? `${Math.floor(s.duration/60)}h${s.duration%60 ? `${s.duration%60}m` : ''}` : `${s.duration}m`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <span className="mlbl">type</span>
        <div className="mtyps">
          {/* Built-in types — each has a hover × to hide */}
          {ALL_BUILTIN.filter(({ key }) => !(hiddenBuiltinTypes || []).includes(key as string)).map(({ key, dot }) => (
            <div key={key} className="mtyp-preset-wrap">
              <button
                className={`mtyp${type === key ? ` ${TYPE_ACTIVE[key]}` : ''}`}
                onClick={() => { setType(key); setCustomName('') }}
              >
                <div className={`tc ${dot}`} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                {key}
              </button>
              <button
                className="mtyp-hide-btn"
                title={`hide ${key} from this list`}
                onClick={e => {
                  e.stopPropagation()
                  hideBuiltinType(key as string)
                  if (type === key) setType(customLabels.length > 0 ? 'custom' : 'focus' as BType)
                }}
              >×</button>
            </div>
          ))}

          {/* Divider if any presets visible and custom labels exist */}
          {ALL_BUILTIN.some(({ key }) => !(hiddenBuiltinTypes || []).includes(key as string)) && customLabels.length > 0 && (
            <div className="mtyps-div" />
          )}

          {/* Custom labels — draggable, zero-rerender approach */}
          {customLabels.map((lbl, i) => {
            const savedColor = customLabelColors[lbl] !== undefined ? CCOLS[customLabelColors[lbl]] : null
            const isActive = type === 'custom' && customName === lbl
            return (
              <div
                key={lbl}
                className={`mtyp saved-lbl-btn${isActive ? ' ad' : ''}`}
                style={savedColor && isActive ? { background: savedColor.bg, borderColor: savedColor.bd, color: savedColor.ink } : savedColor ? { borderColor: savedColor.bd } : {}}
                draggable
                onDragStart={() => onLblDragStart(i)}
                onDragOver={e => onLblDragOver(e, i)}
                onDrop={e => onLblDrop(e, i)}
                onDragEnd={onLblDragEnd}
              >
                <span className="slb-drag" title="drag to reorder">
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                    <circle cx="2" cy="2" r="1.2" fill="currentColor" opacity=".5"/>
                    <circle cx="6" cy="2" r="1.2" fill="currentColor" opacity=".5"/>
                    <circle cx="2" cy="6" r="1.2" fill="currentColor" opacity=".5"/>
                    <circle cx="6" cy="6" r="1.2" fill="currentColor" opacity=".5"/>
                    <circle cx="2" cy="10" r="1.2" fill="currentColor" opacity=".5"/>
                    <circle cx="6" cy="10" r="1.2" fill="currentColor" opacity=".5"/>
                  </svg>
                </span>
                <span className="slb-name" onClick={() => pickSavedLabel(lbl)}>
                  <span className="slb-dot" style={{
                    background: savedColor ? savedColor.bg : 'var(--bd2)',
                    border: `1px solid ${savedColor ? savedColor.bd : 'var(--bd)'}`,
                  }} />
                  {lbl}
                </span>
                <button
                  className="slb-rm"
                  onClick={e => { e.stopPropagation(); removeCustomLabel(lbl); if (customName === lbl) { setCustomName(''); setType('custom') } }}
                  title="remove label"
                >×</button>
              </div>
            )
          })}

          {/* + new label */}
          <button className="mtyp new-lbl-btn" onClick={() => setShowNewLabelInput(v => !v)} title="add a new custom label">
            {showNewLabelInput ? '×' : '+ new'}
          </button>

          {/* Restore hidden presets link */}
          {(hiddenBuiltinTypes || []).length > 0 && (
            <button className="mtyp-restore" onClick={() => (hiddenBuiltinTypes || []).forEach(t => showBuiltinType(t))}>
              restore {(hiddenBuiltinTypes || []).join(', ')}
            </button>
          )}
        </div>

        {/* Inline new label input — only when + new is clicked */}
        {showNewLabelInput && (
          <div className="label-inp-row">
            <input
              ref={newLabelRef}
              id="type-name-inp"
              placeholder="label name (e.g. meditation, meeting…)"
              value={newLabelVal}
              onChange={e => setNewLabelVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitNewLabel()
                if (e.key === 'Escape') { setShowNewLabelInput(false); setNewLabelVal('') }
              }}
            />
            {newLabelVal.trim() && (
              <button
                className="label-save-btn"
                onClick={commitNewLabel}
                title="save label with current color"
              >save</button>
            )}
          </div>
        )}

        {/* Repeat picker — not for Perfect Day blocks */}
        {!isForPD && (
          <>
            <span className="mlbl">repeat</span>
            <div className="mtyps">
              {(['none', 'daily', 'weekdays', 'weekly'] as const).map(r => (
                <button
                  key={r}
                  className={`mtyp${repeat === r ? ' af' : ''}`}
                  onClick={() => setRepeat(r)}
                >
                  {r === 'weekdays' ? 'M–F' : r}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Goal picker — only for real blocks, not PD */}
        {!isForPD && goals.length > 0 && (
          <>
            <span className="mlbl">goal</span>
            <div className="mtyps goal-chips">
              <button className={`mtyp${!goalId ? ' af' : ''}`} onClick={() => setGoalId(null)}>none</button>
              {goals.map(g => (
                <button
                  key={g.id}
                  className={`mtyp goal-chip${goalId === g.id ? ' af' : ''}`}
                  style={goalId === g.id ? { background: g.color, borderColor: g.color, color: '#fff' } : { borderColor: g.color, color: g.color }}
                  onClick={() => setGoalId(goalId === g.id ? null : g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Color picker — always shown for selected type */}
        <div id="custom-type-sec" className="on">
          {/* For custom type: show label name input (when no saved label selected) */}
          {type === 'custom' && !customName && (
            <div className="label-inp-row">
              <input
                id="type-name-inp"
                placeholder="label name (e.g. meditation, meeting…)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (customName.trim()) addCustomLabel(customName.trim(), ccIdx)
                  }
                }}
              />
              {customName.trim() && (
                <button
                  className="label-save-btn"
                  onClick={() => addCustomLabel(customName.trim(), ccIdx)}
                  title="save label with current color"
                >save</button>
              )}
            </div>
          )}

          <div id="type-color-row">
            {CCOLS.map((c, i) => (
              <div
                key={i}
                className={`tcsw${ccIdx === i ? ' on' : ''}${DARK_THRESHOLD.includes(c.n) ? ' dark-swatch' : ''}`}
                style={{ background: c.bg, borderColor: c.bd }}
                title={c.n}
                onClick={() => setCcIdx(i)}
              />
            ))}
          </div>
          <div className="tcsw-sel-name" style={{ background: CCOLS[ccIdx].bg, borderColor: CCOLS[ccIdx].bd, color: CCOLS[ccIdx].ink }}>
            {CCOLS[ccIdx].n}
          </div>

          {/* Set as global default — only for built-in types */}
          {isBuiltin && (
            <button
              className="set-default-btn"
              onClick={() => {
                setTypeColorOverride(type as string, ccIdx)
                useStore.getState().showToast(`default color for ${type} updated`)
              }}
              title={`set this color as the default for all ${type} blocks`}
            >
              set as default for {type}
            </button>
          )}
        </div>

        <div className="macts">
          {!isNew && (
            <button className="mact-btn mdel" onClick={deleteFromBlockModal}>delete</button>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
            {!isForPD && name.trim() && (
              <button
                className={`mact-btn mtmpl-btn${savedTmpl ? ' tmpl-saved' : ''}`}
                title="save as a reusable template"
                onClick={() => {
                  const dur = toM(end) - toM(start)
                  saveAsTemplate(name.trim(), [{ name: name.trim(), type: type === 'custom' ? 'custom' : type, duration: dur, cc: type === 'custom' ? CCOLS[ccIdx] : undefined, customName: type === 'custom' ? customName || undefined : undefined }])
                  setSavedTmpl(true)
                  setTimeout(() => setSavedTmpl(false), 2000)
                }}
              >
                {savedTmpl ? '✓ saved!' : '+ template'}
              </button>
            )}
            <button className="mact-btn mcanc" onClick={closeBlockModal}>cancel</button>
            <button className="mact-btn msave" onClick={handleSave}>save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
