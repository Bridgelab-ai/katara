import { useState, useRef } from 'react'
import {
  CARD_COLORS, CARD_FONT_SIZES, CARD_FONT_FAMILIES,
  getColorHex, getFontSizePx, getFontCss,
} from './cardStyles.js'

// ─── OVERLAY (replaces Modal from App.jsx — avoids circular import) ───────────
const EditorOverlay = ({ children, onClose, width, T }) => {
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
      <div style={{
        width: '100%', maxWidth: width,
        background: T.s2,
        border: `1px solid ${T.border}`,
        borderRadius: T.r3,
        padding: '28px 28px 40px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        overflowY: 'auto',
        maxHeight: 'calc(100dvh - 40px)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── MICRO LABEL HELPERS ──────────────────────────────────────────────────────
const FL = ({ children, T }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>
)
const SL = ({ children, T }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, marginBottom: 12, color: T.acc }}>{children}</div>
)

// ─── IMAGE THUMBNAIL ──────────────────────────────────────────────────────────
const ImgThumb = ({ src, onRemove, T }) => (
  <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
    <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 7, border: `1px solid ${T.border}` }} />
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

// ─── COLOR CHIP ROW ───────────────────────────────────────────────────────────
const ColorRow = ({ label, value, onChange, T }) => (
  <div style={{ marginBottom: 14 }}>
    <FL T={T}>{label}</FL>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
      {CARD_COLORS.map(({ key, label: lbl, hex }) => {
        const sel = value === key
        return (
          <button
            key={String(key)}
            title={lbl}
            onClick={() => onChange(key)}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: key === null ? 'transparent' : hex,
              border: sel
                ? `2px solid ${T.acc}`
                : key === null
                  ? `2px dashed ${T.textDim}`
                  : `2px solid rgba(255,255,255,0.15)`,
              cursor: 'pointer',
              outline: sel ? `2px solid ${T.acc}44` : 'none',
              outlineOffset: 2, flexShrink: 0, transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: T.textDim, fontWeight: 700, padding: 0,
            }}
          >{key === null ? '×' : ''}</button>
        )
      })}
    </div>
  </div>
)

// ─── CHIP ROW (font sizes / families) ────────────────────────────────────────
const ChipRow = ({ label, options, value, onChange, T }) => (
  <div style={{ marginBottom: 14 }}>
    <FL T={T}>{label}</FL>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(opt => {
        const sel = value === opt.key
        return (
          <button
            key={String(opt.key)}
            onClick={() => onChange(opt.key)}
            style={{
              padding: '3px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
              background: sel ? T.acc : 'transparent',
              color: sel ? '#fff' : T.textDim,
              border: `1px ${opt.key === null ? 'dashed' : 'solid'} ${sel ? T.acc : opt.key === null ? T.textDim : T.border}`,
              fontWeight: sel ? 700 : 400, transition: 'all 0.12s',
              fontFamily: opt.css || undefined,
            }}
          >{opt.label}</button>
        )
      })}
    </div>
  </div>
)

// ─── LIVE CARD PREVIEW ────────────────────────────────────────────────────────
const CardPreview = ({ front, back, bgColor, textColor, fontSize, fontFamily, T }) => {
  const bg   = getColorHex(bgColor)
  const fg   = getColorHex(textColor)
  const size = getFontSizePx(fontSize) || 16
  const font = getFontCss(fontFamily)
  const same = bg && fg && bg.toLowerCase() === fg.toLowerCase()
  return (
    <div style={{ marginTop: 14 }}>
      <FL T={T}>VORSCHAU</FL>
      <div style={{
        borderRadius: 10, padding: '16px 20px',
        background: bg || 'rgba(23,30,48,0.9)',
        border: same ? `2px solid ${T.red}` : '1px solid rgba(255,255,255,0.10)',
        transition: 'all 0.2s',
      }}>
        {same && (
          <div style={{ fontSize: 10, color: T.red, fontWeight: 700, marginBottom: 8 }}>
            ⚠ Text- und Hintergrundfarbe identisch
          </div>
        )}
        <div style={{ fontSize: size, color: fg || '#FFFFFF', fontFamily: font || undefined, fontWeight: 600, lineHeight: 1.4 }}>
          {front || '(Vorderseite)'}
        </div>
        {back && (
          <>
            <div style={{ height: 1, background: fg ? `${fg}22` : 'rgba(255,255,255,0.10)', margin: '8px 0' }} />
            <div style={{ fontSize: Math.round(size * 0.85), color: fg ? `${fg}BB` : 'rgba(255,255,255,0.70)', fontFamily: font || undefined, lineHeight: 1.3 }}>
              {back}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── CARD EDITOR (replaces CardModal) ────────────────────────────────────────
// Props: initial (card obj or null), onSave, onClose, theme (T object), groupStyle (nullable)
export const CardEditor = ({ initial, onSave, onClose, theme: T, groupStyle = null }) => {
  const [front,           setFront]           = useState(initial?.front           || '')
  const [image,           setImage]           = useState(initial?.image           || null)
  const [back,            setBack]            = useState(initial?.back            || '')
  const [backShort,       setBackShort]       = useState(initial?.backShort       || '')
  const [backImage,       setBackImage]       = useState(initial?.backImage       || null)
  const [pronunciationDe, setPronunciationDe] = useState(initial?.pronunciation_de || '')
  const [pronunciationEn, setPronunciationEn] = useState(initial?.pronunciation_en || '')
  const [bgColor,         setBgColor]         = useState(initial?.bgColor         ?? null)
  const [textColor,       setTextColor]       = useState(initial?.textColor       ?? null)
  const [fontSize,        setFontSize]        = useState(initial?.fontSize        ?? null)
  const [fontFamily,      setFontFamily]      = useState(initial?.fontFamily      ?? null)
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
      bgColor: bgColor || null, textColor: textColor || null,
      fontSize: fontSize || null, fontFamily: fontFamily || null,
    })
    setSaving(false)
  }

  const inp = {
    width: '100%', background: T.s1, border: `1px solid ${T.border}`,
    borderRadius: T.r, color: T.text, fontSize: 13, padding: '6px 10px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const ta = { ...inp, resize: 'vertical', minHeight: 60 }

  const canSave = !saving && (back.trim() || front.trim() || image)
  const previewBg    = bgColor    ?? groupStyle?.defaultBgColor    ?? null
  const previewFg    = textColor  ?? groupStyle?.defaultTextColor  ?? null
  const previewSize  = fontSize   ?? groupStyle?.defaultFontSize   ?? null
  const previewFont  = fontFamily ?? groupStyle?.defaultFontFamily ?? null

  return (
    <EditorOverlay onClose={onClose} width={720} T={T}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text }}>
          {initial ? 'Karte bearbeiten' : 'Neue Karte'}
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
      </div>

      {/* Content fields: front + back side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
          <SL T={T}>VORDERSEITE</SL>
          <FL T={T}>Text</FL>
          <textarea value={front} onChange={e => setFront(e.target.value)} placeholder="Begriff, Signal, Situation…" rows={3} style={ta} />
          <div style={{ marginTop: 10 }}>
            <FL T={T}>Bild (optional)</FL>
            <input type="file" accept="image/*" onChange={pickImg(setImage)} style={{ fontSize: 12, color: T.textSub }} />
            {image && <ImgThumb src={image} onRemove={() => setImage(null)} T={T} />}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: T.r, padding: 16, border: `1px solid ${T.border}` }}>
          <SL T={T}>RÜCKSEITE</SL>
          <FL T={T}>Langbezeichnung *</FL>
          <textarea value={back} onChange={e => setBack(e.target.value)} placeholder="z.B. Hauptsignal Hp 0 — Halt" rows={3} style={ta} />
          <div style={{ marginTop: 10 }}>
            <FL T={T}>Kurzbezeichnung</FL>
            <input value={backShort} onChange={e => setBackShort(e.target.value)} placeholder="z.B. Hp 0" style={{ ...inp, marginBottom: 8 }} />
          </div>
          <FL T={T}>🇩🇪 Aussprache</FL>
          <input value={pronunciationDe} onChange={e => setPronunciationDe(e.target.value)} placeholder="z.B. haupt-zig-nahl" style={{ ...inp, marginBottom: 8 }} />
          <FL T={T}>🇬🇧 Pronunciation</FL>
          <input value={pronunciationEn} onChange={e => setPronunciationEn(e.target.value)} placeholder="e.g. howpt-zig-nahl" style={{ ...inp, marginBottom: 8 }} />
          <FL T={T}>Bild (optional)</FL>
          <input type="file" accept="image/*" onChange={pickImg(setBackImage)} style={{ fontSize: 12, color: T.textSub }} />
          {backImage && <ImgThumb src={backImage} onRemove={() => setBackImage(null)} T={T} />}
        </div>
      </div>

      {/* Style pickers */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: T.acc, marginBottom: 14 }}>
          KARTEN-STIL
          {groupStyle && <span style={{ fontWeight: 400, color: T.textDim }}> — ×&nbsp;= Gruppenstandard</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <ColorRow label="Hintergrundfarbe" value={bgColor} onChange={setBgColor} T={T} />
          <ColorRow label="Textfarbe" value={textColor} onChange={setTextColor} T={T} />
          <ChipRow label="Schriftgröße" options={CARD_FONT_SIZES} value={fontSize} onChange={setFontSize} T={T} />
          <ChipRow label="Schriftfamilie" options={CARD_FONT_FAMILIES} value={fontFamily} onChange={setFontFamily} T={T} />
        </div>
        <CardPreview front={front} back={back} bgColor={previewBg} textColor={previewFg} fontSize={previewSize} fontFamily={previewFont} T={T} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={save} disabled={!canSave}
          style={{
            flex: 1, padding: '10px 18px', borderRadius: T.r, fontSize: 14, fontWeight: 700,
            background: canSave ? T.acc : T.s3, color: '#fff', border: 'none',
            cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.45, minHeight: 44,
          }}
        >{saving ? 'Speichert…' : initial ? 'Änderungen speichern' : 'Karte speichern'}</button>
        <button
          onClick={onClose}
          style={{
            padding: '10px 16px', borderRadius: T.r, fontSize: 14, fontWeight: 600,
            background: T.s2, color: T.text, border: `1px solid ${T.border}`,
            cursor: 'pointer', minHeight: 44,
          }}
        >Abbrechen</button>
      </div>
    </EditorOverlay>
  )
}

// ─── GROUP STYLE MODAL ────────────────────────────────────────────────────────
// Props: initial (group doc object or null), groupName, onSave, onClose, theme (T object)
export const GroupStyleModal = ({ initial, groupName, onSave, onClose, theme: T }) => {
  const [bgColor,    setBgColor]    = useState(initial?.defaultBgColor    ?? null)
  const [textColor,  setTextColor]  = useState(initial?.defaultTextColor  ?? null)
  const [fontSize,   setFontSize]   = useState(initial?.defaultFontSize   ?? null)
  const [fontFamily, setFontFamily] = useState(initial?.defaultFontFamily ?? null)
  const [saving,     setSaving]     = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave({
      defaultBgColor:    bgColor    || null,
      defaultTextColor:  textColor  || null,
      defaultFontSize:   fontSize   || null,
      defaultFontFamily: fontFamily || null,
    })
    setSaving(false)
  }

  return (
    <EditorOverlay onClose={onClose} width={480} T={T}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          🎨 Kartenstandard — {groupName || 'Gruppe'}
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: T.textDim, marginBottom: 18, lineHeight: 1.55 }}>
        Diese Werte gelten als Standard für alle Karten dieser Gruppe ohne eigenen Stil.
      </div>
      <ColorRow label="Standard-Hintergrundfarbe" value={bgColor} onChange={setBgColor} T={T} />
      <ColorRow label="Standard-Textfarbe" value={textColor} onChange={setTextColor} T={T} />
      <ChipRow label="Standard-Schriftgröße" options={CARD_FONT_SIZES} value={fontSize} onChange={setFontSize} T={T} />
      <ChipRow label="Standard-Schriftfamilie" options={CARD_FONT_FAMILIES} value={fontFamily} onChange={setFontFamily} T={T} />
      <CardPreview
        front="Beispiel-Vorderseite"
        back="Beispiel-Rückseite"
        bgColor={bgColor}
        textColor={textColor}
        fontSize={fontSize}
        fontFamily={fontFamily}
        T={T}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={save} disabled={saving}
          style={{
            flex: 1, padding: '10px 18px', borderRadius: T.r, fontSize: 14, fontWeight: 700,
            background: saving ? T.s3 : T.acc, color: '#fff', border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.45 : 1, minHeight: 44,
          }}
        >{saving ? 'Speichert…' : 'Standard speichern'}</button>
        <button
          onClick={onClose}
          style={{
            padding: '10px 16px', borderRadius: T.r, fontSize: 14, fontWeight: 600,
            background: T.s2, color: T.text, border: `1px solid ${T.border}`,
            cursor: 'pointer', minHeight: 44,
          }}
        >Abbrechen</button>
      </div>
    </EditorOverlay>
  )
}
