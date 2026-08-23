// Hockey.AI — background result checker (Capacitor Background Runner).
//
// Android schedules this via WorkManager roughly every 15 minutes (that floor
// is the OS's, not ours). Each run is a tiny version probe against the same
// JSON feed the app itself reads; only when the pipeline has published a new
// snapshot does it pull fixtures and raise a system notification for each
// freshly completed match. The open app announces results instantly through
// its own sync and acks them here, so the two paths never double-notify.
//
// This runtime is NOT a browser: no window, no localStorage, no DOM. Only
// fetch, CapacitorKV and CapacitorNotifications exist — keep it that way.

var DATA = 'https://prashobhpaul.github.io/Hockey.AI_FIH2026/data'
var FRESH_MS = 18 * 60 * 60 * 1000 // never replay results older than 18h
var MAX_PER_RUN = 6                // a burst of finals stays readable

function kvGet(key) {
  try {
    var r = CapacitorKV.get(key)
    if (r == null) return null
    if (typeof r === 'string') return r
    return r.value != null ? r.value : null
  } catch (e) { return null }
}

function kvSet(key, value) {
  try { CapacitorKV.set(key, String(value)) } catch (e) { /* best effort */ }
}

function loadSeen() {
  try { return JSON.parse(kvGet('seenResults') || '[]') } catch (e) { return [] }
}

function saveSeen(arr) { kvSet('seenResults', JSON.stringify(arr)) }

function intId(tag) {
  var h = 5381
  for (var i = 0; i < tag.length; i++) h = ((h << 5) + h + tag.charCodeAt(i)) | 0
  return Math.abs(h) % 2147483647
}

function kickoffMs(m) {
  // date "2026-08-23" + time "14:00" CET summer (+02:00)
  try { return new Date(m.date + 'T' + (m.time || '12:00') + ':00+02:00').getTime() } catch (e) { return 0 }
}

function phaseLine(m) {
  if (m.phase === 'pool') return 'Pool ' + (m.pool || '') + ' — final score confirmed.'
  if (m.phase === 'crossover' || m.phase === 'second_round' || m.phase === 'pool2') {
    return 'Second round' + (m.pool ? ' · Group ' + m.pool : '') + ' — final score confirmed.'
  }
  if (m.phase === 'semifinal' || m.id === 'SF1' || m.id === 'SF2') return 'Semi-final — final score confirmed.'
  if (m.id === 'GOLD') return 'World Cup final — champions crowned.'
  if (m.id === 'BRZ') return 'Bronze medal match — final score confirmed.'
  return 'Final score confirmed.'
}

addEventListener('checkResults', function (resolve, reject) {
  (async function () {
    var now = Date.now()

    // 1) Cheap probe: has the pipeline published anything new?
    var version = null
    try {
      var vr = await fetch(DATA + '/data-version.json?t=' + now)
      var vj = await vr.json()
      version = vj && vj.version != null ? String(vj.version) : null
    } catch (e) {
      resolve() // offline — the next run tries again
      return
    }

    var seeded = kvGet('seeded') === '1'
    var lastVersion = kvGet('lastVersion')
    if (seeded && version !== null && version === lastVersion) {
      resolve() // nothing published since last check
      return
    }

    // 2) Something changed (or first ever run) — read the fixtures.
    var matches = []
    try {
      var fr = await fetch(DATA + '/fixtures.json?t=' + now)
      var fj = await fr.json()
      matches = (fj && fj.matches) || []
    } catch (e) {
      resolve()
      return
    }

    var completed = []
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i]
      if (m.status === 'completed' && m.score && m.score.home != null) completed.push(m)
    }

    var seen = loadSeen()

    // First run on a device: everything already played is history, not news.
    if (!seeded) {
      saveSeen(completed.map(function (m) { return m.id }))
      kvSet('seeded', '1')
      if (version !== null) kvSet('lastVersion', version)
      resolve()
      return
    }

    // 3) Announce what's genuinely new and recent.
    var seenSet = {}
    for (var s = 0; s < seen.length; s++) seenSet[seen[s]] = true

    var toNotify = []
    for (var j = 0; j < completed.length; j++) {
      var c = completed[j]
      if (seenSet[c.id]) continue
      var ko = kickoffMs(c)
      if (ko && now - ko > FRESH_MS) continue
      toNotify.push(c)
    }

    var batch = []
    for (var k = 0; k < toNotify.length && k < MAX_PER_RUN; k++) {
      var t = toNotify[k]
      batch.push({
        id: intId('ft:' + t.id),
        title: 'Full-time: ' + t.home + ' ' + t.score.home + '\u2013' + t.score.away + ' ' + t.away,
        body: phaseLine(t),
        scheduleAt: new Date(now + 1000),
      })
    }
    if (batch.length) {
      try { CapacitorNotifications.schedule(batch) } catch (e) { /* permission revoked */ }
    }

    saveSeen(completed.map(function (m) { return m.id }))
    if (version !== null) kvSet('lastVersion', version)
    resolve()
  })().catch(function () { resolve() })
})

// The open app announced these itself — never repeat them from the background.
addEventListener('ack', function (resolve, reject, args) {
  try {
    var ids = (args && args.ids) || []
    var seen = loadSeen()
    var have = {}
    for (var i = 0; i < seen.length; i++) have[seen[i]] = true
    for (var j = 0; j < ids.length; j++) if (!have[ids[j]]) seen.push(ids[j])
    saveSeen(seen)
    kvSet('seeded', '1')
  } catch (e) { /* best effort */ }
  resolve()
})
