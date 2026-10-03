# Handoff: Hungry Snaily Math (iPhone, iPad, Android)

## Overview
A math game for ages 6–7 (US Grades 1–2) that teaches **3-digit addition and subtraction**, including regrouping (carrying and borrowing). It uses place-value blocks and a number line. Snaily, a hungry snail, narrates every step. Each correct answer earns a leaf, which Snaily catches from a confetti cannon and eats. After 10 leaves she goes to the potty, the leaves disappear one at a time, and the player earns a **medal**. After every 2 medals the player chooses: keep the level, go to the next level, or finish.

Target: native store apps for **iOS (iPhone + iPad)** and **Android**, **landscape only**. A PWA build is optional.

## About the Design Files
`prototype/Snaily Number Garden.dc.html` is a **design reference built in HTML**. It's a working prototype that shows the intended look, motion, sound and game logic. It is **not production code**. Recreate it in the chosen app stack. Recommended: React + Capacitor, which can reuse much of the logic. Alternatives are Expo/React Native or SwiftUI plus Kotlin. Open the file in a browser to play it; `support.js` is the prototype runtime and is not needed in production.

All game logic lives in the `<script data-dc-script>` block, plain JS in `class Component`. Key functions:
- `useRound(seed, level, round)` generates the step script for a round.
- `mkAdd` / `mkSub` / `layout` place the blocks.
- `celebrate()` runs the cannon sequence.
- `startPotty()` runs the potty and medal sequence.
- `snd()` holds the sound effects (Web Audio synthesis).
- `speak*()` handles the voice.

## Fidelity
**High-fidelity.** Colors, type, layout, motion timings and copy are final unless a decision below changes them. Snaily and the cannon are built from simple CSS shapes as placeholders. An illustrator may redraw them in the same style and proportions.

## Product decisions (confirmed)
| # | Decision | Choice |
|---|---|---|
| 1 | Studio / bundle ID | **BoomLabs**, `com.boomlabs.hungrysnaily`. Developer accounts: Apple ✔ and Google ✔ |
| 2 | Voice | **Licensed TTS, pre-generated and bundled** (see Voice). No network TTS at runtime. |
| 3 | Pricing | **Free.** No ads, no in-app purchases, no third-party analytics. |
| 4 | Levels | **6 levels** (see Levels): Warm-up (2-digit), Level 1–3 (3-digit), Mixed review, 4-digit challenge |
| 5 | Saving progress | **On the device only**, one player, no accounts |
| 6 | Parent area | Behind a **parent gate**: settings, a **progress report**, and a **time limit / break reminder** |
| 7 | Language | English at launch. **Build for more languages later**: every string and voice line in locale files, and number words generated per locale. |
| 8 | Sound | Keep the synthesized effects (port the Web Audio code or render it to audio files) |
| 9 | Extras | **Haptics** (correct answer, each bite, medal) and a **reduce-motion** setting |
| 10 | Privacy policy | **Needs writing.** A draft is in `PRIVACY_POLICY_DRAFT.md`; have it reviewed before publishing. |
| 11 | Store compliance | Apple Kids Category (ages 6–8) and Google Families: parent gate on all outside links and on the parent area |

## Levels (replaces the 4-level list in Game Flow)
Order: Warm-up → Level 1 → Level 2 → Level 3 → Mixed review → 4-digit challenge. The "Next level" choice follows this order and is hidden on the last level.
| Level | Name | Content | Board |
|---|---|---|---|
| 0 | Warm-up | 2-digit numbers: adding and taking away, with no trade and with a trade in the ones | 2 columns (Tens, Ones), each wider |
| 1 | Adding & taking away | 3-digit, no trades, plus number-line hops | 3 columns |
| 2 | One trade | 3-digit, trade in the ones only | 3 columns |
| 3 | Two trades | 3-digit, trades in the ones and tens | 3 columns |
| 4 | Mixed review | 3 random problems per round, drawn from Levels 1–3 | 3 columns |
| 5 | 4-digit challenge | 4-digit numbers with up to 3 trades; the first trade is a drag, the rest are automatic | 4 columns (Thousands, Hundreds, Tens, Ones). New piece: thousand cube, a 3D-looking 84px cube made of stacked flats, purple-free and in the same palette. |
- Generalize `mkAdd`/`mkSub`/`layout`/`useRound` from 3 columns to N columns. The column width is `855 / N`, and the slot math scales to fit.
- Keep the layout limits for every level: at most 6 pieces of the largest block, at most 12 rods, and at most 18 cubes per merged column.
- A new player starts at **Warm-up**. A player can tap the Level label to change level, but only through the parent gate.

## Parent area (behind a parent gate)
- **Gate:** hold the gear button for 2s, then answer a simple adult question (for example "Type 7 × 6").
- **Settings:** sound on/off, voice on/off, narration speed (slow/normal/fast), auto-advance on/off, reduce motion, haptics on/off, starting level, and reset progress.
- **Progress report:** medals earned, current level, accuracy per problem type (adding with no trade, adding with trades, taking away with no trade, taking away with trades), common mistakes (for example "forgot to trade"), and play time this week. Stored on the device only.
- **Time limit / break reminder:** off, 10, 15, 20 or 30 minutes. When time is up, Snaily yawns, says it's time for a break, and the game locks until the gate is passed or 30 minutes have gone by.

## Reduce motion
When it's on, or when the system "Reduce Motion" setting is on:
- No confetti and no cannon. The leaf drops straight into Snaily's mouth.
- No screen-wide bursts.
- Block moves shorten to 0.3s with no overshoot.
- The potty sequence keeps its logic, but uses fades instead of slides.

## Stage & Responsive Layout
- The design canvas is **1280×720** at minimum, scaled uniformly to fit. The canvas grows to use spare space:
  - `W = clamp(720 × aspect, 1280, 1600)`
  - `H = clamp(1280 / aspect, 720, 960)`
  - `scale = min(screenW / W, screenH / H)`
- Number pad placement depends on the extra space:
  - **side**: if `W − 1280 ≥ 250` (wide phones). A 3-column grid of 84px keys at x = 1268, y = 110.
  - **bottom**: if `H − 720 ≥ 150` (iPad). A centered row of 94×94 keys at y = 736.
  - **row**: if the screen is 16:9 and scale < 0.8 (small phones). A white panel at x 200, y 540, 1060×172, z-index 35. It shows the question text and a row of keys 96px tall. The hint pill sits above the panel.
  - **normal**: laptops. A 5×2 grid of 48px keys under the written-math card.
- When the device is held in portrait, show the "Turn your screen sideways" overlay and pause the game.
- Keep everything inside the safe areas. Touch targets must be at least 44pt after scaling.

## Screens / Regions (canvas coordinates, px)
**Top bar (y 18–74)**
- Title at x 40: "Hungry Snaily Math", 26/700, color #3f7a4a. Under it: "{Level N} · {section}", 18/500.
- **Medals row** at x 430: the label "Medals", then up to 8 medal icons (28px gold circle on two ribbons), then "+N". With zero medals it shows the hint "Fill Snaily's tummy to earn one!".
- **Tummy meter** at x 836, a pill 310×56: the label "Tummy" and 10 leaf slots, 20px each.
  - Empty slot: dashed outline, scale 0.85. Filled slot: green, scale 1.05, with a springy 0.4s transition.
- **Sound toggle**: a 52px circle at x 1162.

**Main area (x 40–945, y 84–494)**, one of:
- **Intro**: sample blocks, the headline "Snaily is hungry!" (76/700), a subcopy line, and a "Let's feed Snaily!" button (84px tall pill, green #64b06a with a 7px darker drop shadow, breathing animation). Below it: a voice picker and a Listen button.
- **Level banner**: "Level N" (100/700) with the subtitle (42/600, amber).
- **Place-value board** at x 90, 855×410: 3 columns of 285px (Hundreds / Tens / Ones). Each column is a panel with 24px radius and a 4px border.
  - The focused column gets a green border plus a 6px glow ring.
  - The drop-target column gets a dashed green border.
  - In addition, a dashed divider at y 232 splits zone A (top number, y 52) from zone B (bottom number, y 240).
  - Number chips sit on the left: orange for the top number, blue for the bottom, with a "+" between them.
- **Blocks**:
  - Hundred flat: 84×84 with a 10×10 grid.
  - Ten rod: 20×84 with 10 segments.
  - One cube: 22×22.
  - Colors: top number orange #f2c27a with edge #c9783c; bottom number blue #a9c9e8 with edge #5f86b8; traded or new blocks green #a6dd8f with edge #5fa26a.
  - Slot math:
    - Hundreds: 3 per row, 88/90 pitch.
    - Tens: in a row, 21 pitch.
    - Ones: 5 per row (ten-frame style), 26 pitch.
  - Moves use a 0.9s `cubic-bezier(.34,1.45,.55,1)` with a 25–35ms stagger.
- **Number line**:
  - The line runs from x 70 to 920 at y 430, with ticks every 5 and labels every 10 (every 20 if crowded).
  - Hops are dashed half-ellipse arcs labeled "+100", "+10", "+N".
  - A mini Snaily (scale 0.45) hops between landing points over 1s.
  - A green pill below the line shows her current position.

**Written-math card (x 968, y 84, 272 wide)**
- White, 26px radius. Columns H/T/O, each 62 wide.
- Rows, top to bottom:
  - Carry/borrow marks: 24/700, green.
  - Top number: 50/600, orange. A digit that's been borrowed from is struck through in red, shown at 50% opacity.
  - Bottom number: blue for addition, ink for subtraction.
  - A 6px rule.
  - The answer slot.
- The active answer slot has a dashed green border, a pale yellow fill and a pulsing glow.

**Bottom row**
- **Snaily** at x 44, y 556 (150×120). Her tummy grows to 1.14× when full and pops to 1.18× while munching.
- **Speech bubble** at x 214, 740 wide: white, 32px radius, text 31/500. A hint pill above it in coral: #f3c9b5 fill, #8a3d22 text.
- **Controls** at x 992: back and next (68px circles) and play/pause (86px green circle).

## Game Flow & Logic
**Round generation** (seeded RNG, new numbers every round). The first round of each level is *guided* with fuller narration; later rounds open with "Your turn!".
- **Level 1, adding and taking away:** meet-the-blocks (first round only), add with no carry, number-line hop (+1 hundred, +1–3 tens, +2–5 ones), subtract with no borrow.
- **Level 2, one trade:** add with a carry in the ones only; subtract with a borrow in the ones only.
- **Level 3, two trades:** add with carries in the ones and tens; subtract with borrows in the ones and tens.
- **Level 4, mix it up:** 3 problems drawn at random from all types. This is the top level.
- **Number limits** (to fit the layout): merged hundreds ≤ 6, tens ≤ 12, ones ≤ 18, and every digit of the second number ≥ 1. The exact ranges are in the `G` generator.
- **Addition steps**, for each column from ones to hundreds:
  - Merge the blocks, then ask "How many?" (a checkpoint).
  - If the column holds 10 or more, the first trade in a problem is a **drag checkpoint**: drag the glowing 10 into the next column to the left. Any later trade is automatic.
  - Then ask "How many are left?" and write a carry mark of "1".
- **Subtraction steps**, for each column:
  - If the top digit is smaller than the bottom digit, break one block from the column to the left. The first break is a drag checkpoint; the 10 new green pieces spill out.
  - Strike through the old digits and write the new ones.
  - Highlight the blocks to remove in red, fade them out upward, then ask "How many are left?".
- **Checkpoints:**
  - **Digit:** tap a number key. An answer longer than one digit fills slots left to right; the number line uses a 3-digit answer.
  - A wrong answer plays a soft "uh-oh" and shows the hint. After 2 misses the hint adds "Try N!".
  - **Drag:** the drop column is worked out from the pointer x. A tap without dragging also counts.
  - Next skips the checkpoint without earning a leaf.
- **Auto-advance:** the game moves on after Snaily finishes speaking plus 700ms (fallback timer: 1.7s + 310ms per word). It also waits for the cannon to finish.

**Correct-answer celebration, `celebrate()`, about 5.6s.** If another answer comes in meanwhile, the next celebration waits and plays after it.
| t (ms) | Event |
|---|---|
| 0 | The cannon rolls in from the right (0.95s) and parks at x 270, y 562, barrel at −55°. Snaily walks to x 128 (1.05s). The speech bubble fades out. |
| 1150 | The fuse spark fizzes down for 0.9s (hiss and crackle). |
| 1450 | Snaily turns and runs back to x 44 (0.55s). |
| 2150 | Snaily turns to face the cannon. |
| 2050 | BOOM: barrel kick, flash, 80 confetti pieces from the muzzle at (402, 533). A leaf is lobbed toward Snaily's mouth (1s arc, apex −300px). |
| 2780 | Snaily jumps −78px (0.28s). |
| 3050 | Catch: tummy +1, 4-bite munch over 1.2s with crunch sounds, green crumbs and a "Nom nom!" pill. |
| 3330 | Snaily lands. |
| 4500 | The cannon rolls out to the right. |
| 5600 | End. If the tummy is at 10, the potty sequence starts. |

**Potty and medal, `startPotty()`, about 9.3s.** Input is blocked during this sequence.
1. Snaily says "Uh oh! My tummy is full. I need to go potty!" A toilet pops up at x 1050, y 500, and she slides over and up onto the seat (1.8s).
2. She sits for 5s. The 10 leaves vanish from the meter one at a time, every 470ms, each with a plop.
3. Flush. A medal pops up in the center (2.8s animation) to a bell fanfare, and Snaily says "Ahh, all better! You earned a medal!" She then slides home.
4. Every 2 medals, a choice dialog opens with three options:
   - Keep playing {Level}
   - Go to {Next level}: {sub} (hidden at Level 4)
   - Finish and see my medals: a medal grid with Keep playing and Start over.

## State
- Saved to the device: `level, round, seed, step, medals`.
- Kept in memory: `leaves (0–10), playing, typed, wrong, hint, drag, potty (walk|sit|back), celeb (walk|run|watch|jump|land), cannon {phase, fired}, munching, choice, finished, muted, voice`.

## Voice (licensed TTS, pre-generated)
- **Provider:** a licensed neural TTS with a child or young-sounding voice whose terms allow bundling the audio in apps (for example Azure Neural TTS, Amazon Polly or ElevenLabs). Confirm the commercial license.
- **Clip bank,** generated at build time with a script:
  1. Number words 0–9999.
  2. Every fixed phrase or phrase fragment from the `useRound` templates, split at the number slots.
  3. Potty, celebration, intro and level lines.
  - Store the clips as AAC/MP3 under `/audio/{locale}/`.
- **Playback:** join the clips together with 40–80ms gaps, one sentence at a time, and 380ms between sentences. Snaily's mouth animation runs while audio is playing.
- **Reading:** "−" is read as "minus", "+" as "plus", "=" as "equals".
- **Rules:** use one voice for everything, never a male fallback, and stay silent if a clip is missing (the bubble text still shows).
- **Localization:** a clip bank per locale, with number-word rules per locale.

## Sound (all synthesized in `snd()`; port as is or render to files)
pop, tap (mallet), yay (bell and marimba arpeggio), oops (two soft wooden notes), swoosh, rumble (wheel clicks), fuse (hiss and crackle), boom (thump, noise and confetti rustle), munch (4 crunches), burp (plus jingle), grumble, toilet (boing), plop, flush, medal, end. A master bus with a light reverb (1.4s noise impulse, 22% wet) and a compressor.

## Design Tokens
- **Font:** Fredoka 400/500/600/700, from Google Fonts. Bundle it in the app.
- **Colors (approximate hex values; the prototype uses OKLCH):**
  - Page background: cream #faf6ea
  - Ink: #2f3b30
  - Leaf green: #64b06a (darker #4f8f55)
  - Sun highlight: #f7d34a
  - Coral hint: #f3c9b5
  - Block colors: as listed under Blocks
  - Snaily: body #e3e08a, shell #f0b36a, spiral #d8673c, blush #f2a7a0
  - Medal: gold #f1c94a, rim #c99a2e, ribbons #e0604a and #5b7fbf
- **Radii:** 6 (cube), 14 (keys), 20–24 (pills and panels), 26–36 (cards).
- **Shadows:** a solid drop of 3–7px in a darker tint (a "chunky" look, no blur), except the stage.

## Assets
- `prototype/icons/`: app icon at 512, 192 and 180, plus a maskable version. **Make a 1024×1024 master for the App Store.**
- Snaily, the cannon, the toilet and the medal are drawn with CSS shapes. Redraw them as vector art (SVG or Lottie) at the same proportions.
- **Not included yet:** voice audio, store screenshots, privacy policy.

## Files
- `prototype/Snaily Number Garden.dc.html`: the complete interactive prototype (template plus logic).
- `prototype/support.js`: the prototype runtime, for viewing only.
- `prototype/manifest.webmanifest`, `prototype/sw.js`: PWA config and offline cache, for the optional web build.
- `prototype/icons/*`: icons.
