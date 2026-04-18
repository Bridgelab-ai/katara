// KATARA v2.0 - 17.04.2026 14:00
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
  bg:       '#0D1117',
  s1:       'rgba(255,255,255,0.07)',   // surface base
  s2:       'rgba(255,255,255,0.11)',   // surface elevated
  s3:       'rgba(255,255,255,0.16)',   // surface hover / popup
  s4:       'rgba(255,255,255,0.22)',   // surface active
  border:   'rgba(255,255,255,0.14)',
  borderHov:'rgba(255,255,255,0.26)',
  acc:      '#00D4AA',
  accHov:   '#00B894',
  accDim:   'rgba(0,212,170,0.16)',
  accGlow:  'rgba(0,212,170,0.30)',
  text:     '#FFFFFF',
  textSub:  '#D8E0F0',
  textDim:  '#B0C0D8',
  green:    '#34D399',
  greenDim: 'rgba(52,211,153,0.14)',
  red:      '#F87171',
  redDim:   'rgba(248,113,113,0.14)',
  amber:    '#F59E0B',
  amberDim: 'rgba(245,158,11,0.15)',
  r:        '8px',
  r2:       '12px',
  r3:       '16px',
}

// ─── LIGHT MODE TOKENS ────────────────────────────────────────────────────────
const T_LIGHT = {
  bg: '#F0F4FF',
  s1: 'rgba(0,0,0,0.04)',
  s2: '#FFFFFF',
  s3: 'rgba(0,0,0,0.08)',
  s4: 'rgba(0,0,0,0.13)',
  border: 'rgba(0,0,0,0.13)',
  borderHov: 'rgba(0,0,0,0.24)',
  acc: '#2563EB',
  accHov: '#1D4ED8',
  accDim: 'rgba(37,99,235,0.10)',
  accGlow: 'rgba(37,99,235,0.20)',
  text: '#1A1A2E',
  textSub: '#374151',
  textDim: '#6B7280',
  green: '#059669',
  greenDim: 'rgba(5,150,105,0.10)',
  red: '#DC2626',
  redDim: 'rgba(220,38,38,0.09)',
  amber: '#D97706',
  amberDim: 'rgba(217,119,6,0.10)',
  r: '8px', r2: '12px', r3: '16px',
}

// ─── THEME CONTEXT ────────────────────────────────────────────────────────────
const ThemeContext  = createContext(T)
const useTheme      = () => useContext(ThemeContext)
const SettingsCtx   = createContext({ cardSize: 'normal' })
const useSettings   = () => useContext(SettingsCtx)

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

// ─── ONLINE HOOK ──────────────────────────────────────────────────────────────
const useOnline = () => {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

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

// ─── KI CONTENT RULES ────────────────────────────────────────────────────────
const KI_CONTENT_RULES = `Pflichtregeln für alle Karten (unbedingt einhalten):
- Kein religiöser Inhalt (keine Gebete, religiösen Rituale, Glaubenssätze oder spirituellen Praktiken)
- Keine praktischen Übungen oder physischen Aufgaben (kein "Gehe raus und tu X", kein "Führe diese Übung durch", kein "Schreibe auf Papier")
- Ausschließlich theoretisches, faktenbasiertes Lernmaterial
- Jede Karte muss inhaltlich einzigartig und spezifisch für diesen Kontext sein — keine generischen oder austauschbaren Formulierungen
- Karten müssen präzise und personalisiert wirken, nicht massenproduktartig`

// ─── SCHOOL MODE CONSTANTS ────────────────────────────────────────────────────
const SCHOOL_GRADES = ['Vorschule', ...Array.from({ length: 12 }, (_, i) => `Klasse ${i + 1}`)]
const SCHOOL_LANGS  = [
  { id: 'de',    label: '🇩🇪 Deutsch' },
  { id: 'en',    label: '🇬🇧 Englisch' },
  { id: 'de+en', label: '🇩🇪+🇬🇧 Beide' },
]
const SCHOOL_COUNTRIES = [
  { id: 'de', flag: '🇩🇪', name: 'Deutschland',  curriculum: 'KMK'                },
  { id: 'ke', flag: '🇰🇪', name: 'Kenia',         curriculum: ''                   },
  { id: 'at', flag: '🇦🇹', name: 'Österreich',    curriculum: 'BMBWF'              },
  { id: 'ch', flag: '🇨🇭', name: 'Schweiz',       curriculum: 'LP21'               },
  { id: 'gb', flag: '🇬🇧', name: 'UK',            curriculum: 'National Curriculum' },
  { id: 'us', flag: '🇺🇸', name: 'USA',           curriculum: 'Common Core'        },
  { id: 'other', flag: '🌍', name: 'Andere',       curriculum: ''                   },
]

// ─── UTILS ────────────────────────────────────────────────────────────────────
// String similarity: character-overlap ratio (Dice coefficient on bigrams)
const strSimilarity = (a, b) => {
  const norm = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9äöüß]/gi, '')
  const na = norm(a); const nb = norm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0
  const bigrams = s => { const r = new Set(); for (let i = 0; i < s.length - 1; i++) r.add(s.slice(i, i+2)); return r }
  const ba = bigrams(na); const bb = bigrams(nb)
  let intersect = 0; ba.forEach(g => { if (bb.has(g)) intersect++ })
  return (2 * intersect) / (ba.size + bb.size)
}

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
  const cacheKey = `katara_cache_${path.replace(/\//g, '_')}`
  try {
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'asc')))
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    try { localStorage.setItem(cacheKey, JSON.stringify(docs)) } catch (_) {}
    return docs
  } catch {
    // Offline fallback
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) return JSON.parse(cached)
    } catch (_) {}
    return []
  }
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
    // count mastered cards (mastery >= 2) and cards due today
    const now = new Date()
    const countMasteredAndDue = async (colPath) => {
      try {
        const snap = await getDocs(collection(db, colPath))
        let mastered = 0, due = 0
        for (const d of snap.docs) {
          const data = d.data()
          if ((data.mastery || 0) >= 2) mastered++
          if (data.nextReview) {
            const nr = data.nextReview.toDate ? data.nextReview.toDate() : new Date(data.nextReview)
            if (nr <= now) due++
          }
        }
        return { mastered, due }
      } catch { return { mastered: 0, due: 0 } }
    }
    const [directMD, ...subcatMD] = await Promise.all([
      countMasteredAndDue(`${catPath}/cards`),
      ...subcatIds.map(sid => countMasteredAndDue(`${catPath}/subcategories/${sid}/cards`)),
    ])
    const allMD = [directMD, ...subcatMD]
    const masteredCount = allMD.reduce((a, b) => a + b.mastered, 0)
    const dueCount      = allMD.reduce((a, b) => a + b.due, 0)
    return { groupCount: subcatIds.length, cardCount, lastStudied, masteredCount, dueCount }
  } catch { return { groupCount: 0, cardCount: 0, lastStudied: null, masteredCount: 0, dueCount: 0 } }
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

// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────────────
const useWide = () => {
  const [wide, setWide] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const h = () => setWide(window.innerWidth >= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return wide
}

// ─── CATEGORY COLORS ─────────────────────────────────────────────────────────
const CAT_COLORS = [
  { id: 'blue',   hex: '#4F8EF7' },
  { id: 'purple', hex: '#9B59B6' },
  { id: 'green',  hex: '#27AE60' },
  { id: 'amber',  hex: '#F39C12' },
  { id: 'rose',   hex: '#E74C3C' },
  { id: 'teal',   hex: '#00D4AA' },
]
const catColor = id => CAT_COLORS.find(c => c.id === id)?.hex ?? CAT_COLORS[0].hex

// ─── SKELETON LOADERS ─────────────────────────────────────────────────────────
const Skeleton = ({ width = '100%', height = 18, radius = 8, style = {} }) => (
  <div className="shimmer" style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }} />
)

const SkeletonCard = () => {
  const T = useTheme()
  return (
    <div style={{
      background: T.s2, border: `1px solid ${T.border}`,
      borderRadius: T.r2, padding: '20px 18px',
    }}>
      <Skeleton height={18} width="55%" style={{ marginBottom: 10 }} />
      <Skeleton height={13} width="35%" style={{ marginBottom: 20, opacity: 0.6 }} />
      <Skeleton height={6} radius={3} />
    </div>
  )
}

const SkeletonGrid = ({ count = 6 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
    {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
)

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = 'primary', disabled = false, style = {}, full = false }) => {
  const T = useTheme()
  const [hov,     setHov]     = useState(false)
  const [pressed, setPressed] = useState(false)

  const variants = {
    primary: {
      background: disabled ? T.s3 : hov ? T.accHov : T.acc,
      color: disabled ? T.textDim : '#fff',
      border: 'none',
      boxShadow: disabled ? 'none' : pressed
        ? `0 1px 3px rgba(0,0,0,0.3)`
        : hov
          ? `0 0 20px ${T.accGlow}, 0 4px 12px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.1) inset`
          : `0 4px 12px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.08) inset`,
    },
    secondary: {
      background: hov ? T.s3 : T.s2,
      color: T.text,
      border: `1px solid ${hov ? T.borderHov : T.border}`,
      boxShadow: pressed ? 'none' : '0 2px 6px rgba(0,0,0,0.2)',
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
      boxShadow: pressed ? 'none' : `0 4px 14px rgba(52,211,153,0.35), 0 1px 0 rgba(255,255,255,0.15) inset`,
    },
  }

  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false) }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, padding: '10px 18px', borderRadius: T.r, fontSize: 14,
        fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
        opacity: disabled ? 0.45 : 1,
        width: full ? '100%' : 'auto', letterSpacing: 0.2,
        transform: pressed && !disabled ? 'scale(0.96) translateY(1px)' : 'scale(1)',
        minHeight: 44,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
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
  const T = useTheme()
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => { window.open('https://katara-eta.vercel.app', '_blank') }}
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
  const T = useTheme()
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
const Modal = ({ children, onClose, width = 480 }) => {
  const T = useTheme()
  // Guard against mobile ghost-clicks: ignore backdrop taps within 300ms of mount
  const mountedAt = useRef(Date.now())
  return (
    <div
      onClick={e => {
        if (!onClose) return
        if (Date.now() - mountedAt.current < 300) return
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(8,11,20,0.82)',
        WebkitBackdropFilter: 'blur(4px)',
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
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const Logo = ({ size = 26, subtitle = false }) => {
  const T = useTheme()
  const iconSize = Math.round(size * 1.0)
  return (
  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
        <polygon points="14,3 26,25 2,25" fill="url(#logoGrad)" opacity="0.95" />
        <polygon points="14,9 21,25 7,25" fill="rgba(0,0,0,0.25)" />
        <defs>
          <linearGradient id="logoGrad" x1="14" y1="3" x2="14" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F5C8" />
            <stop offset="100%" stopColor="#00A882" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        fontSize: size,
        fontFamily: "'Exo 2', sans-serif",
        fontWeight: 800,
        background: 'linear-gradient(135deg, #00F5C8 0%, #00D4AA 50%, #00A882 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        letterSpacing: '0.1em',
        filter: 'drop-shadow(0 0 12px rgba(0,212,170,0.35))',
      }}>
        Katara
      </div>
    </div>
    {subtitle
      ? <div style={{ fontSize: Math.max(8, size * 0.38), color: T.textSub, letterSpacing: 0.2, marginTop: 3, fontWeight: 500, paddingLeft: iconSize + 8 }}>
          Strukturiertes Lernen.
        </div>
      : <div style={{ fontSize: Math.max(8, size * 0.31), color: T.textDim, letterSpacing: 1.8, marginTop: 3, paddingLeft: iconSize + 8 }}>
          BY BRIDGELAB
        </div>
    }
  </div>
  )
}

// ─── OFFLINE BADGE ────────────────────────────────────────────────────────────
const OfflineBadge = () => {
  const T = useTheme()
  return (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, fontWeight: 700, color: T.amber,
    background: T.amberDim, border: `1px solid ${T.amber}44`,
    borderRadius: 20, padding: '3px 10px', letterSpacing: 0.3,
    flexShrink: 0,
  }}>
    📵 Offline
  </div>
  )
}

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const Breadcrumb = ({ crumbs, onNavigate }) => {
  const T = useTheme()
  return (
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
}

// ─── STICKY HEADER ────────────────────────────────────────────────────────────
const Header = ({ crumbs, onBack, right, title, onNavigate, showSubtitle = false }) => {
  const T = useTheme()
  const t = useT()
  const online = useOnline()
  return (
  <div style={{
    position: 'sticky', top: 0, zIndex: 100,
    background: T.bg,
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
        <Logo size={24} subtitle={showSubtitle} />
      </div>
      <div style={{ width: 72, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        {!online && <OfflineBadge />}
      </div>
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
  const T = useTheme()
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
  const T = useTheme()
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
  const T = useTheme()
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
  const T = useTheme()
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
  const T = useTheme()
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
  const T = useTheme()
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
const SectionLabel = ({ children }) => {
  const T = useTheme()
  return (
  <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
    {children}
  </div>
  )
}

// ─── FOLDER CARD (grid tile — Level 1) ───────────────────────────────────────
const FolderCard = ({ item, onClick, onRename, onDelete, onShare, onMove, onExport, onSendToPartner, onPublicShare }) => {
  const T = useTheme()
  const [hov, setHov] = useState(false)
  const t = useT()
  const groupCount    = item._count ?? 0
  const cardCount     = item._cardCount ?? 0
  const masteredCount = item._masteredCount ?? 0
  const dueCount      = item._dueCount ?? 0
  const color = catColor(item.color || 'blue')
  const colorDim = `${color}1A`

  return (
    <div
      className={`glass-card`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        borderRadius: T.r2,
        padding: '20px 18px',
        cursor: 'pointer',
        transition: 'all 0.18s',
        position: 'relative',
        minHeight: 120,
        display: 'flex', flexDirection: 'column', gap: 10,
        background: hov ? '#1C2230' : '#161B22',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: `3px solid ${color}`,
        boxShadow: hov
          ? `0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}22`
          : `0 4px 16px rgba(0,0,0,0.35)`,
        transform: hov ? 'translateY(-2px)' : 'none',
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
          <span style={{ fontSize: 12, color: T.textSub }}>
            {groupCount} {groupCount === 1 ? 'Gruppe' : 'Gruppen'}
          </span>
          {cardCount > 0 && (
            <span style={{ fontSize: 12, color, fontWeight: 600 }}>
              · {cardCount} {t.cardsUnit}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {cardCount > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((masteredCount / cardCount) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 11, color: T.textSub }}>{masteredCount}/{cardCount} gemeistert</span>
            {dueCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: T.amber,
                background: `${T.amber}1A`, border: `1px solid ${T.amber}44`,
                borderRadius: 10, padding: '1px 7px', letterSpacing: 0.2,
              }}>
                {dueCount} fällig
              </span>
            )}
          </div>
        </div>
      )}

      {/* Last studied */}
      {(item._lastStudied || item.updatedAt) && (
        <div style={{ fontSize: 11, color: T.textSub }}>
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

      {/* Colored category circle */}
      <div style={{
        position: 'absolute', top: 12, right: 44,
        width: 10, height: 10, borderRadius: '50%',
        background: color, opacity: 0.85,
        boxShadow: `0 0 8px ${color}88`,
      }} />

      {/* Context menu — always visible */}
      <div
        style={{ position: 'absolute', top: 10, right: 10 }}
        onClick={e => e.stopPropagation()}
      >
        <CtxMenu items={[
          { label: t.rename,                                     action: onRename },
          ...(onMove        ? [{ label: '↗ Verschieben',        action: onMove        }] : []),
          ...(onExport      ? [{ label: '📤 Exportieren',       action: onExport      }] : []),
          ...(onPublicShare ? [{ label: '🔗 Link teilen',       action: onPublicShare }] : []),
          { label: '📤 An Partner senden', action: onSendToPartner },
          ...(onShare ? [{ label: '🎁 Mit Partner teilen', action: onShare }] : []),
          { label: t.delete, action: onDelete, danger: true },
        ]} />
      </div>
    </div>
  )
}

// ─── FOLDER ROW (list — Levels 2 & 3) ────────────────────────────────────────
const FolderRow = ({ item, onClick, onRename, onDelete, countLabel, accentColor, onLearn, onMove, onExport, onSendToPartner }) => {
  const T = useTheme()
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
const CardItem = ({ card, onSave, onDelete, onMove, onSendToPartner }) => {
  const T = useTheme()
  const { cardSize } = useSettings()
  const cardPad   = cardSize === 'small' ? '7px 10px'   : cardSize === 'large' ? '16px 18px'  : '11px 14px'
  const frontSize = cardSize === 'small' ? 12           : cardSize === 'large' ? 16            : 14
  const backSize  = cardSize === 'small' ? 11           : cardSize === 'large' ? 13            : 12
  const [hov,         setHov]         = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [front,       setFront]       = useState(card.front || '')
  const [back,        setBack]        = useState(card.back || '')
  const [backShort,   setBackShort]   = useState(card.backShort || '')
  const [saving,      setSaving]      = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const m = card.mastery || 0
  const mColor = m >= 3 ? T.green : m >= 2 ? T.acc : m >= 1 ? T.red : T.textDim
  const history = card.history || []

  const handleSave = async () => {
    setSaving(true)
    await onSave({ front, back, backShort })
    setSaving(false)
    setEditing(false)
    setShowHistory(false)
  }

  const restoreVersion = (v) => {
    setFront(v.front || '')
    setBack(v.back || '')
    setBackShort(v.backShort || '')
    setShowHistory(false)
  }

  const inputStyle = {
    width: '100%', background: T.s1, border: `1px solid ${T.border}`,
    borderRadius: T.r, color: T.text, fontSize: 13, padding: '6px 10px',
    outline: 'none', boxSizing: 'border-box',
  }

  if (editing) {
    return (
      <div style={{
        background: '#1A2240',
        border: `1px solid ${T.acc}44`, borderLeft: `3px solid ${T.acc}`,
        borderRadius: T.r2, padding: '12px 14px', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
          <input style={inputStyle} value={front} placeholder="Vorderseite" onChange={e => setFront(e.target.value)} autoFocus />
          <input style={inputStyle} value={back} placeholder="Rückseite" onChange={e => setBack(e.target.value)} />
          <input style={inputStyle} value={backShort} placeholder="Kurzbez. (optional)" onChange={e => setBackShort(e.target.value)} />
        </div>

        {/* Version history */}
        {history.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setShowHistory(h => !h)}
              style={{ background: 'none', border: 'none', color: T.textDim, fontSize: 11, cursor: 'pointer', padding: 0, letterSpacing: 0.3 }}
            >
              {showHistory ? '▲ Verlauf schließen' : `▾ Verlauf anzeigen (${history.length})`}
            </button>
            {showHistory && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[...history].reverse().map((v, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r,
                    padding: '7px 10px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.front || '(leer)'}</div>
                      <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>
                        {new Date(v.savedAt).toLocaleDateString('de-DE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreVersion(v)}
                      style={{ background: T.accDim, border: `1px solid ${T.acc}55`, borderRadius: 6, color: T.acc, fontSize: 11, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}
                    >Wiederherstellen</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ background: T.acc, border: 'none', borderRadius: T.r, color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 16px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >{saving ? 'Speichert…' : 'Speichern'}</button>
          <button onClick={() => { setEditing(false); setFront(card.front||''); setBack(card.back||''); setBackShort(card.backShort||''); setShowHistory(false) }}
            style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r, color: T.textSub, fontSize: 13, padding: '6px 14px', cursor: 'pointer' }}
          >Abbrechen</button>
        </div>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.s3 : T.s2,
        border: `1px solid ${hov ? T.borderHov : T.border}`,
        borderLeft: m > 0 ? `3px solid ${mColor}88` : `3px solid ${T.border}`,
        borderRadius: T.r2,
        padding: cardPad,
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
        <div style={{ fontSize: frontSize, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.front || '(Bild)'}
        </div>
        {card.back && (
          <div style={{ fontSize: backSize, color: T.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          onClick={e => { e.stopPropagation(); setEditing(true) }}
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
const ImgPreview = ({ src, onRemove }) => {
  const T = useTheme()
  return (
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
}

// ─── CARD MODAL ───────────────────────────────────────────────────────────────
const CardModal = ({ initial, onSave, onClose }) => {
  const T = useTheme()
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
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
          <SideLabel>VORDERSEITE</SideLabel>
          <FieldLabel>Text</FieldLabel>
          <textarea value={front} onChange={e => setFront(e.target.value)} placeholder="Begriff, Signal, Situation…" rows={3} style={{ marginBottom: 14 }} />
          <FieldLabel>Bild (optional)</FieldLabel>
          <input type="file" accept="image/*" onChange={pickImg(setImage)} style={{ fontSize: 12, color: T.textSub }} />
          {image && <ImgPreview src={image} onRemove={() => setImage(null)} />}
        </div>

        {/* Back */}
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
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
const LEHRPLAN_OPTIONS = [
  { id: 'abitur',        label: 'Abitur' },
  { id: 'ihk',           label: 'IHK-Prüfung' },
  { id: 'fuehrerschein', label: 'Führerschein' },
  { id: 'zugfuehrer',    label: 'Zugführer DB' },
  { id: 'custom',        label: 'Eigene Eingabe' },
]
const LEHRPLAN_COUNTRIES = [
  { id: 'Deutschland', label: '🇩🇪 Deutschland' },
  { id: 'Österreich',  label: '🇦🇹 Österreich' },
  { id: 'Schweiz',     label: '🇨🇭 Schweiz' },
  { id: 'Andere',      label: '🌍 Andere' },
]

const KIImportScreen = ({ cardsPath, destinations = [], onSaved, onClose, onCreateSub }) => {
  const T = useTheme()
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
  const [lehrplanOpen,    setLehrplanOpen]    = useState(false)
  const [lehrplanSel,     setLehrplanSel]     = useState(null)
  const [lehrplanCustom,  setLehrplanCustom]  = useState('')
  const [lehrplanCountry, setLehrplanCountry] = useState('Deutschland')
  const [ankiOpen,    setAnkiOpen]    = useState(false)
  const [ankiText,    setAnkiText]    = useState('')
  const fileRef    = useRef(null)
  const ankiFileRef = useRef(null)

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

  const importAnki = async (source) => {
    // source: a File or a raw string
    let text = typeof source === 'string' ? source : await toText(source)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    const cards = []
    for (const line of lines) {
      const tabIdx = line.indexOf('\t')
      if (tabIdx < 1) continue
      const front = line.slice(0, tabIdx).trim()
      const rest  = line.slice(tabIdx + 1).trim()
      // Anki may have a second tab for tags; split at second tab if present
      const secondTab = rest.indexOf('\t')
      const back = secondTab >= 0 ? rest.slice(0, secondTab).trim() : rest
      if (front) cards.push({ front, back, backShort: '', _dest: destList[0].path })
    }
    if (cards.length === 0) { setError('Keine Karten gefunden. Format: Vorderseite[Tab]Rückseite — eine Karte pro Zeile.'); return }
    setPreview(cards)
    setAnkiOpen(false)
    setAnkiText('')
    setSubDismissed(false)
  }

  const handleAnkiFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    await importAnki(file)
    e.target.value = ''
  }

  const parseCards = (raw) => {
    console.log('[KI] Raw response length:', raw.length)
    console.log('[KI] Raw response (first 500):', raw.slice(0, 500))
    // strip markdown fences
    let cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) {
      console.error('[KI] No JSON array found in response:', raw)
      throw new Error(`KI hat kein JSON zurückgegeben.\n\nAntwort: ${raw.slice(0, 300)}`)
    }
    try {
      const parsed = JSON.parse(match[0])
      console.log('[KI] Parsed', parsed.length, 'cards')
      return parsed
    } catch (e) {
      console.error('[KI] JSON.parse failed:', e.message, '\nRaw match:', match[0].slice(0, 300))
      throw new Error(`JSON-Fehler: ${e.message}\n\nRaw: ${match[0].slice(0, 200)}`)
    }
  }

  const generate = async () => {
    if (files.length === 0 && !instr.trim()) return
    setLoading(true); setError(''); setPreview(null)
    try {
      const content = []

      for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase()
        console.log('[KI] Processing file:', file.name, 'ext:', ext, 'size:', file.size)

        if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
          const b64 = await toBase64(file)
          content.push({ type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64.split(',')[1] } })
          console.log('[KI] Added image block')
        } else if (ext === 'pdf') {
          console.log('[KI] Reading PDF as ArrayBuffer…')
          const arrayBuf = await file.arrayBuffer()
          const bytes = new Uint8Array(arrayBuf)
          let binary = ''
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
          const b64 = btoa(binary)
          content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } })
          console.log('[KI] Added PDF document block, base64 length:', b64.length)
        } else {
          const text = await toText(file)
          content.push({ type: 'text', text: `--- ${file.name} ---\n${text.slice(0, 14000)}` })
          console.log('[KI] Added text block, chars:', text.length)
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
        text: `${instrPart}Create flashcards from the above content.${sortPart}${pronunciationPart}\n\n${KI_CONTENT_RULES}\nReturn ONLY a valid JSON array. No markdown. No backticks. Start with [ and end with ]:\n${jsonExample}`,
      })

      console.log('[KI] Sending', content.length, 'content blocks to API')
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000, messages: [{ role: 'user', content }] }),
      })
      console.log('[KI] API response status:', res.status)
      const data = await res.json()
      if (data.error) throw new Error(`API-Fehler: ${data.error.message || JSON.stringify(data.error)}`)
      const raw = data.content?.[0]?.text || ''
      const cards = parseCards(raw)
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Keine Karten in der Antwort gefunden.')
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
          try {
            const names = JSON.parse(m[0]).filter(n => typeof n === 'string' && n.trim())
            if (names.length > 0) setSubSuggestions(names.slice(0, 3))
          } catch (_) {}
        }
      }).catch(() => {})
    } catch (e) {
      console.error('[KI] generate error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const generateFromLehrplan = async () => {
    const opt = LEHRPLAN_OPTIONS.find(o => o.id === lehrplanSel)
    if (!opt) return
    const customTopic = lehrplanCustom.trim()
    if (opt.id === 'custom' && !customTopic) return
    const label = opt.id === 'custom' ? customTopic : opt.label
    const year  = new Date().getFullYear()
    setLoading(true); setError(''); setPreview(null); setLehrplanOpen(false)
    try {
      console.log('[KI Lehrplan] Step 1+2 via API — topic:', label, 'country:', lehrplanCountry)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lehrplan: { topic: opt.id, label, country: lehrplanCountry, year },
        }),
      })
      console.log('[KI Lehrplan] response status:', res.status)
      const data = await res.json()
      if (data.error) throw new Error(`API-Fehler: ${data.error.message || JSON.stringify(data.error)}`)
      const raw = data.content?.[0]?.text || ''
      const cards = parseCards(raw)
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('Keine Karten in der Antwort gefunden.')
      setPreview(cards.map(c => ({ ...c, _dest: destList[0].path })))
      setSubDismissed(false)
    } catch (e) {
      console.error('[KI Lehrplan] error:', e)
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
    <div className="app-bg" style={{ position: 'fixed', inset: 0, zIndex: 500, overflowY: 'auto' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px 80px' }}>
        <Header title="KI-Kartengenerator" onBack={onClose} />

        <div style={{ padding: '32px 0' }}>
          {!preview ? (<>
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

              {/* ── Lehrplan button ── */}
              <div style={{ marginTop: 16, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontSize: 11, color: T.textDim, whiteSpace: 'nowrap' }}>oder</span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
                <button
                  onClick={() => setLehrplanOpen(o => !o)}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '12px 18px', borderRadius: T.r2,
                    background: T.s2, border: `1px solid ${lehrplanOpen ? T.acc + '66' : T.border}`,
                    color: T.text, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <span>📚 Nach offiziellem Lehrplan</span>
                  <span style={{ color: T.textDim, fontSize: 12 }}>{lehrplanOpen ? '▲' : '▼'}</span>
                </button>

                {lehrplanOpen && (
                  <div style={{
                    marginTop: 8, background: T.s1, border: `1px solid ${T.border}`,
                    borderRadius: T.r2, overflow: 'hidden',
                  }}>
                    {/* Country picker */}
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, background: T.s2 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, marginBottom: 8 }}>LAND</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {LEHRPLAN_COUNTRIES.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setLehrplanCountry(c.id)}
                            style={{
                              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                              background: lehrplanCountry === c.id ? T.acc : T.s3,
                              color: lehrplanCountry === c.id ? '#fff' : T.textSub,
                              border: `1px solid ${lehrplanCountry === c.id ? T.acc : T.border}`,
                              cursor: 'pointer', transition: 'all 0.12s',
                            }}
                          >{c.label}</button>
                        ))}
                      </div>
                    </div>

                    {/* Topic list */}
                    {LEHRPLAN_OPTIONS.map(opt => (
                      <div key={opt.id}>
                        <button
                          onClick={() => setLehrplanSel(s => s === opt.id ? null : opt.id)}
                          style={{
                            width: '100%', padding: '11px 16px', background: lehrplanSel === opt.id ? T.accDim : 'transparent',
                            border: 'none', borderBottom: `1px solid ${T.border}`,
                            color: lehrplanSel === opt.id ? T.acc : T.text,
                            fontSize: 14, textAlign: 'left', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}
                        >
                          {opt.label}
                          {lehrplanSel === opt.id && <span style={{ fontSize: 12 }}>✓</span>}
                        </button>
                        {lehrplanSel === opt.id && opt.id === 'custom' && (
                          <div style={{ padding: '10px 16px', background: T.s2, borderBottom: `1px solid ${T.border}` }}>
                            <input
                              value={lehrplanCustom}
                              onChange={e => setLehrplanCustom(e.target.value)}
                              placeholder="z.B. Industriemechaniker IHK, Pflege Abschlussprüfung…"
                              style={{
                                width: '100%', background: T.s1, border: `1px solid ${T.border}`,
                                borderRadius: T.r, color: T.text, fontSize: 13,
                                padding: '8px 12px', outline: 'none', boxSizing: 'border-box',
                              }}
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Info + generate */}
                    {lehrplanSel && (
                      <div style={{ padding: '10px 16px', background: T.accDim, borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 11, color: T.acc }}>
                          ✦ KI sucht zuerst den aktuellen offiziellen Lehrplan ({lehrplanCountry}, {new Date().getFullYear()}), dann werden Karten generiert.
                        </div>
                      </div>
                    )}
                    <div style={{ padding: '12px 16px', background: T.s1 }}>
                      <Btn
                        onClick={generateFromLehrplan}
                        disabled={!lehrplanSel || (lehrplanSel === 'custom' && !lehrplanCustom.trim()) || loading}
                        full style={{ padding: '10px', fontSize: 14 }}
                      >
                        {loading ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Lehrplan wird gesucht…</> : '✦ Karten generieren'}
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Anki Import ── */}
            <div style={{ marginTop: 16, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: T.border }} />
                <span style={{ fontSize: 11, color: T.textDim, whiteSpace: 'nowrap' }}>oder</span>
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>
              <button
                onClick={() => setAnkiOpen(o => !o)}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px 18px', borderRadius: T.r2,
                  background: T.s2, border: `1px solid ${ankiOpen ? T.acc + '66' : T.border}`,
                  color: T.text, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.15s',
                }}
              >
                <span>📥 Anki-Import (.txt)</span>
                <span style={{ color: T.textDim, fontSize: 12 }}>{ankiOpen ? '▲' : '▼'}</span>
              </button>

              {ankiOpen && (
                <div style={{ marginTop: 8, background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: 16 }}>
                  <div style={{ fontSize: 12, color: T.textDim, marginBottom: 12, lineHeight: 1.6 }}>
                    Anki-Export als .txt hochladen (Tab-getrennt: Vorderseite<strong style={{ color: T.textSub }}>[Tab]</strong>Rückseite) oder Text direkt einfügen.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <Btn
                      onClick={() => ankiFileRef.current?.click()}
                      variant="secondary"
                      style={{ padding: '9px 16px', fontSize: 13 }}
                    >
                      📂 .txt Datei wählen
                    </Btn>
                    <input ref={ankiFileRef} type="file" accept=".txt,.tsv" onChange={handleAnkiFile} style={{ display: 'none' }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>— oder Text direkt einfügen —</div>
                  <textarea
                    value={ankiText}
                    onChange={e => setAnkiText(e.target.value)}
                    rows={6}
                    placeholder={"Vorderseite\tRückseite\nNächste Karte\tNächste Antwort"}
                    style={{ marginBottom: 10, fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <Btn
                    onClick={() => importAnki(ankiText)}
                    disabled={!ankiText.trim()}
                    full style={{ padding: '10px', fontSize: 14 }}
                  >
                    📥 Importieren
                  </Btn>
                </div>
              )}
            </div>

          </>) : (
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
// ─── PUBLIC SHARE MODAL ───────────────────────────────────────────────────────
const PublicShareModal = ({ cards, folderName, createdBy, onClose }) => {
  const [shareId,  setShareId]  = useState(null)
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState(false)

  const create = async () => {
    setCreating(true)
    try {
      const cleanCards = cards.map(({ front, back, backShort, image, pronunciation_de, pronunciation_en }) =>
        ({ front: front||'', back: back||'', backShort: backShort||'', image: image||null, pronunciation_de: pronunciation_de||'', pronunciation_en: pronunciation_en||'' })
      )
      const ref = await addDoc(collection(db, 'publicSets'), {
        folderName, createdBy, cards: cleanCards,
        createdAt: serverTimestamp(), viewCount: 0,
      })
      setShareId(ref.id)
    } catch (e) { console.error('[PublicShare]', e) }
    setCreating(false)
  }

  const shareUrl = shareId ? `https://katara-eta.vercel.app/share/${shareId}` : null

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <Modal onClose={onClose} width={480}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>🔗 Set öffentlich teilen</h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 20 }}>
        Erstelle einen öffentlichen Link. Jeder mit dem Link kann das Set ansehen und importieren — kein Login nötig.
      </p>
      {!shareId ? (
        <>
          <div style={{ padding: '12px 16px', background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r, marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{folderName}</div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{cards.length} Karten</div>
          </div>
          <Btn onClick={create} disabled={creating} full style={{ padding: '12px' }}>
            {creating ? <><span style={{ display:'inline-block', animation:'spin 1s linear infinite' }}>⟳</span> Link wird erstellt…</> : '🔗 Öffentlichen Link erstellen'}
          </Btn>
        </>
      ) : (
        <div className="fade-in">
          <div style={{ padding: '14px 16px', background: T.accDim, border: `1px solid ${T.acc}44`, borderRadius: T.r2, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.acc, fontWeight: 700, letterSpacing: 0.8, marginBottom: 6 }}>LINK ERSTELLT</div>
            <div style={{ fontSize: 12, color: T.text, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.6 }}>{shareUrl}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={copy} full style={{ padding: '10px' }}>
              {copied ? '✓ Kopiert!' : '📋 Link kopieren'}
            </Btn>
            <Btn onClick={onClose} variant="secondary" style={{ padding: '10px 16px', flexShrink: 0 }}>Schließen</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── PUBLIC SET VIEW (no-auth page at /share/{id}) ────────────────────────────
const PublicSetView = ({ shareId, currentUser }) => {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [posting,  setPosting]  = useState(false)
  const [imported, setImported] = useState(false)
  const [importing,setImporting]= useState(false)

  useEffect(() => {
    getDoc(doc(db, 'publicSets', shareId))
      .then(snap => {
        if (!snap.exists()) { setNotFound(true); setLoading(false); return }
        setData({ id: snap.id, ...snap.data() })
        // bump view count
        updateDoc(doc(db, 'publicSets', shareId), { viewCount: increment(1) }).catch(() => {})
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [shareId])

  useEffect(() => {
    if (!shareId) return
    const unsub = onSnapshot(
      query(collection(db, `publicSets/${shareId}/comments`), orderBy('createdAt', 'asc')),
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    )
    return unsub
  }, [shareId])

  const postComment = async () => {
    if (!newComment.trim() || !currentUser) return
    setPosting(true)
    await addDoc(collection(db, `publicSets/${shareId}/comments`), {
      text: newComment.trim(),
      authorName: currentUser.displayName || currentUser.email,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp(),
    }).catch(() => {})
    setNewComment('')
    setPosting(false)
  }

  const importSet = async () => {
    if (!currentUser || !data) return
    setImporting(true)
    try {
      const catRef = await addDoc(collection(db, `users/${currentUser.uid}/categories`), {
        name: data.folderName, color: 'blue',
        sharedBy: { name: data.createdBy }, readOnly: false,
        createdAt: serverTimestamp(),
      })
      for (const c of data.cards || []) {
        await addDoc(collection(db, `users/${currentUser.uid}/categories/${catRef.id}/cards`), {
          ...c, mastery: 0, correctCount: 0, wrongCount: 0,
          lastReviewed: null, createdAt: serverTimestamp(),
        })
      }
      setImported(true)
    } catch (e) { console.error('[PublicSetView] import', e) }
    setImporting(false)
  }

  const bg = { minHeight: '100vh', background: T.bg, padding: '0 0 60px' }

  if (loading) return (
    <div style={{ ...bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: T.textDim, fontSize: 14 }}>Wird geladen…</div>
    </div>
  )
  if (notFound) return (
    <div style={{ ...bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>Set nicht gefunden</div>
        <div style={{ fontSize: 13, color: T.textSub, marginBottom: 24 }}>Dieser Link ist ungültig oder wurde entfernt.</div>
        <Btn onClick={() => window.location.href = '/'}>Zur App</Btn>
      </div>
    </div>
  )

  return (
    <div className="app-bg" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="header-glass" style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '2px solid #00D4AA' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo size={20} subtitle />
          <div style={{ flex: 1 }} />
          {currentUser ? (
            <Btn onClick={() => window.location.href = '/'} variant="secondary" style={{ padding: '6px 14px', fontSize: 13 }}>← Zur App</Btn>
          ) : (
            <Btn onClick={() => window.location.href = '/'} style={{ padding: '6px 14px', fontSize: 13 }}>Anmelden & importieren</Btn>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }} className="fade-in">
        {/* Set info */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: T.acc, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>GETEILTES KARTENSET</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 6 }}>{data.folderName}</h1>
          <div style={{ fontSize: 13, color: T.textSub }}>
            {data.cards?.length || 0} Karten · Geteilt von {data.createdBy}
          </div>
        </div>

        {/* Import button */}
        {currentUser && (
          <div style={{ marginBottom: 24 }}>
            {imported ? (
              <div style={{ padding: '12px 18px', background: T.greenDim, border: `1px solid ${T.green}44`, borderRadius: T.r2, color: T.green, fontSize: 14, fontWeight: 600 }}>
                ✓ Set importiert! Du findest es in deinen Kategorien.
              </div>
            ) : (
              <Btn onClick={importSet} disabled={importing} style={{ padding: '11px 22px', fontSize: 14 }}>
                {importing ? 'Wird importiert…' : '📥 In meine Kategorien importieren'}
              </Btn>
            )}
          </div>
        )}
        {!currentUser && (
          <div style={{ padding: '14px 18px', background: T.accDim, border: `1px solid ${T.acc}33`, borderRadius: T.r2, marginBottom: 24 }}>
            <span style={{ fontSize: 13, color: T.acc }}>Melde dich an, um dieses Set zu importieren. </span>
            <button onClick={() => window.location.href='/'} style={{ background:'none', border:'none', color: T.acc, fontSize: 13, fontWeight: 700, cursor:'pointer', textDecoration:'underline' }}>Anmelden →</button>
          </div>
        )}

        {/* Card list */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 12 }}>
            Karten ({data.cards?.length || 0})
          </div>
          {(data.cards || []).map((c, i) => (
            <div key={i} className="glass-card" style={{
              borderRadius: T.r2, padding: '13px 16px', marginBottom: 8,
              borderLeft: `3px solid ${T.acc}66`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.front || '(Bild)'}</div>
              {c.back && <div style={{ fontSize: 12, color: T.textSub, marginTop: 4 }}>→ {c.back}{c.backShort ? ` · ${c.backShort}` : ''}</div>}
            </div>
          ))}
        </div>

        {/* Comments */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 14 }}>
            Kommentare ({comments.length})
          </div>
          {comments.length === 0 && (
            <div style={{ fontSize: 13, color: T.textDim, marginBottom: 18 }}>Noch keine Kommentare. Sei der Erste!</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display:'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accDim, border:`1px solid ${T.acc}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontWeight: 700, color: T.acc, flexShrink: 0 }}>
                {(c.authorName||'?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display:'flex', gap: 8, alignItems:'baseline', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.authorName}</span>
                  {c.createdAt?.seconds && <span style={{ fontSize: 11, color: T.textDim }}>{new Date(c.createdAt.seconds*1000).toLocaleDateString('de-DE')}</span>}
                </div>
                <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.5 }}>{c.text}</div>
              </div>
            </div>
          ))}
          {currentUser ? (
            <div style={{ display:'flex', gap: 8, marginTop: 4 }}>
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
                placeholder="Kommentar schreiben…"
                style={{ flex: 1 }}
              />
              <Btn onClick={postComment} disabled={posting || !newComment.trim()} style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0 }}>
                {posting ? '…' : 'Senden'}
              </Btn>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 8 }}>Melde dich an, um zu kommentieren.</div>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const { cardSize } = useSettings()
  const learnFrontSize = cardSize === 'small' ? 18 : cardSize === 'large' ? 28 : 22
  const learnBackSize  = cardSize === 'small' ? 20 : cardSize === 'large' ? 30 : 24
  const learnShortSize = cardSize === 'small' ? 13 : cardSize === 'large' ? 19 : 16
  const [phase,         setPhase]         = useState('settings') // settings|loading|session|result
  const [cardCount,     setCardCount]     = useState(() => Math.min(10, initCards.length))
  const [learnMode,     setLearnMode]     = useState('klassisch')
  const [queue,         setQueue]         = useState([])   // mutable session queue; queue[0] = current card
  const [sessionSize,   setSessionSize]   = useState(0)    // initial queue length for progress bar
  const [flipped,       setFlipped]       = useState(false)
  const [results,       setResults]       = useState([])   // [{card, rating}] — may contain duplicates (re-shown cards)
  const [kiError,       setKiError]       = useState('')
  const [wrongTips,     setWrongTips]     = useState({})
  const [tipsLoading,   setTipsLoading]   = useState(false)
  const [micActive,     setMicActive]     = useState(false)
  const [micTranscript, setMicTranscript] = useState('')
  const [patternTip,    setPatternTip]    = useState('')
  const [showPatternTip, setShowPatternTip] = useState(false)
  const sessionStartRef    = useRef(null)
  const sessionAttemptsRef = useRef({})   // {cardId: timesProcessed} — caps re-inserts
  const sessionFalschRef   = useRef(0)    // cumulative falsch count for pattern detection
  const patternTriggeredRef = useRef(false)
  const micRef             = useRef(null)

  const countOptions = (() => {
    const opts = [5, 10, 20].filter(n => n <= initCards.length)
    if (!opts.includes(initCards.length)) opts.push(initCards.length)
    return opts
  })()

  const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const fetchWrongTips = async (hardResults) => {
    if (!hardResults.length) return
    setTipsLoading(true)
    const tips = {}
    for (const { card } of hardResults) {
      if (tips[card.id]) continue
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
    const now = new Date()
    // Filter to cards that are due (nextReview in the past or not set)
    const dueCards = initCards.filter(card => {
      if (card.nextReview) {
        const nr = card.nextReview.toDate ? card.nextReview.toDate() : new Date(card.nextReview)
        if (nr > now) return false
      }
      return true
    })
    const source = dueCards.length > 0 ? dueCards : initCards
    const count = Math.min(cardCount, source.length)
    setKiError('')
    sessionStartRef.current = Date.now()
    sessionAttemptsRef.current = {}
    sessionFalschRef.current = 0
    patternTriggeredRef.current = false
    setPatternTip(''); setShowPatternTip(false)

    if (learnMode === 'klassisch') {
      const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, count)
      setQueue(shuffled); setSessionSize(shuffled.length)
      setFlipped(false); setResults([]); setMicTranscript('')
      setPhase('session')
      return
    }

    // KI-Auswahl
    setPhase('loading')
    try {
      const cardList = source.map(c => ({
        id: c.id, front: c.front,
        mastery: c.mastery || 0,
        daysSinceReview: c.lastReviewed?.seconds
          ? Math.floor((Date.now() / 1000 - c.lastReviewed.seconds) / 86400) : null,
      }))
      const prompt = `You are a learning optimizer. Select the ${count} most important flashcards to study now. Prioritize unseen (mastery 0), then wrong (mastery 1), then least recently reviewed. Cards: ${JSON.stringify(cardList)}. Return ONLY a JSON array of IDs: ["id1","id2",...]`
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const match = raw.match(/\[[\s\S]*?\]/)
      if (!match) throw new Error('no JSON')
      const ids = JSON.parse(match[0])
      const cardMap = Object.fromEntries(source.map(c => [c.id, c]))
      const ordered = ids.map(id => cardMap[id]).filter(Boolean)
      const remaining = source.filter(c => !ids.includes(c.id))
      const sessionCards = [...ordered, ...remaining].slice(0, count)
      setQueue(sessionCards); setSessionSize(sessionCards.length)
    } catch {
      setKiError('KI-Auswahl fehlgeschlagen — klassische Reihenfolge wird verwendet.')
      const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, count)
      setQueue(shuffled); setSessionSize(shuffled.length)
    }
    setFlipped(false); setResults([]); setMicTranscript('')
    setPhase('session')
  }

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR || micActive || flipped) return
    const card = queue[0]
    const r = new SR()
    r.lang = 'de-DE'
    r.interimResults = false
    r.maxAlternatives = 5
    r.onresult = e => {
      const alts = Array.from(e.results[0]).map(a => a.transcript)
      const spoken = alts[0] || ''
      setMicTranscript(spoken)
      setMicActive(false)
      // Auto-flip if transcript closely matches card back
      const norm = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9äöüß]/gi, '')
      const back = norm(card.back || '')
      const short = norm(card.backShort || '')
      const sp = norm(spoken)
      if (sp && (back.includes(sp) || sp.includes(back) || (short && (short.includes(sp) || sp.includes(short))))) {
        setFlipped(true)
      }
    }
    r.onerror = () => setMicActive(false)
    r.onend = () => setMicActive(false)
    micRef.current = r
    r.start()
    setMicActive(true)
    setMicTranscript('')
  }

  const rate = async (rating) => {
    const card = queue[0]
    const rest = [...queue.slice(1)]

    // Track how many times this card has been processed this session
    const attempts = (sessionAttemptsRef.current[card.id] || 0) + 1
    sessionAttemptsRef.current[card.id] = attempts

    // Build Firestore update
    const updates = { lastReviewed: serverTimestamp() }

    if (rating === 'falsch') {
      updates.wrongCount = increment(1)
      updates.consecutiveRight = 0
      if (card.mastered) updates.mastered = false
      // Re-insert at position 5 (cap at 2 re-inserts to prevent infinite loop)
      if (attempts < 3) {
        const insertAt = Math.min(4, rest.length)
        rest.splice(insertAt, 0, card)
      }
    } else if (rating === 'fast') {
      updates.fastCount = increment(1)
      updates.consecutiveRight = 0
      if (card.mastered && card.nextReview) {
        // Halve remaining review interval for mastered cards
        const now = Date.now()
        const nr = card.nextReview.toDate ? card.nextReview.toDate().getTime() : new Date(card.nextReview).getTime()
        updates.nextReview = new Date(now + Math.max(0, nr - now) / 2)
      }
      // Re-insert once for another chance this session
      if (attempts < 3) {
        const insertAt = Math.min(4, rest.length)
        rest.splice(insertAt, 0, card)
      }
    } else if (rating === 'richtig') {
      updates.rightCount = increment(1)
      const consRight = (card.consecutiveRight || 0) + 1
      updates.consecutiveRight = consRight
      // Skip future sessions after repeated success
      if (consRight >= 5) {
        updates.nextSessionDue = new Date(Date.now() + 2 * 86400000)
      } else if (consRight >= 3) {
        updates.nextSessionDue = new Date(Date.now() + 86400000)
      }
    } else if (rating === 'easy') {
      updates.easyCount = increment(1)
      updates.consecutiveRight = (card.consecutiveRight || 0) + 1
      const newEasyCount = (card.easyCount || 0) + 1
      if (newEasyCount >= 5) {
        // Card is MASTERED — start spaced review schedule
        updates.mastered = true
        if (!card.masteredAt) updates.masteredAt = serverTimestamp()
        const mri = card.masteryReviewIndex || 0
        const masteryDays = [30, 60, 90, 180, 180]
        updates.masteryReviewIndex = mri + 1
        updates.nextReview = new Date(Date.now() + (masteryDays[Math.min(mri, 4)] * 86400000))
      } else {
        // Spaced repetition: 1st=5d, 2nd=10d, 3rd=21d, 4th+=30d
        const easyDays = [5, 10, 21, 30]
        updates.nextReview = new Date(Date.now() + (easyDays[Math.min(newEasyCount - 1, 3)] * 86400000))
      }
    }

    try { await updateDoc(doc(db, `${cardsPath}/${card.id}`), updates) } catch (_) {}

    // Fehler-Muster: trigger KI analysis after 5th cumulative falsch
    if (rating === 'falsch') {
      sessionFalschRef.current += 1
      if (sessionFalschRef.current === 5 && !patternTriggeredRef.current) {
        patternTriggeredRef.current = true
        const wrongSoFar = [...results.filter(r => r.rating === 'falsch'), { card, rating }]
          .map(r => `- ${r.card.front}: ${r.card.back}`)
          .join('\n')
        fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 150,
            messages: [{ role: 'user', content: `Diese Lernkarten wurden falsch beantwortet:\n${wrongSoFar}\n\nAnalysiere das Muster: Was fällt dem Lernenden schwer? Gib einen konkreten Lerntipp auf Deutsch in maximal 2 Sätzen. Antworte NUR mit dem Tipp, ohne Einleitung.` }],
          }),
        }).then(r => r.json()).then(data => {
          const tip = data.content?.[0]?.text?.trim()
          if (tip) { setPatternTip(tip); setShowPatternTip(true) }
        }).catch(() => {})
      }
    }

    const newResults = [...results, { card, rating }]
    setResults(newResults)
    setMicTranscript('')

    if (rest.length === 0) {
      // Session complete — compute final per-card outcome (last rating wins)
      const durationMinutes = Math.round((Date.now() - (sessionStartRef.current || Date.now())) / 1000) / 60
      updateGlobalStats(uid, newResults.length, durationMinutes)
      const lastRatingMap = {}
      for (const r of newResults) lastRatingMap[r.card.id] = r
      const hardCards = Object.values(lastRatingMap).filter(r => r.rating === 'falsch' || r.rating === 'fast')
      fetchWrongTips(hardCards)
      setQueue([])
      setPhase('result')
    } else {
      setQueue(rest)
      setFlipped(false)
    }
  }

  const repeatWrong = (cards) => {
    sessionAttemptsRef.current = {}
    sessionFalschRef.current = 0; patternTriggeredRef.current = false
    setQueue(cards); setSessionSize(cards.length)
    setFlipped(false); setResults([]); setMicTranscript('')
    setWrongTips({}); setTipsLoading(false)
    setPatternTip(''); setShowPatternTip(false)
    setPhase('session')
  }

  const repeatAll = () => {
    sessionAttemptsRef.current = {}
    sessionFalschRef.current = 0; patternTriggeredRef.current = false
    const shuffled = [...initCards].sort(() => Math.random() - 0.5).slice(0, cardCount)
    setQueue(shuffled); setSessionSize(shuffled.length)
    setFlipped(false); setResults([]); setMicTranscript('')
    setWrongTips({}); setTipsLoading(false)
    setPatternTip(''); setShowPatternTip(false)
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
      <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="fade-in" style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📖</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Exo 2', sans-serif", color: T.text, marginBottom: 6 }}>Lerneinstellungen</h2>
            <p style={{ fontSize: 13, color: T.textSub }}>{initCards.length} Karten verfügbar</p>
          </div>

          <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r3, padding: '26px 24px 22px', marginBottom: 14 }}>
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
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 12 }}>Lernmodus</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'klassisch', icon: '🃏', label: 'Klassisch', desc: 'Karten in zufälliger Reihenfolge' },
                  { key: 'ki', icon: '✦', label: 'KI-Auswahl', desc: 'KI wählt die wichtigsten Karten für dich' },
                ].map(({ key, icon, label, desc }) => (
                  <button key={key} onClick={() => setLearnMode(key)} style={{
                    ...chipStyle(learnMode === key),
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 16px',
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
            <div style={{ fontSize: 13, color: T.red, marginBottom: 10, padding: '10px 14px', background: T.redDim, borderRadius: T.r }}>{kiError}</div>
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
      <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 16, color: T.acc }}>✦</div>
          <p style={{ color: T.textSub, fontSize: 14 }}>KI wählt optimale Karten aus…</p>
        </div>
      </div>
    )
  }

  // ── RESULT ───────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    // Use last rating per card (a card may have been shown multiple times)
    const lastRatingMap = {}
    for (const r of results) lastRatingMap[r.card.id] = r
    const finalResults = Object.values(lastRatingMap)
    const falschFinal  = finalResults.filter(r => r.rating === 'falsch')
    const fastFinal    = finalResults.filter(r => r.rating === 'fast')
    const richtigFinal = finalResults.filter(r => r.rating === 'richtig')
    const easyFinal    = finalResults.filter(r => r.rating === 'easy')
    const goodCount    = richtigFinal.length + easyFinal.length
    const totalUniq    = finalResults.length
    const pct          = totalUniq > 0 ? Math.round(goodCount / totalUniq * 100) : 0
    const hardResults  = [...falschFinal, ...fastFinal]
    const masteredNow  = easyFinal.filter(r => (r.card.easyCount || 0) + 1 >= 5)
    const lernzeit     = Math.round((Date.now() - (sessionStartRef.current || Date.now())) / 60000)

    // Weakest card: most times rated 'falsch' across all results (not just last)
    const falschCounts = {}
    for (const r of results) { if (r.rating === 'falsch') falschCounts[r.card.id] = (falschCounts[r.card.id] || 0) + 1 }
    const weakestId = Object.entries(falschCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    const weakestCard = weakestId ? finalResults.find(r => r.card.id === weakestId)?.card : null

    // Strongest card: rated easy or richtig with zero falsch
    const falschIds = new Set(Object.keys(falschCounts))
    const strongestCard = finalResults.find(r => !falschIds.has(r.card.id) && (r.rating === 'easy' || r.rating === 'richtig'))?.card || null

    return (
      <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 500, overflowY: 'auto' }}>
        <div style={{ maxWidth: 580, margin: '0 auto', padding: '40px 20px 100px' }}>
          <div className="fade-in" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{pct >= 80 ? '🎯' : pct >= 50 ? '📈' : '💪'}</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Exo 2', sans-serif", color: T.text, marginBottom: 6 }}>Session abgeschlossen</h2>
            <p style={{ color: T.textSub }}>{totalUniq} Karten bewertet</p>
          </div>

          {/* 4-stat score grid */}
          <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '20px 16px', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
              {[
                { label: 'Falsch', count: falschFinal.length, color: T.red, icon: '❌' },
                { label: 'Fast',   count: fastFinal.length,   color: T.amber, icon: '😕' },
                { label: 'Richtig',count: richtigFinal.length, color: T.green, icon: '✅' },
                { label: 'Easy',   count: easyFinal.length,   color: '#A78BFA', icon: '⚡' },
              ].map(({ label, count, color, icon }) => (
                <div key={label}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color }}>{count}</div>
                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, height: 4, borderRadius: 2, background: T.s4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${T.green}, #6EE7B7)`, borderRadius: 2, transition: 'width 0.6s' }} />
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: T.textDim, marginTop: 6 }}>{pct}% richtig / easy</div>
          </div>

          {/* Mastered notice */}
          {masteredNow.length > 0 && (
            <div style={{ background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: T.r2, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⭐</span>
              <span style={{ fontSize: 13, color: '#C4B5FD', fontWeight: 600 }}>{masteredNow.length} Karte{masteredNow.length > 1 ? 'n' : ''} gemeistert! Nächste Wiederholung in 30 Tagen.</span>
            </div>
          )}

          {/* Hard cards + KI tips */}
          {hardResults.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                Noch lernen ({hardResults.length})
                {tipsLoading && <span style={{ fontSize: 12, color: T.textDim, fontWeight: 400 }}>· Merkhilfen werden geladen…</span>}
              </div>
              {hardResults.map(({ card, rating }) => (
                <div key={card.id} style={{
                  background: T.s2, border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${rating === 'falsch' ? T.red : T.amber}88`,
                  borderRadius: T.r2, padding: '14px 16px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{rating === 'falsch' ? '❌' : '😕'}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{card.front}</div>
                  </div>
                  <div style={{ fontSize: 13, color: T.textSub }}>{card.back}{card.backShort ? ` · ${card.backShort}` : ''}</div>
                  {wrongTips[card.id] && (
                    <div style={{ fontSize: 13, color: T.acc, lineHeight: 1.6, background: T.accDim, borderRadius: T.r, padding: '8px 12px', marginTop: 10 }}>
                      {wrongTips[card.id]}
                    </div>
                  )}
                </div>
              ))}
              <Btn onClick={() => repeatWrong(hardResults.map(r => r.card))} variant="ghost" full style={{ marginTop: 6, padding: '12px' }}>
                🔁 Schwierige Karten wiederholen ({hardResults.length})
              </Btn>
            </div>
          )}

          {/* Session details: Lernzeit + weakest + strongest */}
          <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Session-Details</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: weakestCard || strongestCard ? 12 : 0 }}>
              <span style={{ fontSize: 16 }}>⏱</span>
              <span style={{ fontSize: 14, color: T.textSub }}>Lernzeit: <span style={{ color: T.text, fontWeight: 600 }}>{lernzeit < 1 ? '< 1 min' : `${lernzeit} min`}</span></span>
            </div>
            {weakestCard && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: strongestCard ? 10 : 0 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🔴</span>
                <div>
                  <div style={{ fontSize: 12, color: T.textDim, marginBottom: 2 }}>Schwächste Karte</div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{weakestCard.front}</div>
                  <div style={{ fontSize: 12, color: T.textSub }}>{weakestCard.back}</div>
                </div>
              </div>
            )}
            {strongestCard && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🟢</span>
                <div>
                  <div style={{ fontSize: 12, color: T.textDim, marginBottom: 2 }}>Stärkste Karte</div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{strongestCard.front}</div>
                  <div style={{ fontSize: 12, color: T.textSub }}>{strongestCard.back}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={repeatAll} variant="secondary" style={{ padding: '14px', fontSize: 15, flex: 1 }}>🔄 Nochmal</Btn>
            <Btn onClick={onClose} full style={{ padding: '14px', fontSize: 15, flex: 1 }}>Zurück</Btn>
          </div>
        </div>
      </div>
    )
  }

  // ── SESSION ───────────────────────────────────────────────────────────────────
  const card = queue[0]
  if (!card) return null
  // Progress: based on cards removed from initial session (completed = sessionSize - remaining unique)
  const uniqueRemaining = new Set(queue.map(c => c.id)).size
  const uniqueInitial   = sessionSize
  const progress        = uniqueInitial > 0 ? Math.max(0, (uniqueInitial - uniqueRemaining) / uniqueInitial * 100) : 0

  return (
    <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <Btn onClick={onClose} variant="secondary" style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}>✕ Beenden</Btn>
        <div style={{ flex: 1, height: 6, background: T.s4, borderRadius: 3, overflow: 'hidden' }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, flexShrink: 0 }}>
          {queue.length} übrig
        </div>
      </div>

      {/* Fehler-Muster notification */}
      {showPatternTip && patternTip && (
        <div
          onClick={() => setShowPatternTip(false)}
          style={{
            background: 'rgba(79,142,247,0.12)', borderBottom: `1px solid ${T.acc}44`,
            padding: '10px 20px', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.acc, marginBottom: 2 }}>KI hat ein Muster erkannt</div>
            <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.5 }}>{patternTip}</div>
          </div>
          <span style={{ fontSize: 12, color: T.textDim, marginLeft: 'auto', flexShrink: 0 }}>✕</span>
        </div>
      )}

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 580 }}>
          {/* Flashcard — CSS flip */}
          <div className="flip-container" style={{ marginBottom: 16, cursor: flipped ? 'default' : 'pointer' }} onClick={() => !flipped && !micActive && setFlipped(true)}>
            <div className={`flip-inner${flipped ? ' flipped' : ''}`} style={{ minHeight: 260 }}>
              {/* FRONT */}
              <div className="flip-front" style={{
                background: card.mastered ? 'rgba(26, 20, 50, 0.92)' : 'rgba(23, 30, 48, 0.8)',
                border: card.mastered ? '2px solid rgba(167,139,250,0.7)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: T.r3, padding: '48px 40px 32px', minHeight: 260,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center',
                boxShadow: card.mastered
                  ? '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(167,139,250,0.2), inset 0 1px 0 rgba(167,139,250,0.1)'
                  : '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}>
                {card.mastered && (
                  <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, fontWeight: 700, color: '#C4B5FD', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ⭐ Gemeistert
                  </div>
                )}
                {card.image && <img src={card.image} alt="" style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 10, marginBottom: 22, objectFit: 'contain' }} />}
                <div style={{ fontSize: learnFrontSize, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>{card.front || '(Bild)'}</div>
                {card.front && card.front.trim().length <= 3 && <PhoneticHint key={card.id} text={card.front.trim()} />}
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 20, letterSpacing: 0.5 }}>Klicken zum Aufdecken</div>
                {/* Mic button */}
                {hasSpeech && !flipped && (
                  <button
                    onClick={e => { e.stopPropagation(); startMic() }}
                    style={{
                      marginTop: 14, display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      background: micActive ? T.acc : T.s4,
                      border: `1px solid ${micActive ? T.acc : T.border}`,
                      color: micActive ? '#fff' : T.textSub,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 16, animation: micActive ? 'pulse 1s infinite' : 'none' }}>🎤</span>
                    {micActive ? 'Höre zu…' : 'Antwort sprechen'}
                  </button>
                )}
                {micTranscript && !flipped && (
                  <div style={{ marginTop: 8, fontSize: 13, color: T.textSub, fontStyle: 'italic' }}>
                    „{micTranscript}"
                  </div>
                )}
              </div>
              {/* BACK */}
              <div className="flip-back" style={{
                background: card.mastered ? 'rgba(26, 20, 50, 0.95)' : 'rgba(20, 28, 50, 0.88)',
                border: card.mastered ? '2px solid rgba(167,139,250,0.7)' : `1px solid ${T.acc}44`,
                borderRadius: T.r3, padding: '52px 40px', minHeight: 260,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center',
                boxShadow: card.mastered
                  ? '0 0 0 1px rgba(167,139,250,0.2), 0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(167,139,250,0.15)'
                  : `0 0 0 1px ${T.acc}22, 0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(79,142,247,0.1)`,
              }}>
                {card.backImage && <img src={card.backImage} alt="" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 10, marginBottom: 20, objectFit: 'contain' }} />}
                <div style={{ fontSize: 10, fontWeight: 700, color: T.acc, letterSpacing: 1.6, marginBottom: 14 }}>ANTWORT</div>
                <div style={{ fontSize: learnBackSize, fontWeight: 700, color: T.text, lineHeight: 1.4, marginBottom: 10 }}>{card.back}</div>
                {card.backShort && <div style={{ fontSize: learnShortSize, color: T.amber, fontWeight: 600, marginBottom: 10 }}>{card.backShort}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <TtsBtn text={card.pronunciation_de || card.back} lang="de-DE" label="🇩🇪 DE" />
                  {(card.pronunciation_en || card.back) && (
                    <TtsBtn text={card.pronunciation_en || card.back} lang="en-GB" label="🇬🇧 EN" />
                  )}
                </div>
                {(card.pronunciation_de || card.pronunciation_en) && (
                  <div style={{ marginTop: 16, padding: '12px 16px', textAlign: 'left', background: T.s1, borderRadius: T.r, border: `1px solid ${T.border}` }}>
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
              </div>
            </div>
          </div>

          {/* 4-button rating row */}
          {flipped && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              {[
                { rating: 'falsch', icon: '❌', label: 'Falsch',  bg: T.redDim,              border: `${T.red}44`,                 color: T.red    },
                { rating: 'fast',   icon: '😕', label: 'Fast',    bg: T.amberDim,            border: `${T.amber}44`,               color: T.amber  },
                { rating: 'richtig',icon: '✅', label: 'Richtig', bg: T.greenDim,            border: `${T.green}44`,               color: T.green  },
                { rating: 'easy',   icon: '⚡', label: 'Easy',    bg: 'rgba(0,212,170,0.12)', border: 'rgba(0,212,170,0.35)',       color: '#00D4AA'},
              ].map(({ rating, icon, label, bg, border, color }) => (
                <button
                  key={rating}
                  onClick={() => rate(rating)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '14px 8px', borderRadius: T.r2, fontSize: 13, fontWeight: 700,
                    background: bg, border: `1px solid ${border}`, color,
                    cursor: 'pointer', transition: 'transform 0.08s, box-shadow 0.08s',
                    boxShadow: `0 2px 8px rgba(0,0,0,0.2)`,
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95) translateY(1px)' }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <span style={{ fontSize: 20, marginBottom: 5 }}>{icon}</span>
                  <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
                </button>
              ))}
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

// ─── SHARED SETUP MODAL SHELL ─────────────────────────────────────────────────
// fileData: null | { name, type:'text', text } | { name, type:'pdf', base64 }
const SetupModal = ({ title, subtitle, onConfirm, onClose, children, canConfirm = true }) => {
  const [generating, setGenerating] = useState(false)
  const [genErr,     setGenErr]     = useState('')
  const [fileData,   setFileData]   = useState(null)
  const [fileErr,    setFileErr]    = useState('')
  const fileRef = useRef(null)

  const chip = (active) => ({
    padding: '6px 12px', borderRadius: T.r, fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? T.acc : T.border}`,
    background: active ? T.accDim : T.s3,
    color: active ? T.acc : T.textSub,
    cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
  })
  const labelEl = (text) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10 }}>{text}</div>
  )

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileErr('')
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf','txt','csv'].includes(ext)) {
      setFileErr('Nur PDF, TXT oder CSV erlaubt.')
      return
    }
    try {
      if (ext === 'pdf') {
        const arrayBuf = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuf)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        setFileData({ name: file.name, type: 'pdf', base64: btoa(binary) })
      } else {
        const text = await toText(file)
        setFileData({ name: file.name, type: 'text', text: text.slice(0, 14000) })
      }
    } catch { setFileErr('Datei konnte nicht gelesen werden.') }
  }

  const handle = async () => {
    setGenerating(true)
    setGenErr('')
    try {
      await onConfirm(fileData)
    } catch {
      setGenErr('KI-Generierung fehlgeschlagen. Versuche es erneut.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Modal onClose={generating ? undefined : onClose} width={560}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 22 }}>{subtitle}</p>
      <div style={{ opacity: generating ? 0.45 : 1, pointerEvents: generating ? 'none' : 'auto' }}>
        {typeof children === 'function' ? children({ chip, labelEl }) : children}

        {/* ── File upload ── */}
        <div style={{ marginTop: 18 }}>
          {!fileData ? (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', borderRadius: T.r,
              border: `1px dashed ${T.border}`,
              cursor: 'pointer', transition: 'border-color 0.15s',
              color: T.textDim, fontSize: 13,
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.acc}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
            >
              <span style={{ fontSize: 16 }}>📎</span>
              <span>Eigene Unterlagen hinzufügen <span style={{ color: T.textDim }}>(optional · PDF, TXT, CSV)</span></span>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', borderRadius: T.r,
              border: `1px solid ${T.green}55`, background: `${T.green}0D`,
              fontSize: 13,
            }}>
              <span style={{ fontSize: 15 }}>{fileData.type === 'pdf' ? '📄' : '📃'}</span>
              <span style={{ color: T.green, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileData.name}</span>
              <button onClick={() => { setFileData(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
          )}
          {fileErr && <div style={{ fontSize: 11, color: T.red, marginTop: 5 }}>{fileErr}</div>}
        </div>
      </div>

      {generating && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', margin: '16px 0 0',
          background: T.accDim, border: `1px solid ${T.acc}44`, borderRadius: T.r,
        }}>
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 16 }}>⟳</span>
          <span style={{ fontSize: 13, color: T.acc, fontWeight: 600 }}>KI generiert deine Karten…</span>
        </div>
      )}
      {genErr && (
        <div style={{ fontSize: 13, color: T.red, background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: T.r, padding: '10px 14px', marginTop: 14 }}>
          ⚠ {genErr}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <Btn onClick={handle} disabled={generating || !canConfirm} full style={{ padding: '11px' }}>
          {generating ? 'Wird generiert…' : '🤖 KI Karten generieren'}
        </Btn>
        {!generating && (
          <Btn onClick={onClose} variant="secondary" style={{ padding: '11px 16px', flexShrink: 0 }}>Abbrechen</Btn>
        )}
      </div>
    </Modal>
  )
}

// ─── BERUF SETUP MODAL ────────────────────────────────────────────────────────
const BERUF_FIELDS = ['Handwerk','IT','Medizin','Recht','Transport & Logistik','Gastronomie','Eigene Eingabe']
const BERUF_LEVELS = ['Azubi','Fachkraft','Quereinstieg','Meister','Studium']
const SETUP_COUNTRIES = ['Deutschland','Österreich','Schweiz','Andere']
const SETUP_LANGS = [
  { id:'de', label:'🇩🇪 DE' },
  { id:'en', label:'🇬🇧 EN' },
  { id:'es', label:'🇪🇸 ES' },
  { id:'fr', label:'🇫🇷 FR' },
  { id:'sw', label:'🌍 SW' },
]
const getLangLabel = lang => ({
  de: 'Deutsch', en: 'Englisch', es: 'Spanisch', fr: 'Französisch', sw: 'Swahili',
}[lang] || 'Deutsch')

const BerufSetupModal = ({ onConfirm, onClose }) => {
  const [field,   setField]   = useState('IT')
  const [custom,  setCustom]  = useState('')
  const [level,   setLevel]   = useState('Fachkraft')
  const [country, setCountry] = useState('Deutschland')
  const [lang,    setLang]    = useState('de')
  const topic = field === 'Eigene Eingabe' ? custom.trim() : field
  return (
    <SetupModal
      title="💼 Beruf einrichten"
      subtitle="KI generiert praxisnahe Lernkarten passend zu deinem Berufsfeld und Niveau."
      onConfirm={(fileData) => onConfirm({ field: topic, level, country, lang, fileData })}
      onClose={onClose}
      canConfirm={field !== 'Eigene Eingabe' || !!custom.trim()}
    >
      {({ chip, labelEl }) => (<>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Berufsfeld')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BERUF_FIELDS.map(f => <button key={f} onClick={() => setField(f)} style={chip(field === f)}>{f}</button>)}
          </div>
          {field === 'Eigene Eingabe' && (
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="z.B. Mechatroniker, Kaufmann im Einzelhandel…"
              style={{ marginTop: 10, width: '100%', background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r, color: T.text, fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }} autoFocus />
          )}
        </div>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Niveau')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BERUF_LEVELS.map(l => <button key={l} onClick={() => setLevel(l)} style={chip(level === l)}>{l}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Land')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SETUP_COUNTRIES.map(c => <button key={c} onClick={() => setCountry(c)} style={chip(country === c)}>{c}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          {labelEl('Lernsprache')}
          <div style={{ display: 'flex', gap: 6 }}>
            {SETUP_LANGS.map(l => <button key={l.id} onClick={() => setLang(l.id)} style={chip(lang === l.id)}>{l.label}</button>)}
          </div>
        </div>
      </>)}
    </SetupModal>
  )
}

// ─── STUDIUM SETUP MODAL ──────────────────────────────────────────────────────
const STUDIUM_FIELDS = ['Medizin','Jura','BWL','Informatik','Ingenieurwesen','Psychologie','Lehramt','Eigene Eingabe']
const STUDIUM_SEMESTERS = ['1–2','3–4','5–6','7+']

const StudiumSetupModal = ({ onConfirm, onClose }) => {
  const [studiengang, setStudiengang] = useState('BWL')
  const [custom,      setCustom]      = useState('')
  const [semester,    setSemester]    = useState('1–2')
  const [country,     setCountry]     = useState('Deutschland')
  const [lang,        setLang]        = useState('de')
  const topic = studiengang === 'Eigene Eingabe' ? custom.trim() : studiengang
  return (
    <SetupModal
      title="📚 Studium einrichten"
      subtitle="KI generiert prüfungsrelevante Lernkarten passend zu deinem Studiengang und Semester."
      onConfirm={(fileData) => onConfirm({ studiengang: topic, semester, country, lang, fileData })}
      onClose={onClose}
      canConfirm={studiengang !== 'Eigene Eingabe' || !!custom.trim()}
    >
      {({ chip, labelEl }) => (<>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Studiengang')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STUDIUM_FIELDS.map(f => <button key={f} onClick={() => setStudiengang(f)} style={chip(studiengang === f)}>{f}</button>)}
          </div>
          {studiengang === 'Eigene Eingabe' && (
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="z.B. Architektur, Sportwissenschaft…"
              style={{ marginTop: 10, width: '100%', background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r, color: T.text, fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }} autoFocus />
          )}
        </div>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Semester')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STUDIUM_SEMESTERS.map(s => <button key={s} onClick={() => setSemester(s)} style={chip(semester === s)}>Semester {s}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Land')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SETUP_COUNTRIES.map(c => <button key={c} onClick={() => setCountry(c)} style={chip(country === c)}>{c}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          {labelEl('Lernsprache')}
          <div style={{ display: 'flex', gap: 6 }}>
            {SETUP_LANGS.map(l => <button key={l.id} onClick={() => setLang(l.id)} style={chip(lang === l.id)}>{l.label}</button>)}
          </div>
        </div>
      </>)}
    </SetupModal>
  )
}

// ─── HOBBY SETUP MODAL ────────────────────────────────────────────────────────
const HOBBY_OPTIONS  = ['Sport','Musik','Kochen','Fotografie','Gaming','Kunst','Technik','Eigene Eingabe']
const HOBBY_LEVELS   = ['Anfänger','Fortgeschritten','Experte']

const HobbySetupModal = ({ onConfirm, onClose }) => {
  const [hobby,   setHobby]   = useState('Sport')
  const [custom,  setCustom]  = useState('')
  const [level,   setLevel]   = useState('Anfänger')
  const [lang,    setLang]    = useState('de')
  const topic = hobby === 'Eigene Eingabe' ? custom.trim() : hobby
  return (
    <SetupModal
      title="🎯 Hobby einrichten"
      subtitle="KI generiert Lernkarten passend zu deinem Hobby und Erfahrungsstand."
      onConfirm={(fileData) => onConfirm({ hobby: topic, level, lang, fileData })}
      onClose={onClose}
      canConfirm={hobby !== 'Eigene Eingabe' || !!custom.trim()}
    >
      {({ chip, labelEl }) => (<>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Hobby')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {HOBBY_OPTIONS.map(h => <button key={h} onClick={() => setHobby(h)} style={chip(hobby === h)}>{h}</button>)}
          </div>
          {hobby === 'Eigene Eingabe' && (
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="z.B. Schach, Angeln, Bouldern…"
              style={{ marginTop: 10, width: '100%', background: T.s1, border: `1px solid ${T.border}`, borderRadius: T.r, color: T.text, fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }} autoFocus />
          )}
        </div>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Niveau')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {HOBBY_LEVELS.map(l => <button key={l} onClick={() => setLevel(l)} style={chip(level === l)}>{l}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          {labelEl('Sprache')}
          <div style={{ display: 'flex', gap: 6 }}>
            {SETUP_LANGS.map(l => <button key={l.id} onClick={() => setLang(l.id)} style={chip(lang === l.id)}>{l.label}</button>)}
          </div>
        </div>
      </>)}
    </SetupModal>
  )
}

// ─── SCHOOL SETUP MODAL ───────────────────────────────────────────────────────
const SchoolSetupModal = ({ onConfirm, onClose }) => {
  const [grade,   setGrade]   = useState('Klasse 1')
  const [lang,    setLang]    = useState('de')
  const [country, setCountry] = useState('de')
  return (
    <SetupModal
      title="🎓 Schule einrichten"
      subtitle="KI kennt den offiziellen Lehrplan für dein Land und generiert altersgerechte Karten."
      onConfirm={(fileData) => onConfirm(grade, lang, country, fileData)}
      onClose={onClose}
    >
      {({ chip, labelEl }) => (<>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Land / Lehrplan')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SCHOOL_COUNTRIES.map(c => (
              <button key={c.id} onClick={() => setCountry(c.id)} style={chip(country === c.id)}>
                {c.flag} {c.name}{c.curriculum ? ` (${c.curriculum})` : ''}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          {labelEl('Klassenstufe')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SCHOOL_GRADES.map(g => <button key={g} onClick={() => setGrade(g)} style={chip(grade === g)}>{g}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          {labelEl('Lernsprache')}
          <div style={{ display: 'flex', gap: 8 }}>
            {SCHOOL_LANGS.map(l => <button key={l.id} onClick={() => setLang(l.id)} style={chip(lang === l.id)}>{l.label}</button>)}
          </div>
        </div>
      </>)}
    </SetupModal>
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
Each card must be unique and specific to the topic — no generic fillers.

${KI_CONTENT_RULES}

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
  const [choices, setChoices] = useState([]) // multiple-choice options for zählen/farbe
  const sessionStart = useRef(Date.now())

  const lang       = cat.schoolLang || 'de'
  const speechLang = lang === 'en' ? 'en-GB' : 'de-DE'
  const card       = session[idx]
  const hasSpeech  = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // Cards that use multiple-choice instead of free speech
  const isMultiChoice = card?.type === 'zählen' || card?.type === 'farbe' || card?.type === 'zahl'

  // Regenerate choices whenever the card changes
  useEffect(() => {
    if (!card) return
    setPhase('question'); setSpoken('')
    if (card.type === 'zählen' || card.type === 'zahl') {
      const correct = typeof card.count === 'number' ? card.count : (parseInt(card.front) || 3)
      const pool = [1,2,3,4,5,6,7,8,9,10].filter(n => n !== correct)
      const wrong = pool.sort(() => Math.random() - 0.5).slice(0, 3)
      setChoices([correct, ...wrong].sort(() => Math.random() - 0.5).map(String))
    } else if (card.type === 'farbe') {
      const correct = (card.back_de || card.front).toLowerCase()
      const pool = ['rot','blau','grün','gelb','orange','lila','rosa','braun','schwarz','weiß'].filter(c => c !== correct)
      const wrong = pool.sort(() => Math.random() - 0.5).slice(0, 3)
      setChoices([correct, ...wrong].sort(() => Math.random() - 0.5))
    } else {
      setChoices([])
    }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const pickChoice = (val) => {
    const correct = card.type === 'zählen' || card.type === 'zahl'
      ? String(typeof card.count === 'number' ? card.count : parseInt(card.front) || 3)
      : (card.back_de || card.front).toLowerCase()
    setSpoken(val)
    setPhase(val.toLowerCase() === correct.toLowerCase() ? 'correct' : 'wrong')
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

  const advance = async (rating) => {
    // rating: 'falsch'|'fast'|'richtig'|'easy'  (or boolean for speech auto-rating)
    const r = rating === true ? 'richtig' : rating === false ? 'falsch' : rating
    const updates = { lastReviewed: serverTimestamp() }
    if (r === 'falsch') {
      updates.wrongCount = increment(1)
      updates.consecutiveRight = 0
    } else if (r === 'fast') {
      updates.fastCount = increment(1)
      updates.consecutiveRight = 0
    } else if (r === 'richtig') {
      updates.rightCount = increment(1)
      updates.consecutiveRight = (card.consecutiveRight || 0) + 1
    } else if (r === 'easy') {
      updates.easyCount = increment(1)
      updates.consecutiveRight = (card.consecutiveRight || 0) + 1
      const newEasyCount = (card.easyCount || 0) + 1
      if (newEasyCount >= 5) {
        updates.mastered = true
        if (!card.masteredAt) updates.masteredAt = serverTimestamp()
        const mri = card.masteryReviewIndex || 0
        updates.masteryReviewIndex = mri + 1
        updates.nextReview = new Date(Date.now() + [30,60,90,180,180][Math.min(mri,4)] * 86400000)
      } else {
        updates.nextReview = new Date(Date.now() + [5,10,21,30][Math.min(newEasyCount-1,3)] * 86400000)
      }
    }
    try { await updateDoc(doc(db, `${cardsPath}/${card.id}`), updates) } catch (_) {}
    const newResults = [...results, { card, rating: r }]
    if (idx + 1 >= session.length) {
      const mins = Math.round((Date.now() - sessionStart.current) / 1000) / 60
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
    const goodCount = results.filter(r => r.rating === 'richtig' || r.rating === 'easy').length
    const pct = Math.round(goodCount / results.length * 100)
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="fade-in" style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 8 }}>Super gemacht!</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Falsch', count: results.filter(r => r.rating === 'falsch').length, color: T.red, icon: '❌' },
              { label: 'Fast',   count: results.filter(r => r.rating === 'fast').length,   color: T.amber, icon: '😕' },
              { label: 'Richtig',count: results.filter(r => r.rating === 'richtig').length, color: T.green, icon: '✅' },
              { label: 'Easy',   count: results.filter(r => r.rating === 'easy').length,   color: '#A78BFA', icon: '⚡' },
            ].map(({ label, count, color, icon }) => (
              <div key={label} style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 16 }}>{icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2 }}>{count}</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              </div>
            ))}
          </div>
          <Btn onClick={onClose} full style={{ padding: '14px', fontSize: 16 }}>Fertig</Btn>
        </div>
      </div>
    )
  }

  // ── SESSION ──────────────────────────────────────────────────────────────────
  const progress = idx / session.length * 100
  const cardType = card.type || (card.color ? 'farbe' : card.shape ? 'form' : card.emoji ? 'bild' : 'buchstabe')

  // TTS helper: speaks text at slow rate with given lang
  const speak = (text, lng, e) => {
    if (e) e.stopPropagation()
    const ss = window.speechSynthesis
    if (!ss || !text) return
    ss.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lng; u.rate = 0.7
    setTimeout(() => ss.speak(u), 80)
  }

  // German and English words for the card
  const wordDe = card.back_de || card.back || card.front
  const wordEn = card.back_en || card.front

  // Phase-based feedback colors
  const feedbackBg    = phase === 'correct' ? '#0D2E1E' : phase === 'wrong' ? '#2E0D0D' : 'rgba(255,255,255,0.09)'
  const feedbackBorder = phase === 'correct' ? T.green    : phase === 'wrong' ? T.red    : 'rgba(255,255,255,0.07)'

  // The two TTS buttons shown on every card
  const PronButtons = ({ deText, enText }) => (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
      <button
        onClick={e => speak(deText || wordDe, 'de-DE', e)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '10px 20px', borderRadius: T.r2, cursor: 'pointer',
          background: 'rgba(79,142,247,0.12)', border: `1px solid ${T.acc}55`,
          color: T.acc, fontWeight: 700, fontSize: 14, transition: 'all 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = T.accDim }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(79,142,247,0.12)' }}
      >
        <span style={{ fontSize: 22 }}>🇩🇪</span>
        <span style={{ fontSize: 11, letterSpacing: 0.3 }}>Deutsch</span>
      </button>
      <button
        onClick={e => speak(enText || wordEn, 'en-GB', e)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '10px 20px', borderRadius: T.r2, cursor: 'pointer',
          background: 'rgba(52,211,153,0.1)', border: `1px solid ${T.green}55`,
          color: T.green, fontWeight: 700, fontSize: 14, transition: 'all 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = T.greenDim }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)' }}
      >
        <span style={{ fontSize: 22 }}>🇬🇧</span>
        <span style={{ fontSize: 11, letterSpacing: 0.3 }}>English</span>
      </button>
    </div>
  )

  // SVG shapes for 'form' type
  const ShapeSvg = ({ shape }) => {
    const s = (shape || '').toLowerCase()
    const shapeEl = s === 'kreis' || s === 'circle'
      ? <circle cx="60" cy="60" r="50" fill={T.acc} opacity="0.85" />
      : s === 'dreieck' || s === 'triangle'
      ? <polygon points="60,8 112,110 8,110" fill={T.amber} opacity="0.85" />
      : s === 'stern' || s === 'star'
      ? <polygon points="60,5 72,40 110,40 80,62 92,98 60,75 28,98 40,62 10,40 48,40" fill="#FBBF24" opacity="0.9" />
      : s === 'herz' || s === 'heart'
      ? <path d="M60 100 C20 70 5 50 5 35 A25 25 0 0 1 60 25 A25 25 0 0 1 115 35 C115 50 100 70 60 100Z" fill={T.red} opacity="0.85" />
      : s === 'raute' || s === 'diamond'
      ? <polygon points="60,5 115,60 60,115 5,60" fill="#A78BFA" opacity="0.85" />
      : /* default rectangle */ <rect x="5" y="25" width="110" height="70" rx="8" fill={T.green} opacity="0.85" />
    return (
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: 'block', margin: '0 auto' }}>
        {shapeEl}
      </svg>
    )
  }

  // Color swatch for 'farbe' type
  const COLOR_MAP = {
    rot: '#EF4444', rot_en: 'red',
    blau: '#3B82F6', blau_en: 'blue',
    grün: '#22C55E', grün_en: 'green',
    gelb: '#EAB308', gelb_en: 'yellow',
    orange: '#F97316', orange_en: 'orange',
    lila: '#A855F7', lila_en: 'purple',
    rosa: '#EC4899', rosa_en: 'pink',
    schwarz: '#1F2937', schwarz_en: 'black',
    weiß: '#F9FAFB', weiß_en: 'white',
    braun: '#92400E', braun_en: 'brown',
  }
  const colorKey = Object.keys(COLOR_MAP).find(k => !k.endsWith('_en') && (
    (card.front || '').toLowerCase().includes(k) || (card.back || '').toLowerCase().includes(k)
  ))
  const swatchColor = card.colorHex || (colorKey ? COLOR_MAP[colorKey] : T.acc)

  // ── CARD VISUAL by type ───────────────────────────────────────────────────────
  const CardVisual = ({ showAnswer = false }) => {
    if (cardType === 'zählen') {
      // Show the emoji repeated `count` times, large, wrapped
      const countNum = typeof card.count === 'number' ? card.count : 3
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
            gap: 6, maxWidth: 280, lineHeight: 1,
          }}>
            {Array.from({ length: Math.min(countNum, 10) }).map((_, i) => (
              <span key={i} style={{ fontSize: countNum <= 5 ? 64 : 48 }}>{card.emoji || '⭐'}</span>
            ))}
          </div>
          {showAnswer && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: T.green, lineHeight: 1 }}>{countNum}</div>
              <div style={{ fontSize: 20, color: T.textSub, marginTop: 6, fontWeight: 600 }}>
                {wordDe}{wordEn && wordEn !== wordDe ? ` · ${wordEn}` : ''}
              </div>
            </div>
          )}
        </div>
      )
    }
    if (cardType === 'zahl') {
      // Show the digit very large + emoji repeated count times below
      const countNum = typeof card.count === 'number' ? card.count : parseInt(card.front) || 1
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            fontSize: 'clamp(100px, 22vw, 160px)', fontWeight: 900, lineHeight: 1,
            color: T.text, textShadow: `0 0 40px ${T.acc}44`,
          }}>{card.front}</div>
          {card.emoji && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
              {Array.from({ length: Math.min(countNum, 10) }).map((_, i) => (
                <span key={i} style={{ fontSize: 36 }}>{card.emoji}</span>
              ))}
            </div>
          )}
          {showAnswer && (
            <div style={{ fontSize: 22, color: T.textSub, fontWeight: 600, marginTop: 4 }}>
              {wordDe}{wordEn && wordEn !== wordDe ? ` · ${wordEn}` : ''}
            </div>
          )}
        </div>
      )
    }
    if (cardType === 'farbe') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 110, height: 110, borderRadius: 20,
            background: swatchColor,
            boxShadow: `0 0 40px ${swatchColor}88, 0 6px 20px rgba(0,0,0,0.4)`,
            border: '3px solid rgba(255,255,255,0.18)',
          }} />
          {showAnswer && (
            <>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.text, lineHeight: 1 }}>{wordDe}</div>
              {wordEn && wordEn !== wordDe && (
                <div style={{ fontSize: 22, color: T.textSub, fontWeight: 600 }}>{wordEn}</div>
              )}
            </>
          )}
        </div>
      )
    }
    if (cardType === 'form') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <ShapeSvg shape={card.shape || card.front} />
          {showAnswer && (
            <>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.text }}>{wordDe}</div>
              {wordEn && wordEn !== wordDe && (
                <div style={{ fontSize: 22, color: T.textSub, fontWeight: 600 }}>{wordEn}</div>
              )}
            </>
          )}
        </div>
      )
    }
    if (cardType === 'bild' || card.emoji || card.image) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {card.image && card.image.startsWith('http')
            ? <img src={card.image} alt={card.front} style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 18 }} />
            : <div style={{ fontSize: 96, lineHeight: 1 }}>{card.emoji}</div>
          }
          <div style={{ fontSize: 34, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>{wordDe}</div>
          {wordEn && wordEn !== wordDe && (
            <div style={{ fontSize: 22, color: T.textSub, fontWeight: 600 }}>{wordEn}</div>
          )}
        </div>
      )
    }
    // buchstabe — very large single character
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{
          fontSize: 'clamp(100px, 22vw, 160px)', fontWeight: 900, lineHeight: 1,
          color: T.text, textShadow: `0 0 40px ${T.acc}44`,
        }}>{card.front}</div>
        {card.emoji && (
          <div style={{ fontSize: 56, lineHeight: 1 }}>{card.emoji}</div>
        )}
        {showAnswer && (
          <div style={{ fontSize: 24, color: T.textSub, fontWeight: 600, marginTop: 4 }}>
            {wordDe}{wordEn && wordEn !== wordDe ? ` · ${wordEn}` : ''}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <Btn onClick={onClose} variant="secondary" style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}>✕ Beenden</Btn>
        <div style={{ flex: 1, height: 6, background: T.s4, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: T.acc, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, flexShrink: 0 }}>{idx + 1} / {session.length}</div>
      </div>

      {/* Scrollable card area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* ── Main card ─────────────────────────────────────────────────────── */}
          <div className="fade-in" style={{
            background: feedbackBg,
            border: `2px solid ${feedbackBorder}`,
            borderRadius: 24, padding: '48px 32px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', marginBottom: 20,
            transition: 'background 0.25s, border-color 0.25s',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>

            {/* Question visual */}
            {phase === 'question' || phase === 'listening' ? (
              <>
                <CardVisual showAnswer={false} />
                {/* Counting question label */}
                {(cardType === 'zählen') && (
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.textSub, marginTop: 20 }}>
                    Wie viele sind es?
                  </div>
                )}
                {/* Color question label */}
                {cardType === 'farbe' && (
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.textSub, marginTop: 20 }}>
                    Welche Farbe ist das?
                  </div>
                )}
                {!isMultiChoice && <PronButtons deText={wordDe} enText={wordEn} />}
                {phase === 'listening' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, color: T.acc, fontSize: 14, fontWeight: 600 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.acc, display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                    Ich höre zu…
                  </div>
                )}
              </>
            ) : phase === 'correct' ? (
              <>
                <CardVisual showAnswer={true} />
                <div style={{ marginTop: 20, fontSize: 44 }}>✅</div>
                {spoken && (
                  <div style={{ fontSize: 14, color: T.textDim, marginTop: 8 }}>
                    {isMultiChoice ? `Richtig! ${spoken}` : `„${spoken}"`}
                  </div>
                )}
                <PronButtons deText={wordDe} enText={wordEn} />
              </>
            ) : phase === 'wrong' ? (
              <>
                <CardVisual showAnswer={true} />
                <div style={{ marginTop: 20, fontSize: 44 }}>❌</div>
                {spoken && (
                  <div style={{ fontSize: 14, color: T.textDim, marginTop: 6 }}>
                    {isMultiChoice ? `Du hast ${spoken} gewählt.` : `Du sagtest: „${spoken}"`}
                  </div>
                )}
                <div style={{ fontSize: 16, color: T.red, fontWeight: 700, marginTop: 8 }}>
                  Richtig: {getAnswer()}
                </div>
                <PronButtons deText={wordDe} enText={wordEn} />
              </>
            ) : phase === 'revealed' ? (
              <>
                <CardVisual showAnswer={true} />
                <PronButtons deText={wordDe} enText={wordEn} />
              </>
            ) : null}
          </div>

          {/* ── Action buttons ──────────────────────────────────────────────────── */}
          {phase === 'question' && isMultiChoice && choices.length === 4 && (
            /* Multiple-choice grid for zählen / farbe / zahl */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {choices.map(val => {
                  const isColorChoice = cardType === 'farbe'
                  const COLOR_HEX_MAP = {
                    rot:'#EF4444',blau:'#3B82F6',grün:'#22C55E',gelb:'#EAB308',
                    orange:'#F97316',lila:'#A855F7',rosa:'#EC4899',braun:'#92400E',
                    schwarz:'#374151',weiß:'#F9FAFB',
                  }
                  return (
                    <button
                      key={val}
                      onClick={() => pickChoice(val)}
                      style={{
                        padding: '20px 12px', borderRadius: T.r2, cursor: 'pointer',
                        border: `2px solid ${T.border}`,
                        background: isColorChoice ? `${COLOR_HEX_MAP[val] || T.s3}22` : T.s3,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        transition: 'transform 0.08s, border-color 0.12s',
                      }}
                      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)' }}
                      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.acc }}
                    >
                      {isColorChoice && (
                        <div style={{
                          width: 44, height: 44, borderRadius: 10,
                          background: COLOR_HEX_MAP[val] || T.s4,
                          border: '2px solid rgba(255,255,255,0.2)',
                        }} />
                      )}
                      <span style={{
                        fontSize: isColorChoice ? 18 : 36,
                        fontWeight: 800,
                        color: isColorChoice ? T.text : T.text,
                      }}>{val}</span>
                    </button>
                  )
                })}
              </div>
              {/* Mic as secondary option */}
              {hasSpeech && (
                <button onClick={startListening} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', marginTop: 12, padding: '12px', borderRadius: T.r2,
                  background: 'transparent', border: `1px solid ${T.border}`,
                  color: T.textDim, fontSize: 13, cursor: 'pointer',
                }}>
                  🎤 Sprechen
                </button>
              )}
            </div>
          )}
          {phase === 'question' && !isMultiChoice && (
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
                  width: '100%', padding: '14px', borderRadius: T.r2,
                  background: T.s3, border: `1px solid ${T.border}`,
                  color: T.textSub, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Antwort zeigen
              </button>
            </div>
          )}
          {phase === 'listening' && (
            <div style={{ textAlign: 'center', color: T.textDim, fontSize: 13, padding: '10px 0' }}>Bitte sprich deutlich und klar…</div>
          )}
          {(phase === 'correct' || phase === 'wrong') && (
            <Btn onClick={() => advance(phase === 'correct' ? 'richtig' : 'falsch')} full style={{ padding: '16px', fontSize: 16 }}>
              Weiter →
            </Btn>
          )}
          {phase === 'revealed' && (
            <>
              {/* Mic button above rating row */}
              {hasSpeech && (
                <button
                  onClick={startListening}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '13px', borderRadius: T.r2, marginBottom: 10,
                    background: T.s3, border: `1px solid ${T.border}`,
                    color: T.textSub, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  🎤 Nochmal sprechen
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                {[
                  { rating: 'falsch', icon: '❌', label: 'Falsch',  bg: T.redDim,              border: `${T.red}44`,            color: T.red    },
                  { rating: 'fast',   icon: '😕', label: 'Fast',    bg: T.amberDim,            border: `${T.amber}44`,          color: T.amber  },
                  { rating: 'richtig',icon: '✅', label: 'Richtig', bg: T.greenDim,            border: `${T.green}44`,          color: T.green  },
                  { rating: 'easy',   icon: '⚡', label: 'Easy',    bg: 'rgba(147,51,234,0.1)', border: 'rgba(167,139,250,0.3)', color: '#A78BFA'},
                ].map(({ rating, icon, label, bg, border, color }) => (
                  <button key={rating} onClick={() => advance(rating)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '14px 6px', borderRadius: T.r2, fontWeight: 700,
                    background: bg, border: `1px solid ${border}`, color,
                    cursor: 'pointer', transition: 'transform 0.08s',
                  }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)' }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <span style={{ fontSize: 18, marginBottom: 4 }}>{icon}</span>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                  </button>
                ))}
              </div>
            </>
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
  const [darkMode,    setDarkMode]    = useState(settings.darkMode    ?? false)
  const [cardSize,    setCardSize]    = useState(settings.cardSize    || 'normal')
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
      // Ensure own index entry exists (repairs users who signed up before indexing was added)
      if (user.email) {
        const ownKey = user.email.toLowerCase().replace(/\./g, ',')
        setDoc(doc(db, 'userIndex', ownKey), { uid: user.uid, displayName: user.displayName || user.email }, { merge: true }).catch(() => {})
      }

      // Primary: direct doc read via userIndex (no query, no cross-user rules issue)
      let partnerUid = null
      let partnerName = null
      const emailKey = email.replace(/\./g, ',')
      const idxSnap = await getDoc(doc(db, 'userIndex', emailKey))
      if (idxSnap.exists()) {
        partnerUid  = idxSnap.data().uid
        partnerName = idxSnap.data().displayName || email
      } else {
        // Fallback: query users collection
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)))
          if (!snap.empty) {
            partnerUid  = snap.docs[0].id
            partnerName = snap.docs[0].data().displayName || email
          }
        } catch { /* rules may block cross-user query — that's fine, primary lookup failed */ }
      }

      if (!partnerUid) {
        setPartnerMsg({ ok: false, text: 'Kein Nutzer gefunden. Bitte sicherstellen, dass er/sie sich mindestens einmal in Katara eingeloggt hat.' })
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
    const data = { lang, dailyGoal, defaultMode, darkMode, cardSize }
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

        <SectionCard label="Darstellung">
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Modus</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDarkMode(false)} style={chipStyle(!darkMode)}>🌙 Dark</button>
              <button onClick={() => setDarkMode(true)}  style={chipStyle(darkMode)}>☀️ Light</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Kartengröße</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['small','Klein'],['normal','Normal'],['large','Groß']].map(([val, label]) => (
                <button key={val} onClick={() => setCardSize(val)} style={chipStyle(cardSize === val)}>{label}</button>
              ))}
            </div>
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
          <div style={{ fontSize: 17, color: T.text, marginTop: 12, fontWeight: 600, letterSpacing: 0.3 }}>
            Strukturiertes Lernen.
          </div>
          <div style={{ fontSize: 13, color: T.textDim, marginTop: 8, letterSpacing: 0.2 }}>
            Lern was du willst. Wann du willst.
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

// ─── PROGRESS DASHBOARD ───────────────────────────────────────────────────────
const ProgressDashboard = ({ streak, totalCards, weeklyMinutes, items, loading }) => {
  const [open, setOpen] = useState(false)

  const totalMastered = items.reduce((s, i) => s + (i._masteredCount || 0), 0)
  const totalDue      = items.reduce((s, i) => s + (i._dueCount || 0), 0)
  const totalCards_   = items.reduce((s, i) => s + (i._cardCount || 0), 0)

  // Only show the collapsed bar if there's something to display
  const hasData = streak > 0 || totalCards > 0 || weeklyMinutes > 0 || totalMastered > 0

  if (loading || !hasData) return null

  const stat = (icon, value, label, color = T.textSub) => (
    <div style={{ textAlign: 'center', padding: '12px 8px', minWidth: 72 }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textDim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.3 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Collapsed bar — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderRadius: open ? `${T.r2} ${T.r2} 0 0` : T.r2,
          background: T.s2, border: `1px solid ${T.border}`,
          borderBottom: open ? `1px solid ${T.border}` : undefined,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {streak > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: T.amber }}>
              🔥 {streak} {streak === 1 ? 'Tag' : 'Tage'}
            </span>
          )}
          {totalDue > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 700, color: T.amber,
              background: `${T.amber}1A`, border: `1px solid ${T.amber}44`,
              borderRadius: 10, padding: '2px 9px',
            }}>
              {totalDue} fällig heute
            </span>
          )}
          {totalMastered > 0 && (
            <span style={{ fontSize: 12, color: T.textDim }}>
              ⭐ <span style={{ color: T.textSub }}>{totalMastered} gemeistert</span>
            </span>
          )}
          {totalCards > 0 && !totalDue && !totalMastered && (
            <span style={{ fontSize: 12, color: T.textDim }}>
              📚 <span style={{ color: T.textSub }}>{totalCards.toLocaleString('de-DE')} gelernt</span>
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: T.textDim, transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={{
          background: T.s2, border: `1px solid ${T.border}`, borderTop: 'none',
          borderRadius: `0 0 ${T.r2} ${T.r2}`,
          padding: '4px 8px 16px',
        }}>
          {/* 4-stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 12 }}>
            {stat('🔥', streak, 'Streak', T.amber)}
            {stat('⭐', totalMastered, 'Gemeistert', '#A78BFA')}
            {stat('📅', totalDue, 'Fällig heute', totalDue > 0 ? T.amber : T.textSub)}
            {stat('📚', totalCards.toLocaleString('de-DE'), 'Gesamt gelernt', T.acc)}
          </div>

          {/* Weekly bar */}
          {weeklyMinutes > 0 && (
            <div style={{ padding: '0 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.textDim }}>Diese Woche</span>
                <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>{weeklyMinutes} Min</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: T.s4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round(weeklyMinutes / 3))}%`,
                  background: `linear-gradient(90deg, ${T.acc}, #7BB8FF)`,
                  borderRadius: 2, transition: 'width 0.5s',
                }} />
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>Ziel: 300 Min / Woche</div>
            </div>
          )}

          {/* Category mastery breakdown */}
          {totalCards_ > 0 && (
            <div style={{ padding: '12px 8px 0' }}>
              <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Fortschritt pro Kategorie
              </div>
              {items.filter(i => (i._cardCount || 0) > 0).map(item => {
                const color = catColor(item.color || 'blue')
                const pct = item._cardCount > 0 ? Math.round((item._masteredCount || 0) / item._cardCount * 100) : 0
                return (
                  <div key={item.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: T.textDim }}>
                        {item._masteredCount || 0}/{item._cardCount || 0}
                        {(item._dueCount || 0) > 0 && (
                          <span style={{ color: T.amber, marginLeft: 6 }}>· {item._dueCount} fällig</span>
                        )}
                      </span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: T.s4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── HOME SCREEN (Level 1: Hauptkategorien) ───────────────────────────────────
const HomeScreen = ({ user, onOpen, onSettings, streak = 0, totalCards = 0, weeklyMinutes = 0 }) => {
  const wide = useWide()
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
  const [exportData,      setExportData]      = useState(null) // { cards, name }
  const [publicShareData, setPublicShareData] = useState(null) // { cards, name }
  const [activeTip,       setActiveTip]       = useState(null)
  const [schoolSetup,     setSchoolSetup]      = useState(false)
  const [berufSetup,   setBerufSetup]   = useState(false)
  const [studiumSetup, setStudiumSetup] = useState(false)
  const [hobbySetup,   setHobbySetup]   = useState(false)
  const [quickLoading, setQuickLoading] = useState(null) // label of chip being loaded
  const { dismissed, dismiss }         = useTips()
  const { partnerUid, partnerName }   = usePartner()
  const partnerInfo = partnerUid ? { uid: partnerUid, name: partnerName } : null
  const t      = useT()
  const online = useOnline()
  const uid    = user.uid
  const path = `users/${uid}/categories`

  const load = useCallback(async () => {
    setLoading(true)
    const docs = await loadDocs(path)
    const enriched = await Promise.all(
      docs.map(async d => {
        const { groupCount, cardCount, lastStudied, masteredCount, dueCount } = await enrichCategoryData(uid, d.id)
        return { ...d, _count: groupCount, _cardCount: cardCount, _lastStudied: lastStudied, _masteredCount: masteredCount, _dueCount: dueCount }
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

  // Shared: create category + generate KI cards + navigate in
  // fileData: null | { name, type:'text', text } | { name, type:'pdf', base64 }
  const createWithKI = async (name, color, prompt, extra = {}, fileData = null) => {
    try {
      const ref = await addDoc(collection(db, path), {
        name, color: color || 'blue', ...extra,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      const newCat = { id: ref.id, name, color: color || 'blue', ...extra }
      // Build message content — prepend uploaded file if present
      let messageContent
      if (fileData?.type === 'pdf') {
        messageContent = [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData.base64 } },
          { type: 'text', text: `Nutze das obige Dokument als zusätzlichen Kontext für die Kartengeneration.\n\n${prompt}` },
        ]
      } else if (fileData?.type === 'text') {
        messageContent = `Zusätzliche Unterlagen des Nutzers:\n---\n${fileData.text}\n---\n\nNutze diese Unterlagen als zusätzlichen Kontext.\n\n${prompt}`
      } else {
        messageContent = prompt
      }
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000, messages: [{ role: 'user', content: messageContent }] }),
      })
      const data = await res.json()
      const raw  = (data.content?.[0]?.text || '').replace(/```(?:json)?/gi,'').replace(/```/g,'').trim()
      const m    = raw.match(/\[[\s\S]*\]/)
      if (m) {
        const cards = JSON.parse(m[0])
        const cardsPath = `${path}/${ref.id}/cards`
        const isVorschuleCard = extra.schoolGrade === 'Vorschule'
        for (const c of Array.isArray(cards) ? cards : []) {
          await addDoc(collection(db, cardsPath), {
            front: c.front || '', back: c.back || '', backShort: c.backShort || '',
            ...(isVorschuleCard && {
              type:     c.type     || 'bild',
              back_de:  c.back_de  || c.back || '',
              back_en:  c.back_en  || '',
              emoji:    c.emoji    || null,
              count:    typeof c.count === 'number' ? c.count : null,
              colorHex: c.colorHex || null,
              shape:    c.shape    || null,
            }),
            image: null, correctCount: 0, wrongCount: 0,
            mastery: 0, lastReviewed: null, createdAt: serverTimestamp(),
          })
        }
      }
      onOpen(newCat)
    } catch (err) {
      console.error('[Katara] createWithKI failed:', err)
      load()
      throw err   // re-throw so SetupModal can show error state
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
    <div className="app-bg" style={{ minHeight: '100vh', opacity: 1, filter: 'none' }}>
      {/* Top bar — two rows */}
      <div style={{
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Row 1: Bridgelab · Logo · user */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: `7px ${wide ? 40 : 28}px`,
          borderBottom: `1px solid ${T.border}44`,
        }}>
          <a
            href="https://vocara-peach.vercel.app"
            style={{ fontSize: 12, color: T.textDim, textDecoration: 'none', fontWeight: 500, letterSpacing: 0.3, transition: 'color 0.12s', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = T.textSub}
            onMouseLeave={e => e.currentTarget.style.color = T.textDim}
          >← Bridgelab</a>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Logo size={26} subtitle />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {!online && <OfflineBadge />}
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
          padding: `9px ${wide ? 40 : 28}px`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{t.home}</span>
            {streak > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#fff',
                background: T.amber, borderRadius: 20,
                padding: '3px 11px', letterSpacing: 0.2,
                boxShadow: `0 2px 8px ${T.amber}55`,
              }}>🔥 {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>
            )}
          </div>
          <Btn onClick={() => setModal(true)} style={{ padding: '7px 16px', fontSize: 13 }}>
            {t.newCategory}
          </Btn>
        </div>
      </div>

      <div style={{ maxWidth: wide ? 1400 : 900, margin: '0 auto', padding: wide ? '28px 40px' : '28px 24px' }}>
        {/* Progress Dashboard */}
        <ProgressDashboard
          streak={streak}
          totalCards={totalCards}
          weeklyMinutes={weeklyMinutes}
          items={items}
          loading={loading}
        />
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
              style={{
                paddingLeft: 34, width: '100%', maxWidth: 340,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: T.text,
              }}
            />
          </div>
        )}

        {/* Schnellstart — always visible */}
        {!loading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10 }}>Schnellstart</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { icon: '💼', label: 'Beruf',   hex: '#E74C3C', bg: 'rgba(231,76,60,0.18)'    },
                { icon: '🎓', label: 'Schule',  hex: '#9B59B6', bg: 'rgba(155,89,182,0.18)'   },
                { icon: '📖', label: 'Studium', hex: '#27AE60', bg: 'rgba(39,174,96,0.18)'    },
                { icon: '🎯', label: 'Hobby',   hex: '#F39C12', bg: 'rgba(243,156,18,0.18)'   },
              ].map(({ icon, label, hex, bg }) => {
                const isLoading = quickLoading === label
                return (
                  <button
                    key={label}
                    disabled={!!quickLoading}
                    onClick={() => {
                      if (label === 'Beruf')   return setBerufSetup(true)
                      if (label === 'Schule')  return setSchoolSetup(true)
                      if (label === 'Studium') return setStudiumSetup(true)
                      if (label === 'Hobby')   return setHobbySetup(true)
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '8px 18px', borderRadius: 9999, flexShrink: 0,
                      background: isLoading ? T.accDim : bg,
                      border: `1px solid ${isLoading ? T.acc : hex}66`,
                      color: isLoading ? T.acc : '#F0F4FF',
                      fontSize: 13, fontWeight: 700,
                      cursor: quickLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s', opacity: quickLoading && !isLoading ? 0.45 : 1,
                      letterSpacing: 0.2,
                    }}
                    onMouseEnter={e => { if (!quickLoading) { e.currentTarget.style.background = `${hex}44`; e.currentTarget.style.borderColor = `${hex}99` } }}
                    onMouseLeave={e => { if (!quickLoading) { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = `${hex}66` } }}
                  >
                    {isLoading ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 12 }}>⟳</span> : <span style={{ fontSize: 15 }}>{icon}</span>}
                    {isLoading ? 'KI generiert Karten…' : label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonGrid count={wide ? 6 : 4} />
        ) : items.length === 0 ? (
          <Empty icon="📚" title="Noch keine Kategorien" sub="Wähle einen Schnellstart oben oder erstelle eine eigene Kategorie." />
        ) : filtered.length === 0 ? (
          <Empty icon="🔍" title="Keine Treffer" sub={`Keine Kategorie enthält "${search}".`} />
        ) : (
          <div className="category-grid" style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: wide ? 18 : 14 }}>
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
                onPublicShare={async () => {
                  const cs = await collectAllCards(uid, item.id)
                  setPublicShareData({ cards: cs, name: item.name })
                }}
              />
            ))}
          </div>
        )}
      </div>

      {modal       && <CreateModal title="Neue Hauptkategorie" placeholder="z.B. RiL 301" onSave={create} onClose={() => setModal(false)} withColor />}
      {berufSetup && <BerufSetupModal onConfirm={async ({ field, level, country, lang, fileData }) => {
        const langLabel = getLangLabel(lang)
        const prompt = `Du bist ein erfahrener Ausbilder und Berufsschullehrer in ${country}. Erstelle 15 praxisnahe Lernkarten für das Berufsfeld "${field}" auf Niveau "${level}".
Lernsprache: ${langLabel}. Decke wichtige Fachbegriffe, Prozesse, Vorschriften und Kernkonzepte ab, die in Prüfungen und im Berufsalltag relevant sind. Jede Karte soll spezifisch für "${field}" in ${country} sein.
${KI_CONTENT_RULES}
Gib NUR ein gültiges JSON-Array zurück. Kein Markdown. Keine Erklärung. Beginne mit [ und ende mit ]:
[{"front":"...","back":"...","backShort":"..."}]`
        await createWithKI('Beruf', 'blue', prompt, {}, fileData)
        setBerufSetup(false)
      }} onClose={() => setBerufSetup(false)} />}
      {studiumSetup && <StudiumSetupModal onConfirm={async ({ studiengang, semester, country, lang, fileData }) => {
        const langLabel = getLangLabel(lang)
        const prompt = `Du bist ein erfahrener Hochschuldozent in ${country}. Erstelle 15 prüfungsrelevante Lernkarten für das Studium "${studiengang}", Semester ${semester}.
Lernsprache: ${langLabel}. Decke die wichtigsten Konzepte, Fachbegriffe, Theorien und Methoden ab, die in Klausuren und mündlichen Prüfungen häufig abgefragt werden. Jede Karte soll spezifisch für "${studiengang}" Semester ${semester} sein.
${KI_CONTENT_RULES}
Gib NUR ein gültiges JSON-Array zurück. Kein Markdown. Keine Erklärung. Beginne mit [ und ende mit ]:
[{"front":"...","back":"...","backShort":"..."}]`
        await createWithKI('Studium', 'green', prompt, {}, fileData)
        setStudiumSetup(false)
      }} onClose={() => setStudiumSetup(false)} />}
      {hobbySetup && <HobbySetupModal onConfirm={async ({ hobby, level, lang, fileData }) => {
        const langLabel = getLangLabel(lang)
        const prompt = `Du bist ein begeisterter Experte für "${hobby}". Erstelle 15 motivierende Lernkarten für Niveau "${level}".
Lernsprache: ${langLabel}. Decke wichtige Begriffe, Techniken, Fakten und Konzepte zu "${hobby}" ab — spezifisch und einzigartig pro Karte.
${KI_CONTENT_RULES}
Gib NUR ein gültiges JSON-Array zurück. Kein Markdown. Keine Erklärung. Beginne mit [ und ende mit ]:
[{"front":"...","back":"...","backShort":"..."}]`
        await createWithKI('Hobby', 'amber', prompt, {}, fileData)
        setHobbySetup(false)
      }} onClose={() => setHobbySetup(false)} />}
      {schoolSetup && <SchoolSetupModal onConfirm={async (grade, lang, country, fileData) => {
        const countryObj  = SCHOOL_COUNTRIES.find(c => c.id === country)
        const countryName = countryObj?.name || 'Deutschland'
        const curriculum  = countryObj?.curriculum || 'KMK'
        const langLabel   = getLangLabel(lang)
        const isVorschuleGrade = grade === 'Vorschule'
        const prompt = isVorschuleGrade
          ? `You are a kindergarten teacher creating flashcards for children aged 4-6.
Generate exactly 15 flashcards. Use ONLY these types — NO drawing, crafting, physical activities, writing, or motor skill tasks:

Types allowed:
- "buchstabe": letter recognition. front=single capital letter, emoji=object starting with that letter
- "zahl": number recognition. front=digit as string ("3"), count=that number (3), emoji=small countable object
- "zählen": counting task. front="Wie viele?", emoji=a single countable object emoji, count=2-5 (NEVER 1), back_de=German number word, back_en=English number word
- "farbe": color naming. front=color name in German, colorHex=hex code, emoji=colored object in that color
- "form": shape naming. front=shape name in German, shape=one of: kreis,dreieck,viereck,stern,herz
- "bild": picture naming. front=German word for the object, emoji=matching emoji, back_de=German word, back_en=English word

Include a mix of all 6 types (at least 2 of each). ALL fields must be filled.
Return ONLY a valid JSON array, no markdown:
[{"type":"buchstabe","front":"A","back":"Apfel","back_de":"Apfel","back_en":"Apple","emoji":"🍎","backShort":"A"},{"type":"zählen","front":"Wie viele?","back":"drei","back_de":"drei","back_en":"three","emoji":"🐥","count":3,"backShort":"3"},{"type":"farbe","front":"Rot","back":"rot","back_de":"rot","back_en":"red","colorHex":"#EF4444","emoji":"🍎","backShort":"red"},{"type":"form","front":"Kreis","back":"Kreis","back_de":"Kreis","back_en":"Circle","shape":"kreis","backShort":"○"},{"type":"zahl","front":"5","back":"fünf","back_de":"fünf","back_en":"five","emoji":"⭐","count":5,"backShort":"5"},{"type":"bild","front":"Hund","back":"Hund","back_de":"Hund","back_en":"Dog","emoji":"🐕","backShort":"Dog"}]`
          : `Du bist ein erfahrener ${countryName}-Lehrer. Erstelle 15 altersgerechte Lernkarten für ${grade} in ${countryName} (${curriculum}-Lehrplan, ${new Date().getFullYear()}).
Lernsprache: ${langLabel}. Karten sollen die wichtigsten Themen dieser Klassenstufe abdecken: Kernfächer, wichtige Begriffe, Konzepte. Jede Karte spezifisch und einzigartig für ${grade}.
${KI_CONTENT_RULES}
Gib NUR ein gültiges JSON-Array zurück. Kein Markdown. Keine Erklärung. Beginne mit [ und ende mit ]:
[{"front":"...","back":"...","backShort":"..."}]`
        await createWithKI('Schule', 'purple', prompt, { schoolMode: true, schoolGrade: grade, schoolLang: lang, schoolCountry: country }, fileData)
        setSchoolSetup(false)
      }} onClose={() => setSchoolSetup(false)} />}
      {renaming    && <RenameModal current={renaming.name} onSave={name => rename(renaming.id, name)} onClose={() => setRenaming(null)} />}
      {shareTarget && activeTip === 'teilen' && <TipModal tipKey="teilen" onClose={() => setActiveTip(null)} />}
      {shareTarget && activeTip !== 'teilen' && <ShareModal catName={shareTarget.name} partnerName={partnerInfo?.name || 'Partner'} sharing={sharing} onConfirm={shareWithPartner} onClose={() => setShareTarget(null)} />}
      {sendTarget  && <SendToPartnerModal uid={uid} displayName={user.displayName || user.email} name={sendTarget.name} getCards={sendTarget.getCards} onClose={() => setSendTarget(null)} />}
      {exportData       && <ExportModal cards={exportData.cards} folderName={exportData.name} onClose={() => setExportData(null)} />}
      {publicShareData  && <PublicShareModal cards={publicShareData.cards} folderName={publicShareData.name} createdBy={user.displayName || user.email} onClose={() => setPublicShareData(null)} />}
      {movingCat        && <MoveFolderModal uid={uid} mode="pick-cat" excludeId={movingCat.id} onPick={handleCatMove} onClose={() => setMovingCat(null)} />}
      {moving      && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,11,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <CardItem key={c.id} card={c} onSave={async data => { const hist = [...(c.history||[]).slice(-4), {front:c.front,back:c.back,backShort:c.backShort,savedAt:Date.now()}]; await updateDoc(doc(db, `${cardsPath}/${c.id}`), {...data, history: hist}); load() }} onDelete={() => removeCard(c.id)} onMove={card => setFolderPicker(card)} onSendToPartner={card => setSendTarget({ name: card.front || '(Karte)', getCards: async () => [card] })} />
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,11,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <CardItem key={c.id} card={c} onSave={async data => { const hist = [...(c.history||[]).slice(-4), {front:c.front,back:c.back,backShort:c.backShort,savedAt:Date.now()}]; await updateDoc(doc(db, `${cardsPath}/${c.id}`), {...data, history: hist}); load() }} onDelete={() => removeCard(c.id)} onMove={card => setFolderPicker(card)} onSendToPartner={card => setSendTarget({ name: card.front || '(Karte)', getCards: async () => [card] })} />
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,11,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          <CardItem key={c.id} card={c} onSave={async data => { const hist = [...(c.history||[]).slice(-4), {front:c.front,back:c.back,backShort:c.backShort,savedAt:Date.now()}]; await updateDoc(doc(db, `${cardsPath}/${c.id}`), {...data, history: hist}); load() }} onDelete={() => remove(c.id)} onMove={card => setFolderPicker(card)} onSendToPartner={card => setSendTarget({ name: card.front || '(Karte)', getCards: async () => [card] })} />
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
  const [settings,      setSettings]      = useState({ lang: 'de', dailyGoal: 10, defaultMode: 'klassisch', darkMode: false, cardSize: 'normal' })
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

  // Public share URL: /share/{shareId} — render without auth requirement
  const publicShareId = window.location.pathname.match(/^\/share\/([A-Za-z0-9_-]+)/)?.[1]
  if (publicShareId) {
    return <PublicSetView shareId={publicShareId} currentUser={user || null} />
  }

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: T.textDim, fontSize: 14 }}>Wird geladen…</div>
      </div>
    )
  }

  const theme = settings.darkMode ? T_LIGHT : T

  return (
    <div style={{ filter: 'none', opacity: 1 }}>
    <ThemeContext.Provider value={theme}>
    <SettingsCtx.Provider value={{ cardSize: settings.cardSize || 'normal' }}>
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
    </SettingsCtx.Provider>
    </ThemeContext.Provider>
    </div>
  )
}
