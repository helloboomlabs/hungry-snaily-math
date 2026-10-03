# Hungry Snaily Math: iOS app (iPhone + iPad)

This project ships the Snaily prototypes as a native iOS app with Capacitor 8. It is landscape only, works offline and collects no data.

**To publish it from Windows, follow [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).** GitHub's cloud Macs build, sign and upload it to TestFlight.

## What's inside

| Path | What it is |
|---|---|
| `www/index.html` and `www/app/home.*` | New home screen: pick Number Garden or Story World, plus the parent gate and the parent area (settings, progress, break reminder, privacy). |
| `www/garden.html` and `www/story.html` | The two games. These files are generated from `design/prototype/` by `scripts/patch-prototypes.py`. **Don't edit them by hand.** |
| `www/app/native.js` | Native bridge. It handles settings, the safe-area stage size, progress mirrored to Capacitor Preferences, haptics, the parent gate and the break lock. |
| `www/app/app.css` | Safe areas, Reduce Motion, and the overlay styles. |
| `www/app/config.js` | Version and **support email (required)**. |
| `www/vendor/` | Filled in by `npm run vendor`: Capacitor core, React 18.3.1 and the Fredoka font. It is not committed. |
| `scripts/configure-ios.sh` | Sets up the iOS project: landscape, iPad full screen, hidden status bar and home indicator, ambient audio, icons, iOS 16, and the version number. |
| `scripts/check-offline.mjs` | Fails the build if any shipped file points at the internet. |
| `tools/smoke-test.mjs` | Browser test of the whole app (`npm test`): pages load offline, parent gate, settings, Reduce Motion, a solved story, haptics, saved progress, break lock. Runs on every push and before every iOS build. |
| `resources/PrivacyInfo.xcprivacy` | Apple privacy manifest (no tracking, no data collected, UserDefaults reason CA92.1). |
| `resources/` | App icon (1024×1024, no alpha) and launch image. |
| `.github/workflows/ios-testflight.yml` | Cloud Mac build → sign → upload to TestFlight. |
| `.github/workflows/screenshots.yml` | App Store screenshots at iPhone 6.9″ and iPad 13″ sizes. |
| `.github/workflows/web-tests.yml` | Runs `npm test` on every push. |
| `site/` | Privacy policy and support page to host (for example on GitHub Pages). |
| `docs/STORE_LISTING.md` | App Store text, keywords, age rating and review notes. |
| `design/` | The original design handoff, kept for reference. |

## Changes from the prototypes (all done by the patch script)

- **No network:**
  - Google Fonts is replaced with a bundled Fredoka.
  - The React CDN is replaced with a bundled copy.
  - The unlicensed "Kid voice (online)" (Google Translate TTS) is removed. Snaily uses the on-device iOS voices.
- **Safe areas:** the stage fits inside the notch, Dynamic Island and home-indicator insets.
- **Navigation:** "‹ Home" buttons replace the cross-links between the two prototypes.
- **Settings:** parent settings feed the prototype props (sound, voice, speed, auto-advance, trick numbers, eating time).
- **Haptics:** correct answers, each bite and medals.
- **Reduce Motion:** follows the in-app setting or the iOS setting. There's no cannon, confetti, flashes or bursts (Snaily just eats the leaf), and moves are calmer.
- **Progress report:** records Number Garden accuracy per problem type (with or without trades, typing vs. trading mistakes) and stories solved and mistakes per Story World spot.
- **Bigger touch areas:** every game button gets 10 extra design-px of invisible hit area.
- **Saved progress:** mirrored to native storage, so iOS can't wipe it.

## Local preview (any computer with Node 22)

```
npm install
npm run build          # copies vendor files + network check
npm run serve          # open http://localhost:8080
```

## Known follow-ups (not blockers for TestFlight)

- **Voice:** uses on-device iOS voices. Licensed, pre-recorded voice clips (per the spec) can replace it later.
- **Characters:** still CSS art. An illustrator can redraw them as SVG.
- **Number Garden levels:** the prototype has 4 levels, which parents can pick in the parent area. The spec's Warm-up (2-digit) and 4-digit challenge need a board with a different column count, so they belong in a design update.
- **Small controls:** hit areas are bigger now, but the swap pills and voice picker are still a little under 44pt on iPhone SE. Check them in TestFlight.
