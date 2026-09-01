import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'

export const SESSION_SIZE = 15
export const MASTERY_THRESHOLD = 0.85

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export function todayStr() { return localDateStr() }

// SM-2 variant — portiert 1:1 aus Vocara appShared.js:418
// Ratings: falsch | fast | unsicher | sicher | verinnerlicht | auswendig
// Legacy-Aliasse: richtig → sicher, easy → verinnerlicht
export function calculateNextInterval(card, rating, p) {
  const interval = p?.interval ?? 1
  const easiness = p?.easiness ?? 2.0
  const consecutiveRight = p?.consecutiveRight ?? 0
  const isLapse = rating === 'falsch' && interval >= 7
  let newInterval, newEasiness, newConsecutiveRight, mastered = false, forceDays = 0

  if (rating === 'falsch') {
    newInterval = 0
    newEasiness = isLapse ? Math.max(1.3, easiness - 0.3) : Math.max(1.3, easiness - 0.2)
    newConsecutiveRight = 0
  } else if (rating === 'fast') {
    newInterval = 1; newEasiness = Math.max(1.3, easiness - 0.15); newConsecutiveRight = 0; forceDays = 1
  } else if (rating === 'unsicher') {
    newConsecutiveRight = consecutiveRight + 1; newEasiness = Math.max(1.3, easiness - 0.05)
    if (newConsecutiveRight === 1) newInterval = 1
    else if (newConsecutiveRight === 2) newInterval = 2
    else newInterval = Math.round(interval * Math.max(1.1, easiness - 0.1))
  } else if (rating === 'sicher') {
    newConsecutiveRight = consecutiveRight + 1; newEasiness = easiness
    if (newConsecutiveRight === 1) newInterval = 1
    else if (newConsecutiveRight === 2) newInterval = 2
    else newInterval = Math.round(interval * easiness)
  } else if (rating === 'verinnerlicht') {
    newConsecutiveRight = consecutiveRight + 1; newEasiness = Math.min(2.5, easiness + 0.1)
    newInterval = Math.round(interval * easiness * 1.3)
    if (newInterval < 3) newInterval = 3
  } else if (rating === 'auswendig') {
    newInterval = 365; newEasiness = Math.min(2.5, easiness + 0.15); newConsecutiveRight = consecutiveRight + 1
    mastered = true
  } else if (rating === 'richtig') {
    // legacy alias → sicher
    newConsecutiveRight = consecutiveRight + 1; newEasiness = easiness
    if (newConsecutiveRight === 1) newInterval = 1
    else if (newConsecutiveRight === 2) newInterval = 2
    else newInterval = Math.round(interval * easiness)
  } else if (rating === 'easy') {
    // legacy alias → verinnerlicht
    newConsecutiveRight = consecutiveRight + 1; newEasiness = Math.min(2.5, easiness + 0.1)
    newInterval = Math.round(interval * easiness * 1.3)
    if (newInterval < 3) newInterval = 3
  }

  const nextReviewDate = localDateStr(new Date(Date.now() + (newInterval || 0) * 86400000))
  return {
    interval: newInterval,
    easiness: newEasiness,
    consecutiveRight: newConsecutiveRight,
    nextReview: (newInterval === 0 || forceDays > 0) ? localDateStr() : nextReviewDate,
    wrongSessions: rating === 'falsch' ? (p?.wrongSessions ?? 0) + 1 : 0,
    forceDays,
    mastered,
    lapse: isLapse ? (p?.lapse ?? 0) + 1 : (p?.lapse ?? 0),
    ...(mastered ? { masteredAt: localDateStr() } : {}),
  }
}

// Session-Queue-Aufbau mit Due/New/Forced-Logik — portiert aus Vocara appShared.js:1354
// (ohne applyDirectionMarkers, da Katara kein Flip-Konzept hat)
export function buildSession(allCards, cardProgress, maxCards = SESSION_SIZE) {
  const today = todayStr()
  const forced = [], due = [], newCards = []
  allCards.forEach(card => {
    const p = cardProgress[card.id]
    if (!p) { newCards.push(card); return }
    if (p.mastered) return
    if (p.wrongSessions > 0) { forced.push(card); return }
    if (p.forceDays > 0) { forced.push(card); return }
    if (p.nextReview <= today) { due.push(card); return }
  })
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
  const forcedSlice = forced.slice(0, Math.min(forced.length, Math.ceil(maxCards * 0.3)))
  const remaining = maxCards - forcedSlice.length
  const knownForOverload = [...forced, ...due]
  const secureCount = knownForOverload.filter(c => (cardProgress[c.id]?.interval ?? 0) >= 7).length
  const allowNew = knownForOverload.length === 0 || (secureCount / knownForOverload.length) > 0.5
  const newBatch = allowNew && (forced.length + due.length) < 5
    ? shuffle(newCards).slice(0, Math.min(3, remaining - Math.min(due.length, remaining)))
    : []
  const dueSlice = shuffle(due).slice(0, Math.max(0, remaining - newBatch.length))
  const nonForced = shuffle([...newBatch, ...dueSlice])
  const insertAt = Math.min(4, nonForced.length)
  return [
    ...nonForced.slice(0, insertAt),
    ...forcedSlice,
    ...nonForced.slice(insertAt),
  ].slice(0, maxCards)
}

// Mastery-Check — portiert aus Vocara appShared.js:1430
export function checkMastery(allCards, cardProgress, sessionCorrect, sessionTotal) {
  const active = allCards.filter(c => {
    const p = cardProgress[c.id]
    return p && (p.interval > 0 || p.wrongSessions > 0)
  })
  if (active.length < 20) return false
  if (sessionTotal > 0 && sessionCorrect / sessionTotal < 0.6) return false
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return mastered.length / active.length >= MASTERY_THRESHOLD
}

// Nächste ungesehene Karten ermitteln — portiert aus Vocara appShared.js:1441
// (vereinfacht: kein targetLang-Filter, Katara ist sprachagnostisch)
export function getNextNewCards(allCards, cardProgress, count) {
  return allCards.filter(c => !cardProgress[c.id]).slice(0, count)
}

// Fortschritt in users/{uid}.cardProgress schreiben — mit 1x Retry
// portiert aus Vocara appShared.js:1492
export async function saveProgressWithRetry(uid, progress, { retries = 1, backoffMs = 1000 } = {}) {
  if (!uid) return { success: false, error: new Error('no uid') }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await setDoc(doc(db, 'users', uid), { cardProgress: progress }, { merge: true })
      return { success: true }
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs))
        continue
      }
      console.error('[saveProgress] failed after retry:', err?.code, err?.message)
      return { success: false, error: err }
    }
  }
  return { success: false, error: new Error('unreachable') }
}
