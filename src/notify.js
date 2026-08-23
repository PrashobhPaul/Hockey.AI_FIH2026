// Hockey.AI — match notifications.
//
// Two kinds, one module:
//   1) Favourite-team alerts (the Home bell): start-soon and full-time for the
//      one team the reader follows.
//   2) Result alerts for EVERY match — on by default in the Android app once
//      notification permission is granted, so the whole tournament's outcomes
//      reach every installed user.
//
// Delivery is honest about each platform. On the web these fire while the app
// (or its tab) is open — a static PWA has no push server, and the UI copy says
// so. In the Android app the open-app path is instant, and a background
// checker (public/runners/results.js) covers the closed-app case on a ~15
// minute cycle; the two deduplicate through ackRunnerSeen().
import { db } from './db'
import { isNative, nativeNotify, ensureNotifPermission, ackRunnerSeen } from './native'

const FAV_KEY = 'hockeyai:favourite-team'
const ENABLED_KEY = 'hockeyai:alerts-enabled'   // favourite-team bell
const RESULTS_KEY = 'hockeyai:results-all'      // every-match full-time alerts
const SENT_KEY = 'hockeyai:alerts-sent'
const SEEDED_KEY = 'hockeyai:results-seeded'
const SOON_MIN = 30            // "starts soon" window before push-back
const RESULT_FRESH_H = 6       // don't announce results older than this

const lsGet = k => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export function alertsSupported() {
  return isNative || typeof Notification !== 'undefined'
}

export function alertsEnabled() {
  if (isNative) return lsGet(ENABLED_KEY) === '1'
  try {
    return alertsSupported() && Notification.permission === 'granted'
      && lsGet(ENABLED_KEY) === '1'
  } catch { return false }
}

export async function enableAlerts() {
  if (isNative) {
    const ok = await ensureNotifPermission()
    if (ok) lsSet(ENABLED_KEY, '1')
    return ok
  }
  if (!alertsSupported()) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  lsSet(ENABLED_KEY, '1')
  return true
}

export function disableAlerts() {
  lsSet(ENABLED_KEY, '0')
}

/* ---- every-match result alerts (the Android default) ---- */

export function resultAlertsEnabled() {
  if (isNative) return lsGet(RESULTS_KEY) === '1'
  try {
    return alertsSupported() && Notification.permission === 'granted'
      && lsGet(RESULTS_KEY) === '1'
  } catch { return false }
}

export async function enableResultAlerts() {
  const ok = isNative
    ? await ensureNotifPermission()
    : (alertsSupported() && (await Notification.requestPermission()) === 'granted')
  if (ok) {
    lsSet(RESULTS_KEY, '1')
    // First enable: everything already played is history, not news.
    if (lsGet(SEEDED_KEY) !== '1') await seedSent()
  }
  return ok
}

export function disableResultAlerts() { lsSet(RESULTS_KEY, '0') }

async function seedSent() {
  const sent = sentSet()
  try {
    const done = await db.matches.where('status').equals('completed').toArray()
    done.forEach(m => sent.add(`ft:${m.id}`))
  } catch { /* empty store — nothing to seed */ }
  lsSet(SENT_KEY, JSON.stringify([...sent]))
  lsSet(SEEDED_KEY, '1')
}

/* ---- shared plumbing ---- */

function sentSet() {
  try { return new Set(JSON.parse(lsGet(SENT_KEY) ?? '[]')) } catch { return new Set() }
}

function markSent(set, key) {
  set.add(key)
  lsSet(SENT_KEY, JSON.stringify([...set]))
}

async function show(title, body, tag, path) {
  if (isNative) return nativeNotify(title, body, tag, path)
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg?.showNotification) return reg.showNotification(title, { body, tag, icon: `${import.meta.env.BASE_URL}icon-192.png` })
  } catch { /* fall through to page-scope notification */ }
  try { new Notification(title, { body, tag }) } catch { /* blocked */ }
}

/* ---- checks — both ride the data sync: fresh data in, notifications out ---- */

/** Favourite-team start-soon + full-time. Cheap, idempotent, once per event. */
export async function checkFavouriteAlerts() {
  if (!alertsEnabled()) return
  const fav = lsGet(FAV_KEY)
  if (!fav) return

  const now = Date.now()
  const sent = sentSet()
  const matches = await db.matches.where('home').equals(fav).or('away').equals(fav).toArray()
  for (const m of matches) {
    const opp = m.home === fav ? m.away : m.home
    const startKey = `start:${m.id}`
    if (m.status === 'scheduled' && !sent.has(startKey)
        && m.kickoffUtc - now > 0 && m.kickoffUtc - now < SOON_MIN * 60000) {
      markSent(sent, startKey)
      await show(`${fav} v ${opp} starts soon`, `Push-back ${m.time} CET — follow it live in Hockey.AI.`, startKey, `/matches/${m.id}`)
    }
    // Full-time for the favourite is covered by checkResultAlerts() when the
    // every-match channel is on; this fallback keeps the bell meaningful for
    // readers who enabled only the bell.
    const ftKey = `ft:${m.id}`
    if (!resultAlertsEnabled() && m.status === 'completed' && m.score?.home != null && !sent.has(ftKey)) {
      markSent(sent, ftKey)
      if (now - m.kickoffUtc < RESULT_FRESH_H * 3600000) {
        await show(`Full-time: ${m.home} ${m.score.home}–${m.score.away} ${m.away}`,
          'Final score confirmed from the official record. Tap for the timeline and stats.', ftKey, `/matches/${m.id}`)
      }
    }
  }
}

/** Full-time for EVERY match — the tournament-wide result feed. */
export async function checkResultAlerts() {
  if (!resultAlertsEnabled()) return
  const now = Date.now()
  const sent = sentSet()

  let done = []
  try { done = await db.matches.where('status').equals('completed').toArray() } catch { return }

  // A first sync on a fresh device must not replay the whole tournament.
  if (lsGet(SEEDED_KEY) !== '1') {
    done.forEach(m => sent.add(`ft:${m.id}`))
    lsSet(SENT_KEY, JSON.stringify([...sent]))
    lsSet(SEEDED_KEY, '1')
    return
  }

  const announced = []
  for (const m of done) {
    if (m.score?.home == null) continue
    const ftKey = `ft:${m.id}`
    if (sent.has(ftKey)) continue
    markSent(sent, ftKey)
    if (now - m.kickoffUtc < RESULT_FRESH_H * 3600000) {
      const stage = m.phase === 'pool' ? `Pool ${m.pool}`
        : m.id === 'GOLD' ? 'World Cup final'
        : m.id === 'BRZ' ? 'Bronze medal match'
        : m.id?.startsWith('SF') ? 'Semi-final'
        : m.pool ? `Second round · Group ${m.pool}` : 'Final score'
      await show(`Full-time: ${m.home} ${m.score.home}–${m.score.away} ${m.away}`,
        `${stage} — final score confirmed. Tap for the timeline and stats.`, ftKey, `/matches/${m.id}`)
      announced.push(m.id)
    }
  }

  // Tell the background checker what the open app already announced,
  // so the 15-minute cycle never repeats it.
  if (announced.length) ackRunnerSeen(done.map(m => m.id))
}
