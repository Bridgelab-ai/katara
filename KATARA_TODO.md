# KATARA TODO — Stand 31.08.2026

---

## ✅ Karten-Styling + CardEditor + GroupStyleModal — V01.002.000 (31.08.2026)
- **Was geändert:**
  - `src/cardStyles.js` (neu): 11 Farben (Dunkelblau, Mitternacht, Waldgrün, Rubinrot, Gold, Schiefergrau, Tiefviolett, Ozeanblau, Kastanienbraun, Elfenbein, Onyx), 5 Schriftgrößen (XS–XL), 5 Schriftfamilien (System, Serif, Mono, Rounded, Condensed). Exports: `CARD_COLORS`, `CARD_FONT_SIZES`, `CARD_FONT_FAMILIES`, `getColorHex()`, `getFontSizePx()`, `getFontCss()`, `resolveCardStyle()`, `extractGroupStyle()`
  - `src/CardEditor.jsx` (neu): `CardEditor` ersetzt `CardModal` vollständig — Inhalt (Vorder-/Rückseite, Bilder, Aussprache) + 4 Style-Picker (Hintergrundfarbe, Textfarbe, Schriftgröße, Schriftfamilie) + Live-Vorschau + Warnhinweis bei identischen Farben; `GroupStyleModal` für Gruppenstandards (4 Picker + Vorschau)
  - `src/App.jsx`: Imports ergänzt; `FolderRow` + `onStyleDefault`-Prop → `CtxMenu`-Eintrag „🎨 Kartenstandard"; `CardItem` zeigt `bgColor` als linken Border-Streifen; `LearnMode` + `groupStyle`-Prop + `resolveCardStyle` angewendet auf Karten-Hintergrund, -Textfarbe, -Schriftgröße, -Familie; `SubcategoryScreen`/`SubSubcategoryScreen`/`CardsScreen`: `CardModal` → `CardEditor`, `groupStyleModal`-State + `saveGroupStyle()`, `useTheme()` ergänzt, `rowLearn` trägt jetzt `groupStyle`
- **Datenmodell-Erweiterung (Karte, nullable):** `bgColor`, `textColor`, `fontSize`, `fontFamily`
- **Datenmodell-Erweiterung (Gruppe/Unterkategorie, nullable):** `defaultBgColor`, `defaultTextColor`, `defaultFontSize`, `defaultFontFamily`
- **Vererbungskette:** Karten-Wert → Gruppen-Standard → null (kein Override)
- **CODE-ÄNDERUNGEN:** `src/cardStyles.js` (neu), `src/CardEditor.jsx` (neu), `src/App.jsx`

---

## ✅ Firebase-Config + SRS aus Vocara portiert + 6-Stufen-Rating — V01.001.000 (31.08.2026)
- **Diagnose:** `firebase.js` zeigte auf `vocara-ca2b7` (falsches Projekt). Kein SM-2: alte SRS schrieb `mastery`/`easyCount`/`nextReview`-Timestamp direkt ins Karten-Dokument. Nur 4 Rating-Stufen (`falsch`, `fast`, `richtig`, `easy`).
- **Was geändert:**
  - `firebase.js`: Config auf `katara-bridgelab` korrigiert
  - `src/srs.js` (neu): `calculateNextInterval`, `buildSession`, `checkMastery`, `getNextNewCards`, `saveProgressWithRetry`, `todayStr` — portiert 1:1 aus Vocara `appShared.js`, ohne Flip-Marker und ohne targetLang-Filter
  - `App.jsx / LearnMode`: cardProgress-State lädt `users/{uid}.cardProgress` beim Mount; `newProgressRef` akkumuliert SM-2-Ergebnis; Session-Ende schreibt via `saveProgressWithRetry`; `startSession` (klassisch) nutzt `buildSession`; `rate()` komplett auf SM-2 umgebaut (kein `updateDoc` auf Karten-Doc mehr); 4-Button-Row → 6-Button-Grid (3×2): `falsch`/`fast`/`unsicher`/`sicher`/`verinnerlicht`/`auswendig`; Result-Screen aktualisiert
- **CODE-ÄNDERUNGEN:** `src/firebase.js`, `src/srs.js` (neu), `src/App.jsx` (LearnMode)
- **Veraltete Karten-Felder (nicht mehr geschrieben/gelesen, harmlos):** `mastery`, `easyCount`, `nextReview` (Timestamp), `masteryReviewIndex`, `correctCount`, `wrongCount`, `fastCount`, `rightCount`, `nextSessionDue`
- **Persistenz-Modell:** `users/{uid}.cardProgress` = `{ [cardId]: { interval, easiness, consecutiveRight, wrongSessions, lapse, nextReview (YYYY-MM-DD), mastered, masteredAt } }` — identisch mit Vocara

---

## BRIDGELAB GLOBAL TRACKING (app-übergreifend)
- ✅ Streak zählt für Vocara UND Katara zusammen
- Gimmicks werden app-übergreifend angerechnet
- ✅ Beide Apps schreiben in Firestore: `users/{uid}/globalStats` = { streak, lastActive, weeklyMinutes, monthlyMinutes, yearlyMinutes, totalMinutes, totalCards }
- Später im Bridgelab Hub zentral angezeigt
- Eine Auswertung, ein Streak, ein Gimmick-System

---

## KI-PROMPT REGELN (✅ implementiert)
- ✅ `KI_CONTENT_RULES` Konstante in alle Prompt-Funktionen eingebunden
- ✅ `KI_SYSTEM` als system-Parameter in `api/chat.js` — gilt für ALLE /api/chat Aufrufe automatisch
- ✅ Kein religiöser Inhalt, keine praktischen Übungen
- ✅ Nur theoretisches, faktenbasiertes Lernmaterial
- ✅ Detailliert und einzigartig per User-Kontext

---

## SPRACHEN (✅ implementiert)
- ✅ Thai entfernt (war nicht vorhanden)
- ✅ SETUP_LANGS = DE, EN, ES, FR, SW — identisch mit Vocara
- ✅ `getLangLabel()` Hilfsfunktion für alle Sprachen
- ✅ Prompts für Beruf/Studium/Hobby/Schule nutzen korrekte Sprachlabels

---

## DARK/LIGHT MODE (✅ implementiert)
- ✅ Toggle in Einstellungen (☀️ Light / 🌙 Dark)
- ✅ Light: bg #F0F4FF, cards #FFFFFF, text #1A1A2E
- ✅ Gespeichert in Firestore `users/{uid}/settings/preferences` (Feld: darkMode)
- ✅ ThemeContext.Provider im App-Root verdrahtet

---

## KARTENGRÖSSE (✅ implementiert)
- ✅ Toggle Klein/Normal/Groß in Einstellungen
- ✅ Angewendet in Kartenliste (CardItem: Padding + Schriftgröße)
- ✅ Angewendet in Lernmodus (LearnMode: Front/Back Schriftgröße)
- ✅ Gespeichert in Firestore `users/{uid}/settings/preferences` (Feld: cardSize)

---

## GLOBAL STATS (✅ implementiert)
- ✅ Session-Ende schreibt in Firestore `users/{uid}/globalStats/main`
- ✅ Felder: totalCards, weeklyMinutes, monthlyMinutes, yearlyMinutes, totalMinutes, streak, lastActive
- ✅ Wird auf HomeScreen angezeigt (Streak, Karten, Wochenminuten)

---

## PC/TABLET LAYOUT (✅ implementiert)
- ✅ `useWide()` Hook (window.innerWidth >= 768, reaktiv)
- ✅ HomeScreen: maxWidth 1400px auf Desktop, 900px auf Mobile
- ✅ Kategorie-Grid: minmax(280px) auf Desktop, minmax(240px) auf Mobile
- ✅ Header-Padding: 40px auf Desktop, 28px auf Mobile
- ✅ Content-Padding: 40px auf Desktop, 24px auf Mobile

---

## FALSCHE KARTE POSITION 5 (✅ verifiziert)
- ✅ `insertAt = Math.min(4, rest.length)` → Index 4 = Position 5
- ✅ Max. 2 Re-Inserts (attempts < 3) verhindert Endlosschleife

---

## Liste A — Features (Priorität)

1. Kartensets teilen (Export/Import zwischen Nutzern)
2. KI-Rubriken: KI schlägt Kategorie-Struktur vor
3. Karten verschieben (drag & drop zwischen Ordnern)
4. Hauptrubriken Beruf / Schule / Studium / Hobby

---

## Liste B — UI/UX

- ✅ Anki-Import (.txt, Tab-getrennt) in KI-Kartengenerator

---

## Liste E — Gamification & Statistik

- ✅ **Streak-System:** app-übergreifend mit Vocara (globalStats)
- ✅ **Lernzeit:** Woche / Monat / Jahr / Gesamt in globalStats
- **Gimmicks:** gemeinsam angerechnet für beide Apps (noch offen)
