# App Store checklist: iPhone + iPad (universal)

## Identity
- **App name:** "Hungry Snaily Math". Check that it's available in App Store Connect. Subtitle (30 characters at most), for example "Story maths for ages 6–8".
- **Bundle ID:** `com.boomlabs.hungrysnaily`. Team: BoomLabs (Apple Developer account ✔).
- **Version:** 1.0.0, build 1. Category: **Education**. Secondary category: Games › Educational.

## Build configuration (Xcode via Capacitor)
- **Devices:** iPhone + iPad (`TARGETED_DEVICE_FAMILY = 1,2`). Minimum iOS: 16.0.
- **Orientation:** Landscape Left and Landscape Right only, set for both iPhone and iPad keys. Set `UIRequiresFullScreen = YES`, which opts out of iPad multitasking so the landscape lock works.
- **Status bar:** hidden (`UIStatusBarHidden`, `UIViewControllerBasedStatusBarAppearance = NO`). The home indicator auto-hides (`prefersHomeIndicatorAutoHidden`).
- **Launch screen:** a storyboard with the cream background `#faf6ea` and a centred Snaily logo. No text.
- **Bundle everything offline:** the font, sounds and voice clips. There must be **no network requests at runtime**. Remove the "Kid voice (online)" option and the Google Fonts links.
- **Audio session:** `ambient` category (it doesn't stop the user's music). Resume the Web Audio context on first touch.
- **Haptics:** `@capacitor/haptics` for correct answers, bites and medals. Respect the in-app haptics setting.
- **Storage:** `@capacitor/preferences`, replacing `localStorage` (iOS can purge web storage).
- **Disable** text selection, long-press callouts, pinch zoom and rubber-band scroll (already set in the prototype CSS; keep it in the WebView config).
- **Icons:** a 1024×1024 PNG with no alpha. Let Xcode generate the sizes from a single-size asset catalog.

## Kids Category requirements (age band 6–8)
- **No third-party analytics or advertising SDKs**, and no data sent off the device.
- **Parent gate** before any external link, the settings or parent area, and any App Store or review prompt. Use: hold the gear for 2s, then answer an adult question.
- No links out of the app except behind the gate (privacy policy, support).
- **Privacy nutrition label:** "Data Not Collected".
- **Age rating questionnaire:** everything "None", which should give 4+. Choose the **Kids Category, ages 6–8**.

## App Store Connect metadata
- **Privacy policy URL** (required): host the reviewed `PRIVACY_POLICY_DRAFT.md`.
- **Support URL** (required), for example a simple page with a contact email.
- **Description:** about 170 words covering the two modes, 9 garden spots, methods taught, no ads, and offline play.
- **Keywords:** math, maths, kids, word problems, bar model, singapore math, mental math, addition, subtraction, multiplication.
- **Screenshots** (landscape), at least 3 of each:
  - iPhone 6.9″: **2868×1320** (6.5″ at 2778×1284 is also accepted).
  - iPad 13″: **2752×2064**.
  - Suggested shots: the garden map, a bar-model story, Make a ten blocks mid-animation, the confetti cannon, and the treat plate at eating time.
- An app preview video is optional (15–30s, landscape).

## Before submission
- **Test devices:** iPhone SE (smallest), iPhone 15/16 Pro Max, iPad mini, iPad Pro 13″.
- **Check on each:**
  - 44pt hit targets.
  - Safe areas.
  - Rotating between both landscape orientations.
  - Airplane mode (the whole app works).
  - VoiceOver labels on the main buttons.
  - Reduce Motion.
  - Mute switch behaviour.
- **TestFlight:** an internal test with 2–3 families.
- **Review notes:** "Kids app, ages 6–8. No accounts, no network, no data collected. Parent gate: hold the gear icon for 2 seconds, then answer the multiplication question."
