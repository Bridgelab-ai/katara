import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, addDoc, getDocs, deleteDoc, doc, limit,
  serverTimestamp, query, orderBy, updateDoc, setDoc, getDoc, increment, onSnapshot,
  where, deleteField,
} from 'firebase/firestore'
import { auth, db, provider } from './firebase'
import './App.css'

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:       '#0E111A',
  s1:       '#141926',   // surface base
  s2:       '#1A2030',   // surface elevated
  s3:       '#20283A',   // surface hover / popup
  s4:       '#28334A',   // surface active
  border:   '#2A3348',
  borderHov:'#364360',
  acc:      '#4F8EF7',
  accHov:   '#3B7BF0',
  accDim:   'rgba(79,142,247,0.12)',
  accGlow:  'rgba(79,142,247,0.22)',
  text:     '#ECF0F9',
  textSub:  '#7E8FAE',
  textDim:  '#4A5675',
  green:    '#34D399',
  greenDim: 'rgba(52,211,153,0.12)',
  red:      '#F87171',
  redDim:   'rgba(248,113,113,0.12)',
  amber:    '#FBBF24',
  r:        '8px',
  r2:       '12px',
  r3:       '16px',
}

// ─── LANGUAGE STRINGS ─────────────────────────────────────────────────────────
const LANG = {
  de: {
    back: 'Zurück', home: 'Meine Kategorien', newCategory: '+ Neue Kategorie',
    noCategories: 'Noch keine Kategorien',
    noCategoriesHint: 'Erstelle deine erste Hauptkategorie,\nz.B. "RiL 301" oder "DB Cargo".',
    groups: 'Gruppen', subgroups: 'Untergruppen', cards: 'Karten',
    learn: '▶ Lernen', newGroup: '+ Neue Gruppe', newSubgroup: '+ Neue Untergruppe',
    addCard: '+ Karte', kiCreate: '📥 Karten erstellen', kiGenerate: '✦ KI generieren',
    rename: 'Umbenennen', delete: 'Löschen', create: 'Erstellen', cancel: 'Abbrechen',
    save: 'Speichern', saveChanges: 'Änderungen speichern', settings: 'Einstellungen',
    signOut: 'Abmelden', language: 'Sprache', dailyGoal: 'Tagesziel (Karten)',
    defaultMode: 'Standard-Lernmodus', accountInfo: 'Konto',
    saved: 'Gespeichert', saving: 'Speichert…', cardsUnit: 'Karten',
    classic: 'Klassisch', kiSelect: 'KI-Auswahl',
    searchPlaceholder: 'Kategorien suchen…',
    emptyCards: 'Noch keine Karten', emptyCardsSub: 'KI-Import oder manuell hinzufügen.',
    lastStudied: 'Gelernt',
  },
  en: {
    back: 'Back', home: 'My Categories', newCategory: '+ New Category',
    noCategories: 'No categories yet',
    noCategoriesHint: 'Create your first main category,\ne.g. "RiL 301" or "DB Cargo".',
    groups: 'Groups', subgroups: 'Subgroups', cards: 'Cards',
    learn: '▶ Learn', newGroup: '+ New Group', newSubgroup: '+ New Subgroup',
    addCard: '+ Card', kiCreate: '📥 Create Cards', kiGenerate: '✦ AI Generate',
    rename: 'Rename', delete: 'Delete', create: 'Create', cancel: 'Cancel',
    save: 'Save', saveChanges: 'Save Changes', settings: 'Settings',
    signOut: 'Sign Out', language: 'Language', dailyGoal: 'Daily Goal (cards)',
    defaultMode: 'Default Learning Mode', accountInfo: 'Account',
    saved: 'Saved', saving: 'Saving…', cardsUnit: 'cards',
    classic: 'Classic', kiSelect: 'AI Selection',
    searchPlaceholder: 'Search categories…',
    emptyCards: 'No cards yet', emptyCardsSub: 'Import with AI or add manually.',
    lastStudied: 'Studied',
  },
}
const LangContext = createContext(LANG.de)
const useT = () => useContext(LangContext)

// ─── TIPS CONTEXT ─────────────────────────────────────────────────────────────
const TipsContext = createContext({ dismissed: new Set(), dismiss: () => {} })
const useTips = () => useContext(TipsContext)

const TIPS = {
  'ki-import': {
    title: '📥 KI-Kartengenerator',
    body: 'Lade Dateien hoch (Bilder, PDFs, Text) oder gib eine Anweisung — die KI erstellt automatisch Lernkarten. Du kannst alle Karten vor dem Speichern bearbeiten und Ziel-Ordner wählen.',
  },
  'lernen': {
    title: '▶ Lernmodus',
    body: 'Karte aufdecken, dann ✓ Gewusst oder ✗ Nochmal klicken. KI-Auswahl wählt automatisch die wichtigsten Karten. Falsche Karten erscheinen am Ende mit KI-Merkhilfen.',
  },
  'teilen': {
    title: '🎁 Kartenset teilen',
    body: 'Deine Karten werden vollständig in die App deines Partners kopiert. Änderungen danach werden nicht synchronisiert — es ist eine einmalige Kopie.',
  },
}

// ─── PARTNER CONTEXT ──────────────────────────────────────────────────────────
const PartnerContext = createContext({ partnerUid: null, partnerName: null })
const usePartner = () => useContext(PartnerContext)

// ─── SCHOOL MODE CONSTANTS ────────────────────────────────────────────────────
const SCHOOL_GRADES = ['Vorschule', ...Array.from({ length: 12 }, (_, i) => `Klasse ${i + 1}`)]
const SCHOOL_LANGS  = [
  { id: 'de',    label: '🇩🇪 Deutsch' },
  { id: 'en',    label: '🇬🇧 Englisch' },
  { id: 'de+en', label: '🇩🇪+🇬🇧 Beide' },
]
const SCHOOL_COUNTRIES = [
  { id: 'de', flag: '🇩🇪', name: 'Deutschland',  curriculum: 'KMK'                },
  { id: 'ke', flag: '🇰🇪', name: 'Kenia',         curriculum: 'CBC'                },
  { id: 'at', flag: '🇦🇹', name: 'Österreich',    curriculum: 'BMBWF'              },
  { id: 'ch', flag: '🇨🇭', name: 'Schweiz',       curriculum: 'LP21'               },
  { id: 'gb', flag: '🇬🇧', name: 'UK',            curriculum: 'National Curriculum' },
  { id: 'us', flag: '🇺🇸', name: 'USA',           curriculum: 'Common Core'        },
  { id: 'other', flag: '🌍', name: 'Andere',       curriculum: ''                   },
]

// ─── UTILS ────────────────────────────────────────────────────────────────────
const toBase64 = f => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(f)
})
const toText = f => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(f, 'utf-8')
})
const fmtDate = ts => {
  if (!ts?.seconds) return ''
  const d = new Date(ts.seconds * 1000)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
const loadDocs = async (path) => {
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'asc')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}
// Recursively collect all cards under a Hauptkategorie (for export)
const collectAllCards = async (uid, catId) => {
  const base = `users/${uid}/categories/${catId}`
  const cards = []
  cards.push(...await loadDocs(`${base}/cards`))
  const subcats = await loadDocs(`${base}/subcategories`)
  for (const sub of subcats) {
    cards.push(...await loadDocs(`${base}/subcategories/${sub.id}/cards`))
    const subsubs = await loadDocs(`${base}/subcategories/${sub.id}/subsubcategories`)
    for (const ss of subsubs) {
      cards.push(...await loadDocs(`${base}/subcategories/${sub.id}/subsubcategories/${ss.id}/cards`))
    }
  }
  return cards
}
const countDocs = async (path) => {
  try { const snap = await getDocs(collection(db, path)); return snap.size }
  catch { return 0 }
}
const getLastReviewed = async (path) => {
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('lastReviewed', 'desc'), limit(1)))
    if (snap.empty) return null
    return snap.docs[0].data().lastReviewed ?? null
  } catch { return null }
}

const enrichCategoryData = async (uid, catId) => {
  const catPath = `users/${uid}/categories/${catId}`
  try {
    const subcatSnap = await getDocs(collection(db, `${catPath}/subcategories`))
    const subcatIds = subcatSnap.docs.map(d => d.id)
    const [directCards, ...subcatCounts] = await Promise.all([
      countDocs(`${catPath}/cards`),
      ...subcatIds.map(sid => countDocs(`${catPath}/subcategories/${sid}/cards`)),
    ])
    const cardCount = directCards + subcatCounts.reduce((a, b) => a + b, 0)
    const [directLast, ...subcatLasts] = await Promise.all([
      getLastReviewed(`${catPath}/cards`),
      ...subcatIds.map(sid => getLastReviewed(`${catPath}/subcategories/${sid}/cards`)),
    ])
    const allLasts = [directLast, ...subcatLasts].filter(Boolean)
    const lastStudied = allLasts.length > 0
      ? allLasts.reduce((a, b) => ((a?.seconds || 0) > (b?.seconds || 0) ? a : b))
      : null
    return { groupCount: subcatIds.length, cardCount, lastStudied }
  } catch { return { groupCount: 0, cardCount: 0, lastStudied: null } }
}

// ─── GLOBAL STATS ─────────────────────────────────────────────────────────────
const updateGlobalStats = async (uid, cardsAnswered, durationMinutes) => {
  if (!uid || cardsAnswered <= 0) return
  const ref = doc(db, `users/${uid}/globalStats/main`)
  const now = Date.now()
  const today = new Date().toDateString()
  try {
    const snap = await getDoc(ref)
    const data = snap.exists() ? snap.data() : {}
    const lastActive = data.lastActive || 0
    const lastDay = new Date(lastActive).toDateString()
    const streakDays = data.streakDays || 0
    const newStreak = lastDay === today
      ? streakDays
      : (new Date(now - 86400000).toDateString() === lastDay ? streakDays + 1 : 1)
    if (snap.exists()) {
      await updateDoc(ref, {
        totalCards:     increment(cardsAnswered),
        weeklyMinutes:  increment(durationMinutes),
        monthlyMinutes: increment(durationMinutes),
        yearlyMinutes:  increment(durationMinutes),
        totalMinutes:   increment(durationMinutes),
        lastActive: now,
        streakDays: newStreak,
      })
    } else {
      await setDoc(ref, {
        totalCards: cardsAnswered, weeklyMinutes: durationMinutes,
        monthlyMinutes: durationMinutes, yearlyMinutes: durationMinutes,
        totalMinutes: durationMinutes, lastActive: now, streakDays: newStreak,
      }, { merge: true })
    }
  } catch (_) {}
}

// ─── FOLDER MOVE UTILITIES ───────────────────────────────────────────────────
// Move a Hauptkategorie to become a subcategory of another Hauptkategorie.
// Its subcategories become subsubcategories (1-level shift; the 3-level limit
// means the original subsubcategories cannot be preserved — they are dropped).
const moveCatAsSubcat = async (uid, srcCatId, dstCatId) => {
  const srcBase = `users/${uid}/categories/${srcCatId}`
  const srcSnap = await getDoc(doc(db, srcBase))
  if (!srcSnap.exists()) return
  const { id: _id, ...srcData } = { id: srcCatId, ...srcSnap.data() }
  const newRef = await addDoc(
    collection(db, `users/${uid}/categories/${dstCatId}/subcategories`),
    { name: srcData.name, createdAt: serverTimestamp() },
  )
  const dstBase = `users/${uid}/categories/${dstCatId}/subcategories/${newRef.id}`
  const cards = await loadDocs(`${srcBase}/cards`)
  for (const c of cards) { const { id: _, ...d } = c; await addDoc(collection(db, `${dstBase}/cards`), d); await deleteDoc(doc(db, `${srcBase}/cards/${c.id}`)) }
  const subcats = await loadDocs(`${srcBase}/subcategories`)
  for (const sub of subcats) {
    const { id: subId, ...subData } = sub
    const newSubRef = await addDoc(collection(db, `${dstBase}/subsubcategories`), { name: subData.name, createdAt: serverTimestamp() })
    const subCards = await loadDocs(`${srcBase}/subcategories/${subId}/cards`)
    for (const c of subCards) { const { id: _, ...d } = c; await addDoc(collection(db, `${dstBase}/subsubcategories/${newSubRef.id}/cards`), d); await deleteDoc(doc(db, `${srcBase}/subcategories/${subId}/cards/${c.id}`)) }
    await deleteDoc(doc(db, `${srcBase}/subcategories/${subId}`))
  }
  await deleteDoc(doc(db, srcBase))
}

// Move a subcategory (with all its subsubcategories and cards) to a different
// Hauptkategorie.
const moveSubcatToCat = async (uid, srcCatId, srcSubId, dstCatId) => {
  const srcBase = `users/${uid}/categories/${srcCatId}/subcategories/${srcSubId}`
  const srcSnap = await getDoc(doc(db, srcBase))
  if (!srcSnap.exists()) return
  const newRef = await addDoc(collection(db, `users/${uid}/categories/${dstCatId}/subcategories`), srcSnap.data())
  const dstBase = `users/${uid}/categories/${dstCatId}/subcategories/${newRef.id}`
  const cards = await loadDocs(`${srcBase}/cards`)
  for (const c of cards) { const { id: _, ...d } = c; await addDoc(collection(db, `${dstBase}/cards`), d); await deleteDoc(doc(db, `${srcBase}/cards/${c.id}`)) }
  const subsubs = await loadDocs(`${srcBase}/subsubcategories`)
  for (const ss of subsubs) {
    const { id: ssId, ...ssData } = ss
    const newSsRef = await addDoc(collection(db, `${dstBase}/subsubcategories`), ssData)
    const ssCards = await loadDocs(`${srcBase}/subsubcategories/${ssId}/cards`)
    for (const c of ssCards) { const { id: _, ...d } = c; await addDoc(collection(db, `${dstBase}/subsubcategories/${newSsRef.id}/cards`), d); await deleteDoc(doc(db, `${srcBase}/subsubcategories/${ssId}/cards/${c.id}`)) }
    await deleteDoc(doc(db, `${srcBase}/subsubcategories/${ssId}`))
  }
  await deleteDoc(doc(db, srcBase))
}

// Move a subsubcategory (with its cards) to a different subcategory.
const moveSubsubcatToSub = async (uid, srcCatId, srcSubId, srcSsId, dstCatId, dstSubId) => {
  const srcBase = `users/${uid}/categories/${srcCatId}/subcategories/${srcSubId}/subsubcategories/${srcSsId}`
  const srcSnap = await getDoc(doc(db, srcBase))
  if (!srcSnap.exists()) return
  const newRef = await addDoc(collection(db, `users/${uid}/categories/${dstCatId}/subcategories/${dstSubId}/subsubcategories`), srcSnap.data())
  const dstBase = `users/${uid}/categories/${dstCatId}/subcategories/${dstSubId}/subsubcategories/${newRef.id}`
  const cards = await loadDocs(`${srcBase}/cards`)
  for (const c of cards) { const { id: _, ...d } = c; await addDoc(collection(db, `${dstBase}/cards`), d); await deleteDoc(doc(db, `${srcBase}/cards/${c.id}`)) }
  await deleteDoc(doc(db, srcBase))
}

// Write to partner's sharedFromPartner inbox
const sendItemToPartner = async (partnerUid, fromUid, fromName, name, cards) => {
  const cleanCards = cards.map(({ id: _id, _count: _c, ...rest }) => rest)
  await addDoc(collection(db, `users/${partnerUid}/sharedFromPartner`), {
    name, fromUid, fromName: fromName || fromUid,
    cards: cleanCards,
    sentAt: serverTimestamp(),
  })
}

// ─── CATEGORY COLORS ─────────────────────────────────────────────────────────
const CAT_COLORS = [
  { id: 'blue',   hex: '#4F8EF7' },
  { id: 'purple', hex: '#A78BFA' },
  { id: 'green',  hex: '#34D399' },
  { id: 'amber',  hex: '#FBBF24' },
  { id: 'rose',   hex: '#F87171' },
]
const catColor = id => CAT_COLORS.find(c => c.id === id)?.hex ?? CAT_COLORS[0].hex

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = 'primary', disabled = false, style = {}, full = false }) => {
  const [hov, setHov] = useState(false)

  const variants = {
    primary: {
      background: disabled ? T.s3 : hov ? T.accHov : T.acc,
      color: disabled ? T.textDim : '#fff',
      border: 'none',
      boxShadow: !disabled && hov ? `0 0 16px ${T.accGlow}` : 'none',
    },
    secondary: {
      background: hov ? T.s3 : T.s2,
      color: T.text,
      border: `1px solid ${hov ? T.borderHov : T.border}`,
    },
    ghost: {
      background: hov ? T.accDim : 'transparent',
      color: T.acc,
      border: `1px solid ${hov ? T.acc : 'rgba(79,142,247,0.35)'}`,
    },
    danger: {
      background: hov ? T.redDim : 'transparent',
      color: T.red,
      border: `1px solid ${hov ? T.red : 'rgba(248,113,113,0.35)'}`,
    },
    success: {
      background: hov ? '#2BBF87' : T.green,
      color: '#0A2A1E',
      border: 'none',
      fontWeight: 700,
    },
  }

  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, padding: '9px 18px', borderRadius: T.r, fontSize: 14,
        fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', opacity: disabled ? 0.45 : 1,
        width: full ? '100%' : 'auto', letterSpacing: 0.2,
        ...(variants[variant] || variants.primary),
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ─── BRIDGELAB NAV BUTTON ─────────────────────────────────────────────────────
const BridgelabBtn = () => {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => { window.location.href = 'https://vocara-peach.vercel.app' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'fixed', top: 12, left: 12, zIndex: 9999,
        background: hov ? T.s3 : T.s2,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        color: hov ? T.text : T.textSub,
        borderRadius: T.r, fontSize: 12, fontWeight: 600,
        padding: '5px 11px', cursor: 'pointer',
        transition: 'all 0.15s', letterSpacing: 0.3,
        backdropFilter: 'blur(8px)',
      }}
    >
      ← Bridgelab
    </button>
  )
}

const Badge = ({ children, color = T.acc }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 20,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    background: `${color}22`, color,
  }}>
    {children}
  </span>
)

// ─── TTS BUTTON ───────────────────────────────────────────────────────────────
const detectLang = text => {
  if (!text) return 'de-DE'
  if (/[äöüÄÖÜß]/.test(text)) return 'de-DE'
  if (/\b(und|oder|der|die|das|ist|sind|hat|haben|wird|werden|ein|eine|kein)\b/i.test(text)) return 'de-DE'
  if (/\b(the|is|are|have|has|will|can|this|that|and|or|not)\b/i.test(text)) return 'en-GB'
  return 'de-DE'
}

const TtsBtn = ({ text, lang, label }) => {
  const [active, setActive] = useState(false)
  const resolvedLang = lang || detectLang(text)
  const play = e => {
    e.stopPropagation()
    const ss = window.speechSynthesis
    if (!ss) return
    ss.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = resolvedLang
    u.rate = 0.92
    u.onend = () => setActive(false)
    u.onerror = () => setActive(false)
    setActive(true)
    // Small delay required after cancel() in Chrome/Chromium
    setTimeout(() => ss.speak(u), 120)
  }
  return (
    <button
      onClick={play}
      title={`Vorlesen (${lang})`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: active ? T.accDim : 'none',
        border: `1px solid ${active ? T.acc : T.border}`,
        color: active ? T.acc : T.textSub,
        borderRadius: T.r, padding: '3px 9px', fontSize: 12,
        cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.acc; e.currentTarget.style.color = T.acc }}
      onMouseLeave={e => {
        if (!active) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub }
      }}
    >
      🔊{label ? ` ${label}` : ''}
    </button>
  )
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
const Modal = ({ children, onClose, width = 480 }) => (
  <div
    onClick={e => e.target === e.currentTarget && onClose()}
    style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(8,11,20,0.82)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
  >
    <div
      className="fade-in"
      style={{
        width: '100%', maxWidth: width,
        background: T.s2,
        border: `1px solid ${T.border}`,
        borderRadius: T.r3,
        padding: 28,
        boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
      }}
    >
      {children}
    </div>
  </div>
)

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const Logo = ({ size = 26 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
    <div style={{
      fontSize: size,
      fontFamily: "'Exo 2', sans-serif",
      fontWeight: 800,
      background: `linear-gradient(135deg, ${T.acc}, #7BB8FF)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      letterSpacing: 1,
    }}>
      Katara
    </div>
    <div style={{ fontSize: Math.max(8, size * 0.31), color: T.textDim, letterSpacing: 1.8, marginTop: 2 }}>
      BY BRIDGELAB
    </div>
  </div>
)

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const Breadcrumb = ({ crumbs, onNavigate }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', overflow: 'hidden' }}>
    {crumbs.map((c, i) => (
      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {i > 0 && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke={T.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        <span
          onClick={onNavigate && i < crumbs.length - 1 ? () => onNavigate(i) : undefined}
          style={{
            fontSize: 13,
            color: i === crumbs.length - 1 ? T.text : T.textSub,
            fontWeight: i === crumbs.length - 1 ? 600 : 400,
            cursor: onNavigate && i < crumbs.length - 1 ? 'pointer' : 'default',
            whiteSpace: 'nowrap', maxWidth: 160,
            overflow: 'hidden', textOverflow: 'ellipsis',
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => { if (onNavigate && i < crumbs.length - 1) e.target.style.color = T.acc }}
          onMouseLeave={e => { if (onNavigate && i < crumbs.length - 1) e.target.style.color = T.textSub }}
        >
          {c}
        </span>
      </span>
    ))}
  </div>
)

// ─── STICKY HEADER ────────────────────────────────────────────────────────────
const Header = ({ crumbs, onBack, right, title, onNavigate }) => {
  const t = useT()
  return (
  <div style={{
    position: 'sticky', top: 0, zIndex: 50,
    background: `${T.bg}F2`,
    backdropFilter: 'blur(14px)',
    borderBottom: `1px solid ${T.border}`,
  }}>
    {/* Row 1: Bridgelab · Logo · spacer */}
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '7px 24px',
      borderBottom: `1px solid ${T.border}44`,
    }}>
      <a
        href="https://vocara-peach.vercel.app"
        style={{
          fontSize: 12, color: T.textDim, textDecoration: 'none',
          fontWeight: 500, letterSpacing: 0.3, transition: 'color 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = T.textSub}
        onMouseLeave={e => e.currentTarget.style.color = T.textDim}
      >← Bridgelab</a>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <Logo size={19} />
      </div>
      <div style={{ width: 72, flexShrink: 0 }} />
    </div>
    {/* Row 2: Back · Breadcrumb/Title · Actions */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 24px',
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none',
            color: T.textSub, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', padding: '3px 0', flexShrink: 0,
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.acc}
          onMouseLeave={e => e.currentTarget.style.color = T.textSub}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.back}
        </button>
      )}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {crumbs
          ? <Breadcrumb crumbs={crumbs} onNavigate={onNavigate} />
          : <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</span>
        }
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{right}</div>}
    </div>
  </div>
  )
}

// ─── CONTEXT MENU ─────────────────────────────────────────────────────────────
const CtxMenu = ({ items }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          background: open ? T.s4 : 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.12)',
          cursor: 'pointer', color: '#fff', fontSize: 17,
          transition: 'all 0.12s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = T.s4; e.currentTarget.style.borderColor = T.border }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' } }}
      >
        ···
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200,
          background: T.s3, border: `1px solid ${T.border}`,
          borderRadius: T.r2, minWidth: 172, overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        }}>
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.action(); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 14px',
                background: 'none', border: 'none',
                color: item.danger ? T.red : T.text,
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer', textAlign: 'left',
                borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = item.danger ? T.redDim : T.s4}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CREATE / RENAME MODALS ───────────────────────────────────────────────────
const CreateModal = ({ title, placeholder, onSave, onClose, withColor = false }) => {
  const [name,  setName]  = useState('')
  const [color, setColor] = useState('blue')
  const t = useT()
  const submit = async () => { if (name.trim()) { await onSave(name.trim(), color); onClose() } }
  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 20 }}>{title}</h3>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 }}>Name</div>
      <input
        autoFocus value={name}
        onChange={e => setName(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
        style={{ marginBottom: withColor ? 18 : 20 }}
      />
      {withColor && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>Farbe</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {CAT_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: c.hex, cursor: 'pointer',
                  border: color === c.id ? `3px solid ${T.text}` : '3px solid transparent',
                  outline: color === c.id ? `2px solid ${c.hex}` : 'none',
                  outlineOffset: 2,
                  transition: 'all 0.12s',
                  boxShadow: color === c.id ? `0 0 8px ${c.hex}66` : 'none',
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={submit} disabled={!name.trim()} full>{t.create}</Btn>
        <Btn onClick={onClose} variant="secondary" style={{ flexShrink: 0, padding: '9px 16px' }}>{t.cancel}</Btn>
      </div>
    </Modal>
  )
}

const RenameModal = ({ current, onSave, onClose }) => {
  const [val, setVal] = useState(current)
  const t = useT()
  const submit = () => { if (val.trim()) { onSave(val.trim()); onClose() } }
  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 20 }}>{t.rename}</h3>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 }}>Name</div>
      <input
        autoFocus value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Name…"
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
        style={{ marginBottom: 20 }}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={submit} disabled={!val.trim()} full>{t.save}</Btn>
        <Btn onClick={onClose} variant="secondary" style={{ flexShrink: 0, padding: '9px 16px' }}>{t.cancel}</Btn>
      </div>
    </Modal>
  )
}

// ─── CONFIRM SEND MODAL ───────────────────────────────────────────────────────
// Self-contained: fetches partner live on open, handles all states internally
const SendToPartnerModal = ({ uid, displayName, name, getCards, onClose }) => {
  const [step,    setStep]    = useState('loading') // loading|no-partner|confirm|sending|done
  const [partner, setPartner] = useState(null)

  useEffect(() => {
    getDoc(doc(db, `users/${uid}/profile/main`))
      .then(snap => {
        if (snap.exists() && snap.data().partnerUid) {
          setPartner({ uid: snap.data().partnerUid, name: snap.data().partnerName || 'Partner' })
          setStep('confirm')
        } else {
          setStep('no-partner')
        }
      })
      .catch(() => setStep('no-partner'))
  }, [uid])

  const send = async () => {
    if (!partner) return
    setStep('sending')
    try {
      const cards = await getCards()
      await sendItemToPartner(partner.uid, uid, displayName, name, cards)
      setStep('done')
      setTimeout(onClose, 1400)
    } catch (_) { setStep('confirm') }
  }

  return (
    <Modal onClose={step !== 'sending' ? onClose : () => {}} width={380}>
      {step === 'loading' && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: T.textSub, fontSize: 14 }}>Wird geladen…</div>
      )}
      {step === 'no-partner' && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12 }}>📤 An Partner senden</h3>
          <p style={{ fontSize: 14, color: T.textSub, marginBottom: 20, lineHeight: 1.7 }}>
            Kein Partner verbunden.<br />
            <span style={{ fontSize: 12, color: T.textDim }}>Gehe zu Einstellungen, um einen Partner zu verknüpfen.</span>
          </p>
          <Btn onClick={onClose} variant="secondary" full>Schließen</Btn>
        </>
      )}
      {step === 'confirm' && (
        <>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 12 }}>📤 An Partner senden</h3>
          <p style={{ fontSize: 14, color: T.textSub, marginBottom: 22, lineHeight: 1.6 }}>
            <strong style={{ color: T.text }}>{name}</strong> an <strong style={{ color: T.text }}>{partner?.name}</strong> senden?
            <br />
            <span style={{ fontSize: 12, color: T.textDim }}>Partner erhält eine Benachrichtigung zum Annehmen.</span>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={send} full>✓ Senden</Btn>
            <Btn onClick={onClose} variant="secondary" style={{ flexShrink: 0, padding: '9px 16px' }}>Abbrechen</Btn>
          </div>
        </>
      )}
      {step === 'sending' && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: T.textSub, fontSize: 14 }}>Wird gesendet…</div>
      )}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10, color: T.green }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>Gesendet!</div>
        </div>
      )}
    </Modal>
  )
}

// ─── INCOMING SHARE MODAL ─────────────────────────────────────────────────────
const IncomingShareModal = ({ item, onAccept, onDecline }) => {
  const [loading, setLoading] = useState(false)
  const handle = async accept => {
    setLoading(true)
    try { if (accept) await onAccept(item); else await onDecline(item) } catch (_) {}
    setLoading(false)
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800,
      background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="fade-in" style={{
        width: '100%', maxWidth: 400,
        background: T.s2, border: `1px solid ${T.border}`,
        borderRadius: T.r3, padding: 28,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🎁</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          {item.fromName} hat dir etwas geschickt!
        </h3>
        <p style={{ fontSize: 14, color: T.textSub, marginBottom: 6, lineHeight: 1.6 }}>
          <strong style={{ color: T.text }}>{item.name}</strong>
        </p>
        {item.cards?.length > 0 && (
          <p style={{ fontSize: 12, color: T.textDim, marginBottom: 22 }}>
            {item.cards.length} {item.cards.length === 1 ? 'Karte' : 'Karten'}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn onClick={() => handle(true)} disabled={loading} full variant="success">
            {loading ? 'Wird verarbeitet…' : '✓ Annehmen'}
          </Btn>
          <Btn onClick={() => handle(false)} disabled={loading} variant="danger" style={{ flexShrink: 0, padding: '9px 16px' }}>
            ✗ Ablehnen
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── MASTERY BAR ──────────────────────────────────────────────────────────────
const MasteryBar = ({ value, height = 4, style = {} }) => {
  const color = value >= 80 ? T.green : value >= 40 ? T.acc : T.textDim
  return (
    <div style={{ height, background: T.s4, borderRadius: height, overflow: 'hidden', ...style }}>
      <div
        className="progress-fill"
        style={{ height: '100%', width: `${value}%`, background: color, borderRadius: height }}
      />
    </div>
  )
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
    {children}
  </div>
)

// ─── FOLDER CARD (grid tile — Level 1) ───────────────────────────────────────
const FolderCard = ({ item, onClick, onRename, onDelete, onShare, onMove, onExport, onSendToPartner }) => {
  const [hov, setHov] = useState(false)
  const t = useT()
  const groupCount = item._count ?? 0
  const cardCount  = item._cardCount ?? 0
  const color = catColor(item.color || 'blue')
  const colorDim = `${color}1A`

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: hov ? T.s3 : T.s2,
        border: `1px solid ${hov ? color + '55' : T.border}`,
        borderRadius: T.r2,
        padding: '20px 18px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        minHeight: 120,
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: hov ? `0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px ${color}22` : 'none',
        borderTop: `3px solid ${color}`,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 9,
        background: colorDim,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M1.5 4.5C1.5 3.672 2.172 3 3 3H7L8.5 4.5H15C15.828 4.5 16.5 5.172 16.5 6V13.5C16.5 14.328 15.828 15 15 15H3C2.172 15 1.5 14.328 1.5 13.5V4.5Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: 6 }}>
          {item.name}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.textDim }}>
            {groupCount} {groupCount === 1 ? 'Gruppe' : 'Gruppen'}
          </span>
          {cardCount > 0 && (
            <span style={{ fontSize: 12, color, fontWeight: 600 }}>
              · {cardCount} {t.cardsUnit}
            </span>
          )}
        </div>
      </div>

      {/* Last studied */}
      {(item._lastStudied || item.updatedAt) && (
        <div style={{ fontSize: 11, color: T.textDim }}>
          {item._lastStudied
            ? `${t.lastStudied}: ${fmtDate(item._lastStudied)}`
            : fmtDate(item.updatedAt)
          }
        </div>
      )}

      {/* SharedBy badge */}
      {item.sharedBy && (
        <div style={{ fontSize: 11, color: T.textSub, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>🎁</span>
          <span>Von {item.sharedBy.name}</span>
        </div>
      )}

      {/* Context menu — always visible */}
      <div
        style={{ position: 'absolute', top: 10, right: 10 }}
        onClick={e => e.stopPropagation()}
      >
        <CtxMenu items={[
          { label: t.rename,                                  action: onRename },
          ...(onMove   ? [{ label: '↗ Verschieben',         action: onMove   }] : []),
          ...(onExport ? [{ label: '📤 Exportieren',        action: onExport }] : []),
          { label: '📤 An Partner senden', action: onSendToPartner },
          ...(onShare  ? [{ label: '🎁 Mit Partner teilen', action: onShare  }] : []),
          { label: t.delete, action: onDelete, danger: true },
        ]} />
      </div>
    </div>
  )
}

// ─── FOLDER ROW (list — Levels 2 & 3) ────────────────────────────────────────
const FolderRow = ({ item, onClick, onRename, onDelete, countLabel, accentColor, onLearn, onMove, onExport, onSendToPartner }) => {
  const [hov, setHov] = useState(false)
  const t = useT()
  const color = accentColor || T.acc

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: hov ? T.s3 : T.s2,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderRadius: T.r2,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 8,
        borderLeft: `3px solid ${color}55`,
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
          <path d="M1.5 3.5C1.5 2.672 2.172 2 3 2H5.5L7 3.5H12C12.828 3.5 13.5 4.172 13.5 5V11.5C13.5 12.328 12.828 13 12 13H3C2.172 13 1.5 12.328 1.5 11.5V3.5Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{item.name}</div>
        {countLabel && (
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{countLabel}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {/* Learn button */}
        {onLearn && (
          <button
            onClick={e => { e.stopPropagation(); onLearn() }}
            title={t.learn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 7,
              background: hov ? T.green : `${T.green}22`,
              border: `1px solid ${hov ? T.green : `${T.green}44`}`,
              color: hov ? '#0A2A1E' : T.green,
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >▶</button>
        )}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: hov ? 0.6 : 0.2, transition: 'opacity 0.15s' }}>
          <path d="M5 2.5L9.5 7L5 11.5" stroke={T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div onClick={e => e.stopPropagation()}>
          <CtxMenu items={[
            { label: t.rename,                                 action: onRename },
            ...(onMove   ? [{ label: '↗ Verschieben',  action: onMove   }] : []),
            ...(onExport ? [{ label: '📤 Exportieren', action: onExport }] : []),
            { label: '📤 An Partner senden', action: onSendToPartner },
            { label: t.delete, action: onDelete, danger: true },
          ]} />
        </div>
      </div>
    </div>
  )
}

// ─── CARD LIST ITEM ───────────────────────────────────────────────────────────
const CardItem = ({ card, onEdit, onDelete, onMove, onSendToPartner }) => {
  const [hov, setHov] = useState(false)
  const m = card.mastery || 0
  const mColor = m >= 3 ? T.green : m >= 2 ? T.acc : m >= 1 ? T.red : T.textDim

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.s3 : T.s2,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderLeft: m > 0 ? `3px solid ${mColor}88` : `3px solid ${T.border}`,
        borderRadius: T.r2,
        padding: '11px 14px',
        transition: 'background 0.15s, border-color 0.15s',
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 8,
      }}
    >
      {/* Front image */}
      {card.image && (
        <img src={card.image} alt="" style={{
          width: 38, height: 38, objectFit: 'cover',
          borderRadius: 6, flexShrink: 0, border: `1px solid ${T.border}`,
        }} />
      )}

      {/* Content: front + back preview */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.front || '(Bild)'}
        </div>
        {card.back && (
          <div style={{ fontSize: 12, color: T.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            → {card.back}{card.backShort ? ` · ${card.backShort}` : ''}
          </div>
        )}
        {(card.pronunciation_de || card.pronunciation_en) && (
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>
            {card.pronunciation_de && `🇩🇪 ${card.pronunciation_de}`}
            {card.pronunciation_de && card.pronunciation_en && ' · '}
            {card.pronunciation_en && `🇬🇧 ${card.pronunciation_en}`}
          </div>
        )}
      </div>

      {/* Mastery + actions — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {m > 0 && <Badge color={mColor}>{['','✗','✓','★'][m] || m}</Badge>}
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          title="Bearbeiten"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, fontSize: 14, padding: '4px 6px', borderRadius: 5, transition: 'color 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.color = T.acc}
          onMouseLeave={e => e.currentTarget.style.color = T.textSub}
        >✏</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Löschen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, fontSize: 15, padding: '4px 6px', borderRadius: 5, transition: 'color 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.color = T.red}
          onMouseLeave={e => e.currentTarget.style.color = T.textDim}
        >🗑</button>
        <div onClick={e => e.stopPropagation()}>
          <CtxMenu items={[
            ...(onMove ? [{ label: '↗ Verschieben', action: () => onMove(card) }] : []),
            { label: '📤 An Partner senden', action: () => onSendToPartner?.(card) },
          ]} />
        </div>
      </div>
    </div>
  )
}

// ─── IMG PREVIEW ──────────────────────────────────────────────────────────────
const ImgPreview = ({ src, onRemove }) => (
  <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
    <img src={src} alt="" style={{
      maxWidth: '100%', maxHeight: 80, borderRadius: 7,
      display: 'block', border: `1px solid ${T.border}`,
    }} />
    <button
      onClick={onRemove}
      style={{
        position: 'absolute', top: -7, right: -7,
        width: 20, height: 20, borderRadius: '50%',
        background: T.red, border: 'none', color: '#fff',
        fontSize: 10, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700,
      }}
    >✕</button>
  </div>
)

// ─── CARD MODAL ───────────────────────────────────────────────────────────────
const CardModal = ({ initial, onSave, onClose }) => {
  const [front,           setFront]           = useState(initial?.front           || '')
  const [image,           setImage]           = useState(initial?.image           || null)
  const [back,            setBack]            = useState(initial?.back            || '')
  const [backShort,       setBackShort]       = useState(initial?.backShort       || '')
  const [backImage,       setBackImage]       = useState(initial?.backImage       || null)
  const [pronunciationDe, setPronunciationDe] = useState(initial?.pronunciation_de || '')
  const [pronunciationEn, setPronunciationEn] = useState(initial?.pronunciation_en || '')
  const [saving,          setSaving]          = useState(false)

  const pickImg = setter => e => {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader(); r.onload = ev => setter(ev.target.result); r.readAsDataURL(f)
  }

  const save = async () => {
    if (!back.trim() && !front.trim() && !image) return
    setSaving(true)
    await onSave({
      front: front.trim(), image: image || null,
      back: back.trim(), backShort: backShort.trim(), backImage: backImage || null,
      pronunciation_de: pronunciationDe.trim(), pronunciation_en: pronunciationEn.trim(),
    })
    setSaving(false)
  }

  const SideLabel = ({ children }) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, marginBottom: 12, color: T.acc }}>{children}</div>
  )

  const FieldLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>
  )

  return (
    <Modal onClose={onClose} width={660}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text }}>
          {initial ? 'Karte bearbeiten' : 'Neue Karte'}
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Front */}
        <div style={{ background: T.bg, borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
          <SideLabel>VORDERSEITE</SideLabel>
          <FieldLabel>Text</FieldLabel>
          <textarea value={front} onChange={e => setFront(e.target.value)} placeholder="Begriff, Signal, Situation…" rows={3} style={{ marginBottom: 14 }} />
          <FieldLabel>Bild (optional)</FieldLabel>
          <input type="file" accept="image/*" onChange={pickImg(setImage)} style={{ fontSize: 12, color: T.textSub }} />
          {image && <ImgPreview src={image} onRemove={() => setImage(null)} />}
        </div>

        {/* Back */}
        <div style={{ background: T.bg, borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
          <SideLabel>RÜCKSEITE</SideLabel>
          <FieldLabel>Langbezeichnung *</FieldLabel>
          <textarea value={back} onChange={e => setBack(e.target.value)} placeholder="z.B. Hauptsignal Hp 0 — Halt" rows={3} style={{ marginBottom: 10 }} />
          <FieldLabel>Kurzbezeichnung</FieldLabel>
          <input value={backShort} onChange={e => setBackShort(e.target.value)} placeholder="z.B. Hp 0" style={{ marginBottom: 10 }} />
          <FieldLabel>🇩🇪 Aussprache (optional)</FieldLabel>
          <input value={pronunciationDe} onChange={e => setPronunciationDe(e.target.value)} placeholder="z.B. haupt-zig-nahl" style={{ marginBottom: 6 }} />
          <FieldLabel>🇬🇧 Pronunciation (optional)</FieldLabel>
          <input value={pronunciationEn} onChange={e => setPronunciationEn(e.target.value)} placeholder="e.g. howpt-zig-nahl" style={{ marginBottom: 14 }} />
          <FieldLabel>Bild (optional)</FieldLabel>
          <input type="file" accept="image/*" onChange={pickImg(setBackImage)} style={{ fontSize: 12, color: T.textSub }} />
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

// ─── KI IMPORT SCREEN ─────────────────────────────────────────────────────────
// destinations: [{ label, path }] — if omitted, saves everything to cardsPath
const KIImportScreen = ({ cardsPath, destinations = [], onSaved, onClose, onCreateSub }) => {
  const destList = destinations.length > 0 ? destinations : [{ label: 'Hier', path: cardsPath }]

  const [files,       setFiles]       = useState([])
  const [instr,       setInstr]       = useState('')
  const [sortInstr,   setSortInstr]   = useState('')
  const [dropOver,    setDropOver]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [preview,     setPreview]     = useState(null) // [{front,back,backShort,_dest}]
  const [error,       setError]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [dragIdx,     setDragIdx]     = useState(null)
  const [subSuggestions, setSubSuggestions] = useState([]) // suggested folder names
  const [subDismissed,   setSubDismissed]   = useState(false)
  const fileRef = useRef(null)

  const addFiles = newFiles => {
    setFiles(prev => {
      const seen = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...Array.from(newFiles).filter(f => !seen.has(f.name + f.size))]
    })
  }

  const fileIcon = f => {
    const ext = f.name.split('.').pop().toLowerCase()
    if (ext === 'pdf') return '📄'
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️'
    return '📝'
  }

  const generate = async () => {
    if (files.length === 0 && !instr.trim()) return
    setLoading(true); setError(''); setPreview(null)
    try {
      const content = []

      for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase()
        if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
          const b64 = await toBase64(file)
          content.push({ type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64.split(',')[1] } })
        } else if (ext === 'pdf') {
          const b64 = await toBase64(file)
          content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64.split(',')[1] } })
        } else {
          const text = await toText(file)
          content.push({ type: 'text', text: `--- ${file.name} ---\n${text.slice(0, 14000)}` })
        }
      }

      const sortPart = sortInstr.trim() ? `\nSorting instruction: ${sortInstr.trim()}` : ''
      const instrPart = instr.trim() ? `${instr.trim()}\n\n` : ''
      const hasPronunciation = /aussprache|pronunciation/i.test(instr + ' ' + sortInstr)
      const pronunciationPart = hasPronunciation
        ? '\nAlso add fields: pronunciation_de (German phonetic guide, use easy-to-read syllable breaks, not IPA) and pronunciation_en (English phonetic guide) for each card.'
        : ''
      const jsonExample = hasPronunciation
        ? '[{"front":"...","back":"...","backShort":"...","pronunciation_de":"...","pronunciation_en":"..."}]'
        : '[{"front":"...","back":"...","backShort":"..."}]'
      content.push({
        type: 'text',
        text: `${instrPart}Create flashcards from the above content.${sortPart}${pronunciationPart}\n\nReturn ONLY a valid JSON array, no markdown, no explanation:\n${jsonExample}`,
      })

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 4096, messages: [{ role: 'user', content }] }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('KI hat kein gültiges JSON zurückgegeben. Versuche eine genauere Anweisung.')
      const cards = JSON.parse(match[0])
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Keine Karten gefunden.')
      setPreview(cards.map(c => ({ ...c, _dest: destList[0].path })))
      setSubDismissed(false)
      // Ask KI for subcategory suggestions (fire-and-forget, non-blocking)
      fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 120,
          messages: [{ role: 'user', content: `Based on these flashcards, suggest 2-3 subcategory names to organize them. Return ONLY a JSON array of strings, no explanation: ${JSON.stringify(cards.slice(0,15).map(c => c.front))}` }],
        }),
      }).then(r => r.json()).then(d => {
        const txt = d.content?.[0]?.text || ''
        const m = txt.match(/\[[\s\S]*?\]/)
        if (m) {
          const names = JSON.parse(m[0]).filter(n => typeof n === 'string' && n.trim())
          if (names.length > 0) setSubSuggestions(names.slice(0, 3))
        }
      }).catch(() => {})
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const upd = (i, field, val) => setPreview(p => p.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  const saveAll = async () => {
    setSaving(true)
    for (const c of preview) {
      await addDoc(collection(db, c._dest), {
        front: c.front || '', image: null,
        back: c.back || c.front || '', backShort: c.backShort || '',
        pronunciation_de: c.pronunciation_de || '', pronunciation_en: c.pronunciation_en || '',
        backImage: null, correctCount: 0, wrongCount: 0,
        mastery: 0, lastReviewed: null, createdAt: serverTimestamp(),
      })
    }
    setSaving(false)
    onSaved()
  }

  // Card drag-to-reorder
  const onCardDragStart = (e, i) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move' }
  const onCardDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    setPreview(p => {
      const next = [...p]; const [moved] = next.splice(dragIdx, 1); next.splice(i, 0, moved); return next
    })
    setDragIdx(i)
  }
  const onCardDragEnd = () => setDragIdx(null)

  const SLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  )
  const FLabel = ({ children }) => (
    <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, marginBottom: 7 }}>{children}</div>
  )

  return (
    <div className="app-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, overflowY: 'auto' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px 80px' }}>
        <Header title="KI-Kartengenerator" onBack={onClose} />

        <div style={{ padding: '32px 0' }}>
          {!preview ? (
            <div className="fade-in">

              {/* ── Drop zone ── */}
              <SLabel>Dateien hochladen</SLabel>
              <div
                className={`drop-zone${dropOver ? ' drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDropOver(true) }}
                onDragLeave={() => setDropOver(false)}
                onDrop={e => { e.preventDefault(); setDropOver(false); addFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dropOver ? T.acc : T.border}`,
                  borderRadius: T.r2,
                  padding: files.length > 0 ? '18px 24px' : '40px 28px',
                  textAlign: files.length > 0 ? 'left' : 'center',
                  cursor: 'pointer', marginBottom: 10,
                  background: dropOver ? T.accDim : T.s1,
                  transition: 'all 0.15s',
                }}
              >
                {files.length === 0 ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                    <div style={{ color: T.textSub, fontSize: 14, marginBottom: 4 }}>Dateien hier ablegen oder klicken</div>
                    <div style={{ fontSize: 12, color: T.textDim }}>PDF · TXT · CSV · JPG · PNG · WEBP — mehrere Dateien möglich</div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📎</span>
                    <span style={{ fontSize: 13, color: T.textSub }}>
                      {files.length} Datei{files.length !== 1 ? 'en' : ''} — hier klicken um weitere hinzuzufügen
                    </span>
                  </div>
                )}
                <input
                  ref={fileRef} type="file" multiple
                  accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={e => addFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
              </div>

              {/* ── File list ── */}
              {files.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', marginBottom: 4,
                      background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r,
                    }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{fileIcon(f)}</span>
                      <span style={{ flex: 1, fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ fontSize: 12, color: T.textDim, flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        onClick={e => { e.stopPropagation(); setFiles(fs => fs.filter((_, fi) => fi !== i)) }}
                        style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 14, padding: '2px 5px', borderRadius: 4, flexShrink: 0, transition: 'color 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.color = T.red}
                        onMouseLeave={e => e.currentTarget.style.color = T.textDim}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Content instruction ── */}
              <SLabel>Anweisung an die KI</SLabel>
              <textarea
                value={instr}
                onChange={e => setInstr(e.target.value)}
                rows={4}
                placeholder="z.B. Vorderseite = Fachbegriff, Rückseite = Definition. Jeden Begriff als eigene Karte."
                style={{ marginBottom: 16 }}
              />

              {/* ── Sort instruction ── */}
              <SLabel>Sortier-Anweisung (optional)</SLabel>
              <textarea
                value={sortInstr}
                onChange={e => setSortInstr(e.target.value)}
                rows={2}
                placeholder="z.B. Sortiere nach Schwierigkeit: einfach zuerst. Oder: Gruppiere nach Thema."
                style={{ marginBottom: 22 }}
              />

              {error && (
                <div style={{ padding: '12px 16px', marginBottom: 18, borderRadius: T.r, background: T.redDim, border: `1px solid rgba(248,113,113,0.3)`, color: T.red, fontSize: 13 }}>
                  {error}
                </div>
              )}

              <Btn
                onClick={generate}
                disabled={loading || (files.length === 0 && !instr.trim())}
                full style={{ padding: '14px', fontSize: 15 }}
              >
                {loading
                  ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> KI analysiert…</>
                  : '✦  Karten generieren'}
              </Btn>
            </div>

          ) : (
            <div className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 15, color: T.text }}>
                  <strong style={{ color: T.acc }}>{preview.length} Karten</strong> generiert
                </div>
                <Btn onClick={() => setPreview(null)} variant="secondary" style={{ padding: '7px 14px', fontSize: 13 }}>
                  ← Neu generieren
                </Btn>
              </div>
              <p style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>
                Ziehen zum Sortieren · Bearbeiten · ✕ zum Löschen{destList.length > 1 ? ' · Ziel-Ordner per Dropdown wählen' : ''}
              </p>

              {/* KI subcategory suggestions */}
              {subSuggestions.length > 0 && !subDismissed && (
                <div style={{
                  background: T.accDim, border: `1px solid ${T.acc}44`,
                  borderRadius: T.r2, padding: '12px 16px', marginBottom: 18,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.acc, marginBottom: 8, letterSpacing: 0.3 }}>
                      ✦ KI-Vorschlag: Diese Gruppen könnten passen
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {subSuggestions.map(name => (
                        <button
                          key={name}
                          onClick={() => onCreateSub?.(name)}
                          disabled={!onCreateSub}
                          style={{
                            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: onCreateSub ? T.acc : T.s4,
                            color: onCreateSub ? '#fff' : T.textDim,
                            border: 'none', cursor: onCreateSub ? 'pointer' : 'default',
                            transition: 'opacity 0.12s',
                          }}
                          title={onCreateSub ? `Gruppe "${name}" erstellen` : 'Nur auf Ordner-Ebene verfügbar'}
                        >+ {name}</button>
                      ))}
                    </div>
                    {!onCreateSub && (
                      <div style={{ fontSize: 11, color: T.textDim, marginTop: 7 }}>
                        Gruppen können nur auf Unterkategorie-Ebene erstellt werden.
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSubDismissed(true)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 16, padding: '0 2px', flexShrink: 0 }}>✕</button>
                </div>
              )}

              {preview.map((card, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={e => onCardDragStart(e, i)}
                  onDragOver={e => onCardDragOver(e, i)}
                  onDragEnd={onCardDragEnd}
                  style={{
                    background: dragIdx === i ? T.s3 : T.s2,
                    border: `1px solid ${dragIdx === i ? T.acc : T.border}`,
                    borderRadius: T.r2, padding: 14, marginBottom: 8,
                    opacity: dragIdx === i ? 0.65 : 1,
                    transition: 'background 0.1s, border-color 0.1s, opacity 0.1s',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr auto', gap: 12, alignItems: 'start' }}>

                    {/* Drag handle */}
                    <div style={{ paddingTop: 24, color: T.textDim, fontSize: 16, cursor: 'grab', userSelect: 'none', textAlign: 'center' }}>
                      ⠿
                    </div>

                    {/* Front */}
                    <div>
                      <FLabel>VORDERSEITE</FLabel>
                      <textarea
                        value={card.front || ''}
                        onChange={e => upd(i, 'front', e.target.value)}
                        rows={2} placeholder="Vorderseite"
                        style={{ cursor: 'text' }}
                      />
                    </div>

                    {/* Back + optional dest dropdown */}
                    <div>
                      <FLabel>RÜCKSEITE</FLabel>
                      <textarea
                        value={card.back || ''}
                        onChange={e => upd(i, 'back', e.target.value)}
                        rows={2} placeholder="Langbezeichnung"
                        style={{ marginBottom: 8, cursor: 'text' }}
                      />
                      <input
                        value={card.backShort || ''}
                        onChange={e => upd(i, 'backShort', e.target.value)}
                        placeholder="Kurzbezeichnung (optional)"
                      />
                      {(card.pronunciation_de !== undefined || card.pronunciation_en !== undefined) && (
                        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input
                            value={card.pronunciation_de || ''}
                            onChange={e => upd(i, 'pronunciation_de', e.target.value)}
                            placeholder="🇩🇪 Aussprache DE"
                          />
                          <input
                            value={card.pronunciation_en || ''}
                            onChange={e => upd(i, 'pronunciation_en', e.target.value)}
                            placeholder="🇬🇧 Pronunciation EN"
                          />
                        </div>
                      )}
                      {destList.length > 1 && (
                        <select
                          value={card._dest}
                          onChange={e => upd(i, '_dest', e.target.value)}
                          style={{
                            marginTop: 8, width: '100%',
                            background: T.s3, border: `1px solid ${T.border}`,
                            color: T.textSub, borderRadius: T.r,
                            padding: '6px 10px', fontSize: 12, outline: 'none',
                          }}
                        >
                          {destList.map(d => (
                            <option key={d.path} value={d.path}>{d.label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => setPreview(p => p.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 16, paddingTop: 22, transition: 'color 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.color = T.red}
                      onMouseLeave={e => e.currentTarget.style.color = T.textDim}
                    >✕</button>
                  </div>
                </div>
              ))}

              <Btn
                onClick={saveAll}
                disabled={saving || preview.length === 0}
                full style={{ padding: '14px', fontSize: 15, marginTop: 10 }}
              >
                {saving ? 'Speichert…' : `${preview.length} Karten speichern`}
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PHONETIC HINT (for short front text ≤3 chars) ───────────────────────────
const PhoneticHint = ({ text }) => {
  const [phonetic, setPhonetic] = useState(null)  // null=loading, ''=failed, str=ok
  const [active,   setActive]   = useState(false)

  useEffect(() => {
    let cancelled = false
    setPhonetic(null)
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 30,
        messages: [{ role: 'user', content: `How is '${text}' pronounced in German? Return ONLY the phonetic sound as a single word or syllable, no explanation, no example sentence. Example: 'N' → 'En'` }],
      }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setPhonetic(d.content?.[0]?.text?.trim() || '') })
      .catch(() => { if (!cancelled) setPhonetic('') })
    return () => { cancelled = true }
  }, [text])

  const speak = e => {
    e.stopPropagation()
    const ss = window.speechSynthesis
    if (!ss) return
    ss.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'; u.rate = 0.7
    u.onend = () => setActive(false); u.onerror = () => setActive(false)
    setActive(true)
    setTimeout(() => ss.speak(u), 120)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 10 }}>
      <button
        onClick={speak}
        title="Aussprechen"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: active ? T.accDim : 'none',
          border: `1px solid ${active ? T.acc : T.border}`,
          color: active ? T.acc : T.textSub,
          borderRadius: T.r, padding: '3px 10px', fontSize: 12,
          cursor: 'pointer', transition: 'all 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = T.acc; e.currentTarget.style.color = T.acc }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub } }}
      >🔊 DE</button>
      {phonetic === null
        ? <span style={{ fontSize: 11, color: T.textDim }}>…</span>
        : phonetic
          ? <span style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic' }}>/{phonetic}/</span>
          : null
      }
    </div>
  )
}

// ─── MOVE FOLDER MODAL ───────────────────────────────────────────────────────
// mode='pick-cat'    → user picks a Hauptkategorie (for subcat move or cat→subcat)
// mode='pick-subcat' → user picks a Hauptkategorie + Unterkategorie (for subsubcat move)
const MoveFolderModal = ({ uid, mode, excludeId, onPick, onClose }) => {
  const [cats,     setCats]     = useState([])
  const [subcats,  setSubcats]  = useState({}) // catId → subs[]
  const [expanded, setExpanded] = useState({})
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    loadDocs(`users/${uid}/categories`).then(cs => {
      setCats(cs.filter(c => c.id !== excludeId))
      setLoading(false)
    })
  }, [uid, excludeId])

  const toggleSubs = async catId => {
    if (subcats[catId]) {
      setExpanded(e => ({ ...e, [catId]: !e[catId] }))
    } else {
      const subs = await loadDocs(`users/${uid}/categories/${catId}/subcategories`)
      setSubcats(s => ({ ...s, [catId]: subs.filter(s => s.id !== excludeId) }))
      setExpanded(e => ({ ...e, [catId]: true }))
    }
  }

  const PickRow = ({ label, indent = 0, onClick }) => {
    const [hov, setHov] = useState(false)
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: `8px 12px 8px ${12 + indent * 18}px`,
          background: hov ? T.s3 : 'none', border: 'none',
          borderRadius: T.r, color: T.text, fontSize: 13,
          cursor: 'pointer', transition: 'background 0.1s',
        }}
      >{label}</button>
    )
  }

  return (
    <Modal onClose={onClose} width={380}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Verschieben nach…</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      {loading ? (
        <div style={{ color: T.textDim, fontSize: 13, padding: '12px 0' }}>Lädt…</div>
      ) : cats.length === 0 ? (
        <div style={{ color: T.textDim, fontSize: 13, padding: '12px 0' }}>Keine anderen Kategorien verfügbar.</div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {cats.map(cat => (
            <div key={cat.id}>
              {mode === 'pick-cat' ? (
                <PickRow label={`📁 ${cat.name}`} onClick={() => onPick({ catId: cat.id })} />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ flex: 1, color: T.textDim, fontSize: 13, padding: '8px 12px', userSelect: 'none' }}>📁 {cat.name}</span>
                    <button
                      onClick={() => toggleSubs(cat.id)}
                      style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '4px 10px', fontSize: 11, transition: 'color 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.color = T.acc}
                      onMouseLeave={e => e.currentTarget.style.color = T.textDim}
                    >{expanded[cat.id] ? '▲' : '▼'}</button>
                  </div>
                  {expanded[cat.id] && (
                    subcats[cat.id]?.length === 0
                      ? <div style={{ paddingLeft: 30, fontSize: 12, color: T.textDim, paddingBottom: 6 }}>Keine Gruppen</div>
                      : subcats[cat.id]?.map(sub => (
                          <PickRow key={sub.id} label={`📂 ${sub.name}`} indent={1} onClick={() => onPick({ catId: cat.id, subId: sub.id })} />
                        ))
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── TIP MODAL ────────────────────────────────────────────────────────────────
const TipModal = ({ tipKey, onClose }) => {
  const { dismiss } = useTips()
  const [dontShow, setDontShow] = useState(false)
  const tip = TIPS[tipKey]
  if (!tip) { onClose(); return null }
  const close = () => { if (dontShow) dismiss(tipKey); onClose() }
  return (
    <Modal onClose={close} width={420}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 14 }}>{tip.title}</h3>
      <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.65, marginBottom: 22 }}>{tip.body}</p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
        <input
          type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: T.acc, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: T.textDim }}>Nicht mehr anzeigen</span>
      </label>
      <Btn onClick={close} full>Verstanden</Btn>
    </Modal>
  )
}

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────────
const ExportModal = ({ cards, folderName, onClose }) => {
  const exportCSV = () => {
    const rows = cards.map(c =>
      ['front','back','backShort'].map(k => `"${(c[k] || '').replace(/"/g,'""')}"`).join(',')
    )
    const csv = 'Vorderseite,Rückseite,Kürzel\n' + rows.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${folderName || 'karten'}.csv`; a.click()
    URL.revokeObjectURL(url)
    onClose()
  }
  const exportPDF = () => {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = cards.map(c => `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e0e0e0;font-weight:600;vertical-align:top">${c.front || ''}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e0e0e0;vertical-align:top">${c.back || ''}${c.backShort ? `<br><span style="font-size:12px;color:#888">${c.backShort}</span>` : ''}</td>
    </tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${folderName}</title>
      <style>body{font-family:system-ui,sans-serif;padding:28px;color:#111}h1{font-size:20px;margin-bottom:4px}
      p{color:#888;font-size:13px;margin-bottom:16px}table{width:100%;border-collapse:collapse}
      th{background:#f5f5f5;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
      button{margin-bottom:18px;padding:8px 18px;cursor:pointer;border:1px solid #ccc;border-radius:6px;font-size:14px}
      @media print{button{display:none}}</style></head><body>
      <h1>📚 ${folderName}</h1>
      <p>${cards.length} Karten · ${new Date().toLocaleDateString('de-DE')}</p>
      <button onclick="window.print()">🖨️ Drucken / Als PDF speichern</button>
      <table><tr><th>Vorderseite</th><th>Rückseite</th></tr>${rows}</table>
      </body></html>`)
    win.document.close()
    onClose()
  }
  return (
    <Modal onClose={onClose} width={360}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>📤 Exportieren</h3>
      <p style={{ fontSize: 13, color: T.textDim, marginBottom: 20 }}>{cards.length} Karten aus „{folderName}"</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { icon: '📊', label: 'CSV', sub: 'Excel-kompatibel · Vorderseite, Rückseite, Kürzel', fn: exportCSV },
          { icon: '🖨️', label: 'Als PDF drucken', sub: 'Formatierte Kartenliste im neuen Tab öffnen', fn: exportPDF },
        ].map(({ icon, label, sub, fn }) => (
          <button key={label} onClick={fn} style={{
            display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
            padding: '14px 16px', background: T.s3, border: `1px solid ${T.border}`,
            borderRadius: T.r2, cursor: 'pointer', transition: 'border-color 0.12s', width: '100%',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.acc}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{sub}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ─── FOLDER PICKER MODAL ─────────────────────────────────────────────────────
const FolderPickerModal = ({ uid, currentPath, onPick, onClose }) => {
  const [cats,     setCats]     = useState([])
  const [subcats,  setSubcats]  = useState({}) // catId → subs[]
  const [expanded, setExpanded] = useState({})
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    loadDocs(`users/${uid}/categories`).then(cs => { setCats(cs); setLoading(false) })
  }, [uid])

  const toggleSubs = async (catId) => {
    if (subcats[catId]) {
      setExpanded(e => ({ ...e, [catId]: !e[catId] }))
    } else {
      const subs = await loadDocs(`users/${uid}/categories/${catId}/subcategories`)
      setSubcats(s => ({ ...s, [catId]: subs }))
      setExpanded(e => ({ ...e, [catId]: true }))
    }
  }

  const Row = ({ label, path, indent = 0 }) => {
    const isCurrent = path === currentPath
    const [hov, setHov] = useState(false)
    return (
      <button
        onClick={() => !isCurrent && onPick(path)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        disabled={isCurrent}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: `8px 12px 8px ${12 + indent * 18}px`,
          background: isCurrent ? T.accDim : hov ? T.s3 : 'none',
          border: 'none', borderRadius: T.r,
          color: isCurrent ? T.acc : T.text, fontSize: 13,
          cursor: isCurrent ? 'default' : 'pointer',
          transition: 'background 0.1s',
          fontWeight: isCurrent ? 600 : 400,
        }}
      >{label}{isCurrent ? ' (aktuell)' : ''}</button>
    )
  }

  return (
    <Modal onClose={onClose} width={380}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Karte verschieben nach…</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      {loading ? (
        <div style={{ color: T.textDim, fontSize: 13, padding: '12px 0' }}>Lädt…</div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {cats.map(cat => (
            <div key={cat.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Row label={`📁 ${cat.name}`} path={`users/${uid}/categories/${cat.id}/cards`} />
                <button
                  onClick={() => toggleSubs(cat.id)}
                  style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '4px 6px', fontSize: 11, flexShrink: 0, transition: 'color 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.color = T.acc}
                  onMouseLeave={e => e.currentTarget.style.color = T.textDim}
                >{expanded[cat.id] ? '▲' : '▼'}</button>
              </div>
              {expanded[cat.id] && subcats[cat.id]?.map(sub => (
                <Row key={sub.id} label={`📂 ${sub.name}`} path={`users/${uid}/categories/${cat.id}/subcategories/${sub.id}/cards`} indent={1} />
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── SHARE MODAL ──────────────────────────────────────────────────────────────
const ShareModal = ({ catName, partnerName, onConfirm, onClose, sharing }) => (
  <Modal onClose={onClose} width={400}>
    <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 14 }}>🎁 Kartenset teilen</h3>
    <p style={{ fontSize: 14, color: T.text, marginBottom: 8 }}>
      <strong>"{catName}"</strong> wird mit <strong>{partnerName}</strong> geteilt.
    </p>
    <p style={{ fontSize: 13, color: T.textSub, marginBottom: 22 }}>
      Alle Karten, Gruppen und Untergruppen werden kopiert.
    </p>
    <div style={{ display: 'flex', gap: 10 }}>
      <Btn onClick={onConfirm} disabled={sharing} full>{sharing ? 'Wird geteilt…' : 'Teilen'}</Btn>
      <Btn onClick={onClose} variant="secondary" style={{ flexShrink: 0, padding: '9px 16px' }}>Abbrechen</Btn>
    </div>
  </Modal>
)

// ─── LEARN MODE ───────────────────────────────────────────────────────────────
const LearnMode = ({ cards: initCards, cardsPath, onClose, uid }) => {
  const [phase,       setPhase]       = useState('settings') // settings|loading|session|result
  const [cardCount,   setCardCount]   = useState(() => Math.min(10, initCards.length))
  const [learnMode,   setLearnMode]   = useState('klassisch') // 'klassisch'|'ki'
  const [session,     setSession]     = useState([])
  const [idx,         setIdx]         = useState(0)
  const [flipped,     setFlipped]     = useState(false)
  const [results,     setResults]     = useState([])  // [{id, card, knew}]
  const [kiError,     setKiError]     = useState('')
  const [wrongTips,   setWrongTips]   = useState({})  // cardId → tip string
  const [tipsLoading, setTipsLoading] = useState(false)
  const sessionStartRef = useRef(null)

  const countOptions = (() => {
    const opts = [5, 10, 20].filter(n => n <= initCards.length)
    if (!opts.includes(initCards.length)) opts.push(initCards.length)
    return opts
  })()

  const fetchWrongTips = async (wrongResults) => {
    if (wrongResults.length === 0) return
    setTipsLoading(true)
    const tips = {}
    for (const { card } of wrongResults) {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 200,
            messages: [{ role: 'user', content: `Gib eine kurze Merkhilfe (1-2 Sätze, auf Deutsch) für folgende Lernkarte:\nVorderseite: "${card.front}"\nRückseite: "${card.back}${card.backShort ? ` (${card.backShort})` : ''}"\nAntworte NUR mit: "Merkhilfe: ..." — kein weiterer Text.` }],
          }),
        })
        const data = await res.json()
        tips[card.id] = data.content?.[0]?.text?.trim() || ''
      } catch (_) {}
    }
    setWrongTips(tips)
    setTipsLoading(false)
  }

  const startSession = async () => {
    const count = Math.min(cardCount, initCards.length)
    setKiError('')
    sessionStartRef.current = Date.now()

    if (learnMode === 'klassisch') {
      const shuffled = [...initCards].sort(() => Math.random() - 0.5)
      setSession(shuffled.slice(0, count))
      setIdx(0); setFlipped(false); setResults([])
      setPhase('session')
      return
    }

    // KI-Auswahl
    setPhase('loading')
    try {
      const cardList = initCards.map(c => ({
        id: c.id, front: c.front,
        mastery: c.mastery || 0,
        daysSinceReview: c.lastReviewed?.seconds
          ? Math.floor((Date.now() / 1000 - c.lastReviewed.seconds) / 86400)
          : null,
      }))
      const prompt = `You are a learning optimizer. The user has these flashcards with mastery scores (0=never seen, 1=wrong, 2=correct once, 3=mastered): ${JSON.stringify(cardList)}. Select the ${count} most important cards to study now. Prioritize: cards never seen (mastery 0), then cards answered wrong (mastery 1), then cards not reviewed recently. Return ONLY a JSON array of card IDs in priority order: ["id1","id2",...]`
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const match = raw.match(/\[[\s\S]*?\]/)
      if (!match) throw new Error('Kein gültiges JSON')
      const ids = JSON.parse(match[0])
      const cardMap = Object.fromEntries(initCards.map(c => [c.id, c]))
      const ordered = ids.map(id => cardMap[id]).filter(Boolean)
      const remaining = initCards.filter(c => !ids.includes(c.id))
      setSession([...ordered, ...remaining].slice(0, count))
    } catch (e) {
      setKiError('KI-Auswahl fehlgeschlagen — klassische Reihenfolge wird verwendet.')
      const shuffled = [...initCards].sort(() => Math.random() - 0.5)
      setSession(shuffled.slice(0, count))
    }
    setIdx(0); setFlipped(false); setResults([])
    setPhase('session')
  }

  const rate = async (knew) => {
    const card = session[idx]
    const cur = card.mastery || 0
    const newMastery = knew
      ? (cur === 0 ? 2 : Math.min(3, cur + 1))
      : (cur === 0 ? 1 : Math.max(1, cur - 1))
    try {
      await updateDoc(doc(db, `${cardsPath}/${card.id}`), {
        mastery: newMastery,
        lastReviewed: serverTimestamp(),
        wrongCount: knew ? (card.wrongCount || 0) : (card.wrongCount || 0) + 1,
      })
    } catch (_) {}
    const newResults = [...results, { id: card.id, card, knew }]
    setResults(newResults)
    if (idx + 1 >= session.length) {
      setPhase('result')
      fetchWrongTips(newResults.filter(r => !r.knew))
      const durationMinutes = Math.max(1, Math.round((Date.now() - (sessionStartRef.current || Date.now())) / 60000))
      updateGlobalStats(uid, newResults.length, durationMinutes)
    } else {
      setIdx(i => i + 1)
      setFlipped(false)
    }
  }

  const repeatWrong = (wrongCards) => {
    setSession(wrongCards)
    setIdx(0); setFlipped(false); setResults([])
    setWrongTips({}); setTipsLoading(false)
    setPhase('session')
  }

  // ── SETTINGS ─────────────────────────────────────────────────────────────────
  if (phase === 'settings') {
    const chipStyle = (active) => ({
      padding: '9px 18px', borderRadius: T.r, fontSize: 14, fontWeight: 600,
      border: `1px solid ${active ? T.acc : T.border}`,
      background: active ? T.accDim : T.s3,
      color: active ? T.acc : T.textSub,
      cursor: 'pointer', transition: 'all 0.12s',
    })
    return (
      <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="fade-in" style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📖</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Exo 2', sans-serif", color: T.text, marginBottom: 6 }}>Lerneinstellungen</h2>
            <p style={{ fontSize: 13, color: T.textSub }}>{initCards.length} Karten verfügbar</p>
          </div>

          <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r3, padding: '26px 24px 22px', marginBottom: 14 }}>
            {/* Card count */}
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 12 }}>Wie viele Karten?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {countOptions.map(n => (
                  <button key={n} onClick={() => setCardCount(n)} style={chipStyle(cardCount === n)}>
                    {n === initCards.length ? `Alle (${n})` : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 12 }}>Lernmodus</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'klassisch', icon: '🃏', label: 'Klassisch', desc: 'Karten in zufälliger Reihenfolge' },
                  { key: 'ki', icon: '✦', label: 'KI-Auswahl', desc: 'KI wählt die wichtigsten Karten für dich' },
                ].map(({ key, icon, label, desc }) => (
                  <button key={key} onClick={() => setLearnMode(key)} style={{
                    ...chipStyle(learnMode === key),
                    display: 'flex', alignItems: 'center', gap: 12,
                    textAlign: 'left', padding: '12px 16px',
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: learnMode === key ? T.acc : T.text }}>{label}</div>
                      <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {kiError && (
            <div style={{ fontSize: 13, color: T.red, marginBottom: 10, padding: '10px 14px', background: T.redDim, borderRadius: T.r }}>
              {kiError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={startSession} full style={{ padding: '14px', fontSize: 15 }}>▶ Starten</Btn>
            <Btn onClick={onClose} variant="secondary" style={{ padding: '14px 18px', flexShrink: 0 }}>Abbrechen</Btn>
          </div>
        </div>
      </div>
    )
  }

  // ── KI LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 16, color: T.acc }}>✦</div>
          <p style={{ color: T.textSub, fontSize: 14 }}>KI wählt optimale Karten aus…</p>
        </div>
      </div>
    )
  }

  // ── RESULT ───────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const wrongResults = results.filter(r => !r.knew)
    const knewCount = results.filter(r => r.knew).length
    const pct = Math.round(knewCount / session.length * 100)
    return (
      <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, overflowY: 'auto' }}>
        <div style={{ maxWidth: 580, margin: '0 auto', padding: '40px 20px 100px' }}>
          <div className="fade-in" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>
              {pct >= 80 ? '🎯' : pct >= 50 ? '📈' : '💪'}
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Exo 2', sans-serif", color: T.text, marginBottom: 6 }}>
              Session abgeschlossen
            </h2>
            <p style={{ color: T.textSub }}>{session.length} Karten durchgearbeitet</p>
          </div>

          {/* Score grid */}
          <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '22px 28px', marginBottom: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: T.green }}>{knewCount}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Gewusst</div>
              </div>
              <div style={{ width: 1, height: 36, background: T.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: T.red }}>{wrongResults.length}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Nochmal</div>
              </div>
              <div style={{ width: 1, height: 36, background: T.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: T.acc }}>{pct}%</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Score</div>
              </div>
            </div>
          </div>

          {/* Wrong cards + KI tips */}
          {wrongResults.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                Nochmal üben ({wrongResults.length})
                {tipsLoading && (
                  <span style={{ fontSize: 12, color: T.textDim, fontWeight: 400 }}>· Merkhilfen werden geladen…</span>
                )}
              </div>
              {wrongResults.map(({ card }) => (
                <div key={card.id} style={{
                  background: T.s2, border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${T.red}66`,
                  borderRadius: T.r2, padding: '14px 16px', marginBottom: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 3 }}>{card.front}</div>
                  <div style={{ fontSize: 13, color: T.textSub }}>
                    {card.back}{card.backShort ? ` · ${card.backShort}` : ''}
                  </div>
                  {wrongTips[card.id] && (
                    <div style={{
                      fontSize: 13, color: T.acc, lineHeight: 1.6,
                      background: T.accDim, borderRadius: T.r,
                      padding: '8px 12px', marginTop: 10,
                    }}>
                      {wrongTips[card.id]}
                    </div>
                  )}
                </div>
              ))}

              <Btn
                onClick={() => repeatWrong(wrongResults.map(r => r.card))}
                variant="ghost" full
                style={{ marginTop: 6, padding: '12px' }}
              >
                🔁 Falsche Karten wiederholen ({wrongResults.length})
              </Btn>
            </div>
          )}

          <Btn onClick={onClose} full style={{ padding: '14px', fontSize: 15 }}>Fertig</Btn>
        </div>
      </div>
    )
  }

  // ── SESSION ───────────────────────────────────────────────────────────────────
  const card = session[idx]
  const progress = (idx / session.length) * 100

  return (
    <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        background: `${T.bg}EE`, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <Btn onClick={onClose} variant="secondary" style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}>
          ✕ Beenden
        </Btn>
        <div style={{ flex: 1, height: 6, background: T.s4, borderRadius: 3, overflow: 'hidden' }}>
          <div className="progress-fill" style={{ height: '100%', width: `${progress}%`, background: T.acc, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, flexShrink: 0 }}>
          {idx + 1} / {session.length}
        </div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 580 }}>
          {/* Flashcard */}
          <div
            onClick={() => !flipped && setFlipped(true)}
            className="fade-in"
            style={{
              background: T.s2,
              border: `1px solid ${flipped ? T.acc : T.border}`,
              borderRadius: T.r3, padding: '52px 40px', minHeight: 260,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', cursor: flipped ? 'default' : 'pointer',
              transition: 'border-color 0.22s', marginBottom: 20,
              boxShadow: flipped ? `0 0 0 1px ${T.acc}33, 0 16px 40px rgba(0,0,0,0.4)` : '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            {!flipped ? (
              <>
                {card.image && <img src={card.image} alt="" style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 10, marginBottom: 22, objectFit: 'contain' }} />}
                <div style={{ fontSize: 22, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>{card.front || '(Bild)'}</div>
                {card.front && card.front.trim().length <= 3 && (
                  <PhoneticHint key={card.id} text={card.front.trim()} />
                )}
                <div style={{ fontSize: 12, color: T.textDim, marginTop: card.front?.trim().length <= 3 ? 10 : 24, letterSpacing: 0.5 }}>Klicken zum Aufdecken</div>
              </>
            ) : (
              <>
                {card.backImage && <img src={card.backImage} alt="" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 10, marginBottom: 20, objectFit: 'contain' }} />}
                <div style={{ fontSize: 10, fontWeight: 700, color: T.acc, letterSpacing: 1.6, marginBottom: 14 }}>ANTWORT</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.text, lineHeight: 1.4, marginBottom: 10 }}>{card.back}</div>
                {card.backShort && <div style={{ fontSize: 16, color: T.acc, fontWeight: 600, marginBottom: 10 }}>{card.backShort}</div>}

                {/* TTS */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <TtsBtn text={card.pronunciation_de || card.back} lang="de-DE" label="🇩🇪 DE" />
                  {(card.pronunciation_en || card.back) && (
                    <TtsBtn text={card.pronunciation_en || card.back} lang="en-GB" label="🇬🇧 EN" />
                  )}
                </div>

                {/* Pronunciation guides */}
                {(card.pronunciation_de || card.pronunciation_en) && (
                  <div style={{
                    marginTop: 16, padding: '12px 16px', textAlign: 'left',
                    background: T.s1, borderRadius: T.r, border: `1px solid ${T.border}`,
                  }}>
                    {card.pronunciation_de && (
                      <div style={{ fontSize: 13, color: T.textSub, marginBottom: card.pronunciation_en ? 6 : 0 }}>
                        🇩🇪 Deutsche Aussprache: <span style={{ color: T.text, fontWeight: 500 }}>{card.pronunciation_de}</span>
                      </div>
                    )}
                    {card.pronunciation_en && (
                      <div style={{ fontSize: 13, color: T.textSub }}>
                        🇬🇧 English pronunciation: <span style={{ color: T.text, fontWeight: 500 }}>{card.pronunciation_en}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Rating */}
          {flipped && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Btn onClick={() => rate(false)} variant="danger" style={{ padding: '16px', fontSize: 16, borderRadius: T.r2 }}>✗  Nochmal</Btn>
              <Btn onClick={() => rate(true)} variant="success" style={{ padding: '16px', fontSize: 16, borderRadius: T.r2 }}>✓  Gewusst</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const Empty = ({ icon, title, sub, children }) => (
  <div style={{
    background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r2,
    padding: '56px 40px', textAlign: 'center', marginTop: 8,
  }}>
    <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>{title}</div>
    {sub && <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{sub}</div>}
    {children && <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>{children}</div>}
  </div>
)

// ─── SCHOOL SETUP MODAL ───────────────────────────────────────────────────────
const SchoolSetupModal = ({ onConfirm, onClose }) => {
  const [grade,   setGrade]   = useState('Klasse 1')
  const [lang,    setLang]    = useState('de')
  const [country, setCountry] = useState('de')

  const chip = (active) => ({
    padding: '6px 12px', borderRadius: T.r, fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? T.acc : T.border}`,
    background: active ? T.accDim : T.s3,
    color: active ? T.acc : T.textSub,
    cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
  })
  const label = (text) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10 }}>{text}</div>
  )

  return (
    <Modal onClose={onClose} width={560}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>🎓 Schule einrichten</h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 22 }}>
        KI kennt den offiziellen Lehrplan für dein Land und generiert altersgerechte Karten.
      </p>

      {/* Country */}
      <div style={{ marginBottom: 18 }}>
        {label('Land / Lehrplan')}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SCHOOL_COUNTRIES.map(c => (
            <button key={c.id} onClick={() => setCountry(c.id)} style={chip(country === c.id)}>
              {c.flag} {c.name}{c.curriculum ? ` (${c.curriculum})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Grade */}
      <div style={{ marginBottom: 18 }}>
        {label('Klassenstufe')}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SCHOOL_GRADES.map(g => (
            <button key={g} onClick={() => setGrade(g)} style={chip(grade === g)}>{g}</button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div style={{ marginBottom: 26 }}>
        {label('Lernsprache')}
        <div style={{ display: 'flex', gap: 8 }}>
          {SCHOOL_LANGS.map(l => (
            <button key={l.id} onClick={() => setLang(l.id)} style={chip(lang === l.id)}>{l.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={() => onConfirm(grade, lang, country)} full style={{ padding: '11px' }}>Kategorie erstellen</Btn>
        <Btn onClick={onClose} variant="secondary" style={{ padding: '11px 16px', flexShrink: 0 }}>Abbrechen</Btn>
      </div>
    </Modal>
  )
}

// ─── SCHOOL KI GENERATE MODAL ─────────────────────────────────────────────────
// Phase: 'curriculum' → fetching curriculum overview
//        'overview'   → showing subjects + topic checkboxes
//        'generating' → generating cards
//        'preview'    → reviewing cards before save
const SchoolKIGenerateModal = ({ cat, cardsPath, onSaved, onClose }) => {
  const [phase,       setPhase]       = useState('curriculum')
  const [curriculum,  setCurriculum]  = useState([])   // [{subject, icon, topics:[]}]
  const [selected,    setSelected]    = useState({})   // { subject: true/false }
  const [curErr,      setCurErr]      = useState('')
  const [count,       setCount]       = useState(10)
  const [preview,     setPreview]     = useState(null)
  const [genErr,      setGenErr]      = useState('')
  const [saving,      setSaving]      = useState(false)

  const grade   = cat.schoolGrade   || 'Klasse 1'
  const lang    = cat.schoolLang    || 'de'
  const country = cat.schoolCountry || 'de'
  const countryInfo = SCHOOL_COUNTRIES.find(c => c.id === country) || SCHOOL_COUNTRIES[0]
  const isYoung = grade === 'Vorschule' || grade === 'Klasse 1' || grade === 'Klasse 2'

  // Auto-fetch curriculum on mount
  useEffect(() => {
    const curriculumName = countryInfo.curriculum || countryInfo.name
    const prompt = `You are an expert in the ${curriculumName} curriculum${countryInfo.id !== 'other' ? ` (${countryInfo.name})` : ''}.
List ALL required subjects and their key learning topics for ${grade}.
Include what is taught, tested, and required that school year.
Return ONLY a valid JSON array, no markdown:
[{"subject":"Mathematics","icon":"🔢","topics":["Addition","Subtraction","Shapes"]},...]`

    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    })
      .then(r => r.json())
      .then(data => {
        const raw = data.content?.[0]?.text || ''
        const m = raw.match(/\[[\s\S]*\]/)
        if (!m) throw new Error('no json')
        const subs = JSON.parse(m[0])
        setCurriculum(subs)
        // Pre-select all
        const sel = {}
        subs.forEach(s => { sel[s.subject] = true })
        setSelected(sel)
        setPhase('overview')
      })
      .catch(() => { setCurErr('Lehrplan konnte nicht geladen werden.'); setPhase('overview') })
  }, [])

  const toggleSubject = subject => setSelected(p => ({ ...p, [subject]: !p[subject] }))

  const generateCards = async () => {
    const chosenSubjects = curriculum.filter(s => selected[s.subject])
    if (chosenSubjects.length === 0) return
    setPhase('generating'); setGenErr('')

    const subjText = chosenSubjects.map(s =>
      `${s.subject}: ${(s.topics || []).join(', ')}`
    ).join('\n')

    const langNote = lang === 'de+en'
      ? 'Provide back_de (German) AND back_en (English) for every card.'
      : lang === 'en'
        ? 'Cards in English. back = English answer, back_de = German, back_en = English.'
        : 'Cards in German. back = German answer, back_de = German, back_en = English translation.'

    const prompt = `Create exactly ${count} flashcards for ${grade} students in ${countryInfo.name} following the ${countryInfo.curriculum || 'standard'} curriculum.
Cover these subjects and topics (distribute cards across all subjects):
${subjText}

${isYoung ? 'Use very simple language. Include a relevant emoji for each card.' : 'Use age-appropriate difficulty.'}
${langNote}

Return ONLY a valid JSON array, no markdown:
[{"front":"...","back":"...","back_de":"...","back_en":"...","emoji":"...","subject":"..."}]`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const raw  = data.content?.[0]?.text || ''
      const m    = raw.match(/\[[\s\S]*\]/)
      if (!m) throw new Error('KI hat kein gültiges JSON zurückgegeben.')
      const cards = JSON.parse(m[0])
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Keine Karten generiert.')
      setPreview(cards)
      setPhase('preview')
    } catch (e) { setGenErr(e.message); setPhase('overview') }
  }

  const saveAll = async () => {
    setSaving(true)
    for (const c of preview) {
      await addDoc(collection(db, cardsPath), {
        front: c.front || '', back: c.back || c.back_de || c.front || '',
        back_de: c.back_de || '', back_en: c.back_en || '',
        backShort: '', emoji: c.emoji || '', subject: c.subject || '',
        image: null, correctCount: 0, wrongCount: 0,
        mastery: 0, lastReviewed: null, createdAt: serverTimestamp(),
      })
    }
    setSaving(false)
    onSaved()
  }

  const headerInfo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{ fontSize: 22 }}>✦</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Lehrplan-KI</div>
        <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>
          {countryInfo.flag} {grade} · {countryInfo.curriculum || countryInfo.name} · {SCHOOL_LANGS.find(l => l.id === lang)?.label}
        </div>
      </div>
    </div>
  )

  // ── LOADING CURRICULUM ────────────────────────────────────────────────────────
  if (phase === 'curriculum') {
    return (
      <Modal onClose={onClose} width={540}>
        {headerInfo}
        <div style={{ textAlign: 'center', padding: '28px 0', color: T.textSub, fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✦</div>
          Lehrplan wird geladen…
        </div>
      </Modal>
    )
  }

  // ── GENERATING CARDS ─────────────────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <Modal onClose={onClose} width={540}>
        {headerInfo}
        <div style={{ textAlign: 'center', padding: '28px 0', color: T.textSub, fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 12, color: T.acc }}>✦</div>
          Karten werden generiert…
        </div>
      </Modal>
    )
  }

  // ── OVERVIEW — subject/topic picker ──────────────────────────────────────────
  if (phase === 'overview') {
    const selCount = Object.values(selected).filter(Boolean).length
    return (
      <Modal onClose={onClose} width={580}>
        {headerInfo}

        {curErr && <div style={{ fontSize: 13, color: T.amber, padding: '8px 12px', background: `${T.amber}18`, borderRadius: T.r, marginBottom: 14 }}>{curErr}</div>}

        {curriculum.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 12 }}>
              Fächer & Themen — {grade} {countryInfo.flag}
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {curriculum.map(sub => {
                const on = !!selected[sub.subject]
                return (
                  <div
                    key={sub.subject}
                    onClick={() => toggleSubject(sub.subject)}
                    style={{
                      background: on ? T.accDim : T.s1,
                      border: `1px solid ${on ? T.acc : T.border}`,
                      borderRadius: T.r, padding: '12px 14px',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sub.topics?.length ? 6 : 0 }}>
                      <span style={{ fontSize: 18 }}>{sub.icon || '📚'}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: on ? T.acc : T.text }}>{sub.subject}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 16, color: on ? T.acc : T.textDim }}>{on ? '☑' : '☐'}</span>
                    </div>
                    {sub.topics?.length > 0 && (
                      <div style={{ fontSize: 12, color: on ? `${T.acc}BB` : T.textDim, paddingLeft: 26, lineHeight: 1.7 }}>
                        {sub.topics.join(' · ')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Card count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: T.textDim, flexShrink: 0 }}>Karten:</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[10, 20, 30, 50].map(n => (
              <button key={n} onClick={() => setCount(n)} style={{
                padding: '5px 12px', borderRadius: T.r, fontSize: 13, fontWeight: 600,
                border: `1px solid ${count === n ? T.acc : T.border}`,
                background: count === n ? T.accDim : T.s3,
                color: count === n ? T.acc : T.textSub, cursor: 'pointer',
              }}>{n}</button>
            ))}
          </div>
        </div>

        {genErr && <div style={{ fontSize: 13, color: T.red, padding: '10px 14px', background: T.redDim, borderRadius: T.r, marginBottom: 14 }}>{genErr}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={generateCards} disabled={selCount === 0} full style={{ padding: '11px' }}>
            ✦ {count} Karten für {selCount} {selCount === 1 ? 'Fach' : 'Fächer'} generieren
          </Btn>
          <Btn onClick={onClose} variant="secondary" style={{ padding: '11px 14px', flexShrink: 0 }}>Abbrechen</Btn>
        </div>
      </Modal>
    )
  }

  // ── PREVIEW ──────────────────────────────────────────────────────────────────
  const bySubject = preview.reduce((acc, c) => {
    const k = c.subject || 'Sonstiges'
    if (!acc[k]) acc[k] = []
    acc[k].push(c)
    return acc
  }, {})

  return (
    <Modal onClose={onClose} width={560}>
      {headerInfo}
      <div style={{ fontSize: 13, color: T.textSub, marginBottom: 14 }}>
        <strong style={{ color: T.text }}>{preview.length} Karten</strong> für {Object.keys(bySubject).length} Fächer generiert
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(bySubject).map(([subj, cards]) => (
          <div key={subj}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.acc, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{subj} ({cards.length})</div>
            {cards.map((c, i) => (
              <div key={i} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                {c.emoji && <span style={{ fontSize: 18, flexShrink: 0 }}>{c.emoji}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.front}</div>
                  <div style={{ fontSize: 12, color: T.textSub }}>
                    {lang === 'de+en' ? `🇩🇪 ${c.back_de}  ·  🇬🇧 ${c.back_en}` : c.back}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={saveAll} disabled={saving} full style={{ padding: '11px' }} variant="success">
          {saving ? 'Speichert…' : `✓ ${preview.length} Karten speichern`}
        </Btn>
        <Btn onClick={() => setPhase('overview')} variant="secondary" style={{ padding: '11px 14px', flexShrink: 0 }}>Neu generieren</Btn>
      </div>
    </Modal>
  )
}

// ─── VORSCHULE LEARN MODE ─────────────────────────────────────────────────────
const VorschuleLearnMode = ({ cards: initCards, cardsPath, cat, uid, onClose }) => {
  const [session, setSession] = useState(() => [...initCards].sort(() => Math.random() - 0.5))
  const [idx,     setIdx]     = useState(0)
  const [phase,   setPhase]   = useState('question') // question|listening|correct|wrong|revealed|done
  const [results, setResults] = useState([])
  const [spoken,  setSpoken]  = useState('')
  const sessionStart = useRef(Date.now())

  const lang      = cat.schoolLang || 'de'
  const speechLang = lang === 'en' ? 'en-GB' : 'de-DE'
  const card      = session[idx]
  const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const normalise = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9äöüß]/gi, '')

  const isCorrect = transcript => {
    const de = normalise(card.back_de || card.back || card.front)
    const en = normalise(card.back_en || '')
    const sp = normalise(transcript)
    if (!sp) return false
    if (lang === 'en')    return sp === en || en.startsWith(sp) || sp.includes(en)
    if (lang === 'de+en') return sp === de || sp === en || de.startsWith(sp) || en.startsWith(sp)
    return sp === de || de.startsWith(sp) || sp.includes(de)
  }

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = speechLang
    r.interimResults = false
    r.maxAlternatives = 4
    r.onresult = e => {
      const alts = Array.from(e.results[0]).map(a => a.transcript)
      setSpoken(alts[0] || '')
      setPhase(alts.some(a => isCorrect(a)) ? 'correct' : 'wrong')
    }
    r.onerror = () => setPhase('question')
    r.start()
    setPhase('listening')
  }

  const advance = async (knew) => {
    const cur = card.mastery || 0
    const newMastery = knew ? Math.min(3, cur + 1) : Math.max(1, cur - 1)
    try {
      await updateDoc(doc(db, `${cardsPath}/${card.id}`), { mastery: newMastery, lastReviewed: serverTimestamp() })
    } catch (_) {}
    const newResults = [...results, { card, knew }]
    if (idx + 1 >= session.length) {
      const mins = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000))
      updateGlobalStats(uid, newResults.length, mins)
      setResults(newResults)
      setPhase('done')
    } else {
      setResults(newResults)
      setIdx(i => i + 1)
      setSpoken('')
      setPhase('question')
    }
  }

  const getAnswer = () => {
    if (lang === 'en')    return card.back_en || card.back || card.front
    if (lang === 'de+en') return `${card.back_de || card.back || card.front}  /  ${card.back_en || ''}`
    return card.back_de || card.back || card.front
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const knew = results.filter(r => r.knew).length
    const pct  = Math.round(knew / results.length * 100)
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="fade-in" style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 8 }}>Super gemacht!</h2>
          <p style={{ color: T.textSub, marginBottom: 28 }}>{knew} von {results.length} Karten richtig ({pct}%)</p>
          <Btn onClick={onClose} full style={{ padding: '14px', fontSize: 16 }}>Fertig</Btn>
        </div>
      </div>
    )
  }

  // ── SESSION ──────────────────────────────────────────────────────────────────
  const progress = idx / session.length * 100
  const bgColor  = phase === 'correct' ? '#0D2E1E' : phase === 'wrong' ? '#2E0D0D' : T.s1
  const borderColor = phase === 'correct' ? T.green : phase === 'wrong' ? T.red : T.border

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: `${T.bg}EE`, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <Btn onClick={onClose} variant="secondary" style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}>✕ Beenden</Btn>
        <div style={{ flex: 1, height: 6, background: T.s4, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: T.acc, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, flexShrink: 0 }}>{idx + 1} / {session.length}</div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          {/* Flash card */}
          <div className="fade-in" style={{
            background: bgColor, border: `2px solid ${borderColor}`,
            borderRadius: 20, padding: '48px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', marginBottom: 20,
            transition: 'background 0.3s, border-color 0.3s',
            minHeight: 280,
          }}>
            {/* Emoji (big visual) */}
            {card.emoji && (
              <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>{card.emoji}</div>
            )}
            {/* Front word */}
            <div style={{ fontSize: card.emoji ? 28 : 40, fontWeight: 800, color: T.text, lineHeight: 1.2, marginBottom: 8 }}>
              {card.front}
            </div>
            {/* Phase indicator */}
            {phase === 'listening' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: T.acc, fontSize: 14, fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.acc, animation: 'pulse 1s infinite' }} />
                Ich höre zu…
              </div>
            )}
            {phase === 'correct' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>✓</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.green }}>{getAnswer()}</div>
                {spoken && <div style={{ fontSize: 13, color: T.textDim, marginTop: 6 }}>Du hast gesagt: „{spoken}"</div>}
              </div>
            )}
            {phase === 'wrong' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>✗</div>
                {spoken && <div style={{ fontSize: 14, color: T.textDim, marginBottom: 6 }}>Du hast gesagt: „{spoken}"</div>}
                <div style={{ fontSize: 13, color: T.textSub }}>Richtige Antwort:</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.red, marginTop: 4 }}>{getAnswer()}</div>
              </div>
            )}
            {phase === 'revealed' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: T.textSub, marginBottom: 6 }}>Antwort:</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: T.text }}>{getAnswer()}</div>
              </div>
            )}
          </div>

          {/* Buttons */}
          {phase === 'question' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hasSpeech && (
                <button
                  onClick={startListening}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    width: '100%', padding: '18px', borderRadius: T.r2,
                    background: T.acc, border: 'none', color: '#fff',
                    fontSize: 17, fontWeight: 700, cursor: 'pointer',
                    boxShadow: `0 0 24px ${T.accGlow}`,
                  }}
                >
                  🎤 Antwort sprechen
                </button>
              )}
              <button
                onClick={() => setPhase('revealed')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', padding: '13px', borderRadius: T.r2,
                  background: T.s3, border: `1px solid ${T.border}`,
                  color: T.textSub, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Antwort zeigen
              </button>
            </div>
          )}
          {phase === 'listening' && (
            <div style={{ textAlign: 'center', color: T.textDim, fontSize: 13 }}>Bitte sprich deutlich…</div>
          )}
          {(phase === 'correct' || phase === 'wrong') && (
            <Btn onClick={() => advance(phase === 'correct')} full style={{ padding: '16px', fontSize: 16 }}>
              Weiter →
            </Btn>
          )}
          {phase === 'revealed' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Btn onClick={() => advance(false)} variant="danger" style={{ padding: '14px', fontSize: 15, borderRadius: T.r2 }}>✗ Nochmal</Btn>
              <Btn onClick={() => advance(true)} variant="success" style={{ padding: '14px', fontSize: 15, borderRadius: T.r2 }}>✓ Gewusst</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SETTINGS SCREEN ─────────────────────────────────────────────────────────
const SettingsScreen = ({ user, settings, onSave, onBack }) => {
  const t = useT()
  const { dismiss, resetAll } = useTips()
  const [lang,        setLang]        = useState(settings.lang        || 'de')
  const [dailyGoal,   setDailyGoal]   = useState(settings.dailyGoal   || 10)
  const [defaultMode, setDefaultMode] = useState(settings.defaultMode || 'klassisch')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [tipsReset,   setTipsReset]   = useState(false)

  // Partner
  const [currentPartner,  setCurrentPartner]  = useState(null)   // { uid, name }
  const [partnerChecking, setPartnerChecking] = useState(true)
  const [partnerEmail,    setPartnerEmail]    = useState('')
  const [partnerLoading,  setPartnerLoading]  = useState(false)
  const [partnerMsg,      setPartnerMsg]      = useState(null)    // { ok: bool, text }

  useEffect(() => {
    getDoc(doc(db, `users/${user.uid}/profile/main`))
      .then(snap => {
        if (snap.exists() && snap.data().partnerUid)
          setCurrentPartner({ uid: snap.data().partnerUid, name: snap.data().partnerName || 'Partner' })
        setPartnerChecking(false)
      })
      .catch(() => setPartnerChecking(false))
  }, [user.uid])

  const connectPartner = async () => {
    const email = partnerEmail.trim().toLowerCase()
    if (!email) return
    if (email === (user.email || '').toLowerCase()) {
      setPartnerMsg({ ok: false, text: 'Das ist deine eigene E-Mail-Adresse.' }); return
    }
    setPartnerLoading(true); setPartnerMsg(null)
    try {
      // Primary: direct doc read via userIndex (no query, no cross-user rules issue)
      let partnerUid = null
      let partnerName = null
      const emailKey = email.replace(/\./g, ',')
      const idxSnap = await getDoc(doc(db, 'userIndex', emailKey))
      if (idxSnap.exists()) {
        partnerUid  = idxSnap.data().uid
        partnerName = idxSnap.data().displayName || email
      } else {
        // Fallback: query users collection (requires Firestore rules to allow reads)
        const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)))
        if (!snap.empty) {
          partnerUid  = snap.docs[0].id
          partnerName = snap.docs[0].data().displayName || email
        }
      }

      if (!partnerUid) {
        setPartnerMsg({ ok: false, text: 'Kein Nutzer mit dieser E-Mail gefunden. Ist er/sie in Katara registriert?' })
      } else {
        // Own profile
        await setDoc(doc(db, `users/${user.uid}/profile/main`), { partnerUid, partnerName }, { merge: true })
        // Back-reference on partner's profile
        await setDoc(doc(db, `users/${partnerUid}/profile/main`),
          { partnerUid: user.uid, partnerName: user.displayName || user.email }, { merge: true })
        setCurrentPartner({ uid: partnerUid, name: partnerName })
        setPartnerEmail('')
        setPartnerMsg({ ok: true, text: `Verbunden mit ${partnerName}` })
      }
    } catch (err) {
      console.error('connectPartner:', err)
      setPartnerMsg({ ok: false, text: 'Fehler beim Suchen. Versuche es erneut.' })
    }
    setPartnerLoading(false)
  }

  const disconnectPartner = async () => {
    if (!currentPartner) return
    setPartnerLoading(true)
    try {
      await updateDoc(doc(db, `users/${user.uid}/profile/main`),
        { partnerUid: deleteField(), partnerName: deleteField() })
      await updateDoc(doc(db, `users/${currentPartner.uid}/profile/main`),
        { partnerUid: deleteField(), partnerName: deleteField() }).catch(() => {})
      setCurrentPartner(null)
      setPartnerMsg({ ok: true, text: 'Verbindung getrennt.' })
    } catch (_) {
      setPartnerMsg({ ok: false, text: 'Fehler beim Trennen.' })
    }
    setPartnerLoading(false)
  }

  const save = async () => {
    setSaving(true)
    const data = { lang, dailyGoal, defaultMode }
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/preferences`), data)
      onSave(data)
      setSaved(true); setTimeout(() => setSaved(false), 2200)
    } catch (e) { console.error('[Katara] settings save failed:', e) }
    setSaving(false)
  }

  const chipStyle = active => ({
    padding: '8px 18px', borderRadius: T.r, fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? T.acc : T.border}`,
    background: active ? T.accDim : T.s3,
    color: active ? T.acc : T.textSub,
    cursor: 'pointer', transition: 'all 0.12s',
  })

  const SectionCard = ({ label, children }) => (
    <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '22px 20px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div className="app-bg" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <Header title={t.settings} onBack={onBack} />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>

        <SectionCard label={t.language}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['de', '🇩🇪 Deutsch'], ['en', '🇬🇧 English']].map(([code, label]) => (
              <button key={code} onClick={() => setLang(code)} style={chipStyle(lang === code)}>{label}</button>
            ))}
          </div>
        </SectionCard>

        <SectionCard label={t.dailyGoal}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[5, 10, 20, 50].map(n => (
              <button key={n} onClick={() => setDailyGoal(n)} style={chipStyle(dailyGoal === n)}>
                {n} {t.cardsUnit}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard label={t.defaultMode}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['klassisch', `🃏 ${t.classic}`],
              ['ki',        `✦ ${t.kiSelect}`],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setDefaultMode(key)} style={chipStyle(defaultMode === key)}>{label}</button>
            ))}
          </div>
        </SectionCard>

        <SectionCard label={t.accountInfo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            {user.photoURL && (
              <img src={user.photoURL} alt="" style={{ width: 42, height: 42, borderRadius: '50%', border: `1px solid ${T.border}`, flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{user.displayName}</div>
              <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{user.email}</div>
            </div>
          </div>
          <Btn onClick={() => signOut(auth)} variant="danger" style={{ padding: '8px 16px', fontSize: 13 }}>
            {t.signOut}
          </Btn>
        </SectionCard>

        <SectionCard label="👥 Partner in Katara">
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14, lineHeight: 1.6 }}>
            Katara-Partner ist unabhängig von Vocara und kann hier separat gesetzt werden.
            Wenn du in Vocara bereits einen Partner verbunden hast, wird er beim nächsten Login automatisch übernommen.
          </div>
          {partnerChecking ? (
            <div style={{ fontSize: 13, color: T.textDim }}>Wird geladen…</div>
          ) : currentPartner ? (
            <div>
              <div style={{ fontSize: 13, color: T.textSub, marginBottom: 6, lineHeight: 1.6 }}>
                Verbunden mit{' '}
                <strong style={{ color: T.green }}>{currentPartner.name}</strong>
              </div>
              <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16, lineHeight: 1.6 }}>
                Ihr könnt euch gegenseitig Karten über das ⋮ Menü senden.
              </div>
              <Btn
                onClick={disconnectPartner}
                disabled={partnerLoading}
                variant="danger"
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                {partnerLoading ? 'Wird getrennt…' : 'Verbindung trennen'}
              </Btn>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: T.textSub, marginBottom: 14, lineHeight: 1.6 }}>
                Gib die E-Mail-Adresse deines Partners ein. Er/sie muss ebenfalls in Katara registriert sein.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={e => { setPartnerEmail(e.target.value); setPartnerMsg(null) }}
                  onKeyDown={e => e.key === 'Enter' && connectPartner()}
                  placeholder="partner@beispiel.de"
                  style={{ flex: 1, minWidth: 180 }}
                />
                <Btn
                  onClick={connectPartner}
                  disabled={partnerLoading || !partnerEmail.trim()}
                  style={{ padding: '9px 18px', flexShrink: 0 }}
                >
                  {partnerLoading ? 'Suche…' : 'Verbinden'}
                </Btn>
              </div>
            </div>
          )}
          {partnerMsg && (
            <div style={{
              fontSize: 13, marginTop: 12, lineHeight: 1.5,
              color: partnerMsg.ok ? T.green : T.red,
            }}>
              {partnerMsg.ok ? '✓ ' : '✗ '}{partnerMsg.text}
            </div>
          )}
        </SectionCard>

        <SectionCard label="Hilfe & Tipps">
          <div style={{ fontSize: 13, color: T.textSub, marginBottom: 14, lineHeight: 1.6 }}>
            Einführungs-Tipps für KI-Import, Lernmodus und Teilen werden beim nächsten Verwenden wieder angezeigt.
          </div>
          <Btn
            onClick={async () => { await resetAll(); setTipsReset(true); setTimeout(() => setTipsReset(false), 2000) }}
            variant="secondary"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            {tipsReset ? '✓ Tipps zurückgesetzt' : '🔄 Alle Tipps zurücksetzen'}
          </Btn>
        </SectionCard>

        <Btn onClick={save} disabled={saving} full style={{ padding: '14px', fontSize: 15 }}>
          {saved ? `✓ ${t.saved}` : saving ? t.saving : t.saveChanges}
        </Btn>
      </div>
    </div>
  )
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const login = async () => {
    setLoading(true); setError('')
    try { await signInWithPopup(auth, provider) }
    catch { setError('Anmeldung fehlgeschlagen — bitte erneut versuchen.'); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse 80% 70% at 50% -20%, ${T.accGlow}, transparent),${T.bg}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        {/* Logo block */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            fontSize: 58, fontFamily: "'Exo 2', sans-serif", fontWeight: 800,
            background: `linear-gradient(135deg, ${T.acc} 20%, #9EC8FF 80%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: 2, lineHeight: 1,
          }}>
            Katara
          </div>
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 8, letterSpacing: 2.5, textTransform: 'uppercase' }}>
            by Bridgelab
          </div>
          <div style={{ fontSize: 13, color: T.textSub, marginTop: 18, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Wissen · Strukturiert · Gemeistert
          </div>
        </div>

        {/* Login card */}
        <div style={{
          background: T.s2, border: `1px solid ${T.border}`,
          borderRadius: T.r3, padding: 28,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}>
          {error && (
            <div style={{
              color: T.red, fontSize: 13, marginBottom: 16,
              padding: '10px 14px', background: T.redDim,
              borderRadius: T.r, border: `1px solid rgba(248,113,113,0.25)`,
            }}>
              {error}
            </div>
          )}
          <Btn onClick={login} disabled={loading} full style={{ padding: '14px', fontSize: 15 }}>
            {loading ? 'Wird angemeldet…' : 'Mit Google anmelden'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── HOME SCREEN (Level 1: Hauptkategorien) ───────────────────────────────────
const HomeScreen = ({ user, onOpen, onSettings, streak = 0, totalCards = 0, weeklyMinutes = 0 }) => {
  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(false)
  const [renaming,    setRenaming]    = useState(null)
  const [search,      setSearch]      = useState('')
  const [shareTarget, setShareTarget] = useState(null) // item being shared (for Mit Partner teilen)
  const [sharing,     setSharing]     = useState(false)
  const [sendTarget,  setSendTarget]  = useState(null) // { name, getCards } for An Partner senden
  const [movingCat,   setMovingCat]   = useState(null) // item being moved
  const [moving,      setMoving]      = useState(false)
  const [exportData,  setExportData]  = useState(null) // { cards, name }
  const [activeTip,   setActiveTip]   = useState(null)
  const [schoolSetup, setSchoolSetup] = useState(false)
  const { dismissed, dismiss }        = useTips()
  const { partnerUid, partnerName }   = usePartner()
  const partnerInfo = partnerUid ? { uid: partnerUid, name: partnerName } : null
  const t    = useT()
  const uid  = user.uid
  const path = `users/${uid}/categories`

  const load = useCallback(async () => {
    setLoading(true)
    const docs = await loadDocs(path)
    const enriched = await Promise.all(
      docs.map(async d => {
        const { groupCount, cardCount, lastStudied } = await enrichCategoryData(uid, d.id)
        return { ...d, _count: groupCount, _cardCount: cardCount, _lastStudied: lastStudied }
      })
    )
    setItems(enriched)
    setLoading(false)
  }, [path, uid])

  useEffect(() => { load() }, [load])

  const create = async (name, color, extra = {}) => {
    try {
      await addDoc(collection(db, path), { name, color: color || 'blue', ...extra, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      load()
    } catch (err) {
      console.error('[Katara] createCategory — addDoc failed:', err)
    }
  }
  const remove = async id => {
    if (!confirm('Kategorie und alle Inhalte löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name, updatedAt: serverTimestamp() })
    setRenaming(null); load()
  }

  const shareWithPartner = async () => {
    if (!shareTarget || !partnerInfo) return
    setSharing(true)
    const srcPath = `${path}/${shareTarget.id}`
    const item = items.find(i => i.id === shareTarget.id)
    try {
      const dstCatRef = await addDoc(collection(db, `users/${partnerInfo.uid}/categories`), {
        name: shareTarget.name, color: item?.color || 'blue',
        sharedBy: { uid, name: user.displayName || user.email },
        readOnly: true, createdAt: serverTimestamp(),
      })
      const dstBase = `users/${partnerInfo.uid}/categories/${dstCatRef.id}`
      const srcCards = await loadDocs(`${srcPath}/cards`)
      for (const c of srcCards) { const { id: _, ...r } = c; await addDoc(collection(db, `${dstBase}/cards`), r) }
      const subcats = await loadDocs(`${srcPath}/subcategories`)
      for (const sub of subcats) {
        const { id: subId, ...subRest } = sub
        const dstSubRef = await addDoc(collection(db, `${dstBase}/subcategories`), subRest)
        const subCards = await loadDocs(`${srcPath}/subcategories/${subId}/cards`)
        for (const c of subCards) { const { id: _, ...r } = c; await addDoc(collection(db, `${dstBase}/subcategories/${dstSubRef.id}/cards`), r) }
        const subsubs = await loadDocs(`${srcPath}/subcategories/${subId}/subsubcategories`)
        for (const ss of subsubs) {
          const { id: ssId, ...ssRest } = ss
          const dstSsRef = await addDoc(collection(db, `${dstBase}/subcategories/${dstSubRef.id}/subsubcategories`), ssRest)
          const ssCards = await loadDocs(`${srcPath}/subcategories/${subId}/subsubcategories/${ssId}/cards`)
          for (const c of ssCards) { const { id: _, ...r } = c; await addDoc(collection(db, `${dstBase}/subcategories/${dstSubRef.id}/subsubcategories/${dstSsRef.id}/cards`), r) }
        }
      }
    } catch (e) { console.error('[Katara] shareWithPartner failed:', e) }
    setSharing(false); setShareTarget(null)
  }

  const handleCatMove = async ({ catId: dstCatId }) => {
    if (!movingCat || dstCatId === movingCat.id) { setMovingCat(null); return }
    setMoving(true); setMovingCat(null)
    await moveCatAsSubcat(uid, movingCat.id, dstCatId)
    setMoving(false); load()
  }

  const filtered = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div className="app-bg" style={{ minHeight: '100vh' }}>
      {/* Top bar — two rows */}
      <div style={{
        background: `${T.bg}F2`, backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${T.border}`,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Row 1: Bridgelab · Logo · user */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '7px 28px',
          borderBottom: `1px solid ${T.border}44`,
        }}>
          <a
            href="https://vocara-peach.vercel.app"
            style={{ fontSize: 12, color: T.textDim, textDecoration: 'none', fontWeight: 500, letterSpacing: 0.3, transition: 'color 0.12s', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = T.textSub}
            onMouseLeave={e => e.currentTarget.style.color = T.textDim}
          >← Bridgelab</a>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Logo size={21} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: T.textDim }}>
              {user.displayName?.split(' ')[0]}
            </span>
            <Btn onClick={onSettings} variant="secondary" style={{ padding: '5px 10px', fontSize: 13 }}>⚙</Btn>
            <Btn onClick={() => signOut(auth)} variant="secondary" style={{ padding: '5px 12px', fontSize: 12 }}>{t.signOut}</Btn>
          </div>
        </div>
        {/* Row 2: Title + streak + New Category */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{t.home}</span>
            {streak > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: T.amber,
                background: `${T.amber}18`, borderRadius: 20,
                padding: '3px 10px', letterSpacing: 0.2,
              }}>🔥 {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>
            )}
          </div>
          <Btn onClick={() => setModal(true)} style={{ padding: '7px 16px', fontSize: 13 }}>
            {t.newCategory}
          </Btn>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
        {/* Stats strip */}
        {(streak > 0 || totalCards > 0 || weeklyMinutes > 0) && (
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            {streak > 0 && (
              <span style={{ fontSize: 12, color: T.textDim }}>
                🔥 <span style={{ color: T.textSub }}>{streak} {streak === 1 ? 'Tag' : 'Tage'}</span>
              </span>
            )}
            {totalCards > 0 && (
              <span style={{ fontSize: 12, color: T.textDim }}>
                📚 <span style={{ color: T.textSub }}>{totalCards.toLocaleString('de-DE')} Karten gelernt</span>
              </span>
            )}
            {weeklyMinutes > 0 && (
              <span style={{ fontSize: 12, color: T.textDim }}>
                ⏱ <span style={{ color: T.textSub }}>{weeklyMinutes} Min diese Woche</span>
              </span>
            )}
          </div>
        )}
        {/* Search */}
        {!loading && items.length > 0 && (
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <svg
              width="15" height="15" viewBox="0 0 15 15" fill="none"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="6.5" cy="6.5" r="4.5" stroke={T.textDim} strokeWidth="1.4"/>
              <path d="M10 10L13 13" stroke={T.textDim} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={{ paddingLeft: 34, width: '100%', maxWidth: 340 }}
            />
          </div>
        )}

        {/* Schnellstart — always visible */}
        {!loading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 }}>Schnellstart</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { icon: '💼', label: 'Beruf', color: 'blue' },
                { icon: '🎓', label: 'Schule', color: 'purple' },
                { icon: '📖', label: 'Studium', color: 'green' },
                { icon: '🎯', label: 'Hobby', color: 'amber' },
              ].map(({ icon, label, color }) => (
                <button
                  key={label}
                  onClick={() => label === 'Schule' ? setSchoolSetup(true) : create(label, color)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 20, flexShrink: 0,
                    background: T.s2, border: `1px solid ${T.border}`,
                    color: T.textSub, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.s3; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderHov }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.s2; e.currentTarget.style.color = T.textSub; e.currentTarget.style.borderColor = T.border }}
                >
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && items.length === 0 ? (
          <Empty icon="📚" title="Noch keine Kategorien" sub="Wähle einen Schnellstart oben oder erstelle eine eigene Kategorie." />
        ) : !loading && filtered.length === 0 ? (
          <Empty icon="🔍" title="Keine Treffer" sub={`Keine Kategorie enthält "${search}".`} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {filtered.map(item => (
              <FolderCard
                key={item.id} item={item}
                onClick={() => onOpen(item)}
                onRename={() => setRenaming(item)}
                onDelete={() => remove(item.id)}
                onMove={() => setMovingCat(item)}
                onExport={async () => {
                  const cs = await collectAllCards(uid, item.id)
                  setExportData({ cards: cs, name: item.name })
                }}
                onShare={partnerInfo ? () => {
                  if (!dismissed.has('teilen')) { setActiveTip('teilen'); setShareTarget(item) }
                  else setShareTarget(item)
                } : undefined}
                onSendToPartner={() => setSendTarget({ name: item.name, getCards: () => collectAllCards(uid, item.id) })}
              />
            ))}
          </div>
        )}
      </div>

      {modal       && <CreateModal title="Neue Hauptkategorie" placeholder="z.B. RiL 301" onSave={create} onClose={() => setModal(false)} withColor />}
      {schoolSetup && <SchoolSetupModal onConfirm={(grade, lang, country) => { create('Schule', 'purple', { schoolMode: true, schoolGrade: grade, schoolLang: lang, schoolCountry: country }); setSchoolSetup(false) }} onClose={() => setSchoolSetup(false)} />}
      {renaming    && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
      {shareTarget && activeTip === 'teilen' && <TipModal tipKey="teilen" onClose={() => setActiveTip(null)} />}
      {shareTarget && activeTip !== 'teilen' && <ShareModal catName={shareTarget.name} partnerName={partnerInfo?.name || 'Partner'} sharing={sharing} onConfirm={shareWithPartner} onClose={() => setShareTarget(null)} />}
      {sendTarget  && <SendToPartnerModal uid={uid} displayName={user.displayName || user.email} name={sendTarget.name} getCards={sendTarget.getCards} onClose={() => setSendTarget(null)} />}
      {exportData  && <ExportModal cards={exportData.cards} folderName={exportData.name} onClose={() => setExportData(null)} />}
      {movingCat   && <MoveFolderModal uid={uid} mode="pick-cat" excludeId={movingCat.id} onPick={handleCatMove} onClose={() => setMovingCat(null)} />}
      {moving      && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: T.textSub, fontSize: 14 }}>Wird verschoben…</div>
        </div>
      )}
    </div>
  )
}

// ─── SUBCATEGORY SCREEN (Level 2) ────────────────────────────────────────────
const SubcategoryScreen = ({ user, cat, onBack, onOpen, onNavigate }) => {
  const [items,        setItems]        = useState([])
  const [modal,        setModal]        = useState(false)
  const [renaming,     setRenaming]     = useState(null)
  const [cards,        setCards]        = useState([])
  const [cardModal,    setCardModal]    = useState(null)
  const [kiImport,     setKiImport]     = useState(false)
  const [learning,     setLearning]     = useState(false)
  const [rowLearn,     setRowLearn]     = useState(null) // { cards, cardsPath }
  const [folderPicker, setFolderPicker] = useState(null) // card being moved
  const [movingSub,    setMovingSub]    = useState(null) // subcat being moved
  const [moving,       setMoving]       = useState(false)
  const [exportData,   setExportData]   = useState(null) // { cards, name }
  const [activeTip,    setActiveTip]    = useState(null)
  const [sendTarget,   setSendTarget]   = useState(null) // { name, getCards }
  const [schoolKi,     setSchoolKi]     = useState(false)
  const { dismissed }  = useTips()
  const { partnerUid, partnerName }     = usePartner()
  const t         = useT()
  const uid       = user.uid
  const isSchool  = !!cat.schoolMode
  const isVorschule = isSchool && (cat.schoolGrade === 'Vorschule' || cat.schoolGrade === 'Klasse 1' || cat.schoolGrade === 'Klasse 2')
  const path      = `users/${uid}/categories/${cat.id}/subcategories`
  const cardsPath = `users/${uid}/categories/${cat.id}/cards`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const enriched = await Promise.all(
      docs.map(async d => ({ ...d, _count: await countDocs(`${path}/${d.id}/subsubcategories`) }))
    )
    setItems(enriched)
    setCards(await loadDocs(cardsPath))
  }, [path, cardsPath])

  useEffect(() => { load() }, [load])

  const create = async name => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    load()
  }
  const remove = async id => {
    if (!confirm('Gruppe löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name }); setRenaming(null); load()
  }
  const saveCard = async data => {
    if (cardModal === 'new')
      await addDoc(collection(db, cardsPath), { ...data, correctCount: 0, wrongCount: 0, mastery: 0, lastReviewed: null, createdAt: serverTimestamp() })
    else
      await updateDoc(doc(db, `${cardsPath}/${cardModal.id}`), data)
    setCardModal(null); load()
  }
  const removeCard = async id => {
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${cardsPath}/${id}`)); load()
  }
  const moveCard = async (card, newPath) => {
    if (newPath === cardsPath) { setFolderPicker(null); return }
    const { id, ...data } = card
    await addDoc(collection(db, newPath), data)
    await deleteDoc(doc(db, `${cardsPath}/${id}`))
    setFolderPicker(null); load()
  }
  const handleSubMove = async ({ catId: dstCatId }) => {
    if (!movingSub || dstCatId === cat.id) { setMovingSub(null); return }
    setMoving(true); setMovingSub(null)
    await moveSubcatToCat(uid, cat.id, movingSub.id, dstCatId)
    setMoving(false); load()
  }

  return (
    <div className="app-bg" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <Header
        crumbs={['Start', cat.name]}
        onBack={onBack}
        onNavigate={onNavigate}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isSchool
              ? <Btn onClick={() => setSchoolKi(true)} variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }}>✦ KI generieren</Btn>
              : <Btn onClick={() => { if (!dismissed.has('ki-import')) setActiveTip('ki-import'); else setKiImport(true) }} variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }}>{t.kiCreate}</Btn>
            }
            <Btn onClick={() => setCardModal('new')} variant="secondary" style={{ padding: '7px 12px', fontSize: 13 }}>{t.addCard}</Btn>
            <Btn onClick={() => setModal(true)} style={{ padding: '7px 14px', fontSize: 13 }}>{t.newGroup}</Btn>
          </div>
        }
      />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}>
        {items.length === 0 && cards.length === 0 && (
          <Empty icon="🗂️" title={t.emptyCards} sub={t.emptyCardsSub}>
            <Btn onClick={() => { if (!dismissed.has('ki-import')) setActiveTip('ki-import'); else setKiImport(true) }} variant="ghost" style={{ padding: '8px 14px', fontSize: 13 }}>{t.kiCreate}</Btn>
            <Btn onClick={() => setCardModal('new')} variant="secondary" style={{ padding: '8px 14px', fontSize: 13 }}>{t.addCard}</Btn>
          </Empty>
        )}
        {items.length > 0 && (
          <>
            <SectionLabel>{t.groups}</SectionLabel>
            {items.map(item => (
              <FolderRow
                key={item.id} item={item}
                countLabel={`${item._count || 0} ${t.subgroups}`}
                accentColor="#7BB8FF"
                onClick={() => onOpen(item)}
                onRename={() => setRenaming(item)}
                onDelete={() => remove(item.id)}
                onMove={() => setMovingSub(item)}
                onExport={async () => {
                  const cs = await loadDocs(`${path}/${item.id}/cards`)
                  setExportData({ cards: cs, name: item.name })
                }}
                onLearn={async () => {
                  if (!dismissed.has('lernen')) { setActiveTip('lernen'); return }
                  const p = `${path}/${item.id}/cards`
                  const cs = await loadDocs(p)
                  if (cs.length > 0) setRowLearn({ cards: cs, cardsPath: p })
                  else onOpen(item)
                }}
                onSendToPartner={() => setSendTarget({
                  name: item.name,
                  getCards: async () => {
                    const direct = await loadDocs(`${path}/${item.id}/cards`)
                    const subsubs = await loadDocs(`${path}/${item.id}/subsubcategories`)
                    const deep = (await Promise.all(subsubs.map(ss => loadDocs(`${path}/${item.id}/subsubcategories/${ss.id}/cards`)))).flat()
                    return [...direct, ...deep]
                  },
                })}
              />
            ))}
          </>
        )}
        {cards.length > 0 && (
          <div style={{ marginTop: items.length > 0 ? 28 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {t.cards} ({cards.length})
                {isSchool && cat.schoolGrade && (
                  <span style={{ marginLeft: 8, color: T.acc, fontWeight: 600 }}>{cat.schoolGrade}</span>
                )}
              </div>
              <Btn onClick={() => { if (isVorschule) setLearning(true); else if (!dismissed.has('lernen')) setActiveTip('lernen'); else setLearning(true) }} variant="success" style={{ padding: '7px 18px', fontSize: 13 }}>
                {isVorschule ? '🎤 Lernen' : t.learn}
              </Btn>
            </div>
            {cards.map(c => (
              <CardItem key={c.id} card={c} onEdit={() => setCardModal(c)} onDelete={() => removeCard(c.id)} onMove={card => setFolderPicker(card)} onSendToPartner={card => setSendTarget({ name: card.front || '(Karte)', getCards: async () => [card] })} />
            ))}
          </div>
        )}
      </div>
      {modal        && <CreateModal title={t.newGroup.replace('+ ','')} placeholder="z.B. Hauptsignale" onSave={create} onClose={() => setModal(false)} />}
      {renaming     && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
      {cardModal    && <CardModal initial={cardModal === 'new' ? null : cardModal} onSave={saveCard} onClose={() => setCardModal(null)} />}
      {activeTip    && <TipModal tipKey={activeTip} onClose={() => { const t = activeTip; setActiveTip(null); if (t === 'ki-import') setKiImport(true); else if (t === 'lernen') setLearning(true) }} />}
      {sendTarget   && <SendToPartnerModal uid={uid} displayName={user.displayName || user.email} name={sendTarget.name} getCards={sendTarget.getCards} onClose={() => setSendTarget(null)} />}
      {learning     && isVorschule
        ? <VorschuleLearnMode cards={cards} cardsPath={cardsPath} cat={cat} uid={uid} onClose={() => { setLearning(false); load() }} />
        : learning && <LearnMode cards={cards} cardsPath={cardsPath} uid={uid} onClose={() => { setLearning(false); load() }} />
      }
      {rowLearn     && <LearnMode cards={rowLearn.cards} cardsPath={rowLearn.cardsPath} uid={uid} onClose={() => { setRowLearn(null); load() }} />}
      {folderPicker && <FolderPickerModal uid={uid} currentPath={cardsPath} onPick={newPath => moveCard(folderPicker, newPath)} onClose={() => setFolderPicker(null)} />}
      {movingSub    && <MoveFolderModal uid={uid} mode="pick-cat" excludeId={cat.id} onPick={handleSubMove} onClose={() => setMovingSub(null)} />}
      {exportData   && <ExportModal cards={exportData.cards} folderName={exportData.name} onClose={() => setExportData(null)} />}
      {moving       && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: T.textSub, fontSize: 14 }}>Wird verschoben…</div>
        </div>
      )}
      {kiImport  && (
        <KIImportScreen
          cardsPath={cardsPath}
          destinations={[
            { label: `📍 ${cat.name} (diese Ebene)`, path: cardsPath },
            ...items.map(it => ({ label: `📁 ${it.name}`, path: `${path}/${it.id}/cards` })),
          ]}
          onSaved={() => { setKiImport(false); load() }}
          onClose={() => setKiImport(false)}
        />
      )}
      {schoolKi  && <SchoolKIGenerateModal cat={cat} cardsPath={cardsPath} onSaved={() => { setSchoolKi(false); load() }} onClose={() => setSchoolKi(false)} />}
    </div>
  )
}

// ─── SUBSUBCATEGORY SCREEN (Level 3) ─────────────────────────────────────────
const SubSubcategoryScreen = ({ user, cat, sub, onBack, onOpen, onNavigate }) => {
  const [items,        setItems]        = useState([])
  const [modal,        setModal]        = useState(false)
  const [renaming,     setRenaming]     = useState(null)
  const [cards,        setCards]        = useState([])
  const [cardModal,    setCardModal]    = useState(null)
  const [kiImport,     setKiImport]     = useState(false)
  const [learning,     setLearning]     = useState(false)
  const [rowLearn,     setRowLearn]     = useState(null) // { cards, cardsPath }
  const [folderPicker, setFolderPicker] = useState(null) // card being moved
  const [movingSs,     setMovingSs]     = useState(null) // subsubcat being moved
  const [moving,       setMoving]       = useState(false)
  const [exportData,   setExportData]   = useState(null) // { cards, name }
  const [activeTip,    setActiveTip]    = useState(null)
  const { dismissed }  = useTips()
  const { partnerUid, partnerName }     = usePartner()
  const [sendTarget,   setSendTarget]   = useState(null)
  const t         = useT()
  const uid       = user.uid
  const path      = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories`
  const cardsPath = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/cards`

  const load = useCallback(async () => {
    const docs = await loadDocs(path)
    const enriched = await Promise.all(
      docs.map(async d => ({ ...d, _count: await countDocs(`${path}/${d.id}/cards`) }))
    )
    setItems(enriched)
    setCards(await loadDocs(cardsPath))
  }, [path, cardsPath])

  useEffect(() => { load() }, [load])

  const create = async name => {
    await addDoc(collection(db, path), { name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    load()
  }
  const remove = async id => {
    if (!confirm('Untergruppe löschen?')) return
    await deleteDoc(doc(db, `${path}/${id}`)); load()
  }
  const rename = async (id, name) => {
    await updateDoc(doc(db, `${path}/${id}`), { name }); setRenaming(null); load()
  }
  const saveCard = async data => {
    if (cardModal === 'new')
      await addDoc(collection(db, cardsPath), { ...data, correctCount: 0, wrongCount: 0, mastery: 0, lastReviewed: null, createdAt: serverTimestamp() })
    else
      await updateDoc(doc(db, `${cardsPath}/${cardModal.id}`), data)
    setCardModal(null); load()
  }
  const removeCard = async id => {
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${cardsPath}/${id}`)); load()
  }
  const moveCard = async (card, newPath) => {
    if (newPath === cardsPath) { setFolderPicker(null); return }
    const { id, ...data } = card
    await addDoc(collection(db, newPath), data)
    await deleteDoc(doc(db, `${cardsPath}/${id}`))
    setFolderPicker(null); load()
  }
  const handleSsMove = async ({ catId: dstCatId, subId: dstSubId }) => {
    if (!movingSs || !dstSubId) { setMovingSs(null); return }
    setMoving(true); setMovingSs(null)
    await moveSubsubcatToSub(uid, cat.id, sub.id, movingSs.id, dstCatId, dstSubId)
    setMoving(false); load()
  }

  return (
    <div className="app-bg" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <Header
        crumbs={['Start', cat.name, sub.name]}
        onBack={onBack}
        onNavigate={onNavigate}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn onClick={() => { if (!dismissed.has('ki-import')) setActiveTip('ki-import'); else setKiImport(true) }} variant="ghost" style={{ padding: '7px 12px', fontSize: 13 }}>{t.kiCreate}</Btn>
            <Btn onClick={() => setCardModal('new')} variant="secondary" style={{ padding: '7px 12px', fontSize: 13 }}>{t.addCard}</Btn>
            <Btn onClick={() => setModal(true)} style={{ padding: '7px 14px', fontSize: 13 }}>{t.newSubgroup}</Btn>
          </div>
        }
      />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}>
        {items.length === 0 && cards.length === 0 && (
          <Empty icon="📂" title={t.emptyCards} sub={t.emptyCardsSub}>
            <Btn onClick={() => { if (!dismissed.has('ki-import')) setActiveTip('ki-import'); else setKiImport(true) }} variant="ghost" style={{ padding: '8px 14px', fontSize: 13 }}>{t.kiCreate}</Btn>
            <Btn onClick={() => setCardModal('new')} variant="secondary" style={{ padding: '8px 14px', fontSize: 13 }}>{t.addCard}</Btn>
          </Empty>
        )}
        {items.length > 0 && (
          <>
            <SectionLabel>{t.subgroups}</SectionLabel>
            {items.map(item => (
              <FolderRow
                key={item.id} item={item}
                countLabel={`${item._count || 0} ${t.cards}`}
                accentColor={T.amber}
                onClick={() => onOpen(item)}
                onRename={() => setRenaming(item)}
                onDelete={() => remove(item.id)}
                onMove={() => setMovingSs(item)}
                onExport={async () => {
                  const cs = await loadDocs(`${path}/${item.id}/cards`)
                  setExportData({ cards: cs, name: item.name })
                }}
                onLearn={item._count > 0 ? async () => {
                  if (!dismissed.has('lernen')) { setActiveTip('lernen'); return }
                  const p = `${path}/${item.id}/cards`
                  const cs = await loadDocs(p)
                  if (cs.length > 0) setRowLearn({ cards: cs, cardsPath: p })
                } : undefined}
                onSendToPartner={() => setSendTarget({ name: item.name, getCards: () => loadDocs(`${path}/${item.id}/cards`) })}
              />
            ))}
          </>
        )}
        {cards.length > 0 && (
          <div style={{ marginTop: items.length > 0 ? 28 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {t.cards} ({cards.length})
              </div>
              <Btn onClick={() => { if (!dismissed.has('lernen')) setActiveTip('lernen'); else setLearning(true) }} variant="success" style={{ padding: '7px 18px', fontSize: 13 }}>
                {t.learn}
              </Btn>
            </div>
            {cards.map(c => (
              <CardItem key={c.id} card={c} onEdit={() => setCardModal(c)} onDelete={() => removeCard(c.id)} onMove={card => setFolderPicker(card)} onSendToPartner={card => setSendTarget({ name: card.front || '(Karte)', getCards: async () => [card] })} />
            ))}
          </div>
        )}
      </div>
      {modal        && <CreateModal title={t.newSubgroup.replace('+ ','')} placeholder="z.B. Hp-Begriffe" onSave={create} onClose={() => setModal(false)} />}
      {renaming     && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
      {cardModal    && <CardModal initial={cardModal === 'new' ? null : cardModal} onSave={saveCard} onClose={() => setCardModal(null)} />}
      {activeTip    && <TipModal tipKey={activeTip} onClose={() => { const tip = activeTip; setActiveTip(null); if (tip === 'ki-import') setKiImport(true); else if (tip === 'lernen') setLearning(true) }} />}
      {sendTarget   && <SendToPartnerModal uid={uid} displayName={user.displayName || user.email} name={sendTarget.name} getCards={sendTarget.getCards} onClose={() => setSendTarget(null)} />}
      {learning     && <LearnMode cards={cards} cardsPath={cardsPath} uid={uid} onClose={() => { setLearning(false); load() }} />}
      {rowLearn     && <LearnMode cards={rowLearn.cards} cardsPath={rowLearn.cardsPath} uid={uid} onClose={() => { setRowLearn(null); load() }} />}
      {folderPicker && <FolderPickerModal uid={uid} currentPath={cardsPath} onPick={newPath => moveCard(folderPicker, newPath)} onClose={() => setFolderPicker(null)} />}
      {movingSs     && <MoveFolderModal uid={uid} mode="pick-subcat" excludeId={sub.id} onPick={handleSsMove} onClose={() => setMovingSs(null)} />}
      {exportData   && <ExportModal cards={exportData.cards} folderName={exportData.name} onClose={() => setExportData(null)} />}
      {moving       && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,11,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: T.textSub, fontSize: 14 }}>Wird verschoben…</div>
        </div>
      )}
      {kiImport  && (
        <KIImportScreen
          cardsPath={cardsPath}
          destinations={[
            { label: `📍 ${sub.name} (diese Ebene)`, path: cardsPath },
            ...items.map(it => ({ label: `📁 ${it.name}`, path: `${path}/${it.id}/cards` })),
          ]}
          onSaved={() => { setKiImport(false); load() }}
          onClose={() => setKiImport(false)}
        />
      )}
    </div>
  )
}

// ─── CARDS SCREEN ─────────────────────────────────────────────────────────────
const CardsScreen = ({ user, cat, sub, subsub, onBack, onNavigate }) => {
  const [cards,        setCards]        = useState([])
  const [cardModal,    setCardModal]    = useState(null)
  const [kiImport,     setKiImport]     = useState(false)
  const [learning,     setLearning]     = useState(false)
  const [folderPicker, setFolderPicker] = useState(null) // card being moved
  const [exportData,   setExportData]   = useState(null) // { cards, name }
  const [activeTip,    setActiveTip]    = useState(null)
  const [sendTarget,   setSendTarget]   = useState(null)
  const { dismissed }  = useTips()
  const { partnerUid, partnerName }     = usePartner()
  const t = useT()
  const uid      = user.uid
  const basePath = `users/${uid}/categories/${cat.id}/subcategories/${sub.id}/subsubcategories/${subsub.id}`
  const cardsPath = `${basePath}/cards`

  const load = useCallback(async () => setCards(await loadDocs(cardsPath)), [cardsPath])
  useEffect(() => { load() }, [load])

  const saveCard = async data => {
    if (cardModal === 'new')
      await addDoc(collection(db, cardsPath), { ...data, correctCount: 0, wrongCount: 0, mastery: 0, lastReviewed: null, createdAt: serverTimestamp() })
    else
      await updateDoc(doc(db, `${cardsPath}/${cardModal.id}`), data)
    setCardModal(null); load()
  }

  const remove = async id => {
    if (!confirm('Karte löschen?')) return
    await deleteDoc(doc(db, `${cardsPath}/${id}`)); load()
  }
  const moveCard = async (card, newPath) => {
    if (newPath === cardsPath) { setFolderPicker(null); return }
    const { id, ...data } = card
    await addDoc(collection(db, newPath), data)
    await deleteDoc(doc(db, `${cardsPath}/${id}`))
    setFolderPicker(null); load()
  }

  const avgMastery = cards.length
    ? Math.round(cards.reduce((s, c) => s + (c.mastery || 0), 0) / cards.length / 3 * 100)
    : 0

  return (
    <div className="app-bg" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <Header crumbs={['Start', cat.name, sub.name, subsub.name]} onBack={onBack} onNavigate={onNavigate} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 24px' }}>
        {/* Action bar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22, alignItems: 'center' }}>
          <Btn onClick={() => setCardModal('new')} style={{ padding: '9px 16px' }}>
            {t.addCard}
          </Btn>
          <Btn onClick={() => { if (!dismissed.has('ki-import')) setActiveTip('ki-import'); else setKiImport(true) }} variant="ghost" style={{ padding: '9px 16px' }}>
            {t.kiGenerate}
          </Btn>
          {cards.length > 0 && (
            <Btn onClick={() => setExportData({ cards, name: subsub.name })} variant="secondary" style={{ padding: '9px 14px', fontSize: 13 }}>
              📤
            </Btn>
          )}
          <div style={{ flex: 1 }} />
          <Btn
            onClick={() => { if (!dismissed.has('lernen')) setActiveTip('lernen'); else setLearning(true) }}
            variant="success"
            disabled={cards.length === 0}
            style={{ padding: '9px 22px' }}
          >
            {t.learn}
          </Btn>
        </div>

        {/* Mastery summary */}
        {cards.length > 0 && (
          <div style={{
            background: T.s1, border: `1px solid ${T.border}`,
            borderRadius: T.r2, padding: '14px 18px', marginBottom: 22,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <MasteryBar value={avgMastery} height={6} style={{ flex: 1 }} />
            <div style={{ fontSize: 13, color: T.textSub, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {cards.length} Karten · Ø {avgMastery}%
            </div>
          </div>
        )}

        {/* Card list */}
        {cards.length === 0 ? (
          <Empty icon="🃏" title={t.emptyCards} sub={t.emptyCardsSub}>
            <Btn onClick={() => { if (!dismissed.has('ki-import')) setActiveTip('ki-import'); else setKiImport(true) }} variant="ghost" style={{ padding: '8px 14px', fontSize: 13 }}>{t.kiGenerate}</Btn>
            <Btn onClick={() => setCardModal('new')} variant="secondary" style={{ padding: '8px 14px', fontSize: 13 }}>{t.addCard}</Btn>
          </Empty>
        ) : cards.map(c => (
          <CardItem key={c.id} card={c} onEdit={() => setCardModal(c)} onDelete={() => remove(c.id)} onMove={card => setFolderPicker(card)} onSendToPartner={card => setSendTarget({ name: card.front || '(Karte)', getCards: async () => [card] })} />
        ))}
      </div>

      {cardModal    && <CardModal initial={cardModal === 'new' ? null : cardModal} onSave={saveCard} onClose={() => setCardModal(null)} />}
      {activeTip    && <TipModal tipKey={activeTip} onClose={() => { const tip = activeTip; setActiveTip(null); if (tip === 'ki-import') setKiImport(true); else if (tip === 'lernen') setLearning(true) }} />}
      {sendTarget   && <SendToPartnerModal uid={uid} displayName={user.displayName || user.email} name={sendTarget.name} getCards={sendTarget.getCards} onClose={() => setSendTarget(null)} />}
      {kiImport     && <KIImportScreen cardsPath={cardsPath} onSaved={() => { setKiImport(false); load() }} onClose={() => setKiImport(false)} />}
      {learning     && <LearnMode cards={cards} cardsPath={cardsPath} uid={uid} onClose={() => { setLearning(false); load() }} />}
      {folderPicker && <FolderPickerModal uid={uid} currentPath={cardsPath} onPick={newPath => moveCard(folderPicker, newPath)} onClose={() => setFolderPicker(null)} />}
      {exportData   && <ExportModal cards={exportData.cards} folderName={exportData.name} onClose={() => setExportData(null)} />}
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,          setUser]          = useState(undefined)
  const [nav,           setNav]           = useState([{ screen: 'home' }])
  const [settings,      setSettings]      = useState({ lang: 'de', dailyGoal: 10, defaultMode: 'klassisch' })
  const [streak,        setStreak]        = useState(0)
  const [totalCards,    setTotalCards]    = useState(0)
  const [weeklyMinutes, setWeeklyMinutes] = useState(0)
  const [dismissedTips, setDismissedTips] = useState(new Set())
  const [partnerInfo,   setPartnerInfo]   = useState(null) // { uid, name }
  const [incomingShares,setIncomingShares]= useState([])   // from sharedFromPartner

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), [])

  // Load settings from Firestore when user logs in
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, `users/${user.uid}/settings/preferences`))
      .then(snap => { if (snap.exists()) setSettings(snap.data()) })
      .catch(() => {})
  }, [user?.uid])

  // Auto-create 4 starter categories on first login (if user has none)
  useEffect(() => {
    if (!user) return
    const catRef = collection(db, `users/${user.uid}/categories`)
    getDocs(query(catRef, limit(1))).then(snap => {
      if (!snap.empty) return // already initialized
      const starters = [
        { name: 'Beruf',   color: 'blue'   },
        { name: 'Schule',  color: 'purple', schoolMode: true, schoolGrade: 'Klasse 1', schoolLang: 'de', schoolCountry: 'de' },
        { name: 'Studium', color: 'green'  },
        { name: 'Hobby',   color: 'amber'  },
      ]
      Promise.all(starters.map(s => addDoc(catRef, { ...s, createdAt: serverTimestamp() }))).catch(() => {})
    }).catch(() => {})
  }, [user?.uid])

  // Register user email in public index so partners can find each other by email
  useEffect(() => {
    if (!user) return
    const email = user.email?.toLowerCase() || ''
    const displayName = user.displayName || user.email || ''
    // Write to users/{uid} for fallback query
    setDoc(doc(db, 'users', user.uid), { email, displayName }, { merge: true }).catch(() => {})
    // Write to userIndex/{emailKey} for direct-read lookup (no cross-user query needed)
    if (email) {
      const emailKey = email.replace(/\./g, ',')
      setDoc(doc(db, 'userIndex', emailKey), { uid: user.uid, displayName }, { merge: true }).catch(() => {})
    }
  }, [user?.uid])

  // Load dismissed tips from Firestore
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, `users/${user.uid}/settings/dismissedTips`))
      .then(snap => { if (snap.exists()) setDismissedTips(new Set(snap.data().keys || [])) })
      .catch(() => {})
  }, [user?.uid])

  const dismissTip = async key => {
    setDismissedTips(prev => { const next = new Set(prev); next.add(key); return next })
    if (!user) return
    const ref = doc(db, `users/${user.uid}/settings/dismissedTips`)
    try {
      const snap = await getDoc(ref)
      const keys = snap.exists() ? (snap.data().keys || []) : []
      if (!keys.includes(key)) await setDoc(ref, { keys: [...keys, key] })
    } catch (_) {}
  }

  const resetAll = async () => {
    setDismissedTips(new Set())
    if (!user) return
    await setDoc(doc(db, `users/${user.uid}/settings/dismissedTips`), { keys: [] }).catch(() => {})
  }

  // Load partner info from profile
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, `users/${user.uid}/profile/main`))
      .then(snap => {
        if (snap.exists() && snap.data().partnerUid) {
          setPartnerInfo({ uid: snap.data().partnerUid, name: snap.data().partnerName || 'Partner' })
        } else {
          setPartnerInfo(null)
        }
      })
      .catch(() => {})
  }, [user?.uid])

  // Listen for incoming shares (sharedFromPartner)
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/sharedFromPartner`),
      snap => setIncomingShares(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {},
    )
    return () => unsub()
  }, [user?.uid])

  const acceptShare = async item => {
    try {
      const newCatRef = await addDoc(collection(db, `users/${user.uid}/categories`), {
        name: item.name, color: 'blue',
        sharedBy: { uid: item.fromUid, name: item.fromName },
        createdAt: serverTimestamp(),
      })
      if (item.cards?.length > 0) {
        for (const { id: _id, ...card } of item.cards) {
          await addDoc(collection(db, `users/${user.uid}/categories/${newCatRef.id}/cards`), {
            ...card, createdAt: serverTimestamp(),
          })
        }
      }
      await deleteDoc(doc(db, `users/${user.uid}/sharedFromPartner/${item.id}`))
    } catch (_) {}
  }

  const declineShare = async item => {
    try { await deleteDoc(doc(db, `users/${user.uid}/sharedFromPartner/${item.id}`)) } catch (_) {}
  }

  // Load stats + ensure globalStats exists; merge so existing data is never lost
  useEffect(() => {
    if (!user) return
    const ref = doc(db, `users/${user.uid}/globalStats/main`)
    getDoc(ref).then(snap => {
      const now = Date.now()
      const today = new Date().toDateString()
      // Always use merge — only fills in missing fields, never deletes existing data
      if (!snap.exists()) {
        setDoc(ref, {
          streakDays: 1, totalCards: 0,
          weeklyMinutes: 0, monthlyMinutes: 0, yearlyMinutes: 0, totalMinutes: 0,
          lastActive: now,
        }, { merge: true }).catch(() => {})
        setStreak(1)
      } else {
        const data = snap.data()
        setTotalCards(data.totalCards || 0)
        setWeeklyMinutes(Math.round(data.weeklyMinutes || 0))
        const lastDay = new Date(data.lastActive || 0).toDateString()
        const streakDays = data.streakDays || 0
        if (lastDay === today) {
          setStreak(streakDays)
        } else {
          const yesterday = new Date(now - 86400000).toDateString()
          const newStreak = lastDay === yesterday ? streakDays + 1 : 1
          setStreak(newStreak)
          // merge: true ensures we only update these two fields, never touch totalCards etc.
          setDoc(ref, { lastActive: now, streakDays: newStreak }, { merge: true }).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [user?.uid])

  const push  = entry => setNav(n => [...n, entry])
  const pop   = () => setNav(n => n.length > 1 ? n.slice(0, -1) : n)
  const goTo  = i => setNav(n => n.slice(0, i + 1))
  const cur   = nav[nav.length - 1]
  const lang  = LANG[settings.lang] || LANG.de

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: T.textDim, fontSize: 14 }}>Wird geladen…</div>
      </div>
    )
  }

  return (
    <LangContext.Provider value={lang}>
      <TipsContext.Provider value={{ dismissed: dismissedTips, dismiss: dismissTip, resetAll }}>
        <PartnerContext.Provider value={{ partnerUid: partnerInfo?.uid || null, partnerName: partnerInfo?.name || null }}>
          {!user && <LoginScreen />}
          {user && incomingShares.length > 0 && (
            <IncomingShareModal item={incomingShares[0]} onAccept={acceptShare} onDecline={declineShare} />
          )}
          {user && cur.screen === 'home'     && <HomeScreen user={user} onOpen={cat => push({ screen: 'sub', cat })} onSettings={() => push({ screen: 'settings' })} streak={streak} totalCards={totalCards} weeklyMinutes={weeklyMinutes} />}
          {user && cur.screen === 'sub'      && <SubcategoryScreen user={user} cat={cur.cat} onBack={pop} onNavigate={goTo} onOpen={sub => push({ screen: 'subsub', cat: cur.cat, sub })} />}
          {user && cur.screen === 'subsub'   && <SubSubcategoryScreen user={user} cat={cur.cat} sub={cur.sub} onBack={pop} onNavigate={goTo} onOpen={subsub => push({ screen: 'cards', cat: cur.cat, sub: cur.sub, subsub })} />}
          {user && cur.screen === 'cards'    && <CardsScreen user={user} cat={cur.cat} sub={cur.sub} subsub={cur.subsub} onBack={pop} onNavigate={goTo} />}
          {user && cur.screen === 'settings' && <SettingsScreen user={user} settings={settings} onSave={s => { setSettings(s); pop() }} onBack={pop} />}
        </PartnerContext.Provider>
      </TipsContext.Provider>
    </LangContext.Provider>
  )
}
