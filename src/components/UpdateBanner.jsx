import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { isNative, checkForApkUpdate, openReleasePage } from '../native'

// Sideloaded APKs do not auto-update, so the app checks the rolling GitHub
// release once per session and offers the download when a newer build exists.
// Data stays live regardless — this banner is only about the shell.
const SNOOZE_KEY = 'hockeyai:update-snoozed-build'

export default function UpdateBanner() {
  const [update, setUpdate] = useState(null)

  useEffect(() => {
    if (!isNative) return
    let cancelled = false
    checkForApkUpdate().then(r => {
      if (cancelled || !r.hasUpdate) return
      try {
        if (localStorage.getItem(SNOOZE_KEY) === String(r.remote)) return
      } catch { /* private mode */ }
      setUpdate(r)
    })
    return () => { cancelled = true }
  }, [])

  if (!update) return null

  const snooze = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(update.remote)) } catch { /* private mode */ }
    setUpdate(null)
  }

  return (
    <div className="border-b border-brand/20 bg-brand/10">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-xs text-pitch-200">
        <Download size={13} className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1 truncate">
          A newer version of the app is available.
        </span>
        <button onClick={openReleasePage}
          className="shrink-0 rounded-md bg-brand px-2.5 py-1 font-semibold text-pitch-950 hover:opacity-90">
          Get update
        </button>
        <button onClick={snooze} aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-pitch-400 hover:bg-pitch-800 hover:text-white">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
