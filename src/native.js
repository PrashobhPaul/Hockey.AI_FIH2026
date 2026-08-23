// Hockey.AI — native (Capacitor) bridge.
//
// Every Android-specific concern funnels through this one module so the rest
// of the app stays platform-blind: status bar and splash, the hardware back
// button, system notifications, the handshake with the background result
// checker, the battery-optimisation escape hatch, and the APK update check.
// On the web every export is a cheap no-op.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { RELEASE_API, RELEASE_PAGE, APK_BUILD } from './config'

export const isNative = Capacitor.isNativePlatform()

// Registered in MainActivity.java — a ~40-line local plugin, because no
// JS API can read or open Android's battery-optimisation state.
const BatteryOpt = isNative ? registerPlugin('BatteryOpt') : null

const RUNNER_LABEL = 'com.prashobhpaul.hockeyai.results'

/* ------------------------------------------------------------------ */
/* App chrome: status bar, splash, hardware back                       */
/* ------------------------------------------------------------------ */

export async function initNative(navigate) {
  if (!isNative) return
  document.documentElement.classList.add('native-app')

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setBackgroundColor({ color: '#0b1736' })
    await StatusBar.setStyle({ style: Style.Dark }) // light text on the navy bar
  } catch { /* plugin unavailable — cosmetic only */ }

  try {
    const { App } = await import('@capacitor/app')
    // Hardware back mirrors browser back; at the root it minimises instead of
    // exiting, the way every native sports app behaves.
    App.addListener('backButton', ({ canGoBack }) => {
      const atRoot = window.location.pathname === '/' || window.location.pathname === ''
      if (!atRoot && (canGoBack || window.history.length > 1)) window.history.back()
      else App.minimizeApp()
    })
  } catch { /* back button falls through to default */ }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.createChannel({
      id: 'results',
      name: 'Match results',
      description: 'Full-time scores for every FIH World Cup match',
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => {})
    // Tapping a result notification lands on that match's page.
    LocalNotifications.addListener('localNotificationActionPerformed', e => {
      const path = e?.notification?.extra?.path
      if (path && navigate) navigate(path)
    })
  } catch { /* notifications degrade to none */ }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch { /* splash auto-hides */ }
}

/* ------------------------------------------------------------------ */
/* System notifications                                                */
/* ------------------------------------------------------------------ */

/** Android 13+ needs a runtime grant; returns true when notifications may show. */
export async function ensureNotifPermission() {
  if (!isNative) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let s = await LocalNotifications.checkPermissions()
    if (s.display !== 'granted') s = await LocalNotifications.requestPermissions()
    return s.display === 'granted'
  } catch {
    return false
  }
}

// Notification ids must be 32-bit ints; derive a stable one from the tag.
function intId(tag) {
  let h = 5381
  for (let i = 0; i < tag.length; i++) h = ((h << 5) + h + tag.charCodeAt(i)) | 0
  return Math.abs(h) % 2147483647
}

export async function nativeNotify(title, body, tag, path) {
  if (!isNative) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [{
        id: intId(tag),
        title,
        body,
        channelId: 'results',
        extra: path ? { path } : undefined,
      }],
    })
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Background result-checker handshake                                 */
/* ------------------------------------------------------------------ */

/**
 * Tell the background runner which finished matches the open app has already
 * announced, so the 15-minute check never repeats them. Fire-and-forget.
 */
export async function ackRunnerSeen(ids) {
  if (!isNative || !ids?.length) return
  try {
    const { BackgroundRunner } = await import('@capacitor/background-runner')
    await BackgroundRunner.dispatchEvent({
      label: RUNNER_LABEL,
      event: 'ack',
      details: { ids },
    })
  } catch { /* runner not registered yet — its own freshness guard covers this */ }
}

/* ------------------------------------------------------------------ */
/* Battery optimisation (the OEM task-killer escape hatch)             */
/* ------------------------------------------------------------------ */

export async function batteryOptIgnored() {
  if (!BatteryOpt) return true
  try {
    const { ignoring } = await BatteryOpt.isIgnoring()
    return !!ignoring
  } catch {
    return true // unknowable — don't nag
  }
}

export async function requestBatteryExemption() {
  if (!BatteryOpt) return
  try { await BatteryOpt.request() } catch { /* settings screen unavailable */ }
}

/* ------------------------------------------------------------------ */
/* APK self-update check                                               */
/* ------------------------------------------------------------------ */

/**
 * Sideloaded APKs don't auto-update. The build workflow stamps `apk-build: N`
 * into the rolling release notes; a newer N than the one baked into this
 * binary means a fresh APK is waiting.
 */
export async function checkForApkUpdate() {
  if (!isNative || !APK_BUILD) return { hasUpdate: false }
  try {
    const r = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
    if (!r.ok) return { hasUpdate: false }
    const rel = await r.json()
    const m = /apk-build:\s*(\d+)/.exec(rel?.body ?? '')
    const remote = m ? Number(m[1]) : 0
    return { hasUpdate: remote > APK_BUILD, remote, url: RELEASE_PAGE }
  } catch {
    return { hasUpdate: false }
  }
}

export async function openReleasePage() {
  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: RELEASE_PAGE })
  } catch {
    window.open(RELEASE_PAGE, '_blank')
  }
}
