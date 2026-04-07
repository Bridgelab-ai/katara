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
  bgGrad: 'linear-gradient(135deg, #06091a 0%, #0a1628 55%, #0d1f3c 100%)',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.09)',
  goldGrad: 'linear-gradient(135deg, #b8922a 0%, #e8c46a 50%, #b8922a 100%)',
  goldLight: '#e8c46a',
  gold: '#c9a84c',
  text: '#e8e8f0',
  subtext: '#7a8fa8',
  danger: '#e05555',
  accent: '#4a8fd4',
}

// ─── WATER CANVAS ────────────────────────────────────────────────────────────
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
      const maxRadius = 60 + Math.random() * 180
      const speed = 0.3 + Math.random() * 0.9
      const startOpacity = 0.07 + Math.random() * 0.06
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const spacing = maxRadius / (ringCount + 1)
      for (let k = 0; k < ringCount; k++) {
        rings.push({ x, y, radius: k * spacing, maxRadius, speed,
          opacity: startOpacity * Math.max(0.5, 1 - k * 0.15),
          fadeRate: (startOpacity * 0.85) / (maxRadius / speed) })
      }
      setTimeout(addDrop, 2500 + Math.random() * 4000)
    }
    addDrop()
    let rafId
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.radius += r.speed; r.opacity -= r.fadeRate
        if (r.radius > r.maxRadius || r.opacity <= 0) { rings.splice(i, 1); continue }
        ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(140,180,255,${r.opacity})`; ctx.lineWidth = 1.0; ctx.stroke()
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
  let bg = hover ? 'rgba(255,255,255,0.08)' : C.glass
  let border = `1px solid ${hover ? 'rgba(201,168,76,0.35)' : C.glassBorder}`
  let color = C.text
  if (variant === 'gold') {
    bg = hover ? 'rgba(201,168,76,0.22)' : 'rgba(201,168,76,0.12)'
    border = `1px solid ${hover ? 'rgba(201,168,76,0.55)' : 'rgba(201,168,76,0.3)'}`
    color = C.goldLight
  }
  if (variant === 'danger') {
    bg = hover ? 'rgba(224,85,85,0.2)' : 'rgba(224,85,85,0.07)'
    border = '1px solid rgba(224,85,85,0.3)'; color = '#e08080'
  }
  if (variant === 'accent') {
    bg = hover ? 'rgba(74,143,212,0.2)' : 'rgba(74,143,212,0.08)'
    border = `1px solid rgba(74,143,212,${hover ? 0.5 : 0.3})`; color = '#7ab8e8'
  }
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: small ? '5px 11px' : '9px 18px', borderRadius: small ? 8 : 11,
        cursor: disabled ? 'not-allowed' : 'pointer', border, background: bg,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        color, fontSize: small ? 12 : 14, fontWeight: 500,
        transition: 'all 0.18s ease', opacity: disabled ? 0.4 : 1, ...style,
      }}>
      {children}
    </button>
  )
}

const Glass = ({ children, style = {} }) => (
  <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 16, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', ...style }}>
    {children}
  </div>
)

const GlassInput = ({ value, onChange, placeholder, style = {}, multiline = false, rows = 3, onKeyDown }) => {
  const base = {
    width: '100%', padding: '10px 13px', borderRadius: 10,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)',
    color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
    resize: multiline ? 'vertical' : 'none', boxSizing: 'border-box', ...style,
  }
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={base} />
    : <input value={value} onChange={onChange} placeholder={placeholder} style={base} onKeyDown={onKeyDown} />
}

const Label = ({ children }) => (
  <div style={{ fontSize: 11, color: C.subtext, letterSpacing: 0.5, marginBottom: 4 }}>{children}</div>
)

// ─── LOGO ────────────────────────────────────────────────────────────────────
const KataraLogo = ({ size = 28 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
    <div style={{
      fontSize: size, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, letterSpacing: 3,
      background: C.goldGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      filter: 'drop-shadow(0 0 14px rgba(201,168,76,0.5))',
    }}>Katara</div>
    <div style={{ fontSize: Math.max(9, size * 0.3), color: C.subtext, letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>by Bridgelab</div>
  </div>
)

// ─── BREADCRUMB ──────────────────────────────────────────────────────────────
const Breadcrumb = ({ crumbs }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
    {crumbs.map((c, i) => (
      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {i > 0 && <span style={{ color: C.subtext, fontSize: 13 }}>›</span>}
        <span style={{ fontSize: 13, color: i === crumbs.length - 1 ? C.goldLight : C.subtext, fontWeight: i === crumbs.length - 1 ? 600 : 400 }}>
          {c}
        </span>
      </span>
    ))}
  </div>
)

// ─── SCREEN HEADER ───────────────────────────────────────────────────────────
const ScreenHeader = ({ crumbs, onBack, right }) => (
  <div style={{
    padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 12,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(6,9,26,0.65)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    position: 'sticky', top: 0, zIndex: 10,
  }}>
    <GlassBtn onClick={onBack} small style={{ flexShrink: 0 }}>← Zurück</GlassBtn>
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <Breadcrumb crumbs={crumbs} />
    </div>
    {right}
  </div>
)

// ─── INLINE RENAME INPUT ─────────────────────────────────────────────────────
const RenameInput = ({ value, onSave, onCancel }) => {
  const [val, setVal] = useState(value)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }} onClick={e => e.stopPropagation()}>
      <GlassInput value={val} onChange={e => setVal(e.target.value)}
        placeholder="Name…" style={{ marginBottom: 0, padding: '6px 10px' }}
        onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel() }} />
      <GlassBtn onClick={() => onSave(val)} variant="gold" small disabled={!val.trim()}>✓</GlassBtn>
      <GlassBtn onClick={onCancel} small>✕</GlassBtn>
    </div>
  )
}

// ─── FOLDER TILE (for grid home) ─────────────────────────────────────────────
const FolderTile = ({ item, onClick, onDelete, onRename, cardCount }) => {
  const [hover, setHover] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const handleRename = async (newName) => {
    if (newName.trim() && newName.trim() !== item.name) await onRename(newName.trim())
    setRenaming(false)
  }

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hover ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.09)'}`,
        borderRadius: 16, padding: '20px 18px', cursor: renaming ? 'default' : 'pointer',
        transition: 'all 0.18s', position: 'relative', minHeight: 90,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
      onClick={renaming ? undefined : onClick}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>

      {renaming ? (
        <RenameInput value={item.name} onSave={handleRename} onCancel={() => setRenaming(false)} />
      ) : (
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, wordBreak: 'break-word' }}>{item.name}</div>
      )}

      {cardCount != null && !renaming && (
        <div style={{ fontSize: 11, color: C.subtext, marginTop: 4 }}>{cardCount} Karten</div>
      )}

      {!renaming && (
        <div style={{
          position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4,
          opacity: hover ? 1 : 0, transition: 'opacity 0.18s',
        }}>
          <button onClick={e => { e.stopPropagation(); setRenaming(true) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.subtext, fontSize: 13, padding: '3px 5px' }}>✏️</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 13, padding: '3px 5px' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── FOLDER ROW (for list view) ───────────────────────────────────────────────
const FolderRow = ({ item, onClick, onDelete, onRename, meta }) => {
  const [hover, setHover] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const handleRename = async (newName) => {
    if (newName.trim() && newName.trim() !== item.name) await onRename(newName.trim())
    setRenaming(false)
  }

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hover ? 'rgba(201,168,76,0.26)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 13, padding: '14px 16px', marginBottom: 8,
        cursor: renaming ? 'default' : 'pointer', transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
      onClick={renaming ? undefined : onClick}
    >
      <div style={{ fontSize: 20, flexShrink: 0 }}>🗂️</div>
      {renaming ? (
        <RenameInput value={item.name} onSave={handleRename} onCancel={() => setRenaming(false)} />
      ) : (
        <>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{item.name}</div>
            {meta && <div style={{ fontSize: 12, color: C.subtext, marginTop: 2 }}>{meta}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: C.subtext, opacity: hover ? 0.8 : 0.3 }}>›</span>
            <button onClick={e => { e.stopPropagation(); setRenaming(true) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.subtext, fontSize: 13, padding: '3px 5px', opacity: hover ? 1 : 0, transition: 'opacity 0.18s' }}>✏️</button>
            <button onClick={e => { e.stopPropagation(); onDelete() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 13, padding: '3px 5px', opacity: hover ? 1 : 0, transition: 'opacity 0.18s' }}>✕</button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── CREATE INLINE FORM ───────────────────────────────────────────────────────
const CreateForm = ({ label, placeholder, onSave, onCancel }) => {
  const [name, setName] = useState('')
  return (
    <Glass style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: C.goldLight, fontWeight: 600, marginBottom: 12 }}>{label}</div>
      <GlassInput value={name} onChange={e => setName(e.target.value)} placeholder={placeholder}
        style={{ marginBottom: 12 }}
        onKeyDown={e => { if (e.key === 'Enter') { if (name.trim()) onSave(name.trim()) } if (e.key === 'Escape') onCancel() }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <GlassBtn onClick={() => { if (name.trim()) onSave(name.trim()) }} variant="gold" disabled={!name.trim()}>Erstellen</GlassBtn>
        <GlassBtn onClick={onCancel}>Abbrechen</GlassBtn>
      </div>
    </Glass>
  )
}

// ─── CARD ROW ────────────────────────────────────────────────────────────────
const CardRow = ({ card, onDelete, onEdit }) => {
  const [hover, setHover] = useState(false)
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      onClick={() => setFlipped(f => !f)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
        border: `1px solid ${hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 12, padding: '13px 16px', marginBottom: 8,
        cursor: 'pointer', transition: 'all 0.18s',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
      <div style={{ flex: 1 }}>
        {!flipped ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {card.image && <img src={card.image} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 7, flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />}
            <div>
              <div style={{ fontSize: 11, color: C.subtext, marginBottom: 3, letterSpacing: 0.5 }}>Vorderseite</div>
              <div style={{ fontSize: 15, color: C.text }}>{card.front || '(nur Bild)'}</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: C.subtext, marginBottom: 3, letterSpacing: 0.5 }}>Rückseite</div>
            {card.backImage && <img src={card.backImage} alt="" style={{ maxHeight: 70, borderRadius: 7, marginBottom: 6, border: '1px solid rgba(255,255,255,0.1)' }} />}
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{card.back}</div>
            {card.backShort && <div style={{ fontSize: 13, color: C.goldLight, marginTop: 4 }}>{card.backShort}</div>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: C.subtext, opacity: hover ? 0.7 : 0.3, whiteSpace: 'nowrap' }}>
          {flipped ? '↩ Vorderseite' : '↩ Umdrehen'}
        </div>
        <button onClick={e => { e.stopPropagation(); onEdit() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.subtext, fontSize: 13, padding: '2px 4px', opacity: hover ? 1 : 0, transition: 'opacity 0.18s' }}>✏️</button>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 13, padding: '2px 4px', opacity: hover ? 1 : 0, transition: 'opacity 0.18s' }}>✕</button>
      </div>
    </div>
  )
}

// ─── CARD CREATE / EDIT MODAL ─────────────────────────────────────────────────
const CardModal = ({ initial, onSave, onClose }) => {
  const [front, setFront] = useState(initial?.front || '')
  const [image, setImage] = useState(initial?.image || null)
  const [back, setBack] = useState(initial?.back || '')
  const [backShort, setBackShort] = useState(initial?.backShort || '')
  const [backImage, setBackImage] = useState(initial?.backImage || null)
  const [saving, setSaving] = useState(false)

  const pickImg = (setter) => (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setter(ev.target.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!back.trim() && !front.trim() && !image) return
    setSaving(true)
    await onSave({ front: front.trim(), image: image || null, back: back.trim(), backShort: backShort.trim(), backImage: backImage || null })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <Glass style={{ width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.goldLight }}>{initial ? 'Karte bearbeiten' : 'Neue Karte'}</div>
          <GlassBtn onClick={onClose} small>✕</GlassBtn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Front */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 12, color: C.goldLight, fontWeight: 600, marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>Vorderseite</div>
            <Label>Text</Label>
            <GlassInput value={front} onChange={e => setFront(e.target.value)} placeholder="Begriff, Signal, Situation…" multiline rows={3} style={{ marginBottom: 14 }} />
            <Label>Bild (optional)</Label>
            <input type="file" accept="image/*" onChange={pickImg(setImage)} style={{ fontSize: 12, color: C.subtext, marginTop: 5, display: 'block' }} />
            {image && (
              <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                <img src={image} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} />
                <button onClick={() => setImage(null)} style={{ position: 'absolute', top: -6, right: -6, background: C.danger, border: 'none', borderRadius: '50%', width: 17, height: 17, color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            )}
          </div>

          {/* Back */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 12, color: C.goldLight, fontWeight: 600, marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>Rückseite</div>
            <Label>Langbezeichnung *</Label>
            <GlassInput value={back} onChange={e => setBack(e.target.value)} placeholder="z.B. Hauptsignal Hp 0 — Halt" multiline rows={3} style={{ marginBottom: 10 }} />
            <Label>Kurzbezeichnung (optional)</Label>
            <GlassInput value={backShort} onChange={e => setBackShort(e.target.value)} placeholder="z.B. Hp 0" style={{ marginBottom: 14 }} />
            <Label>Bild (optional)</Label>
            <input type="file" accept="image/*" onChange={pickImg(setBackImage)} style={{ fontSize: 12, color: C.subtext, marginTop: 5, display: 'block' }} />
            {backImage && (
              <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                <img src={backImage} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }} />
                <button onClick={() => setBackImage(null)} style={{ position: 'absolute', top: -6, right: -6, background: C.danger, border: 'none', borderRadius: '50%', width: 17, height: 17, color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <GlassBtn onClick={save} variant="gold" disabled={saving || (!back.trim() && !front.trim() && !image)} style={{ flex: 1, padding: '12px 20px' }}>
            {saving ? 'Speichert…' : initial ? 'Änderungen speichern' : 'Karte speichern'}
          </GlassBtn>
          <GlassBtn onClick={onClose}>Abbrechen</GlassBtn>
        </div>
      </Glass>
    </div>
  )
}

// ─── KI IMPORT MODAL ──────────────────────────────────────────────────────────
const KIImportModal = ({ basePath, onSaved, onClose }) => {
  const [file, setFile] = useState(null)
  const [instruction, setInstruction] = useState('Erstelle Lernkarten aus diesem Dokument. Vorderseite = Begriff, Rückseite = Erklärung.')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const analyze = async () => {
    if (!file) return
    setLoading(true); setError(''); setPreview(null)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      let content
      const prompt = instruction + '\n\nAntworte NUR mit einem JSON-Array ohne Markdown:\n[{"front": "...", "back": "...", "backShort": "..."}]'
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        const b64 = await fileToBase64(file)
        content = [{ type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64.split(',')[1] } }, { type: 'text', text: prompt }]
      } else {
        const text = await fileToText(file)
        content = [{ type: 'text', text: `${instruction}\n\nDokument:\n${text.slice(0, 14000)}\n\nAntworte NUR mit einem JSON-Array ohne Markdown:\n[{"front": "...", "back": "...", "backShort": "..."}]` }]
      }
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 4096, messages: [{ role: 'user', content }] }) })
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
      await addDoc(collection(db, `${basePath}/cards`), {
        front: card.front || '', image: null, back: card.back || card.front || '',
        backShort: card.backShort || '', backImage: null, createdAt: serverTimestamp(),
      })
    }
    setSaving(false); onSaved()
  }

  const update = (i, field, val) => setPreview(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <Glass style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.goldLight }}>✦ KI-Import</div>
          <GlassBtn onClick={onClose} small>✕</GlassBtn>
        </div>

        {!preview ? (
          <>
            <Label>Datei (TXT, CSV, PDF, JPG, PNG…)</Label>
            <input type="file" accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" onChange={e => setFile(e.target.files[0])}
              style={{ fontSize: 13, color: C.subtext, margin: '6px 0 18px', display: 'block' }} />
            <Label>Anweisung an die KI</Label>
            <GlassInput value={instruction} onChange={e => setInstruction(e.target.value)} multiline rows={4} style={{ marginTop: 6, marginBottom: 18 }} />
            {error && <div style={{ color: '#e08080', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'rgba(224,85,85,0.1)', borderRadius: 8 }}>{error}</div>}
            <GlassBtn onClick={analyze} variant="gold" disabled={loading || !file} style={{ width: '100%', padding: '13px 20px', fontSize: 15 }}>
              {loading ? '✦ KI analysiert…' : '✦ Karten generieren'}
            </GlassBtn>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: C.text, marginBottom: 18 }}>
              <span style={{ color: C.goldLight, fontWeight: 600 }}>{preview.length} Karten</span> generiert — prüfen und ggf. bearbeiten:
            </div>
            {preview.map((card, i) => (
              <Glass key={i} style={{ padding: 14, marginBottom: 10, background: 'rgba(255,255,255,0.03)' }}>
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
                  <button onClick={() => setPreview(p => p.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 15, paddingTop: 20 }}>✕</button>
                </div>
              </Glass>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <GlassBtn onClick={saveAll} variant="gold" disabled={saving || preview.length === 0} style={{ flex: 1, minWidth: 160, padding: '12px 20px' }}>
                {saving ? 'Speichert…' : `${preview.length} Karten speichern`}
              </GlassBtn>
              <GlassBtn onClick={() => setPreview(null)}>← Zurück</GlassBtn>
              <GlassBtn onClick={onClose}>Abbrechen</GlassBtn>
            </div>
          </>
        )}
      </Glass>
    </div>
  )
}

// ─── FILE UTILS ───────────────────────────────────────────────────────────────
const fileToBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file) })
const fileToText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(file, 'utf-8') })

// ─── FIRESTORE HELPERS ───────────────────────────────────────────────────────
const loadDocs = async (path, order = 'createdAt') => {
  const snap = await getDocs(query(collection(db, path), orderBy(order, 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = async () => {
    setLoading(true); setError('')
    try { await signInWithPopup(auth, provider) }
    catch { setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.'); setLoading(false) }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Glass style={{ padding: '52px 44px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <KataraLogo size={46} />
        <div style={{ marginTop: 18, fontSize: 16, color: C.text, letterSpacing: 0.5 }}>Professionelles Lernen</div>
        <div style={{ marginTop: 8, fontSize: 13, color: C.subtext, fontStyle: 'italic', lineHeight: 1.6 }}>Wir bauen keine Apps.<br />Wir bauen Brücken.</div>
        <div style={{ margin: '32px 0', height: 1, background: 'rgba(255,255,255,0.07)' }} />
        {error && <div style={{ color: '#e08080', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        <GlassBtn onClick={login} disabled={loading} variant="gold" style={{ width: '100%', padding: '14px 20px', fontSize: 15, borderRadius: 13 }}>
          {loading ? 'Wird angemeldet…' : '▶  Mit Google anmelden'}
        </GlassBtn>
      </Glass>
    </div>
  )
}

// ─── HOME — HAUPTKATEGORIEN ──────────────────────────────────────────────────
const HomeScreen = ({ user, onOpen }) => {
  const [items, setItems] = useState([])
  const [creating, setCreating] = useState(false)
  const uid = user.uid
  const path = `users/${uid}/categories`

  const load = useCallback(async () => setItems(await loadDocs(path)), [path])
  useEffect(() => { load() }, [load])

  const create = async (name) => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp() })
    setCreating(false); load()
  }
  const remove = async (id) => {
    if (!confirm('Hauptkategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name }); load()
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      {/* Sticky top bar */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,9,26,0.65)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <KataraLogo size={24} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 13, color: C.subtext }}>{user.displayName?.split(' ')[0]}</div>
          <GlassBtn onClick={() => signOut(auth)} small>Abmelden</GlassBtn>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: C.text }}>Kategorien</div>
            <div style={{ fontSize: 13, color: C.subtext, marginTop: 3 }}>{items.length === 0 ? 'Noch keine Kategorien' : `${items.length} Kategorie${items.length !== 1 ? 'n' : ''}`}</div>
          </div>
          <GlassBtn onClick={() => setCreating(true)} variant="gold">+ Neue Kategorie</GlassBtn>
        </div>

        {creating && <CreateForm label="Neue Hauptkategorie" placeholder="z.B. RiL 301" onSave={create} onCancel={() => setCreating(false)} />}

        {items.length === 0 && !creating ? (
          <Glass style={{ padding: '52px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>📚</div>
            <div style={{ color: C.text, fontSize: 16, fontWeight: 500 }}>Noch keine Kategorien</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 8, lineHeight: 1.7 }}>
              Erstelle deine erste Hauptkategorie, z.B. "RiL 301".<br />
              Darunter kannst du Unterkategorien und Karten anlegen.
            </div>
          </Glass>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {items.map(item => (
              <FolderTile key={item.id} item={item}
                onClick={() => onOpen(item)}
                onDelete={() => remove(item.id)}
                onRename={name => rename(item.id, name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LEVEL 2 — UNTERKATEGORIEN ───────────────────────────────────────────────
const SubcategoryScreen = ({ user, cat, onBack, onOpen }) => {
  const [items, setItems] = useState([])
  const [creating, setCreating] = useState(false)
  const [kiModal, setKiModal] = useState(false)
  const uid = user.uid
  const path = `users/${uid}/categories/${cat.id}/subcategories`
  const cardsPath = `users/${uid}/categories/${cat.id}/cards`

  const load = useCallback(async () => setItems(await loadDocs(path)), [path])
  useEffect(() => { load() }, [load])

  const create = async (name) => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp() })
    setCreating(false); load()
  }
  const remove = async (id) => {
    if (!confirm('Unterkategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => { await updateDoc(doc(db, `${path}/${id}`), { name }); load() }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader crumbs={[cat.name]} onBack={onBack} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <GlassBtn onClick={() => setCreating(c => !c)} variant="gold">+ Unterkategorie</GlassBtn>
          <GlassBtn onClick={() => setKiModal(true)} variant="accent">✦ KI-Import</GlassBtn>
        </div>

        {creating && <CreateForm label="Neue Unterkategorie" placeholder="z.B. Hauptsignale" onSave={create} onCancel={() => setCreating(false)} />}

        {items.length === 0 && !creating && (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗂️</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Keine Unterkategorien</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6 }}>Erstelle Unterkategorien oder importiere via KI.</div>
          </Glass>
        )}

        {items.map(item => (
          <FolderRow key={item.id} item={item}
            onClick={() => onOpen(item)}
            onDelete={() => remove(item.id)}
            onRename={name => rename(item.id, name)}
          />
        ))}
      </div>
      {kiModal && <KIImportModal basePath={`users/${uid}/categories/${cat.id}`} onSaved={() => { setKiModal(false); load() }} onClose={() => setKiModal(false)} />}
    </div>
  )
}

// ─── LEVEL 3 — UNTER-UNTERKATEGORIEN ────────────────────────────────────────
const SubSubcategoryScreen = ({ user, cat, sub, onBack, onOpen }) => {
  const [items, setItems] = useState([])
  const [creating, setCreating] = useState(false)
  const [kiModal, setKiModal] = useState(false)
  const uid = user.uid
  const path = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories`

  const load = useCallback(async () => setItems(await loadDocs(path)), [path])
  useEffect(() => { load() }, [load])

  const create = async (name) => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp() })
    setCreating(false); load()
  }
  const remove = async (id) => {
    if (!confirm('Unter-Unterkategorie löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => { await updateDoc(doc(db, `${path}/${id}`), { name }); load() }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader crumbs={[cat.name, sub.name]} onBack={onBack} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <GlassBtn onClick={() => setCreating(c => !c)} variant="gold">+ Unter-Unterkategorie</GlassBtn>
          <GlassBtn onClick={() => setKiModal(true)} variant="accent">✦ KI-Import</GlassBtn>
        </div>

        {creating && <CreateForm label="Neue Unter-Unterkategorie" placeholder="z.B. Hp 0" onSave={create} onCancel={() => setCreating(false)} />}

        {items.length === 0 && !creating && (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Keine Einträge</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6 }}>Erstelle Unter-Unterkategorien oder importiere via KI.</div>
          </Glass>
        )}

        {items.map(item => (
          <FolderRow key={item.id} item={item}
            onClick={() => onOpen(item)}
            onDelete={() => remove(item.id)}
            onRename={name => rename(item.id, name)}
          />
        ))}
      </div>
      {kiModal && <KIImportModal basePath={`users/${uid}/categories/${cat.id}/subcategories/${sub.id}`} onSaved={() => { setKiModal(false); load() }} onClose={() => setKiModal(false)} />}
    </div>
  )
}

// ─── LEVEL 4 — KARTEN ────────────────────────────────────────────────────────
const CardsScreen = ({ user, cat, sub, subsub, onBack }) => {
  const [cards, setCards] = useState([])
  const [cardModal, setCardModal] = useState(null) // null | 'new' | cardObj
  const [kiModal, setKiModal] = useState(false)
  const uid = user.uid
  const basePath = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories/${subsub.id}`
  const cardsPath = `${basePath}/cards`

  const load = useCallback(async () => setCards(await loadDocs(cardsPath)), [cardsPath])
  useEffect(() => { load() }, [load])

  const saveCard = async (data) => {
    if (cardModal === 'new') {
      await addDoc(collection(db, cardsPath), { ...data, createdAt: serverTimestamp() })
    } else {
      await updateDoc(doc(db, `${cardsPath}/${cardModal.id}`), data)
    }
    setCardModal(null); load()
  }

  const remove = async (id) => {
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${cardsPath}/${id}`)); load()
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader crumbs={[cat.name, sub.name, subsub.name]} onBack={onBack} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <GlassBtn onClick={() => setCardModal('new')}>+ Karte</GlassBtn>
          <GlassBtn onClick={() => setKiModal(true)} variant="accent">✦ KI-Import</GlassBtn>
          <GlassBtn onClick={() => alert('Lern-Modus kommt bald! 🚀')} style={{ marginLeft: 'auto' }}>▶ Lernen</GlassBtn>
        </div>

        {cards.length === 0 ? (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>🃏</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Noch keine Karten</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6 }}>Erstelle Karten manuell oder importiere via KI.</div>
          </Glass>
        ) : (
          <>
            <div style={{ fontSize: 11, color: C.subtext, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
              {cards.length} Karte{cards.length !== 1 ? 'n' : ''}
            </div>
            {cards.map(c => (
              <CardRow key={c.id} card={c}
                onDelete={() => remove(c.id)}
                onEdit={() => setCardModal(c)}
              />
            ))}
          </>
        )}
      </div>

      {cardModal && (
        <CardModal
          initial={cardModal === 'new' ? null : cardModal}
          onSave={saveCard}
          onClose={() => setCardModal(null)}
        />
      )}
      {kiModal && (
        <KIImportModal basePath={basePath} onSaved={() => { setKiModal(false); load() }} onClose={() => setKiModal(false)} />
      )}
    </div>
  )
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined)
  // nav stack: each entry = { screen, cat, sub, subsub }
  const [nav, setNav] = useState([{ screen: 'home' }])

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), [])

  const push = (entry) => setNav(n => [...n, entry])
  const pop = () => setNav(n => n.length > 1 ? n.slice(0, -1) : n)
  const current = nav[nav.length - 1]

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.subtext, fontSize: 14 }}>Wird geladen…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgGrad, position: 'relative' }}>
      <WaterCanvas />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {!user && <LoginScreen />}

        {user && current.screen === 'home' && (
          <HomeScreen user={user}
            onOpen={cat => push({ screen: 'sub', cat })}
          />
        )}

        {user && current.screen === 'sub' && (
          <SubcategoryScreen user={user} cat={current.cat} onBack={pop}
            onOpen={sub => push({ screen: 'subsub', cat: current.cat, sub })}
          />
        )}

        {user && current.screen === 'subsub' && (
          <SubSubcategoryScreen user={user} cat={current.cat} sub={current.sub} onBack={pop}
            onOpen={subsub => push({ screen: 'cards', cat: current.cat, sub: current.sub, subsub })}
          />
        )}

        {user && current.screen === 'cards' && (
          <CardsScreen user={user} cat={current.cat} sub={current.sub} subsub={current.subsub} onBack={pop} />
        )}
      </div>
    </div>
  )
}
