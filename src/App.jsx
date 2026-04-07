import { useState, useEffect, useRef, useCallback } from 'react'
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  serverTimestamp, query, orderBy, updateDoc,
} from 'firebase/firestore'
import { auth, db, provider } from './firebase'
import './App.css'

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const T = {
  bg:       '#1C1C1E',
  surface:  '#2C2C2E',
  surface2: '#3A3A3C',
  border:   '#48484A',
  blue:     '#4A90D9',
  blueHov:  '#5A9FE5',
  blueDim:  'rgba(74,144,217,0.12)',
  text:     '#F5F5F7',
  textSub:  '#98989D',
  textDim:  '#6C6C70',
  green:    '#30D158',
  red:      '#FF453A',
  r:        '10px',
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = 'primary', disabled = false, style = {}, full = false }) => {
  const [hov, setHov] = useState(false)
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 18px', borderRadius: T.r, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', transition: 'all 0.15s', opacity: disabled ? 0.45 : 1, width: full ? '100%' : 'auto', ...style }
  const v = {
    primary: { background: hov ? T.blueHov : T.blue, color: '#fff' },
    secondary: { background: hov ? T.surface2 : T.surface, color: T.text, border: `1px solid ${T.border}` },
    ghost: { background: hov ? T.blueDim : 'transparent', color: T.blue, border: `1px solid ${hov ? T.blue : 'rgba(74,144,217,0.4)'}` },
    danger: { background: hov ? 'rgba(255,69,58,0.12)' : 'transparent', color: T.red, border: `1px solid ${hov ? T.red : 'rgba(255,69,58,0.35)'}` },
    success: { background: hov ? '#28C24E' : T.green, color: '#fff' },
  }[variant] || {}
  return (
    <button style={{ ...base, ...v }} onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </button>
  )
}

const Input = ({ value, onChange, placeholder, multiline, rows = 4, onKeyDown, autoFocus, style = {} }) => {
  const s = { ...style }
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={s} autoFocus={autoFocus} />
    : <input value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} autoFocus={autoFocus} style={s} />
}

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r, ...style, cursor: onClick ? 'pointer' : 'default' }}>
    {children}
  </div>
)

const Label = ({ children, style = {} }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, ...style }}>{children}</div>
)

const Divider = ({ style = {} }) => <div style={{ height: 1, background: T.border, ...style }} />

// ─── MODAL ────────────────────────────────────────────────────────────────────
const Modal = ({ children, onClose, width = 460 }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ width: '100%', maxWidth: width, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
      {children}
    </div>
  </div>
)

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const Logo = ({ size = 28 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
    <div style={{ fontSize: size, fontFamily: "'Exo 2', sans-serif", fontWeight: 800, color: T.blue, letterSpacing: 1, lineHeight: 1 }}>
      Katara
    </div>
    <div style={{ fontSize: Math.max(9, size * 0.32), color: T.textDim, letterSpacing: 1.5, marginTop: 2 }}>
      by Bridgelab
    </div>
  </div>
)

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const Breadcrumb = ({ crumbs }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', overflow: 'hidden' }}>
    {crumbs.map((c, i) => (
      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {i > 0 && <span style={{ color: T.textDim, fontSize: 13 }}>›</span>}
        <span style={{ fontSize: 13, color: i === crumbs.length - 1 ? T.text : T.textSub, fontWeight: i === crumbs.length - 1 ? 600 : 400, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c}
        </span>
      </span>
    ))}
  </div>
)

// ─── STICKY HEADER ────────────────────────────────────────────────────────────
const Header = ({ crumbs, onBack, right, title }) => (
  <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.bg, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
    {onBack && (
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.blue, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← Zurück
      </button>
    )}
    <div style={{ flex: 1, overflow: 'hidden' }}>
      {crumbs ? <Breadcrumb crumbs={crumbs} /> : <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{title}</span>}
    </div>
    {right}
  </div>
)

// ─── CONTEXT MENU (⋮) ────────────────────────────────────────────────────────
const useContextMenu = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return { open, setOpen, ref }
}

const CtxMenu = ({ items }) => {
  const { open, setOpen, ref } = useContextMenu()
  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, fontSize: 18, padding: '0 4px', lineHeight: 1, borderRadius: 6 }}>⋮</button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.r, minWidth: 160, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginTop: 4 }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.action(); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: item.danger ? T.red : T.text, fontSize: 14, cursor: 'pointer', textAlign: 'left', borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CREATE MODAL ─────────────────────────────────────────────────────────────
const CreateModal = ({ title, placeholder, onSave, onClose }) => {
  const [name, setName] = useState('')
  const submit = () => { if (name.trim()) { onSave(name.trim()); onClose() } }
  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 20 }}>{title}</h3>
      <Label>Name</Label>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} autoFocus
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={submit} disabled={!name.trim()} full>Erstellen</Btn>
        <Btn onClick={onClose} variant="secondary" style={{ flexShrink: 0, padding: '9px 16px' }}>Abbrechen</Btn>
      </div>
    </Modal>
  )
}

// ─── RENAME MODAL ─────────────────────────────────────────────────────────────
const RenameModal = ({ current, onSave, onClose }) => {
  const [val, setVal] = useState(current)
  const submit = () => { if (val.trim()) { onSave(val.trim()); onClose() } }
  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 20 }}>Umbenennen</h3>
      <Label>Neuer Name</Label>
      <Input value={val} onChange={e => setVal(e.target.value)} placeholder="Name…" autoFocus
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={submit} disabled={!val.trim()} full>Speichern</Btn>
        <Btn onClick={onClose} variant="secondary" style={{ flexShrink: 0, padding: '9px 16px' }}>Abbrechen</Btn>
      </div>
    </Modal>
  )
}

// ─── FOLDER CARD (2-col grid tile) ───────────────────────────────────────────
const FolderCard = ({ item, onClick, onRename, onDelete }) => {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? T.surface2 : T.surface, border: `1px solid ${hov ? '#5A5A5C' : T.border}`, borderRadius: T.r, padding: '18px 16px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', minHeight: 110, display: 'flex', flexDirection: 'column', gap: 8 }}
      onClick={onClick}>
      <div style={{ fontSize: 28 }}>📁</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1.3, flex: 1 }}>{item.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: T.textDim }}>{item._count != null ? `${item._count} Gruppen` : ''}</div>
        {item.updatedAt && <div style={{ fontSize: 11, color: T.textDim }}>{fmtDate(item.updatedAt)}</div>}
      </div>
      <div style={{ position: 'absolute', top: 10, right: 10, opacity: hov ? 1 : 0, transition: 'opacity 0.15s' }} onClick={e => e.stopPropagation()}>
        <CtxMenu items={[{ label: '✏️  Umbenennen', action: onRename }, { label: '🗑️  Löschen', action: onDelete, danger: true }]} />
      </div>
    </div>
  )
}

// ─── FOLDER ROW (list) ────────────────────────────────────────────────────────
const FolderRow = ({ item, onClick, onRename, onDelete, countLabel }) => {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? T.surface2 : T.surface, border: `1px solid ${hov ? '#5A5A5C' : T.border}`, borderRadius: T.r, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}
      onClick={onClick}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>🗂️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{item.name}</div>
        <div style={{ fontSize: 12, color: T.textDim, marginTop: 2, display: 'flex', gap: 12 }}>
          {countLabel && <span>{countLabel}</span>}
          {item.updatedAt && <span>{fmtDate(item.updatedAt)}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: T.textDim, fontSize: 16, opacity: hov ? 0.8 : 0.3 }}>›</span>
        <div style={{ opacity: hov ? 1 : 0, transition: 'opacity 0.15s' }} onClick={e => e.stopPropagation()}>
          <CtxMenu items={[{ label: '✏️  Umbenennen', action: onRename }, { label: '🗑️  Löschen', action: onDelete, danger: true }]} />
        </div>
      </div>
    </div>
  )
}

// ─── CARD LIST ITEM ───────────────────────────────────────────────────────────
const CardItem = ({ card, onEdit, onDelete }) => {
  const [hov, setHov] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const m = card.mastery || 0
  const mColor = m >= 80 ? T.green : m >= 40 ? T.blue : T.textDim

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => setFlipped(f => !f)}
      style={{ background: hov ? T.surface2 : T.surface, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
      {/* Mastery indicator */}
      <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: m > 0 ? `${mColor}88` : T.border, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {!flipped ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {card.image && <img src={card.image} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${T.border}` }} />}
            <div>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 3 }}>VORDERSEITE</div>
              <div style={{ fontSize: 15, color: T.text }}>{card.front || '(nur Bild)'}</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 3 }}>RÜCKSEITE</div>
            {card.backImage && <img src={card.backImage} alt="" style={{ maxHeight: 60, borderRadius: 6, marginBottom: 6, border: `1px solid ${T.border}` }} />}
            <div style={{ fontSize: 15, color: T.text, fontWeight: 600 }}>{card.back}</div>
            {card.backShort && <div style={{ fontSize: 13, color: T.blue, marginTop: 3 }}>{card.backShort}</div>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, opacity: hov ? 1 : 0, transition: 'opacity 0.15s' }} onClick={e => e.stopPropagation()}>
        {m > 0 && <span style={{ fontSize: 11, color: mColor }}>{m}%</span>}
        <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, fontSize: 14, padding: '2px 4px' }}>✏️</button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, fontSize: 14, padding: '2px 4px' }}>✕</button>
      </div>
    </div>
  )
}

// ─── CARD MODAL ───────────────────────────────────────────────────────────────
const CardModal = ({ initial, onSave, onClose }) => {
  const [front, setFront] = useState(initial?.front || '')
  const [image, setImage] = useState(initial?.image || null)
  const [back, setBack] = useState(initial?.back || '')
  const [backShort, setBackShort] = useState(initial?.backShort || '')
  const [backImage, setBackImage] = useState(initial?.backImage || null)
  const [saving, setSaving] = useState(false)

  const pickImg = setter => e => {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader(); r.onload = ev => setter(ev.target.result); r.readAsDataURL(f)
  }

  const save = async () => {
    if (!back.trim() && !front.trim() && !image) return
    setSaving(true)
    await onSave({ front: front.trim(), image: image || null, back: back.trim(), backShort: backShort.trim(), backImage: backImage || null })
    setSaving(false)
  }

  return (
    <Modal onClose={onClose} width={640}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{initial ? 'Karte bearbeiten' : 'Neue Karte'}</h3>
        <Btn onClick={onClose} variant="secondary" style={{ padding: '5px 10px', fontSize: 12 }}>✕</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Front */}
        <div style={{ background: T.bg, borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1, marginBottom: 14 }}>VORDERSEITE</div>
          <Label>Text</Label>
          <Input value={front} onChange={e => setFront(e.target.value)} placeholder="Begriff, Signal, Situation…" multiline rows={3} style={{ marginBottom: 14 }} />
          <Label>Bild (optional)</Label>
          <input type="file" accept="image/*" onChange={pickImg(setImage)} style={{ fontSize: 12, color: T.textSub, display: 'block', marginTop: 4, background: 'none', border: 'none', padding: 0, width: 'auto' }} />
          {image && <ImgPreview src={image} onRemove={() => setImage(null)} />}
        </div>
        {/* Back */}
        <div style={{ background: T.bg, borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1, marginBottom: 14 }}>RÜCKSEITE</div>
          <Label>Langbezeichnung *</Label>
          <Input value={back} onChange={e => setBack(e.target.value)} placeholder="z.B. Hauptsignal Hp 0 — Halt" multiline rows={3} style={{ marginBottom: 10 }} />
          <Label>Kurzbezeichnung</Label>
          <Input value={backShort} onChange={e => setBackShort(e.target.value)} placeholder="z.B. Hp 0" style={{ marginBottom: 14 }} />
          <Label>Bild (optional)</Label>
          <input type="file" accept="image/*" onChange={pickImg(setBackImage)} style={{ fontSize: 12, color: T.textSub, display: 'block', marginTop: 4, background: 'none', border: 'none', padding: 0, width: 'auto' }} />
          {backImage && <ImgPreview src={backImage} onRemove={() => setBackImage(null)} />}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Btn onClick={save} disabled={saving || (!back.trim() && !front.trim() && !image)} full>
          {saving ? 'Speichert…' : initial ? 'Änderungen speichern' : 'Karte speichern'}
        </Btn>
        <Btn onClick={onClose} variant="secondary" style={{ flexShrink: 0, padding: '9px 16px' }}>Abbrechen</Btn>
      </div>
    </Modal>
  )
}

const ImgPreview = ({ src, onRemove }) => (
  <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
    <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 6, display: 'block', border: `1px solid ${T.border}` }} />
    <button onClick={onRemove} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: T.red, border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
  </div>
)

// ─── KI IMPORT SCREEN ────────────────────────────────────────────────────────
const KIImportScreen = ({ cardsPath, onSaved, onClose }) => {
  const [file, setFile] = useState(null)
  const [instr, setInstr] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  const handleDrop = e => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) setFile(f)
  }

  const generate = async () => {
    if (!file && !instr.trim()) return
    setLoading(true); setError(''); setPreview(null)
    try {
      const ext = (file?.name || '').split('.').pop().toLowerCase()
      const jsonPrompt = '\n\nAntworte NUR mit einem JSON-Array (kein Markdown):\n[{"front":"...","back":"...","backShort":"..."}]'
      let content

      if (file && ['jpg','jpeg','png','gif','webp'].includes(ext)) {
        const b64 = await toBase64(file)
        content = [
          { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64.split(',')[1] } },
          { type: 'text', text: (instr || 'Erstelle Lernkarten aus diesem Bild.') + jsonPrompt },
        ]
      } else {
        const text = file ? await toText(file) : ''
        content = [{ type: 'text', text: `${instr || 'Erstelle Lernkarten aus diesem Dokument.'}${text ? `\n\nDokument:\n${text.slice(0, 14000)}` : ''}${jsonPrompt}` }]
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 4096, messages: [{ role: 'user', content }] }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const match = raw.match(/\[[\s\S]*?\]/)
      if (!match) throw new Error('KI hat kein gültiges JSON zurückgegeben. Versuche eine genauere Anweisung.')
      const cards = JSON.parse(match[0])
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Keine Karten gefunden.')
      setPreview(cards)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const saveAll = async () => {
    setSaving(true)
    for (const c of preview) {
      await addDoc(collection(db, cardsPath), { front: c.front || '', image: null, back: c.back || c.front || '', backShort: c.backShort || '', backImage: null, correctCount: 0, wrongCount: 0, mastery: 0, lastReviewed: null, createdAt: serverTimestamp() })
    }
    setSaving(false)
    onSaved()
  }

  const upd = (i, field, val) => setPreview(p => p.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  return (
    <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px 60px' }}>
        <Header title="📥 Karten erstellen" onBack={onClose} />

        {!preview ? (
          <div style={{ marginTop: 28 }}>
            {/* Drop zone */}
            <Label>Datei hochladen</Label>
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? T.blue : T.border}`, borderRadius: T.r, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: 24, transition: 'all 0.15s', background: dragOver ? T.blueDim : T.surface }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
              <div style={{ color: T.textSub, fontSize: 14, marginBottom: 4 }}>
                {file ? <><strong style={{ color: T.text }}>{file.name}</strong> <span style={{ color: T.textDim }}>({(file.size / 1024).toFixed(0)} KB)</span></> : 'Datei hier ablegen oder klicken zum Auswählen'}
              </div>
              <div style={{ fontSize: 12, color: T.textDim }}>PDF, TXT, CSV, JPG, PNG</div>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
            </div>

            {/* Instruction */}
            <Label>Anweisung an die KI</Label>
            <Input value={instr} onChange={e => setInstr(e.target.value)} multiline rows={5}
              placeholder="z.B. Erstelle Lernkarten aus diesem Dokument. Vorderseite = Frage oder Begriff, Rückseite = Antwort oder Erklärung. Jeder wichtige Punkt bekommt eine eigene Karte."
              style={{ marginTop: 6, marginBottom: 22 }} />

            {error && (
              <Card style={{ padding: '12px 16px', marginBottom: 18, borderColor: 'rgba(255,69,58,0.4)', background: 'rgba(255,69,58,0.08)' }}>
                <div style={{ color: T.red, fontSize: 13 }}>{error}</div>
              </Card>
            )}

            <Btn onClick={generate} disabled={loading || (!file && !instr.trim())} full style={{ padding: '13px', fontSize: 15 }}>
              {loading ? '✦ KI analysiert…' : '✦ KI starten'}
            </Btn>
          </div>
        ) : (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, color: T.text }}>
                <strong style={{ color: T.blue }}>{preview.length} Karten</strong> generiert — prüfen und bearbeiten:
              </div>
              <Btn onClick={() => setPreview(null)} variant="secondary" style={{ padding: '7px 14px', fontSize: 13 }}>← Neu generieren</Btn>
            </div>

            {preview.map((card, i) => (
              <Card key={i} style={{ padding: 16, marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'start' }}>
                  <div>
                    <Label>Vorderseite</Label>
                    <Input value={card.front || ''} onChange={e => upd(i, 'front', e.target.value)} placeholder="Vorderseite" multiline rows={2} style={{ marginTop: 4 }} />
                  </div>
                  <div>
                    <Label>Langbezeichnung</Label>
                    <Input value={card.back || ''} onChange={e => upd(i, 'back', e.target.value)} placeholder="Rückseite" multiline rows={2} style={{ marginTop: 4, marginBottom: 8 }} />
                    <Input value={card.backShort || ''} onChange={e => upd(i, 'backShort', e.target.value)} placeholder="Kurzbezeichnung (optional)" />
                  </div>
                  <button onClick={() => setPreview(p => p.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 16, paddingTop: 24 }}>✕</button>
                </div>
              </Card>
            ))}

            <Btn onClick={saveAll} disabled={saving || preview.length === 0} full style={{ padding: '13px', fontSize: 15, marginTop: 8 }}>
              {saving ? 'Speichert…' : `${preview.length} Karten speichern`}
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LEARN MODE ───────────────────────────────────────────────────────────────
const LearnMode = ({ cards: initCards, cardsPath, onClose }) => {
  const [cards] = useState(() => [...initCards].sort(() => Math.random() - 0.5))
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([])
  const [done, setDone] = useState(false)

  const card = cards[idx]
  const progress = (idx / cards.length) * 100

  const rate = async (knew) => {
    const newCorrect = (card.correctCount || 0) + (knew ? 1 : 0)
    const newWrong = (card.wrongCount || 0) + (knew ? 0 : 1)
    const newMastery = Math.round((newCorrect / (newCorrect + newWrong)) * 100)
    try {
      await updateDoc(doc(db, `${cardsPath}/${card.id}`), { correctCount: newCorrect, wrongCount: newWrong, mastery: newMastery, lastReviewed: serverTimestamp() })
    } catch (_) {}
    setResults(r => [...r, { id: card.id, knew }])
    if (idx + 1 >= cards.length) setDone(true)
    else { setIdx(i => i + 1); setFlipped(false) }
  }

  if (done) {
    const knew = results.filter(r => r.knew).length
    const pct = Math.round(knew / cards.length * 100)
    return (
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420, width: '100%' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{pct >= 80 ? '🎯' : pct >= 50 ? '📈' : '💪'}</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Exo 2', sans-serif", color: T.text, marginBottom: 8 }}>Session abgeschlossen!</h2>
          <p style={{ color: T.textSub, marginBottom: 28 }}>{cards.length} Karten durchgearbeitet</p>
          <Card style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: T.green }}>{knew}</div>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>Gewusst</div>
              </div>
              <div style={{ width: 1, background: T.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: T.red }}>{cards.length - knew}</div>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>Nochmal</div>
              </div>
              <div style={{ width: 1, background: T.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: T.blue }}>{pct}%</div>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>Score</div>
              </div>
            </div>
          </Card>
          <Btn onClick={onClose} full style={{ padding: '13px', fontSize: 15 }}>✓ Fertig</Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <Btn onClick={onClose} variant="secondary" style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}>✕ Beenden</Btn>
        <div style={{ flex: 1, height: 8, background: T.surface2, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: T.blue, borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, flexShrink: 0 }}>{idx + 1} / {cards.length}</div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 580 }}>
          {/* Flashcard */}
          <Card onClick={() => !flipped && setFlipped(true)}
            style={{ padding: '44px 36px', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: flipped ? 'default' : 'pointer', transition: 'border-color 0.2s', borderColor: flipped ? T.blue : T.border, marginBottom: 20 }}>
            {!flipped ? (
              <>
                {card.image && <img src={card.image} alt="" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 8, marginBottom: 18, objectFit: 'contain' }} />}
                <div style={{ fontSize: 22, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{card.front || '(Bild)'}</div>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 20 }}>Antippen zum Aufdecken</div>
              </>
            ) : (
              <>
                {card.backImage && <img src={card.backImage} alt="" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, marginBottom: 16, objectFit: 'contain' }} />}
                <div style={{ fontSize: 11, color: T.textDim, letterSpacing: 1, marginBottom: 12 }}>RÜCKSEITE</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.text, lineHeight: 1.4, marginBottom: 8 }}>{card.back}</div>
                {card.backShort && <div style={{ fontSize: 17, color: T.blue, fontWeight: 600 }}>{card.backShort}</div>}
              </>
            )}
          </Card>

          {/* Rating — only after flip */}
          {flipped && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Btn onClick={() => rate(false)} variant="danger" style={{ padding: '16px', fontSize: 16, borderRadius: T.r }}>✗  Nochmal</Btn>
              <Btn onClick={() => rate(true)} variant="success" style={{ padding: '16px', fontSize: 16, borderRadius: T.r }}>✓  Gewusst</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
const toBase64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(f) })
const toText   = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(f, 'utf-8') })
const fmtDate  = ts => { if (!ts?.seconds) return ''; const d = new Date(ts.seconds * 1000); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
const loadDocs = async (path) => {
  try { const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'asc'))); return snap.docs.map(d => ({ id: d.id, ...d.data() })) }
  catch { return [] }
}
const countDocs = async (path) => {
  try { const snap = await getDocs(collection(db, path)); return snap.size }
  catch { return 0 }
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
const Empty = ({ icon, title, sub }) => (
  <Card style={{ padding: '52px 40px', textAlign: 'center', marginTop: 8 }}>
    <div style={{ fontSize: 44, marginBottom: 14 }}>{icon}</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>{title}</div>
    {sub && <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>{sub}</div>}
  </Card>
)

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = async () => {
    setLoading(true); setError('')
    try { await signInWithPopup(auth, provider) }
    catch (e) { setError('Anmeldung fehlgeschlagen — bitte erneut versuchen.'); setLoading(false) }
  }
  return (
    <div className="grid-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 52, fontFamily: "'Exo 2', sans-serif", fontWeight: 800, color: T.blue, letterSpacing: 2, lineHeight: 1 }}>Katara</div>
          <div style={{ fontSize: 13, color: T.textDim, marginTop: 6, letterSpacing: 1.5 }}>by Bridgelab</div>
          <div style={{ fontSize: 14, color: T.textSub, marginTop: 14, letterSpacing: 1 }}>WISSEN · STRUKTURIERT · GEMEISTERT</div>
        </div>

        <Card style={{ padding: 28 }}>
          {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'rgba(255,69,58,0.08)', borderRadius: 8, border: '1px solid rgba(255,69,58,0.2)' }}>{error}</div>}
          <Btn onClick={login} disabled={loading} full style={{ padding: '14px', fontSize: 15 }}>
            {loading ? 'Wird angemeldet…' : '▶  Mit Google anmelden'}
          </Btn>
        </Card>
      </div>
    </div>
  )
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
const HomeScreen = ({ user, onOpen }) => {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const uid = user.uid; const path = `users/${uid}/categories`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const enriched = await Promise.all(docs.map(async d => ({ ...d, _count: await countDocs(`${path}/${d.id}/subcategories`) })))
    setItems(enriched)
  }, [path])

  useEffect(() => { load() }, [load])

  const create = async name => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    setModal(false); load()
  }
  const remove = async id => {
    if (!confirm('Kategorie und alle Inhalte löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name, updatedAt: serverTimestamp() })
    setRenaming(null); load()
  }

  return (
    <div className="grid-bg" style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <Logo size={26} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: T.textSub }}>{user.displayName?.split(' ')[0]}</span>
          <Btn onClick={() => signOut(auth)} variant="secondary" style={{ padding: '6px 13px', fontSize: 13 }}>Abmelden</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 20px' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, fontFamily: "'Exo 2', sans-serif" }}>Meine Kategorien</h1>
            <p style={{ fontSize: 13, color: T.textSub, marginTop: 3 }}>{items.length === 0 ? 'Noch keine Kategorien erstellt' : `${items.length} Kategorie${items.length !== 1 ? 'n' : ''}`}</p>
          </div>
          <Btn onClick={() => setModal(true)} style={{ padding: '10px 20px' }}>+ Neue Hauptkategorie</Btn>
        </div>

        {items.length === 0
          ? <Empty icon="📚" title="Noch keine Kategorien" sub={'Erstelle deine erste Hauptkategorie,\nz.B. "RiL 301" oder "DB Cargo".'} />
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {items.map(item => (
                <FolderCard key={item.id} item={item}
                  onClick={() => onOpen(item)}
                  onRename={() => setRenaming(item)}
                  onDelete={() => remove(item.id)}
                />
              ))}
            </div>
          )
        }
      </div>

      {modal && <CreateModal title="Neue Hauptkategorie" placeholder="z.B. RiL 301" onSave={create} onClose={() => setModal(false)} />}
      {renaming && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
    </div>
  )
}

// ─── SUBCATEGORY SCREEN ───────────────────────────────────────────────────────
const SubcategoryScreen = ({ user, cat, onBack, onOpen }) => {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const uid = user.uid; const path = `users/${uid}/categories/${cat.id}/subcategories`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const enriched = await Promise.all(docs.map(async d => ({ ...d, _count: await countDocs(`${path}/${d.id}/subsubcategories`) })))
    setItems(enriched)
  }, [path])

  useEffect(() => { load() }, [load])

  const create = async name => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    setModal(false); load()
  }
  const remove = async id => {
    if (!confirm('Unterkategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name }); setRenaming(null); load()
  }

  return (
    <div className="grid-bg" style={{ minHeight: '100vh' }}>
      <Header crumbs={['Startseite', cat.name]} onBack={onBack}
        right={<Btn onClick={() => setModal(true)} style={{ padding: '7px 14px', fontSize: 13 }}>+ Neue Gruppe</Btn>} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        {items.length === 0
          ? <Empty icon="🗂️" title="Keine Unterkategorien" sub="Erstelle Unterkategorien um Inhalte zu strukturieren." />
          : items.map(item => (
            <FolderRow key={item.id} item={item} countLabel={`${item._count || 0} Untergruppen`}
              onClick={() => onOpen(item)}
              onRename={() => setRenaming(item)}
              onDelete={() => remove(item.id)}
            />
          ))
        }
      </div>
      {modal && <CreateModal title="Neue Unterkategorie" placeholder="z.B. Hauptsignale" onSave={create} onClose={() => setModal(false)} />}
      {renaming && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
    </div>
  )
}

// ─── SUBSUBCATEGORY SCREEN ────────────────────────────────────────────────────
const SubSubcategoryScreen = ({ user, cat, sub, onBack, onOpen }) => {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const uid = user.uid; const path = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const enriched = await Promise.all(docs.map(async d => ({ ...d, _count: await countDocs(`${path}/${d.id}/cards`) })))
    setItems(enriched)
  }, [path])

  useEffect(() => { load() }, [load])

  const create = async name => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    setModal(false); load()
  }
  const remove = async id => {
    if (!confirm('Unter-Unterkategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name }); setRenaming(null); load()
  }

  return (
    <div className="grid-bg" style={{ minHeight: '100vh' }}>
      <Header crumbs={['Startseite', cat.name, sub.name]} onBack={onBack}
        right={<Btn onClick={() => setModal(true)} style={{ padding: '7px 14px', fontSize: 13 }}>+ Neue Gruppe</Btn>} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        {items.length === 0
          ? <Empty icon="📂" title="Keine Einträge" sub="Erstelle Unter-Unterkategorien für deine Karten." />
          : items.map(item => (
            <FolderRow key={item.id} item={item} countLabel={`${item._count || 0} Karten`}
              onClick={() => onOpen(item)}
              onRename={() => setRenaming(item)}
              onDelete={() => remove(item.id)}
            />
          ))
        }
      </div>
      {modal && <CreateModal title="Neue Unter-Unterkategorie" placeholder="z.B. Hp 0 — Halt" onSave={create} onClose={() => setModal(false)} />}
      {renaming && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
    </div>
  )
}

// ─── CARDS SCREEN ─────────────────────────────────────────────────────────────
const CardsScreen = ({ user, cat, sub, subsub, onBack }) => {
  const [cards, setCards] = useState([])
  const [cardModal, setCardModal] = useState(null)   // null | 'new' | cardObj
  const [kiImport, setKiImport] = useState(false)
  const [learning, setLearning] = useState(false)
  const uid = user.uid
  const basePath = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories/${subsub.id}`
  const cardsPath = `${basePath}/cards`

  const load = useCallback(async () => setCards(await loadDocs(cardsPath)), [cardsPath])
  useEffect(() => { load() }, [load])

  const saveCard = async data => {
    if (cardModal === 'new') await addDoc(collection(db, cardsPath), { ...data, correctCount: 0, wrongCount: 0, mastery: 0, lastReviewed: null, createdAt: serverTimestamp() })
    else await updateDoc(doc(db, `${cardsPath}/${cardModal.id}`), data)
    setCardModal(null); load()
  }
  const remove = async id => {
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${cardsPath}/${id}`)); load()
  }

  const avgMastery = cards.length ? Math.round(cards.reduce((s, c) => s + (c.mastery || 0), 0) / cards.length) : 0

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <Header crumbs={['Startseite', cat.name, sub.name, subsub.name]} onBack={onBack} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        {/* Action bar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22, alignItems: 'center' }}>
          <Btn onClick={() => setCardModal('new')} style={{ padding: '9px 16px' }}>+ Karte</Btn>
          <Btn onClick={() => setKiImport(true)} variant="ghost" style={{ padding: '9px 16px' }}>📥 Karten erstellen</Btn>
          <Btn onClick={() => setLearning(true)} variant="success" disabled={cards.length === 0} style={{ marginLeft: 'auto', padding: '9px 20px' }}>▶ Lernen</Btn>
        </div>

        {/* Mastery bar */}
        {cards.length > 0 && (
          <Card style={{ padding: '10px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, height: 6, background: T.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${avgMastery}%`, background: avgMastery >= 80 ? T.green : T.blue, borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: 13, color: T.textSub, flexShrink: 0, fontWeight: 600 }}>
              {cards.length} Karten · ⌀ {avgMastery}%
            </div>
          </Card>
        )}

        {/* Cards */}
        {cards.length === 0
          ? <Empty icon="🃏" title="Noch keine Karten" sub="Erstelle Karten manuell oder importiere via KI." />
          : cards.map(c => <CardItem key={c.id} card={c} onEdit={() => setCardModal(c)} onDelete={() => remove(c.id)} />)
        }
      </div>

      {cardModal && <CardModal initial={cardModal === 'new' ? null : cardModal} onSave={saveCard} onClose={() => setCardModal(null)} />}
      {kiImport && <KIImportScreen cardsPath={cardsPath} onSaved={() => { setKiImport(false); load() }} onClose={() => setKiImport(false)} />}
      {learning && <LearnMode cards={cards} cardsPath={cardsPath} onClose={() => { setLearning(false); load() }} />}
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined)
  const [nav, setNav] = useState([{ screen: 'home' }])

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), [])

  const push = entry => setNav(n => [...n, entry])
  const pop  = () => setNav(n => n.length > 1 ? n.slice(0, -1) : n)
  const cur  = nav[nav.length - 1]

  if (user === undefined) return (
    <div className="grid-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: T.textDim, fontSize: 14 }}>Wird geladen…</div>
    </div>
  )

  return (
    <>
      {!user && <LoginScreen />}
      {user && cur.screen === 'home'    && <HomeScreen user={user} onOpen={cat => push({ screen: 'sub', cat })} />}
      {user && cur.screen === 'sub'     && <SubcategoryScreen user={user} cat={cur.cat} onBack={pop} onOpen={sub => push({ screen: 'subsub', cat: cur.cat, sub })} />}
      {user && cur.screen === 'subsub'  && <SubSubcategoryScreen user={user} cat={cur.cat} sub={cur.sub} onBack={pop} onOpen={subsub => push({ screen: 'cards', cat: cur.cat, sub: cur.sub, subsub })} />}
      {user && cur.screen === 'cards'   && <CardsScreen user={user} cat={cur.cat} sub={cur.sub} subsub={cur.subsub} onBack={pop} />}
    </>
  )
}
