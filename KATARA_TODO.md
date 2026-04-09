# KATARA TODO

---

## BRIDGELAB GLOBAL TRACKING (app-übergreifend)
- Streak zählt für Vocara UND Katara zusammen
- Gimmicks werden app-übergreifend angerechnet
- Beide Apps schreiben in Firestore: `users/{uid}/globalStats` = { streak, lastActive, weeklyMinutes, monthlyMinutes, yearlyMinutes, totalMinutes, totalCards, weeklyCards, monthlyCards }
- Später im Bridgelab Hub zentral angezeigt
- Eine Auswertung, ein Streak, ein Gimmick-System

---

## Liste A — Features (Priorität)

0. **PRIORITÄT:** Alle Items aus Liste A noch nicht implementiert — bei nächster Session starten mit: Kartensets teilen, KI-Rubriken, Karten verschieben, Hauptrubriken Beruf/Schule/Studium/Hobby

1. Kartensets teilen (Export/Import zwischen Nutzern)
2. KI-Rubriken: KI schlägt Kategorie-Struktur vor
3. Karten verschieben (drag & drop zwischen Ordnern)
4. Hauptrubriken Beruf / Schule / Studium / Hobby

---

## Liste B — UI/UX

- (offen)

---

## Liste C — Bugs

- (offen)

---

## Liste D — Technisch/Infra

- (offen)

---

## Liste E — Gamification & Statistik

- **Streak-System:** app-übergreifend mit Vocara (globalStats)
- **Lernzeit:** Woche / Monat / Jahr / Gesamt in globalStats
- **Gimmicks:** gemeinsam angerechnet für beide Apps
