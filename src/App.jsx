import { useState, useEffect, useRef, useCallback } from 'react'
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  serverTimestamp, query, orderBy, updateDoc,
} from 'firebase/firestore'
import { auth, db, provider } from './firebase'
import './App.css'

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg: '#0A0E1A',
  bgGrad: [
    'radial-gradient(ellipse at 22% 14%, rgba(74,144,217,0.10) 0%, transparent 52%)',
    'radial-gradient(ellipse at 78% 82%, rgba(46,92,138,0.08) 0%, transparent 48%)',
    'linear-gradient(180deg, #0A0E1A 0%, #0C1322 100%)',
  ].join(', '),
  glass: 'rgba(255,255,255,0.035)',
  glassBorder: 'rgba(74,144,217,0.16)',
  glassHover: 'rgba(74,144,217,0.07)',
  blue: '#4A90D9',
  blueLight: '#B8D4F0',
  blueDark: '#2E5C8A',
  blueMid: '#6EB0E8',
  blueGrad: 'linear-gradient(135deg, #4A90D9 0%, #B8D4F0 50%, #2E5C8A 100%)',
  blueTint: 'rgba(74,144,217,0.12)',
  text: '#E2E8F0',
  subtext: '#5A6E82',
  subtextLight: '#8A9EB8',
  success: '#3DAA6E',
  danger: '#E05555',
  radius: '12px',
  // Only for "by Bridgelab" hint
  bridgelabGold: 'rgba(201,168,76,0.55)',
}

// ─── WATER CANVAS (steel blue) ───────────────────────────────────────────────
const WaterCanvas = () => {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const rings = []
    const addDrop = () => {
      const ringCount = 2 + Math.floor(Math.random() * 3)
      const maxRadius = 60 + Math.random() * 160
      const speed = 0.25 + Math.random() * 0.7
      const startOpacity = 0.06 + Math.random() * 0.05
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const spacing = maxRadius / (ringCount + 1)
      for (let k = 0; k < ringCount; k++) {
        rings.push({ x, y, radius: k * spacing, maxRadius, speed,
          opacity: startOpacity * Math.max(0.5, 1 - k * 0.15),
          fadeRate: (startOpacity * 0.85) / (maxRadius / speed) })
      }
      setTimeout(addDrop, 3000 + Math.random() * 5000)
    }
    addDrop()
    let rafId
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.radius += r.speed; r.opacity -= r.fadeRate
        if (r.radius > r.maxRadius || r.opacity <= 0) { rings.splice(i, 1); continue }
        ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(74,144,217,${r.opacity})`
        ctx.lineWidth = 1.0; ctx.stroke()
      }
      rafId = requestAnimationFrame(animate)
    }
    animate()
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', mixBlendMode: 'screen' }} />
}

// ─── PRIMITIVES ──────────────────────────────────────────────────────────────
const GlassBtn = ({ children, onClick, style = {}, variant = 'default', disabled = false, small = false }) => {
  const [hover, setHover] = useState(false)
  const variants = {
    default: { bg: hover ? C.glassHover : C.glass, border: `1px solid ${hover ? 'rgba(74,144,217,0.35)' : C.glassBorder}`, color: C.text },
    blue:    { bg: hover ? 'rgba(74,144,217,0.22)' : 'rgba(74,144,217,0.10)', border: `1px solid rgba(74,144,217,${hover ? 0.55 : 0.28})`, color: C.blueLight },
    accent:  { bg: hover ? 'rgba(110,176,232,0.18)' : 'rgba(110,176,232,0.08)', border: `1px solid rgba(110,176,232,${hover ? 0.45 : 0.22})`, color: C.blueMid },
    success: { bg: hover ? 'rgba(61,170,110,0.22)' : 'rgba(61,170,110,0.09)', border: `1px solid rgba(61,170,110,${hover ? 0.5 : 0.25})`, color: '#72CFA0' },
    danger:  { bg: hover ? 'rgba(224,85,85,0.2)' : 'rgba(224,85,85,0.07)', border: '1px solid rgba(224,85,85,0.28)', color: '#E08080' },
  }
  const v = variants[variant] || variants.default
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: small ? '5px 10px' : '9px 18px', borderRadius: C.radius,
        cursor: disabled ? 'not-allowed' : 'pointer', border: v.border, background: v.bg,
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        color: v.color, fontSize: small ? 12 : 14, fontWeight: 500,
        transition: 'all 0.15s ease', opacity: disabled ? 0.4 : 1, ...style }}>
      {children}
    </button>
  )
}

const Glass = ({ children, style = {} }) => (
  <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: C.radius, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', ...style }}>
    {children}
  </div>
)

const GlassInput = ({ value, onChange, placeholder, style = {}, multiline = false, rows = 3, onKeyDown, autoFocus }) => {
  const base = { width: '100%', padding: '10px 13px', borderRadius: C.radius, background: 'rgba(74,144,217,0.05)', border: `1px solid ${C.glassBorder}`, color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: multiline ? 'vertical' : 'none', boxSizing: 'border-box', ...style }
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={base} autoFocus={autoFocus} />
    : <input value={value} onChange={onChange} placeholder={placeholder} style={base} onKeyDown={onKeyDown} autoFocus={autoFocus} />
}

const Label = ({ children }) => (
  <div style={{ fontSize: 11, color: C.subtext, letterSpacing: 0.8, marginBottom: 5, textTransform: 'uppercase' }}>{children}</div>
)

const Divider = () => <div style={{ height: 1, background: C.glassBorder, margin: '20px 0' }} />

// ─── DATE HELPER ─────────────────────────────────────────────────────────────
const fmtDate = (ts) => {
  if (!ts?.seconds) return ''
  const d = new Date(ts.seconds * 1000)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const KataraLogo = ({ size = 28 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
    <div style={{
      fontSize: size, fontFamily: "'Rajdhani', 'Segoe UI', sans-serif", fontWeight: 700,
      letterSpacing: 4, textTransform: 'uppercase',
      background: C.blueGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      textShadow: '0 0 30px rgba(74,144,217,0.4)',
      filter: 'drop-shadow(0 0 18px rgba(74,144,217,0.35))',
    }}>Katara</div>
    <div style={{ fontSize: Math.max(8, size * 0.28), color: C.bridgelabGold, letterSpacing: 3, textTransform: 'uppercase', marginTop: 3, opacity: 0.8 }}>
      by Bridgelab
    </div>
  </div>
)

// ─── BREADCRUMB ──────────────────────────────────────────────────────────────
const Breadcrumb = ({ crumbs }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', overflow: 'hidden' }}>
    {['Startseite', ...crumbs].map((c, i, arr) => (
      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {i > 0 && <span style={{ color: C.subtext, fontSize: 12 }}>›</span>}
        <span style={{ fontSize: 13, color: i === arr.length - 1 ? C.blueLight : C.subtext, fontWeight: i === arr.length - 1 ? 600 : 400, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c}
        </span>
      </span>
    ))}
  </div>
)

// ─── SCREEN HEADER ────────────────────────────────────────────────────────────
const ScreenHeader = ({ crumbs, onBack, right }) => (
  <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.glassBorder}`, background: 'rgba(10,14,26,0.7)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', position: 'sticky', top: 0, zIndex: 10 }}>
    <GlassBtn onClick={onBack} small style={{ flexShrink: 0 }}>← Zurück</GlassBtn>
    <div style={{ flex: 1, overflow: 'hidden' }}><Breadcrumb crumbs={crumbs} /></div>
    {right}
  </div>
)

// ─── CONTEXT MENU (⋮) ────────────────────────────────────────────────────────
const ContextMenu = ({ items, onClose }) => {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div ref={ref} style={{ position: 'absolute', top: 32, right: 0, zIndex: 100, background: '#0F1524', border: `1px solid ${C.glassBorder}`, borderRadius: C.radius, overflow: 'hidden', minWidth: 150, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose() }}
          style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: item.danger ? C.danger : C.text, fontSize: 14, cursor: 'pointer', textAlign: 'left', borderBottom: i < items.length - 1 ? `1px solid ${C.glassBorder}` : 'none' }}
          onMouseEnter={e => e.target.style.background = C.glassHover}
          onMouseLeave={e => e.target.style.background = 'none'}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── FOLDER TILE (home 2-col grid) ───────────────────────────────────────────
const FolderTile = ({ item, onClick, onDelete, onRename }) => {
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setMenu(false) }}
      style={{ background: hover ? C.glassHover : C.glass, border: `1px solid ${hover ? 'rgba(74,144,217,0.3)' : C.glassBorder}`, borderRadius: C.radius, padding: '20px 18px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      onClick={onClick}>
      <div style={{ fontSize: 26, marginBottom: 10 }}>📁</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, wordBreak: 'break-word', lineHeight: 1.3 }}>{item.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        {item._count != null && <div style={{ fontSize: 11, color: C.subtext }}>{item._count} Gruppen</div>}
        {item.updatedAt && <div style={{ fontSize: 11, color: C.subtext }}>{fmtDate(item.updatedAt)}</div>}
      </div>
      {/* ⋮ menu */}
      <div style={{ position: 'absolute', top: 10, right: 10 }} onClick={e => e.stopPropagation()}>
        <button onClick={e => { e.stopPropagation(); setMenu(m => !m) }}
          style={{ background: hover ? C.glass : 'none', border: 'none', color: C.subtextLight, cursor: 'pointer', fontSize: 16, padding: '2px 7px', borderRadius: 6, opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>⋮</button>
        {menu && <ContextMenu items={[{ label: '✏️  Umbenennen', action: () => onRename() }, { label: '🗑  Löschen', action: () => onDelete(), danger: true }]} onClose={() => setMenu(false)} />}
      </div>
    </div>
  )
}

// ─── FOLDER ROW (list view) ───────────────────────────────────────────────────
const FolderRow = ({ item, onClick, onDelete, onRename, countLabel }) => {
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setMenu(false) }}
      style={{ background: hover ? C.glassHover : C.glass, border: `1px solid ${hover ? 'rgba(74,144,217,0.28)' : C.glassBorder}`, borderRadius: C.radius, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
      onClick={onClick}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>🗂️</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{item.name}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
          {countLabel && <div style={{ fontSize: 12, color: C.subtext }}>{countLabel}</div>}
          {item.updatedAt && <div style={{ fontSize: 12, color: C.subtext }}>{fmtDate(item.updatedAt)}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <span style={{ fontSize: 16, color: C.subtext, opacity: hover ? 0.6 : 0.2 }}>›</span>
        <button onClick={() => setMenu(m => !m)}
          style={{ background: 'none', border: 'none', color: C.subtextLight, cursor: 'pointer', fontSize: 16, padding: '2px 7px', borderRadius: 6, opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>⋮</button>
        {menu && <ContextMenu items={[{ label: '✏️  Umbenennen', action: () => onRename() }, { label: '🗑  Löschen', action: () => onDelete(), danger: true }]} onClose={() => setMenu(false)} />}
      </div>
    </div>
  )
}

// ─── RENAME MODAL ─────────────────────────────────────────────────────────────
const RenameModal = ({ current, onSave, onClose }) => {
  const [val, setVal] = useState(current)
  return (
    <Overlay onClose={onClose}>
      <Glass style={{ padding: 28, maxWidth: 420, width: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.blueLight, marginBottom: 18 }}>Umbenennen</div>
        <GlassInput value={val} onChange={e => setVal(e.target.value)} placeholder="Neuer Name…" autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onSave(val.trim()); if (e.key === 'Escape') onClose() }} style={{ marginBottom: 18 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <GlassBtn onClick={() => { if (val.trim()) onSave(val.trim()) }} variant="blue" disabled={!val.trim()} style={{ flex: 1 }}>Speichern</GlassBtn>
          <GlassBtn onClick={onClose}>Abbrechen</GlassBtn>
        </div>
      </Glass>
    </Overlay>
  )
}

// ─── CREATE MODAL ─────────────────────────────────────────────────────────────
const CreateModal = ({ title, placeholder, onSave, onClose }) => {
  const [name, setName] = useState('')
  return (
    <Overlay onClose={onClose}>
      <Glass style={{ padding: 28, maxWidth: 440, width: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.blueLight, marginBottom: 18 }}>+ {title}</div>
        <GlassInput value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); if (e.key === 'Escape') onClose() }} style={{ marginBottom: 18 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <GlassBtn onClick={() => { if (name.trim()) onSave(name.trim()) }} variant="blue" disabled={!name.trim()} style={{ flex: 1, padding: '11px 20px' }}>Erstellen</GlassBtn>
          <GlassBtn onClick={onClose}>Abbrechen</GlassBtn>
        </div>
      </Glass>
    </Overlay>
  )
}

// ─── OVERLAY WRAPPER ─────────────────────────────────────────────────────────
const Overlay = ({ children, onClose, maxWidth }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div style={{ width: '100%', maxWidth: maxWidth || 720 }}>{children}</div>
  </div>
)

// ─── CARD MODAL (create / edit) ───────────────────────────────────────────────
const CardModal = ({ initial, onSave, onClose }) => {
  const [front, setFront] = useState(initial?.front || '')
  const [image, setImage] = useState(initial?.image || null)
  const [back, setBack] = useState(initial?.back || '')
  const [backShort, setBackShort] = useState(initial?.backShort || '')
  const [backImage, setBackImage] = useState(initial?.backImage || null)
  const [saving, setSaving] = useState(false)

  const pickImg = setter => e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader(); reader.onload = ev => setter(ev.target.result); reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!back.trim() && !front.trim() && !image) return
    setSaving(true)
    await onSave({ front: front.trim(), image: image || null, back: back.trim(), backShort: backShort.trim(), backImage: backImage || null })
    setSaving(false)
  }

  const ImgField = ({ label, value, setter }) => (
    <div>
      <Label>{label}</Label>
      <input type="file" accept="image/*" onChange={pickImg(setter)} style={{ fontSize: 12, color: C.subtext, display: 'block', marginTop: 4 }} />
      {value && <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
        <img src={value} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 8, border: `1px solid ${C.glassBorder}`, display: 'block' }} />
        <button onClick={() => setter(null)} style={{ position: 'absolute', top: -6, right: -6, background: C.danger, border: 'none', borderRadius: '50%', width: 17, height: 17, color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>}
    </div>
  )

  return (
    <Overlay onClose={onClose}>
      <Glass style={{ padding: 26, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.blueLight }}>{initial ? 'Karte bearbeiten' : 'Neue Karte'}</div>
          <GlassBtn onClick={onClose} small>✕</GlassBtn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ background: 'rgba(74,144,217,0.04)', borderRadius: C.radius, padding: 16, border: `1px solid ${C.glassBorder}` }}>
            <div style={{ fontSize: 11, color: C.blueMid, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>Vorderseite</div>
            <Label>Text</Label>
            <GlassInput value={front} onChange={e => setFront(e.target.value)} placeholder="Begriff, Signal, Situation…" multiline rows={3} style={{ marginBottom: 14 }} />
            <ImgField label="Bild (optional)" value={image} setter={setImage} />
          </div>
          <div style={{ background: 'rgba(74,144,217,0.04)', borderRadius: C.radius, padding: 16, border: `1px solid ${C.glassBorder}` }}>
            <div style={{ fontSize: 11, color: C.blueMid, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>Rückseite</div>
            <Label>Langbezeichnung *</Label>
            <GlassInput value={back} onChange={e => setBack(e.target.value)} placeholder="z.B. Hauptsignal Hp 0 — Halt" multiline rows={3} style={{ marginBottom: 10 }} />
            <Label>Kurzbezeichnung</Label>
            <GlassInput value={backShort} onChange={e => setBackShort(e.target.value)} placeholder="z.B. Hp 0" style={{ marginBottom: 14 }} />
            <ImgField label="Bild (optional)" value={backImage} setter={setBackImage} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <GlassBtn onClick={save} variant="blue" disabled={saving || (!back.trim() && !front.trim() && !image)} style={{ flex: 1, padding: '12px 20px' }}>
            {saving ? 'Speichert…' : initial ? 'Änderungen speichern' : 'Karte speichern'}
          </GlassBtn>
          <GlassBtn onClick={onClose}>Abbrechen</GlassBtn>
        </div>
      </Glass>
    </Overlay>
  )
}

// ─── KI IMPORT SCREEN (full overlay) ─────────────────────────────────────────
const KIImportScreen = ({ cardsPath, onSaved, onClose }) => {
  const [file, setFile] = useState(null)
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const analyze = async () => {
    if (!file && !instruction.trim()) return
    setLoading(true); setError(''); setPreview(null)
    try {
      const ext = (file?.name || '').split('.').pop().toLowerCase()
      let content
      const jsonNote = '\n\nAntworte NUR mit einem JSON-Array ohne Markdown:\n[{"front": "...", "back": "...", "backShort": "..."}]'
      if (file && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        const b64 = await fileToBase64(file)
        content = [{ type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64.split(',')[1] } }, { type: 'text', text: (instruction || 'Erstelle Lernkarten.') + jsonNote }]
      } else {
        const text = file ? await fileToText(file) : ''
        content = [{ type: 'text', text: `${instruction || 'Erstelle Lernkarten aus diesem Dokument.'}${text ? `\n\nDokument:\n${text.slice(0, 14000)}` : ''}${jsonNote}` }]
      }
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 4096, messages: [{ role: 'user', content }] }) })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('KI hat kein gültiges JSON zurückgegeben.')
      const cards = JSON.parse(match[0])
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Keine Karten gefunden.')
      setPreview(cards)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const saveAll = async () => {
    setSaving(true)
    for (const card of preview) {
      await addDoc(collection(db, cardsPath), { front: card.front || '', image: null, back: card.back || card.front || '', backShort: card.backShort || '', backImage: null, correctCount: 0, wrongCount: 0, mastery: 0, lastReviewed: null, createdAt: serverTimestamp() })
    }
    setSaving(false); onSaved()
  }

  const update = (i, field, val) => setPreview(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bgGrad, zIndex: 900, overflowY: 'auto' }}>
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <GlassBtn onClick={onClose} small>← Zurück</GlassBtn>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.blueLight, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>📥 Karten erstellen</div>
        </div>

        {!preview ? (
          <Glass style={{ padding: 30 }}>
            {/* File upload zone */}
            <Label>Datei hochladen</Label>
            <div style={{ border: `2px dashed ${C.glassBorder}`, borderRadius: C.radius, padding: '28px 20px', textAlign: 'center', marginBottom: 22, cursor: 'pointer', transition: 'border-color 0.15s', background: 'rgba(74,144,217,0.03)' }}
              onClick={() => document.getElementById('ki-file').click()}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ color: C.subtextLight, fontSize: 14 }}>{file ? file.name : 'PDF, TXT, CSV, JPG oder PNG klicken oder ablegen'}</div>
              {file && <div style={{ fontSize: 12, color: C.subtext, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</div>}
              <input id="ki-file" type="file" accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
            </div>

            {/* Instructions */}
            <Label>Wie sollen die Karten erstellt werden?</Label>
            <GlassInput value={instruction} onChange={e => setInstruction(e.target.value)} multiline rows={5}
              placeholder="z.B. Vorderseite = Signalbild oder Begriff, Rückseite = Langbezeichnung + Kurzbezeichnung. Erstelle für jeden Begriff eine eigene Karte. Wenn du mehrere Begriffe auf einer Seite siehst, erstelle eine Karte pro Begriff."
              style={{ marginTop: 6, marginBottom: 22 }} />

            {error && <div style={{ color: '#e08080', fontSize: 13, marginBottom: 16, padding: '11px 14px', background: 'rgba(224,85,85,0.1)', borderRadius: C.radius }}>{error}</div>}

            <GlassBtn onClick={analyze} variant="blue" disabled={loading || (!file && !instruction.trim())} style={{ width: '100%', padding: '14px 20px', fontSize: 16, borderRadius: C.radius }}>
              {loading ? '✦ KI analysiert…' : '✦ KI starten'}
            </GlassBtn>
          </Glass>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, color: C.text }}><span style={{ color: C.blueLight, fontWeight: 700 }}>{preview.length} Karten</span> generiert — prüfen und bearbeiten:</div>
              <GlassBtn onClick={() => setPreview(null)} small>← Neu generieren</GlassBtn>
            </div>
            {preview.map((card, i) => (
              <Glass key={i} style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'start' }}>
                  <div>
                    <Label>Vorderseite</Label>
                    <GlassInput value={card.front || ''} onChange={e => update(i, 'front', e.target.value)} placeholder="Vorderseite" multiline rows={2} style={{ marginTop: 4 }} />
                  </div>
                  <div>
                    <Label>Langbezeichnung</Label>
                    <GlassInput value={card.back || ''} onChange={e => update(i, 'back', e.target.value)} placeholder="Langbezeichnung" multiline rows={2} style={{ marginTop: 4, marginBottom: 6 }} />
                    <GlassInput value={card.backShort || ''} onChange={e => update(i, 'backShort', e.target.value)} placeholder="Kurzbezeichnung (optional)" />
                  </div>
                  <button onClick={() => setPreview(p => p.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 15, paddingTop: 22 }}>✕</button>
                </div>
              </Glass>
            ))}
            <GlassBtn onClick={saveAll} variant="blue" disabled={saving || preview.length === 0} style={{ width: '100%', padding: '14px 20px', fontSize: 16, marginTop: 8 }}>
              {saving ? 'Speichert…' : `${preview.length} Karten speichern`}
            </GlassBtn>
          </>
        )}
      </div>
      <WaterCanvas />
    </div>
  )
}

// ─── KI LERNPLAN MODAL ───────────────────────────────────────────────────────
const KILernplanModal = ({ cards, onStartLearn, onClose }) => {
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(null)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')

  const generate = async () => {
    if (!desc.trim() || cards.length === 0) return
    setLoading(true); setError(''); setPlan(null)
    try {
      const cardSummary = cards.slice(0, 80).map((c, i) => `[${i}] Vorderseite: "${c.front || '(Bild)'}" | Rückseite: "${c.back}" | Mastery: ${c.mastery || 0}%`).join('\n')
      const prompt = `Du bist ein Lerncoach. Hier sind ${cards.length} verfügbare Lernkarten:\n\n${cardSummary}\n\nDer Nutzer beschreibt seine Lernsession:\n"${desc}"\n\nWähle die optimalen Karten für diese Session aus. Priorisiere Karten mit niedriger Mastery (< 50%) und solche, die zum Fokus des Nutzers passen.\n\nAntworte NUR mit diesem JSON:\n{"selectedIndices": [0, 2, 5, ...], "reasoning": "Kurze Begründung (2-3 Sätze)", "count": N}`
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }) })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Kein gültiges JSON.')
      const result = JSON.parse(match[0])
      const sel = (result.selectedIndices || []).filter(i => i >= 0 && i < cards.length).map(i => cards[i])
      setPlan({ reasoning: result.reasoning, count: sel.length })
      setSelected(sel)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const toggle = (card) => setSelected(s => s.find(c => c.id === card.id) ? s.filter(c => c.id !== card.id) : [...s, card])

  return (
    <Overlay onClose={onClose} maxWidth={640}>
      <Glass style={{ padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.blueLight }}>🤖 KI-Lernplan</div>
          <GlassBtn onClick={onClose} small>✕</GlassBtn>
        </div>

        <div style={{ fontSize: 13, color: C.subtext, marginBottom: 16, lineHeight: 1.6 }}>
          Verfügbar: <strong style={{ color: C.text }}>{cards.length} Karten</strong>. Beschreibe deine Session — die KI wählt den optimalen Lernset aus.
        </div>

        {!plan ? (
          <>
            <Label>Deine Session beschreiben</Label>
            <GlassInput value={desc} onChange={e => setDesc(e.target.value)} multiline rows={4}
              placeholder="z.B. Ich habe 30 Minuten. Fokus auf schwache Karten. Hauptsignale und Vorsignale auffrischen."
              style={{ marginTop: 6, marginBottom: 18 }} />
            {error && <div style={{ color: '#e08080', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'rgba(224,85,85,0.1)', borderRadius: C.radius }}>{error}</div>}
            <GlassBtn onClick={generate} variant="blue" disabled={loading || !desc.trim() || cards.length === 0} style={{ width: '100%', padding: '13px', fontSize: 15 }}>
              {loading ? '🤖 KI analysiert…' : '🤖 Lernplan erstellen'}
            </GlassBtn>
          </>
        ) : (
          <>
            {/* Reasoning */}
            <div style={{ background: 'rgba(74,144,217,0.07)', border: `1px solid ${C.glassBorder}`, borderRadius: C.radius, padding: '14px 16px', marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: C.blueMid, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>KI-BEGRÜNDUNG</div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{plan.reasoning}</div>
            </div>
            <div style={{ fontSize: 13, color: C.subtext, marginBottom: 12 }}>
              <strong style={{ color: C.text }}>{selected.length} Karten</strong> ausgewählt — einzelne abwählen möglich:
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 18 }}>
              {selected.map(card => (
                <div key={card.id} onClick={() => toggle(card)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: C.radius, marginBottom: 6, cursor: 'pointer', background: 'rgba(74,144,217,0.06)', border: `1px solid ${C.glassBorder}`, transition: 'all 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${C.blue}`, background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 11 }}>✓</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: C.text }}>{card.front || '(Bild)'}</div>
                    <div style={{ fontSize: 12, color: C.subtext }}>{card.back} {card.backShort && `· ${card.backShort}`} · Mastery {card.mastery || 0}%</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <GlassBtn onClick={() => onStartLearn(selected)} variant="success" disabled={selected.length === 0} style={{ flex: 1, padding: '13px', fontSize: 15 }}>
                ▶ Lernen starten ({selected.length})
              </GlassBtn>
              <GlassBtn onClick={() => { setPlan(null); setSelected([]) }}>Neu</GlassBtn>
            </div>
          </>
        )}
      </Glass>
    </Overlay>
  )
}

// ─── LEARN MODE ───────────────────────────────────────────────────────────────
const LearnMode = ({ cards, cardsPath, onClose }) => {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([]) // {id, correct}
  const [done, setDone] = useState(false)

  const card = cards[idx]
  const progress = idx / cards.length

  const rate = async (correct) => {
    const newMastery = Math.min(100, Math.max(0,
      ((card.correctCount || 0) + (correct ? 1 : 0)) /
      ((card.correctCount || 0) + (card.wrongCount || 0) + 1) * 100
    ))
    // Update Firestore
    try {
      await updateDoc(doc(db, `${cardsPath}/${card.id}`), {
        correctCount: (card.correctCount || 0) + (correct ? 1 : 0),
        wrongCount: (card.wrongCount || 0) + (correct ? 0 : 1),
        mastery: Math.round(newMastery),
        lastReviewed: serverTimestamp(),
      })
    } catch (_) {}
    setResults(r => [...r, { id: card.id, correct }])
    if (idx + 1 >= cards.length) { setDone(true) }
    else { setIdx(i => i + 1); setFlipped(false) }
  }

  const correctCount = results.filter(r => r.correct).length

  if (done) {
    const pct = Math.round(correctCount / cards.length * 100)
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bgGrad, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24 }}>
        <WaterCanvas />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>{pct >= 80 ? '🎯' : pct >= 50 ? '📈' : '💪'}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1, marginBottom: 8 }}>Session abgeschlossen</div>
          <div style={{ fontSize: 16, color: C.subtextLight, marginBottom: 24 }}>
            <span style={{ color: C.success, fontWeight: 700 }}>{correctCount}</span> richtig · <span style={{ color: C.danger, fontWeight: 700 }}>{cards.length - correctCount}</span> falsch · {pct}%
          </div>
          <Glass style={{ padding: '16px 24px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.success }}>{correctCount}</div>
                <div style={{ fontSize: 11, color: C.subtext, marginTop: 2 }}>Richtig</div>
              </div>
              <div style={{ width: 1, height: 40, background: C.glassBorder }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.danger }}>{cards.length - correctCount}</div>
                <div style={{ fontSize: 11, color: C.subtext, marginTop: 2 }}>Falsch</div>
              </div>
              <div style={{ width: 1, height: 40, background: C.glassBorder }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.blueLight }}>{pct}%</div>
                <div style={{ fontSize: 11, color: C.subtext, marginTop: 2 }}>Score</div>
              </div>
            </div>
          </Glass>
          <GlassBtn onClick={onClose} variant="blue" style={{ width: '100%', padding: '13px 20px', fontSize: 15 }}>✓ Fertig</GlassBtn>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bgGrad, zIndex: 900, display: 'flex', flexDirection: 'column' }}>
      <WaterCanvas />
      {/* Header */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${C.glassBorder}`, position: 'relative', zIndex: 1 }}>
        <GlassBtn onClick={onClose} small>✕ Beenden</GlassBtn>
        <div style={{ flex: 1, height: 6, background: C.glass, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: C.blueGrad, borderRadius: 3, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: 13, color: C.subtext, flexShrink: 0 }}>{idx + 1} / {cards.length}</div>
      </div>

      {/* Card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <Glass style={{ padding: '40px 36px', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: `1px solid ${flipped ? 'rgba(74,144,217,0.35)' : C.glassBorder}` }}
            onClick={() => !flipped && setFlipped(true)}>
            {!flipped ? (
              <>
                {card.image && <img src={card.image} alt="" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 8, marginBottom: 16, objectFit: 'contain' }} />}
                <div style={{ fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{card.front || '(Bild)'}</div>
                <div style={{ fontSize: 12, color: C.subtext, marginTop: 16 }}>Antippen zum Aufdecken</div>
              </>
            ) : (
              <>
                {card.backImage && <img src={card.backImage} alt="" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, marginBottom: 14, objectFit: 'contain' }} />}
                <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 8 }}>{card.back}</div>
                {card.backShort && <div style={{ fontSize: 16, color: C.blueLight, fontWeight: 600 }}>{card.backShort}</div>}
              </>
            )}
          </Glass>

          {/* Rating buttons — only show after flip */}
          {flipped && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <GlassBtn onClick={() => rate(false)} variant="danger" style={{ padding: '16px', fontSize: 16 }}>✗  Falsch</GlassBtn>
              <GlassBtn onClick={() => rate(true)} variant="success" style={{ padding: '16px', fontSize: 16 }}>✓  Richtig</GlassBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CARD ROW ────────────────────────────────────────────────────────────────
const CardRow = ({ card, onDelete, onEdit }) => {
  const [hover, setHover] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const mastery = card.mastery || 0
  const masteryColor = mastery >= 80 ? C.success : mastery >= 40 ? C.blueMid : C.subtext

  return (
    <div onClick={() => setFlipped(f => !f)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? C.glassHover : C.glass, border: `1px solid ${hover ? 'rgba(74,144,217,0.22)' : C.glassBorder}`, borderRadius: C.radius, padding: '13px 16px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      {/* Mastery bar — left edge */}
      <div style={{ width: 3, alignSelf: 'stretch', background: `${masteryColor}66`, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        {!flipped ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {card.image && <img src={card.image} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 7, flexShrink: 0, border: `1px solid ${C.glassBorder}` }} />}
            <div>
              <div style={{ fontSize: 11, color: C.subtext, marginBottom: 3, letterSpacing: 0.5 }}>Vorderseite</div>
              <div style={{ fontSize: 15, color: C.text }}>{card.front || '(nur Bild)'}</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: C.subtext, marginBottom: 3, letterSpacing: 0.5 }}>Rückseite</div>
            {card.backImage && <img src={card.backImage} alt="" style={{ maxHeight: 60, borderRadius: 7, marginBottom: 6, border: `1px solid ${C.glassBorder}` }} />}
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{card.back}</div>
            {card.backShort && <div style={{ fontSize: 13, color: C.blueLight, marginTop: 3 }}>{card.backShort}</div>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: masteryColor }}>{mastery > 0 ? `${mastery}%` : ''}</div>
        <div style={{ fontSize: 11, color: C.subtext, opacity: hover ? 0.7 : 0.3 }}>{flipped ? '↩' : '↩'}</div>
        <button onClick={e => { e.stopPropagation(); onEdit() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.subtext, fontSize: 12, padding: '2px 4px', opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>✏️</button>
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 12, padding: '2px 4px', opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>✕</button>
      </div>
    </div>
  )
}

// ─── FILE UTILS ───────────────────────────────────────────────────────────────
const fileToBase64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(f) })
const fileToText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(f, 'utf-8') })

// ─── FIRESTORE HELPERS ────────────────────────────────────────────────────────
const loadDocs = async (path, ord = 'createdAt') => {
  try {
    const snap = await getDocs(query(collection(db, path), orderBy(ord, 'asc')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}

const loadCount = async (path) => {
  try { const snap = await getDocs(collection(db, path)); return snap.size } catch { return 0 }
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = async () => {
    setLoading(true); setError('')
    try { await signInWithPopup(auth, provider) }
    catch { setError('Anmeldung fehlgeschlagen.'); setLoading(false) }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Glass style={{ padding: '56px 48px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <KataraLogo size={50} />
        <div style={{ marginTop: 22, fontSize: 14, color: C.subtextLight, letterSpacing: 2, textTransform: 'uppercase' }}>Wissen. Strukturiert. Gemeistert.</div>
        <Divider />
        {error && <div style={{ color: '#e08080', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        <GlassBtn onClick={login} disabled={loading} variant="blue" style={{ width: '100%', padding: '14px 20px', fontSize: 15 }}>
          {loading ? 'Wird angemeldet…' : '▶  Mit Google anmelden'}
        </GlassBtn>
      </Glass>
    </div>
  )
}

// ─── HOME — HAUPTKATEGORIEN (2-column grid) ───────────────────────────────────
const HomeScreen = ({ user, onOpen }) => {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const uid = user.uid
  const path = `users/${uid}/categories`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const withCounts = await Promise.all(docs.map(async d => ({ ...d, _count: await loadCount(`${path}/${d.id}/subcategories`) })))
    setItems(withCounts)
  }, [path])

  useEffect(() => { load() }, [load])

  const create = async (name) => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    setModal(false); load()
  }
  const remove = async (id) => {
    if (!confirm('Kategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name, updatedAt: serverTimestamp() })
    setRenaming(null); load()
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.glassBorder}`, background: 'rgba(10,14,26,0.7)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <KataraLogo size={24} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: C.subtext }}>{user.displayName?.split(' ')[0]}</div>
          <GlassBtn onClick={() => signOut(auth)} small>Abmelden</GlassBtn>
        </div>
      </div>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1 }}>Kategorien</div>
            <div style={{ fontSize: 13, color: C.subtext, marginTop: 3 }}>{items.length === 0 ? 'Noch keine Kategorien' : `${items.length} Kategorie${items.length !== 1 ? 'n' : ''}`}</div>
          </div>
          <GlassBtn onClick={() => setModal(true)} variant="blue">+ Neue Gruppe</GlassBtn>
        </div>
        {items.length === 0 ? (
          <Glass style={{ padding: '56px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📚</div>
            <div style={{ color: C.text, fontSize: 16, fontWeight: 600, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 0.5 }}>Noch keine Kategorien</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 8, lineHeight: 1.7 }}>Erstelle deine erste Hauptkategorie,<br />z.B. "RiL 301".</div>
          </Glass>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {items.map(item => (
              <FolderTile key={item.id} item={item}
                onClick={() => onOpen(item)}
                onDelete={() => remove(item.id)}
                onRename={() => setRenaming(item)}
              />
            ))}
          </div>
        )}
      </div>
      {modal && <CreateModal title="Neue Hauptkategorie" placeholder="z.B. RiL 301" onSave={create} onClose={() => setModal(false)} />}
      {renaming && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
    </div>
  )
}

// ─── LEVEL 2 — UNTERKATEGORIEN ────────────────────────────────────────────────
const SubcategoryScreen = ({ user, cat, onBack, onOpen }) => {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const uid = user.uid
  const path = `users/${uid}/categories/${cat.id}/subcategories`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const withCounts = await Promise.all(docs.map(async d => ({ ...d, _count: await loadCount(`${path}/${d.id}/subsubcategories`) })))
    setItems(withCounts)
  }, [path])

  useEffect(() => { load() }, [load])

  const create = async (name) => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    setModal(false); load()
  }
  const remove = async (id) => {
    if (!confirm('Unterkategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => { await updateDoc(doc(db, `${path}/${id}`), { name }); setRenaming(null); load() }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader crumbs={[cat.name]} onBack={onBack} right={<GlassBtn onClick={() => setModal(true)} variant="blue" small>+ Neue Gruppe</GlassBtn>} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        {items.length === 0 && (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗂️</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>Keine Unterkategorien</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6 }}>Erstelle Unterkategorien um Inhalte zu strukturieren.</div>
          </Glass>
        )}
        {items.map(item => (
          <FolderRow key={item.id} item={item}
            countLabel={`${item._count || 0} Untergruppen`}
            onClick={() => onOpen(item)}
            onDelete={() => remove(item.id)}
            onRename={() => setRenaming(item)}
          />
        ))}
      </div>
      {modal && <CreateModal title="Neue Unterkategorie" placeholder="z.B. Hauptsignale" onSave={create} onClose={() => setModal(false)} />}
      {renaming && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
    </div>
  )
}

// ─── LEVEL 3 — UNTER-UNTERKATEGORIEN ─────────────────────────────────────────
const SubSubcategoryScreen = ({ user, cat, sub, onBack, onOpen }) => {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const uid = user.uid
  const path = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const withCounts = await Promise.all(docs.map(async d => ({ ...d, _count: await loadCount(`${path}/${d.id}/cards`) })))
    setItems(withCounts)
  }, [path])

  useEffect(() => { load() }, [load])

  const create = async (name) => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    setModal(false); load()
  }
  const remove = async (id) => {
    if (!confirm('Unter-Unterkategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => { await updateDoc(doc(db, `${path}/${id}`), { name }); setRenaming(null); load() }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader crumbs={[cat.name, sub.name]} onBack={onBack} right={<GlassBtn onClick={() => setModal(true)} variant="blue" small>+ Neue Gruppe</GlassBtn>} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        {items.length === 0 && (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>Keine Einträge</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6 }}>Erstelle Unter-Unterkategorien für deine Karten.</div>
          </Glass>
        )}
        {items.map(item => (
          <FolderRow key={item.id} item={item}
            countLabel={`${item._count || 0} Karten`}
            onClick={() => onOpen(item)}
            onDelete={() => remove(item.id)}
            onRename={() => setRenaming(item)}
          />
        ))}
      </div>
      {modal && <CreateModal title="Neue Unter-Unterkategorie" placeholder="z.B. Hp 0" onSave={create} onClose={() => setModal(false)} />}
      {renaming && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
    </div>
  )
}

// ─── LEVEL 4 — KARTEN ─────────────────────────────────────────────────────────
const CardsScreen = ({ user, cat, sub, subsub, onBack }) => {
  const [cards, setCards] = useState([])
  const [cardModal, setCardModal] = useState(null)
  const [kiImport, setKiImport] = useState(false)
  const [lernplan, setLernplan] = useState(false)
  const [learning, setLearning] = useState(false)
  const uid = user.uid
  const basePath = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories/${subsub.id}`
  const cardsPath = `${basePath}/cards`

  const load = useCallback(async () => setCards(await loadDocs(cardsPath)), [cardsPath])
  useEffect(() => { load() }, [load])

  const saveCard = async (data) => {
    if (cardModal === 'new') await addDoc(collection(db, cardsPath), { ...data, correctCount: 0, wrongCount: 0, mastery: 0, lastReviewed: null, createdAt: serverTimestamp() })
    else await updateDoc(doc(db, `${cardsPath}/${cardModal.id}`), data)
    setCardModal(null); load()
  }
  const remove = async (id) => {
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${cardsPath}/${id}`)); load()
  }

  const avgMastery = cards.length ? Math.round(cards.reduce((s, c) => s + (c.mastery || 0), 0) / cards.length) : 0

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader crumbs={[cat.name, sub.name, subsub.name]} onBack={onBack} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        {/* Action bar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <GlassBtn onClick={() => setCardModal('new')} variant="blue">+ Karte</GlassBtn>
          <GlassBtn onClick={() => setKiImport(true)} variant="accent">📥 Karten erstellen</GlassBtn>
          <GlassBtn onClick={() => setLernplan(true)} variant="accent" disabled={cards.length === 0}>🤖 KI-Lernplan</GlassBtn>
          <GlassBtn onClick={() => setLearning(true)} variant="success" disabled={cards.length === 0} style={{ marginLeft: 'auto' }}>▶ Lernen</GlassBtn>
        </div>

        {/* Mastery overview */}
        {cards.length > 0 && (
          <Glass style={{ padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, height: 6, background: C.glass, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${avgMastery}%`, background: avgMastery >= 80 ? `linear-gradient(90deg, ${C.success}, #72CFA0)` : C.blueGrad, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 13, color: C.subtextLight, flexShrink: 0 }}>{cards.length} Karten · ⌀ {avgMastery}% Mastery</div>
          </Glass>
        )}

        {/* Cards list */}
        {cards.length === 0 ? (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>🃏</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>Noch keine Karten</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6 }}>Erstelle Karten manuell oder importiere via KI.</div>
          </Glass>
        ) : (
          cards.map(c => (
            <CardRow key={c.id} card={c} onDelete={() => remove(c.id)} onEdit={() => setCardModal(c)} />
          ))
        )}
      </div>

      {cardModal && <CardModal initial={cardModal === 'new' ? null : cardModal} onSave={saveCard} onClose={() => setCardModal(null)} />}
      {lernplan && <KILernplanModal cards={cards} onStartLearn={sel => { setLernplan(false); setCards(sel); setLearning(true) }} onClose={() => setLernplan(false)} />}
      {learning && <LearnMode cards={cards} cardsPath={cardsPath} onClose={() => { setLearning(false); load() }} />}
      {kiImport && <KIImportScreen cardsPath={cardsPath} onSaved={() => { setKiImport(false); load() }} onClose={() => setKiImport(false)} />}
    </div>
  )
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined)
  const [nav, setNav] = useState([{ screen: 'home' }])

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), [])

  const push = entry => setNav(n => [...n, entry])
  const pop = () => setNav(n => n.length > 1 ? n.slice(0, -1) : n)
  const current = nav[nav.length - 1]

  if (user === undefined) return (
    <div style={{ minHeight: '100vh', background: C.bgGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: C.subtext, fontSize: 14 }}>Wird geladen…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bgGrad, position: 'relative' }}>
      <WaterCanvas />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {!user && <LoginScreen />}
        {user && current.screen === 'home' && <HomeScreen user={user} onOpen={cat => push({ screen: 'sub', cat })} />}
        {user && current.screen === 'sub' && <SubcategoryScreen user={user} cat={current.cat} onBack={pop} onOpen={sub => push({ screen: 'subsub', cat: current.cat, sub })} />}
        {user && current.screen === 'subsub' && <SubSubcategoryScreen user={user} cat={current.cat} sub={current.sub} onBack={pop} onOpen={subsub => push({ screen: 'cards', cat: current.cat, sub: current.sub, subsub })} />}
        {user && current.screen === 'cards' && <CardsScreen user={user} cat={current.cat} sub={current.sub} subsub={current.subsub} onBack={pop} />}
      </div>
    </div>
  )
}
