# KATARA TODO

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
