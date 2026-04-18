# KATARA TODO

---

## BRIDGELAB GLOBAL TRACKING (app-übergreifend)
- ✅ Streak zählt für Vocara UND Katara zusammen
- Gimmicks werden app-übergreifend angerechnet
- ✅ Beide Apps schreiben in Firestore: `users/{uid}/globalStats` = { streak, lastActive, weeklyMinutes, monthlyMinutes, yearlyMinutes, totalMinutes, totalCards, weeklyCards, monthlyCards }
- Später im Bridgelab Hub zentral angezeigt
- Eine Auswertung, ein Streak, ein Gimmick-System

---

## KI-PROMPT REGELN (✅ implementiert)
- ✅ Kein religiöser Inhalt oder praktische Übungen in allen KI-Karten
- ✅ Nur theoretisches, faktenbasiertes Lernmaterial
- ✅ KI-Antworten sind detailliert und einzigartig per User-Kontext
- ✅ Karten wirken personalisiert, nicht massenproduktartig
- ✅ Konstante `KI_CONTENT_RULES` wird in alle Prompt-Funktionen eingebunden

---

## SPRACHEN (✅ implementiert)
- ✅ Thai entfernt (war nicht vorhanden)
- ✅ SETUP_LANGS = DE, EN, ES, FR, SW — identisch mit Vocara
- ✅ `getLangLabel()` Hilfsfunktion für alle Sprachen
- ✅ Prompts für Beruf/Studium/Hobby/Schule nutzen korrekte Sprachlabels

---

## Liste A — Features (Priorität)

0. **PRIORITÄT:** Alle Items aus Liste A noch nicht implementiert — bei nächster Session starten mit: Kartensets teilen, KI-Rubriken, Karten verschieben, Hauptrubriken Beruf/Schule/Studium/Hobby

1. Kartensets teilen (Export/Import zwischen Nutzern)
2. KI-Rubriken: KI schlägt Kategorie-Struktur vor
3. Karten verschieben (drag & drop zwischen Ordnern)
4. Hauptrubriken Beruf / Schule / Studium / Hobby

---

## Liste B — UI/UX

- ✅ Dark/Light mode Toggle in Einstellungen (☀️/🌙)
- ✅ Kartengröße Klein/Normal/Groß in Einstellungen
- ✅ ThemeContext.Provider + SettingsCtx.Provider im App-Root verdrahtet
- ✅ Global Stats (streak, totalCards, weeklyMinutes) auf Homescreen
- ✅ Anki-Import (.txt, Tab-getrennt) in KI-Kartengenerator (JSX-Bug gefixt)

---

## Liste C — Bugs

- ✅ JSX-Strukturfehler im KIImportScreen (zwei Geschwister-Elemente ohne Fragment)

---

## Liste D — Technisch/Infra

- (offen)

---

## Liste E — Gamification & Statistik

- ✅ **Streak-System:** app-übergreifend mit Vocara (globalStats)
- ✅ **Lernzeit:** Woche / Monat / Jahr / Gesamt in globalStats
- **Gimmicks:** gemeinsam angerechnet für beide Apps (noch offen)
