import { useState, useEffect, useRef, useCallback } from 'react'
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { auth, db, provider } from './firebase'
import './App.css'

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  bgGrad: 'linear-gradient(135deg, #06091a 0%, #0a1628 55%, #0d1f3c 100%)',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.09)',
  gold: '#c9a84c',
  goldLight: '#e8c46a',
  goldGrad: 'linear-gradient(135deg, #b8922a 0%, #e8c46a 50%, #b8922a 100%)',
  text: '#e8e8f0',
  subtext: '#7a8fa8',
  danger: '#e05555',
  accent: '#4a8fd4',
}

// ─── WATER CANVAS ───────────────────────────────────────────────────────────
const WaterCanvas = () => {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
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
        rings.push({
          x, y,
          radius: k * spacing,
          maxRadius,
          opacity: startOpacity * Math.max(0.5, 1 - k * 0.15),
          speed,
          fadeRate: (startOpacity * 0.85) / (maxRadius / speed),
        })
      }
      setTimeout(addDrop, 2500 + Math.random() * 4000)
    }
    addDrop()

    let rafId
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]
        r.radius += r.speed
        r.opacity -= r.fadeRate
        if (r.radius > r.maxRadius || r.opacity <= 0) { rings.splice(i, 1); continue }
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(140,180,255,${r.opacity})`
        ctx.lineWidth = 1.0
        ctx.stroke()
      }
      rafId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none', mixBlendMode: 'screen',
      }}
    />
  )
}

// ─── PRIMITIVES ─────────────────────────────────────────────────────────────
const GlassBtn = ({ children, onClick, style = {}, variant = 'default', disabled = false }) => {
  const [hover, setHover] = useState(false)
  let bg = hover ? 'rgba(255,255,255,0.08)' : C.glass
  let border = `1px solid ${hover ? 'rgba(201,168,76,0.35)' : C.glassBorder}`
  let color = C.text

  if (variant === 'gold') {
    bg = hover ? 'rgba(201,168,76,0.22)' : 'rgba(201,168,76,0.13)'
    border = `1px solid ${hover ? 'rgba(201,168,76,0.55)' : 'rgba(201,168,76,0.32)'}`
    color = C.goldLight
  }
  if (variant === 'danger') {
    bg = hover ? 'rgba(224,85,85,0.2)' : 'rgba(224,85,85,0.08)'
    border = '1px solid rgba(224,85,85,0.35)'
    color = '#e08080'
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '9px 18px', borderRadius: 11, cursor: disabled ? 'not-allowed' : 'pointer',
        border, background: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        color, fontSize: 14, fontWeight: 500, transition: 'all 0.18s ease',
        opacity: disabled ? 0.45 : 1, ...style,
      }}
    >
      {children}
    </button>
  )
}

const Glass = ({ children, style = {} }) => (
  <div style={{
    background: C.glass,
    border: `1px solid ${C.glassBorder}`,
    borderRadius: 16,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    ...style,
  }}>
    {children}
  </div>
)

const GlassInput = ({ value, onChange, placeholder, style = {}, multiline = false, rows = 3 }) => {
  const base = {
    width: '100%', padding: '10px 13px', borderRadius: 10,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)',
    color: C.text, fontSize: 14, outline: 'none',
    fontFamily: 'inherit', resize: multiline ? 'vertical' : 'none',
    boxSizing: 'border-box', ...style,
  }
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={base} />
    : <input value={value} onChange={onChange} placeholder={placeholder} style={base} />
}

const Label = ({ children }) => (
  <div style={{ fontSize: 11, color: C.subtext, letterSpacing: 0.5, marginBottom: 4 }}>{children}</div>
)

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, color: C.subtext, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
    {children}
  </div>
)

// ─── KATARA LOGO ─────────────────────────────────────────────────────────────
const KataraLogo = ({ size = 32 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
    <div style={{
      fontSize: size,
      fontFamily: "'Playfair Display', Georgia, serif",
      fontWeight: 700,
      letterSpacing: 3,
      background: C.goldGrad,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      filter: 'drop-shadow(0 0 14px rgba(201,168,76,0.55))',
    }}>
      Katara
    </div>
    <div style={{ fontSize: Math.max(9, size * 0.28), color: C.subtext, letterSpacing: 3, textTransform: 'uppercase', marginTop: 3 }}>
      by Bridgelab
    </div>
  </div>
)

// ─── SCREEN HEADER ───────────────────────────────────────────────────────────
const ScreenHeader = ({ title, onBack, right }) => (
  <div style={{
    padding: '14px 20px',
    display: 'flex', alignItems: 'center', gap: 12,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(6,9,26,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    position: 'sticky', top: 0, zIndex: 10,
  }}>
    <GlassBtn onClick={onBack} style={{ padding: '7px 12px', fontSize: 13 }}>← Zurück</GlassBtn>
    <div style={{ fontSize: 17, fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {title}
    </div>
    {right || <KataraLogo size={18} />}
  </div>
)

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    setLoading(true); setError('')
    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <Glass style={{ padding: '52px 44px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <KataraLogo size={46} />

        <div style={{ marginTop: 18, fontSize: 16, color: C.text, letterSpacing: 0.5 }}>
          Professionelles Lernen
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: C.subtext, fontStyle: 'italic', lineHeight: 1.6 }}>
          Wir bauen keine Apps.<br />Wir bauen Brücken.
        </div>

        <div style={{ margin: '32px 0', height: 1, background: 'rgba(255,255,255,0.07)' }} />

        {error && (
          <div style={{ color: '#e08080', fontSize: 13, marginBottom: 14 }}>{error}</div>
        )}

        <GlassBtn
          onClick={login}
          disabled={loading}
          variant="gold"
          style={{ width: '100%', padding: '14px 20px', fontSize: 15, borderRadius: 13 }}
        >
          {loading ? 'Wird angemeldet…' : '▶  Mit Google anmelden'}
        </GlassBtn>
      </Glass>
    </div>
  )
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
const HomeScreen = ({ user, onOpenFolder }) => {
  const [folders, setFolders] = useState([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const load = useCallback(async () => {
    const snap = await getDocs(query(collection(db, `users/${user.uid}/folders`), orderBy('createdAt', 'desc')))
    setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, [user.uid])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!newName.trim()) return
    await addDoc(collection(db, `users/${user.uid}/folders`), {
      name: newName.trim(), description: newDesc.trim(), createdAt: serverTimestamp(),
    })
    setNewName(''); setNewDesc(''); setCreating(false); load()
  }

  const remove = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Ordner löschen?')) return
    await deleteDoc(doc(db, `users/${user.uid}/folders/${id}`))
    load()
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(6,9,26,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <KataraLogo size={26} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 13, color: C.subtext }}>{user.displayName?.split(' ')[0]}</div>
          <GlassBtn onClick={() => signOut(auth)} style={{ padding: '6px 12px', fontSize: 12 }}>Abmelden</GlassBtn>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, color: C.text }}>Meine Ordner</div>
            <div style={{ fontSize: 13, color: C.subtext, marginTop: 3 }}>
              {folders.length === 0 ? 'Noch keine Ordner' : `${folders.length} Ordner`}
            </div>
          </div>
          <GlassBtn onClick={() => setCreating(true)} variant="gold">+ Neuer Ordner</GlassBtn>
        </div>

        {/* Create form */}
        {creating && (
          <Glass style={{ padding: 22, marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: C.goldLight, fontWeight: 600, marginBottom: 14 }}>Neuer Ordner</div>
            <GlassInput
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Name (z.B. RiL 301)"
              style={{ marginBottom: 10 }}
            />
            <GlassInput
              value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Beschreibung (optional)"
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <GlassBtn onClick={create} variant="gold" disabled={!newName.trim()}>Erstellen</GlassBtn>
              <GlassBtn onClick={() => { setCreating(false); setNewName(''); setNewDesc('') }}>Abbrechen</GlassBtn>
            </div>
          </Glass>
        )}

        {/* Empty state */}
        {folders.length === 0 && !creating && (
          <Glass style={{ padding: '48px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📂</div>
            <div style={{ color: C.text, fontSize: 16, fontWeight: 500 }}>Noch keine Ordner</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
              Erstelle deinen ersten Ordner, z.B. "RiL 301".<br />
              Darunter kannst du Unterordner und Karten anlegen.
            </div>
          </Glass>
        )}

        {/* Folder list */}
        {folders.map(f => (
          <FolderRow key={f.id} item={f} onClick={() => onOpenFolder(f)} onDelete={e => remove(f.id, e)} />
        ))}
      </div>
    </div>
  )
}

// ─── FOLDER ROW ──────────────────────────────────────────────────────────────
const FolderRow = ({ item, onClick, onDelete, icon = '📁' }) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.035)',
        border: `1px solid ${hover ? 'rgba(201,168,76,0.28)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14, padding: '15px 18px', marginBottom: 10,
        cursor: 'pointer', transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{item.name}</div>
          {item.description && (
            <div style={{ fontSize: 12, color: C.subtext, marginTop: 2 }}>{item.description}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 16, color: C.subtext, opacity: hover ? 1 : 0.4 }}>›</div>
        <button
          onClick={onDelete}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.danger,
            fontSize: 14, padding: '2px 5px',
            opacity: hover ? 1 : 0, transition: 'opacity 0.18s',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── FOLDER SCREEN ───────────────────────────────────────────────────────────
const FolderScreen = ({ user, folder, onBack, onOpenSubfolder }) => {
  const [subfolders, setSubfolders] = useState([])
  const [cards, setCards] = useState([])
  const [panel, setPanel] = useState(null) // 'subfolder' | 'card' | null
  const [newName, setNewName] = useState('')
  const [kiModal, setKiModal] = useState(false)
  const basePath = `users/${user.uid}/folders/${folder.id}`

  const load = useCallback(async () => {
    const [sfSnap, cSnap] = await Promise.all([
      getDocs(query(collection(db, `${basePath}/subfolders`), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, `${basePath}/cards`), orderBy('createdAt', 'desc'))),
    ])
    setSubfolders(sfSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCards(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, [basePath])

  useEffect(() => { load() }, [load])

  const createSubfolder = async () => {
    if (!newName.trim()) return
    await addDoc(collection(db, `${basePath}/subfolders`), { name: newName.trim(), createdAt: serverTimestamp() })
    setNewName(''); setPanel(null); load()
  }

  const removeSf = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Unterordner löschen?')) return
    await deleteDoc(doc(db, `${basePath}/subfolders/${id}`))
    load()
  }

  const removeCard = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${basePath}/cards/${id}`))
    load()
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader title={folder.name} onBack={onBack} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <GlassBtn onClick={() => setPanel(panel === 'subfolder' ? null : 'subfolder')} variant="gold">
            + Unterordner
          </GlassBtn>
          <GlassBtn onClick={() => setPanel(panel === 'card' ? null : 'card')}>
            + Karte
          </GlassBtn>
          <GlassBtn
            onClick={() => setKiModal(true)}
            style={{ color: C.accent, borderColor: 'rgba(74,143,212,0.4)' }}
          >
            ✦ KI-Import
          </GlassBtn>
          <GlassBtn
            onClick={() => alert('Lern-Modus kommt bald! 🚀')}
            style={{ marginLeft: 'auto' }}
          >
            ▶ Lernen
          </GlassBtn>
        </div>

        {/* Subfolder create */}
        {panel === 'subfolder' && (
          <Glass style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: C.goldLight, fontWeight: 600, marginBottom: 12 }}>Neuer Unterordner</div>
            <GlassInput
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Name (z.B. Hp — Hauptsignale)"
              style={{ marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <GlassBtn onClick={createSubfolder} variant="gold" disabled={!newName.trim()}>Erstellen</GlassBtn>
              <GlassBtn onClick={() => { setPanel(null); setNewName('') }}>Abbrechen</GlassBtn>
            </div>
          </Glass>
        )}

        {/* Card create */}
        {panel === 'card' && (
          <CardCreateForm
            basePath={basePath}
            onSaved={() => { setPanel(null); load() }}
            onCancel={() => setPanel(null)}
          />
        )}

        {/* Subfolders */}
        {subfolders.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>Unterordner ({subfolders.length})</SectionLabel>
            {subfolders.map(sf => (
              <FolderRow
                key={sf.id} item={sf} icon="🗂️"
                onClick={() => onOpenSubfolder(sf)}
                onDelete={e => removeSf(sf.id, e)}
              />
            ))}
          </div>
        )}

        {/* Cards */}
        {cards.length > 0 && (
          <div>
            <SectionLabel>Karten ({cards.length})</SectionLabel>
            {cards.map(c => (
              <CardRow key={c.id} card={c} onDelete={e => removeCard(c.id, e)} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {subfolders.length === 0 && cards.length === 0 && panel === null && (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>🗂️</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Ordner ist leer</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
              Erstelle Unterordner, füge Karten manuell hinzu<br />oder importiere via KI.
            </div>
          </Glass>
        )}
      </div>

      {kiModal && (
        <KIImportModal
          basePath={basePath}
          onSaved={() => { setKiModal(false); load() }}
          onClose={() => setKiModal(false)}
        />
      )}
    </div>
  )
}

// ─── SUBFOLDER SCREEN ────────────────────────────────────────────────────────
const SubfolderScreen = ({ user, folder, subfolder, onBack }) => {
  const [cards, setCards] = useState([])
  const [creating, setCreating] = useState(false)
  const [kiModal, setKiModal] = useState(false)
  const basePath = `users/${user.uid}/folders/${folder.id}/subfolders/${subfolder.id}`

  const load = useCallback(async () => {
    const snap = await getDocs(query(collection(db, `${basePath}/cards`), orderBy('createdAt', 'desc')))
    setCards(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, [basePath])

  useEffect(() => { load() }, [load])

  const removeCard = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${basePath}/cards/${id}`))
    load()
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <ScreenHeader title={`${folder.name} › ${subfolder.name}`} onBack={onBack} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '22px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <GlassBtn onClick={() => setCreating(c => !c)}>+ Karte</GlassBtn>
          <GlassBtn
            onClick={() => setKiModal(true)}
            style={{ color: C.accent, borderColor: 'rgba(74,143,212,0.4)' }}
          >
            ✦ KI-Import
          </GlassBtn>
          <GlassBtn
            onClick={() => alert('Lern-Modus kommt bald! 🚀')}
            style={{ marginLeft: 'auto' }}
          >
            ▶ Lernen
          </GlassBtn>
        </div>

        {creating && (
          <CardCreateForm
            basePath={basePath}
            onSaved={() => { setCreating(false); load() }}
            onCancel={() => setCreating(false)}
          />
        )}

        {cards.length > 0 && (
          <div>
            <SectionLabel>Karten ({cards.length})</SectionLabel>
            {cards.map(c => (
              <CardRow key={c.id} card={c} onDelete={e => removeCard(c.id, e)} />
            ))}
          </div>
        )}

        {cards.length === 0 && !creating && (
          <Glass style={{ padding: '44px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>🃏</div>
            <div style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>Noch keine Karten</div>
            <div style={{ color: C.subtext, fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
              Erstelle Karten manuell oder importiere via KI.
            </div>
          </Glass>
        )}
      </div>

      {kiModal && (
        <KIImportModal
          basePath={basePath}
          onSaved={() => { setKiModal(false); load() }}
          onClose={() => setKiModal(false)}
        />
      )}
    </div>
  )
}

// ─── CARD CREATE FORM ────────────────────────────────────────────────────────
const CardCreateForm = ({ basePath, onSaved, onCancel }) => {
  const [front, setFront] = useState('')
  const [frontImg, setFrontImg] = useState(null)
  const [longName, setLongName] = useState('')
  const [shortName, setShortName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleImg = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFrontImg(ev.target.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!longName.trim()) return
    setSaving(true)
    await addDoc(collection(db, `${basePath}/cards`), {
      front: front.trim(),
      frontImg: frontImg || null,
      longName: longName.trim(),
      shortName: shortName.trim(),
      createdAt: serverTimestamp(),
    })
    onSaved()
  }

  return (
    <Glass style={{ padding: 22, marginBottom: 20 }}>
      <div style={{ fontSize: 14, color: C.goldLight, fontWeight: 600, marginBottom: 16 }}>Neue Karte</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Front */}
        <div>
          <Label>Vorderseite — Text</Label>
          <GlassInput
            value={front} onChange={e => setFront(e.target.value)}
            placeholder="Begriff, Signal, Situation…"
            multiline rows={3}
            style={{ marginBottom: 12 }}
          />
          <Label>Vorderseite — Bild (optional)</Label>
          <input
            type="file" accept="image/*" onChange={handleImg}
            style={{ fontSize: 12, color: C.subtext, marginTop: 5, display: 'block' }}
          />
          {frontImg && (
            <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
              <img
                src={frontImg} alt=""
                style={{ maxWidth: '100%', maxHeight: 90, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }}
              />
              <button
                onClick={() => setFrontImg(null)}
                style={{
                  position: 'absolute', top: -7, right: -7,
                  background: C.danger, border: 'none', borderRadius: '50%',
                  width: 18, height: 18, color: '#fff', fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          )}
        </div>

        {/* Back */}
        <div>
          <Label>Rückseite — Langbezeichnung *</Label>
          <GlassInput
            value={longName} onChange={e => setLongName(e.target.value)}
            placeholder="z.B. Hauptsignal Hp 0 — Halt"
            multiline rows={3}
            style={{ marginBottom: 12 }}
          />
          <Label>Rückseite — Kurzbezeichnung</Label>
          <GlassInput
            value={shortName} onChange={e => setShortName(e.target.value)}
            placeholder="z.B. Hp 0"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <GlassBtn onClick={save} variant="gold" disabled={saving || !longName.trim()}>
          {saving ? 'Speichert…' : 'Karte speichern'}
        </GlassBtn>
        <GlassBtn onClick={onCancel}>Abbrechen</GlassBtn>
      </div>
    </Glass>
  )
}

// ─── CARD ROW ────────────────────────────────────────────────────────────────
const CardRow = ({ card, onDelete }) => {
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
      }}
    >
      <div style={{ flex: 1 }}>
        {!flipped ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {card.frontImg && (
              <img
                src={card.frontImg} alt=""
                style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 7, flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
              />
            )}
            <div>
              <div style={{ fontSize: 11, color: C.subtext, marginBottom: 3, letterSpacing: 0.5 }}>Vorderseite</div>
              <div style={{ fontSize: 15, color: C.text }}>{card.front || '(nur Bild)'}</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: C.subtext, marginBottom: 3, letterSpacing: 0.5 }}>Rückseite</div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{card.longName}</div>
            {card.shortName && (
              <div style={{ fontSize: 13, color: C.goldLight, marginTop: 4, letterSpacing: 0.5 }}>{card.shortName}</div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: C.subtext, opacity: hover ? 0.8 : 0.4, whiteSpace: 'nowrap' }}>
          {flipped ? '↩ Vorderseite' : '↩ Umdrehen'}
        </div>
        <button
          onClick={onDelete}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.danger,
            fontSize: 14, padding: '2px 4px',
            opacity: hover ? 1 : 0, transition: 'opacity 0.18s',
          }}
        >✕</button>
      </div>
    </div>
  )
}

// ─── KI IMPORT MODAL ─────────────────────────────────────────────────────────
const KIImportModal = ({ basePath, onSaved, onClose }) => {
  const [file, setFile] = useState(null)
  const [instruction, setInstruction] = useState(
    'Erstelle Lernkarten aus diesem Dokument. Vorderseite = Begriff, Rückseite = Erklärung.'
  )
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

      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        const base64 = await fileToBase64(file)
        content = [
          {
            type: 'image',
            source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64.split(',')[1] },
          },
          {
            type: 'text',
            text: instruction + '\n\nAntworte NUR mit einem JSON-Array ohne Markdown:\n[{"front": "...", "longName": "...", "shortName": "..."}]',
          },
        ]
      } else {
        const text = await fileToText(file)
        content = [{
          type: 'text',
          text: `${instruction}\n\nDokument:\n${text.slice(0, 14000)}\n\nAntworte NUR mit einem JSON-Array ohne Markdown:\n[{"front": "...", "longName": "...", "shortName": "..."}]`,
        }]
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content }],
        }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('KI hat kein gültiges JSON zurückgegeben.')
      const cards = JSON.parse(jsonMatch[0])
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
    for (const card of preview) {
      await addDoc(collection(db, `${basePath}/cards`), {
        front: card.front || '',
        frontImg: null,
        longName: card.longName || card.front || '',
        shortName: card.shortName || '',
        createdAt: serverTimestamp(),
      })
    }
    setSaving(false)
    onSaved()
  }

  const updateCard = (i, field, val) =>
    setPreview(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  const removeCard = (i) =>
    setPreview(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.78)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <Glass style={{
        width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflowY: 'auto',
        padding: 30,
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.goldLight }}>✦ KI-Import</div>
          <GlassBtn onClick={onClose} style={{ padding: '5px 10px', fontSize: 12 }}>✕</GlassBtn>
        </div>

        {!preview ? (
          /* Step 1: Upload + instruction */
          <>
            <Label>Datei hochladen (TXT, CSV, PDF, JPG, PNG…)</Label>
            <input
              type="file"
              accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
              onChange={e => setFile(e.target.files[0])}
              style={{ fontSize: 13, color: C.subtext, margin: '6px 0 18px', display: 'block' }}
            />

            <Label>Anweisung an die KI</Label>
            <GlassInput
              value={instruction} onChange={e => setInstruction(e.target.value)}
              multiline rows={4}
              style={{ marginTop: 6, marginBottom: 18 }}
            />

            {error && (
              <div style={{ color: '#e08080', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'rgba(224,85,85,0.1)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <GlassBtn
              onClick={analyze}
              variant="gold"
              disabled={loading || !file}
              style={{ width: '100%', padding: '14px 20px', fontSize: 15 }}
            >
              {loading ? '✦ KI analysiert…' : '✦ Karten generieren'}
            </GlassBtn>
          </>
        ) : (
          /* Step 2: Review + edit generated cards */
          <>
            <div style={{ fontSize: 14, color: C.text, marginBottom: 18 }}>
              <span style={{ color: C.goldLight, fontWeight: 600 }}>{preview.length} Karten</span>{' '}
              generiert — prüfen und ggf. bearbeiten:
            </div>

            {preview.map((card, i) => (
              <Glass key={i} style={{ padding: 14, marginBottom: 10, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'start' }}>
                  <div>
                    <Label>Vorderseite</Label>
                    <GlassInput
                      value={card.front || ''} onChange={e => updateCard(i, 'front', e.target.value)}
                      placeholder="Vorderseite" multiline rows={2} style={{ marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <Label>Langbezeichnung</Label>
                    <GlassInput
                      value={card.longName || ''} onChange={e => updateCard(i, 'longName', e.target.value)}
                      placeholder="Langbezeichnung" multiline rows={2} style={{ marginTop: 4, marginBottom: 6 }}
                    />
                    <GlassInput
                      value={card.shortName || ''} onChange={e => updateCard(i, 'shortName', e.target.value)}
                      placeholder="Kurzbezeichnung"
                    />
                  </div>
                  <button
                    onClick={() => removeCard(i)}
                    style={{
                      background: 'none', border: 'none', color: C.danger, cursor: 'pointer',
                      fontSize: 16, paddingTop: 22, alignSelf: 'start',
                    }}
                  >✕</button>
                </div>
              </Glass>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <GlassBtn
                onClick={saveAll}
                variant="gold"
                disabled={saving || preview.length === 0}
                style={{ flex: 1, minWidth: 160, padding: '12px 20px' }}
              >
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

// ─── UTILS ───────────────────────────────────────────────────────────────────
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = e => resolve(e.target.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const fileToText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = e => resolve(e.target.result)
  reader.onerror = reject
  reader.readAsText(file, 'utf-8')
})

// ─── ROOT APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined)
  const [screen, setScreen] = useState('home')
  const [activeFolder, setActiveFolder] = useState(null)
  const [activeSubfolder, setActiveSubfolder] = useState(null)

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), [])

  // Loading
  if (user === undefined) {
    return (
      <div style={{
        minHeight: '100vh', background: C.bgGrad,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: C.subtext, fontSize: 14 }}>Wird geladen…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgGrad, position: 'relative' }}>
      <WaterCanvas />
      <div style={{ position: 'relative', zIndex: 1 }}>

        {!user && <LoginScreen />}

        {user && screen === 'home' && (
          <HomeScreen
            user={user}
            onOpenFolder={f => { setActiveFolder(f); setScreen('folder') }}
          />
        )}

        {user && screen === 'folder' && activeFolder && (
          <FolderScreen
            user={user}
            folder={activeFolder}
            onBack={() => { setScreen('home'); setActiveFolder(null) }}
            onOpenSubfolder={sf => { setActiveSubfolder(sf); setScreen('subfolder') }}
          />
        )}

        {user && screen === 'subfolder' && activeFolder && activeSubfolder && (
          <SubfolderScreen
            user={user}
            folder={activeFolder}
            subfolder={activeSubfolder}
            onBack={() => { setScreen('folder'); setActiveSubfolder(null) }}
          />
        )}

      </div>
    </div>
  )
}
