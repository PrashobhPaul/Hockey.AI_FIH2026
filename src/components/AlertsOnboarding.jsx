import { useEffect, useState } from 'react'
import { Bell, BatteryCharging, X } from 'lucide-react'
import { isNative, batteryOptIgnored, requestBatteryExemption } from '../native'
import { resultAlertsEnabled, enableResultAlerts } from '../notify'

// Android-only, shown once. Two taps stand between an install and reliable
// full-time notifications: the Android 13+ notification permission, and — on
// the aggressive OEM builds (MIUI, ColorOS, FunTouch…) that dominate this
// app's audience — a battery-optimisation exemption so the 15-minute
// background check is allowed to actually run.
const DONE_KEY = 'hockeyai:alerts-onboarded'

export default function AlertsOnboarding() {
  const [step, setStep] = useState(null) // null | 'notify' | 'battery'

  useEffect(() => {
    if (!isNative) return
    let cancelled = false
    ;(async () => {
      try { if (localStorage.getItem(DONE_KEY)) return } catch { return }
      if (!resultAlertsEnabled()) { if (!cancelled) setStep('notify'); return }
      if (!(await batteryOptIgnored())) { if (!cancelled) setStep('battery') }
    })()
    return () => { cancelled = true }
  }, [])

  if (!step) return null

  const finish = () => {
    try { localStorage.setItem(DONE_KEY, '1') } catch { /* private mode */ }
    setStep(null)
  }

  const onEnable = async () => {
    const ok = await enableResultAlerts()
    if (!ok) { finish(); return }
    if (!(await batteryOptIgnored())) setStep('battery')
    else finish()
  }

  const onBattery = async () => {
    await requestBatteryExemption()
    finish()
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] md:left-auto md:right-6 md:w-96">
      <div className="rounded-2xl border border-brand/25 bg-pitch-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <button onClick={finish} aria-label="Not now"
          className="absolute right-2.5 top-2.5 rounded-md p-1 text-pitch-400 hover:bg-pitch-800 hover:text-white">
          <X size={14} />
        </button>
        {step === 'notify' ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bell size={15} className="text-brand" /> Every final score, delivered
            </div>
            <p className="mt-1.5 pr-4 text-xs leading-relaxed text-pitch-300">
              Get a notification when each World Cup match finishes — every result
              through the final on 30 August. Instant while the app is open;
              checked about every 15 minutes when it&apos;s closed.
            </p>
            <button onClick={onEnable}
              className="mt-3 w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-pitch-950 transition-opacity hover:opacity-90">
              Turn on result alerts
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BatteryCharging size={15} className="text-brand" /> One more tap for reliability
            </div>
            <p className="mt-1.5 pr-4 text-xs leading-relaxed text-pitch-300">
              Some phones pause background apps to save battery, which can delay
              or silence result alerts. Allowing Hockey.AI to skip battery
              optimisation keeps the checks running. It stays lightweight — one
              tiny data probe every 15 minutes.
            </p>
            <button onClick={onBattery}
              className="mt-3 w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-pitch-950 transition-opacity hover:opacity-90">
              Allow background checks
            </button>
          </>
        )}
      </div>
    </div>
  )
}
