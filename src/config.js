// Hockey.AI — one place for every URL the app depends on.
//
// The web app reads its data relative to its own origin (GitHub Pages serves
// both). The Android build ships the web bundle *inside* the APK, so "its own
// origin" is the phone — it must name the data origin absolutely. If the site
// ever moves to the custom domain, change PAGES_ORIGIN here and rebuild the
// APK; nothing else references the host.

export const PAGES_ORIGIN = 'https://prashobhpaul.github.io/Hockey.AI_FIH2026'

// Rolling Android release — the build-apk workflow recreates this tag on every
// build and stamps `apk-build: N` in the release notes; the app compares that
// N with its own baked-in build number to offer updates.
export const RELEASE_API =
  'https://api.github.com/repos/PrashobhPaul/Hockey.AI_FIH2026/releases/tags/apk-latest'
export const RELEASE_PAGE =
  'https://github.com/PrashobhPaul/Hockey.AI_FIH2026/releases/tag/apk-latest'

// Injected by vite.config.js: 0 for the web build, the Actions run number for
// an APK build.
export const APK_BUILD = typeof __APK_BUILD__ !== 'undefined' ? Number(__APK_BUILD__) : 0
