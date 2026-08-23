<div align="center">

<img src="public/logo.png" alt="" width="104" height="104">

<img src="public/hockeyai_name.png" alt="Hockey.AI" width="320">

### Your intelligent companion for the FIH Hockey World Cup 2026

**Analyze. Predict. Experience.**

16 nations · 50 matches · Belgium &amp; Netherlands · 15–30 August 2026

<br>

<a href="https://github.com/PrashobhPaul/worldcup2026hockey/releases/download/apk-latest/Hockey.AI.apk">
<img src="https://img.shields.io/badge/Android-Download%20the%20app-3ddc84?style=for-the-badge&labelColor=0b1736" alt="Download the Android app">
</a>
<a href="https://prashobhpaul.github.io/worldcup2026hockey/">
<img src="https://img.shields.io/badge/▶%20Open%20in%20a%20browser-No%20install-ffb547?style=for-the-badge&labelColor=0b1736" alt="Open Hockey.AI in a browser">
</a>

<br><br>

<img src="https://img.shields.io/badge/result-alerts%20built%20in-22c55e?style=flat-square&labelColor=0b1736" alt="Result alerts built in">
<img src="https://img.shields.io/badge/works-offline-22c55e?style=flat-square&labelColor=0b1736" alt="Works offline">
<img src="https://img.shields.io/badge/no-account%20needed-8fa3d1?style=flat-square&labelColor=0b1736" alt="No account needed">
<img src="https://img.shields.io/badge/no-ads%20or%20trackers-8fa3d1?style=flat-square&labelColor=0b1736" alt="No ads or trackers">
<img src="https://img.shields.io/badge/free-forever-ffb547?style=flat-square&labelColor=0b1736" alt="Free">

</div>

---

## Get the Android app

Download **Hockey.AI.apk** from the button above, open it, and allow the install when Android asks. APK stands for Android Package — the same file format the Play Store delivers, just handed to you directly.

**If you had the older Hockey.AI installed, uninstall it first.** This build is a different app underneath and carries a new signing key, so Android will refuse to install over the old one. It's a one-time thing — every future build installs straight over the top of this one and keeps your data.

This is a real standalone app, not a shortcut to a website. The whole interface ships inside the download and renders in the app's own window: no address bar, no browser chrome, its own icon in the app drawer, and it opens with no network at all. The previous build was a Trusted Web Activity — a thin wrapper that asked Chrome to display the site — which is why a browser bar kept appearing at the top.

No Android device? The browser version at [prashobhpaul.github.io/worldcup2026hockey](https://prashobhpaul.github.io/worldcup2026hockey/) is the same app and still installs to your home screen on iPhone (Share → Add to Home Screen) or desktop Chrome. It just can't reach you while it's closed.

---

## Result alerts

Every match that finishes sends a notification with the final score. Nothing to configure, no account anywhere — the app asks for notification permission on first launch and then looks after itself.

Two things do the work:

- **While the app is open or recently backgrounded**, it's already refreshing tournament data every minute. A result that lands in that refresh becomes a notification immediately.
- **While the app is fully in the background**, a scheduled job wakes roughly every fifteen minutes, checks whether the published data changed, and announces anything that finished since it last looked. It's deliberately cheap: it fetches one tiny version file first and only pulls the full fixture list when that number has moved.

Both paths share a record of what's already been announced, so the same result never arrives twice.

**What this honestly can't do.** Android gives background jobs a floor of about fifteen minutes and treats it as a suggestion rather than a promise, so a result can reach you a few minutes after it reaches the stadium. Phones with aggressive battery managers — Xiaomi, Vivo, Oppo, Realme and OnePlus are the usual suspects — will delay or silently kill that job unless the app is exempted, which is why the app offers to open the exemption screen on first run. And if the app is force-stopped rather than simply closed, Android blocks it from running at all until it's opened again. There's no push server behind this app to wake it up, which is precisely why there's no account, no backend bill, and nothing collecting a device identifier.

Following a specific team still works: open its page, follow it, and the bell on the Home screen adds start-of-match reminders on top of the result alerts.

---

## What it does

### 🏑 Every match, as it happens
Live scores, quarter-by-quarter timelines, penalty corners, cards and full match stats — with the key moments marked so you can catch up on a match in fifteen seconds.

### 🎯 Predictions that are graded in public
Every fixture gets an engine pick **before** it's played. Once the result is in, the pick is graded — correct or wrong, on the record. Picks are never edited or deleted after the fact, and the running accuracy is shown at the top of every screen. If the model is having a bad tournament, you'll see it.

### 📈 One champion probability, everywhere
A Monte-Carlo simulation runs the remaining tournament thousands of times after every completed match. The number you see on the Oracle race chart is the same number on the odds table, the team page and the home screen — one calculation, one answer, no contradictions.

### 🧠 AI Lab
Live win-probability that moves with the match, momentum swings, upcoming-fixture previews, and a written brief for every finished match.

### 🏆 Tournament centre
Pool tables, stat boards, the bracket as it locks, the Tournament's Best XI picked purely on AI player ratings — and the awards, with the engine's pre-tournament picks graded against the real ones.

### 🌍 Teams and players
All 16 squads with a pre-tournament introduction, a live title probability, and per-player AI ratings out of 100 that update after every match. Filter the field by who's still alive, the favourites, the contenders, the dark horses.

---

## Why you can trust the numbers

- **The engine shows its work.** Every probability names the snapshot it came from — how many matches are counted, which model version, how many simulations.
- **It says when it doesn't know.** No fake 33/33/33 splits, no invented stats. Where data is estimated rather than official, it's labelled as estimated.
- **Nothing is quietly rewritten.** Match results, predictions and awards are append-only; the git history is the audit trail.
- **Your data stays yours.** No account, no analytics, no ad network. The app never sends anything about you anywhere.

---

## Under the hood

React + Vite, offline storage in IndexedDB (the browser's built-in database), and a GitHub Actions pipeline that pulls official FIH results through match days, recomputes player ratings and predictions, and redeploys itself. There is no server and no database to pay for — the tournament data lives in this repository.

The system is **AI-first with a deterministic fallback**. Match briefs and pick rationales are written by a language model when one is configured; every number underneath them comes from the calibrated statistical engine, which also stands in on its own whenever no model is available. Code, data and configuration are kept apart:

- `model/params.json` — every model constant, in one documented file, read verbatim by both the pipeline (Python) and the app engine (JavaScript) so the two can never drift.
- `public/data/` — the published tournament data. Append-only where it matters: picks and probabilities are never rewritten, corrections arrive as new revision rows.
- `scripts/backtest_model.py` — re-scores every completed match *as-of-then* (using only what was known before each push-back), so the calibration claims are reproducible on demand.

### How the Android app is built

The repository holds the web source **and** the Android project. Capacitor is the bridge: it packages the built web bundle into the app and exposes the native pieces the app needs — status bar colour, splash screen, hardware back button, notifications, and the background job.

Everything is built by GitHub Actions, so no local Android toolchain is required anywhere. Pushing a change to `src/`, `public/`, `android/` or the build config runs **Build Android APK**, which produces a signed app and replaces the `apk-latest` release. The same workflow can be started by hand from the Actions tab.

| Piece | Where it lives |
| --- | --- |
| Native shell config | `capacitor.config.json` |
| Native bridge used by the app | `src/native.js` |
| Notification rules, both paths | `src/notify.js` |
| Background job, runs outside the app | `public/runners/results.js` |
| Battery-exemption helper | `android/app/src/main/java/com/prashobhpaul/hockeyai/BatteryOptPlugin.java` |
| Build and release pipeline | `.github/workflows/build-apk.yml` |

**Data still updates without a new app build.** Only the interface is packaged into the download; fixtures, results and probabilities are fetched live from the published site, exactly as the browser version does. A new app build is needed only when the app's own code changes — and when one exists, the app notices and shows an update banner instead of leaving anyone stranded on a stale version. It compares a build number baked into the binary against the one stamped into the release notes.

**Signing, plainly stated.** The signing key is committed to this repository at `android/app/keystore/`, which is what makes the build work with zero setup. The trade-off is real and worth naming: anyone can take that key and sign an app that Android will happily install over this one. For a free, open, sideloaded tournament app that is an acceptable risk; for anything holding real user data it would not be. To close it, generate a private key, add `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD` as repository secrets, and the workflow signs with those instead — no code change needed. The base64 form of the current key sits in `android/keystore-base64.txt` if the simplest path is to move that key into secrets and delete it from the tree.

### Bring your own AI

Fork the repo, add one repository secret, and the AI tier switches on — no code changes:

| Secret | Provider | Default model |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic | `claude-sonnet-5` |
| `OPENAI_API_KEY` | OpenAI | `gpt-4o` |

Set `AI_MODEL` to pin a specific model id. Without a key, the deterministic engine composes the same content from the same event data — the app is complete either way. See `scripts/ai_provider.py`.

```bash
npm install
npm run dev               # local dev server
npm run build             # production build
npm run test:probability  # probability consistency suite
python3 scripts/backtest_model.py  # model calibration, as-of-then
```

---

<div align="center">

Sister app: **[Soccer.AI](https://fifa2026.prashobhpaul.com)** — the same engine for the football World Cup.

<sub>An independent project. Not affiliated with, endorsed by, or connected to the FIH.<br>
Team names, results and rankings are the property of their respective owners.</sub>

</div>
