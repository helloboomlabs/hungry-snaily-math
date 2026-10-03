# Handoff: Snaily Math — iOS app (iPhone + iPad)

## Overview
A math game for ages 6–8 (US Grades 1–3), shipped as **one universal iOS app** (iPhone and iPad), **landscape only**, offline, free, with no ads, no in-app purchases and no analytics. It has two modes, both narrated by Snaily the hungry snail:

1. **Number Garden**: 3-digit adding and taking away with place-value blocks and a number line. The full spec is in `NUMBER_GARDEN_SPEC.md` and is unchanged.
2. **Story World**: word problems on a garden map with 9 spots. Each spot teaches a topic with Singapore-style methods (bar models, comparison bars, guess and check, mental maths and others). Kids collect items, swap them for treats, and feed Snaily at eating time.

The home screen offers both modes. Each mode keeps its own saved progress.

## About the Design Files
The files in `prototype/` are **design references built in HTML**. They are working prototypes that show the intended look, motion, sound and logic. They are **not production code to ship as is**. Recreate them in the app stack below. Open any `.dc.html` file in a browser to play it. `support.js` is the prototype runtime; it is for viewing only and is not needed in production.

All logic lives in the `<script data-dc-script>` block of each file (plain JS `class Component`). The markup is the template between `<x-dc>` tags, written with `{{ }}` holes, `<sc-for>` and `<sc-if>`.

**Recommended stack: React + TypeScript + Vite, wrapped with Capacitor 6 for iOS.**
- The game logic is plain JS and ports almost line for line (story generators, `prep`, `buildModel`, `buildWork`, `mentalVis`, `celebrate`, `startPotty`, the eating-time timer).
- Every model and animation is absolutely positioned on a fixed 1280×720 canvas, which maps directly onto a scaled React stage.
- SwiftUI is possible, but it means a full rewrite of about 2,200 lines of logic. Only do that if a native look-and-feel matters more than speed.

## Fidelity
**High-fidelity.** Colors, type, layout, motion timings and copy are final. Snaily, the cannon, the map spots, the treats and the items are drawn with CSS shapes as placeholders. An illustrator may redraw them as SVG or Lottie at the same sizes and proportions.

## Stage, scaling and devices
- The design canvas is **1280×720**, scaled uniformly with `scale = min(viewW/1280, viewH/720)` and letterboxed on the cream background `#faf6ea`.
- Respect the safe areas (iPhone notch and Dynamic Island, the iPad home indicator). Pad the stage container with `env(safe-area-inset-*)`.
- **Minimum hit target: 44pt after scaling.** On the smallest supported phone (iPhone SE, 667×375pt) the scale is about 0.52. Any control smaller than about 84 canvas-px must grow a larger invisible hit area. Check the swap pills, the treat-plate items, the voice toggle and the method tabs.
- **Orientation:** landscape-left and landscape-right only, set in `Info.plist` (`UISupportedInterfaceOrientations` and `~ipad`). iPad must also declare `UIRequiresFullScreen = YES` so the landscape lock is honoured.
- On iPad, the extra height (about 4:3) is shared above and below the stage. The Number Garden spec's "bottom keypad" layout applies there.

## Story World: screens

### Map (home of Story World)
- **Garden map:** 884×408 at (24, 88) with a slight 3D tilt (`perspective(1600px) rotateX(9deg)`).
  - Row 1, left to right: Lily Pond, Sunflower Hill, Two-Step Bridge, **Thinking Tree**, Bug Bakery.
  - Row 2, right to left: Garden Market, Measuring Shed, Clock Tower, Fruit Orchard.
  - Positions are in `POS`.
- **Each spot** is 180×162 with CSS art, a name pill, a topic line, a yellow count badge (items held) and a "Speedy feed" button.
- **Treat swap panel** at (924, 92), 316 wide: one row per spot reading item → treat, a count of n/10, and a "Swap 10" pill once the count reaches 10. Below it are the voice picker and the speaker toggle.
- **Treat plate** in the top-right corner, shown on every screen: day number, eating-time countdown (turns red in the last minute) and treat counts. Tapping it opens the snack picker.

### Spots and methods (generators live in `T` in the Story World file)
| Spot | Topic | Item → treat | Methods |
|---|---|---|---|
| Lily Pond | Adding & taking away | shell → jelly | Bar model, Number bond, Before and after |
| Sunflower Hill | Comparing | seed → cookie | Comparison bars, Guess and check*, Cut off the extra* |
| Two-Step Bridge | Two-step stories | gem → lollipop | Step diagram, Work backwards, Comparison bars, Guess and check |
| Thinking Tree | Mental maths | acorn → muffin | Bonds to 10, Ones only, Tens and hundreds, Make a ten, Split tens and ones, Nearly ten, Near doubles |
| Bug Bakery | Multiplying & sharing | cookie → cupcake | Drawing groups, Array, Bar model, Split to multiply*, Double it*, Think multiplication*, Split to divide* |
| Garden Market | Money | coin → ice cream | Bar model, Before and after, Comparison bars, Drawing groups, Number bond |
| Measuring Shed | Length, mass & volume | flower pot → donut | Bar model, Comparison bars, Before and after, Drawing groups |
| Clock Tower | Time | star → strawberry | Timeline, Work backwards |
| Fruit Orchard | Fractions | apple → apple pie | Fraction model, Bar model |

\* These methods always appear in a visit:
- **Sunflower Hill:** the pot problem appears once with Guess and check, then later with Cut off the extra.
- **Bug Bakery:** one smart multiplying story and one smart dividing story.
- **Thinking Tree:** always opens with Bonds to 10, then Ones only, then 3 of the 5 strategies in order of difficulty.

All of this is in `genVisit`.

### Story screen
- **Top strip:** the story text (2 lines), a method pill (green, nowrap), the tip and the map button (folded-map icon plus "Map").
- **Model card:** 900×330 at (40, 168). The model types and their renderers in `buildModel` are `bar`, `cmp`, `ba`, `bond`, `groups`, `time`, `frac`, `guess`, `cut` and `mental`.
- **Bottom row:** Snaily at the left, a speech bubble of at most 2 lines, then a key row with number chips (build), keypad keys (solve), fraction choices, or one big button (Show me / Next / Trade! / Next story).
- **Difficulty per visit (5 stories):**
  - Story 1 is **guided**: "Show me" makes Snaily place the numbers. A second button, **"I can do it!"**, skips the demo and is visible until the demo starts.
  - Story 2 has the kid build the model with labelled boxes.
  - Stories 3–4 add 1 trick number to the chips, and story 5 adds 2. Trick numbers can be turned off with the `trickNumbers` prop.
- **Sunflower Hill guess-and-check pot story:** opens with a choice card, "Try it yourself, or watch Snaily first?", with the buttons **I'll do it!** and **Show me how**.
- **Work it out page:** opens for 2- and 3-digit adding and taking-away steps. It offers Blocks (column method with trades, one digit at a time), Number line, Count on and Steps. Mental maths stories never open it. The full spec is in `STORY_WORLD_DECISIONS.md` §17–25.

### Mental maths model (`type: 'mental'`)
- **Number sentences:** up to 4 rows (y 5 / 56 / 104 / 152, height 40, font 26/700).
  - Row 0 is the problem, inside a pale yellow panel.
  - Each later row has a right-aligned caption (17px) and tokens. A token is a string, a typed slot `{s:id}`, or a reference `{r:id}` that shows the slot's value once it's filled and a grey "?" before that.
- **Visual strip** at y about 194–322, built by `mentalVis`:
  - **Base-ten blocks, true scale:** a cube is 8×8, a ten rod is 8×80 (10 cubes), a hundred flat is 80×80 (10×10). Colors: first number orange (PAL.A), second number blue (PAL.B). Taken-away blocks are dashed red outlines.
  - **Animated by step** (`k: 'anim'`): every block is a stable element whose left/top/size move with `.7s cubic-bezier(.4,1.3,.5,1)`. The step comes from the active calc's index. Steps per strategy:
    - **Split tens and ones:** one box per number → a Tens box and a Ones box → one box, with 10 cubes squashing into a rod if the ones reach 10.
    - **Make a ten (add):** the second number splits into two outlined sub-groups labelled "need" and "?" → the need cubes jump into the 2×5 ten frame → the frame squashes into a rod and the rest join it.
    - **Make a ten (take away):** the ones float up and fade → a rod breaks into a ten frame → the rest fade.
    - **Ones only / Tens and hundreds:** the second number's blocks slide in to join the first; taken-away blocks float off.
  - **Nearly ten:** a number line with a large arc for the round jump (±10, ±100) and a fixed-width 90px small arc for the fix (∓1, ∓2). The labels are the start below its tick, the middle stop above, and the answer below.
  - **Near doubles:** two rows, with the extra cube(s) highlighted in a dashed gold outline.
  - **Bug Bakery smart methods:** a dot array on the right (up to 250×290), split into colour bands with dashed dividers (5 + rest rows, doubles, or 10 + rest columns).
  - **Bonds to 10:** a 10-cell ten frame (50px cells), with acorns in the filled cells and ghost acorns appearing in the empty cells once the answer is right.

### Rewards and pacing (Story World)
- **Right answer:**
  1. The typed number fills its slot with a "pop" sound and a springy `slotIn` animation.
  2. **About 900ms later:** a cheer, a leaf burst and the confetti cannon (the same sequence as Number Garden). Input stays locked until it finishes.
  3. On the Work it out page, the typed number stays visible for 800ms before the page moves on.
- **Earnings:** every right answer earns 1 of that spot's items (in stories and in Speedy feed) and feeds Snaily leaves. 10 leaves trigger the potty trip, which earns a medal. Every 2 medals, the kid chooses: stay, next spot, or finish.
- **Treat swap:** 10 items → 1 treat, which flies to the plate.
- **Eating time:** every 20 minutes of real clock time (the `mealMinutes` prop), an "Eating time!" card asks which treat to feed.
  - Snaily accepts about 72% of the time with 1 of 7 "I would love it!" lines; about 14% she says "Not now…"; about 14% "Nah, not today." After a refusal, the next treat is always accepted.
  - **When she eats:** the treat arcs from the plate to her mouth (1s lob), she eats **the treat itself** (it shrinks in 4 bites, `bite` keyframes) with round crumbs in treat colours, and she gets +3 leaves.

### Voice
- **Prototype:** Snaily reads each new line on her own (Web Speech API). A speaker toggle mutes her voice only; ♪ mutes everything.
- **Production:** the prototype's "Kid voice (online)" option calls Google Translate's TTS endpoint. **Remove it.** It isn't licensed and it breaks the Kids Category no-network rule.
- **Replacement:** pre-generated, licensed TTS clips bundled with the app (see `NUMBER_GARDEN_SPEC.md` → Voice). Story text is generated, so build clips from phrase templates plus number words. Alternatively, use on-device `AVSpeechSynthesizer` through a Capacitor TTS plugin with an enhanced en-US voice, which has no network dependency.

## State (persist on the device)
The prototype uses `localStorage`. In the app, use Capacitor Preferences.
- **Story World keys:** `snaily-sw-medals`, `-leaves`, `-coll` (items per spot key), `-pantry` (treats), `-nextmeal`, `-day`, `-voiceoff`, `-seen` (recent number sets, to avoid repeats). Voice choice: `snaily-voice2`.
- **Kept in memory only:** screen, mode, spot, visit (5 generated stories), si, phase (build/solve/done), filled, typed, wrong, hint, calcI, work, guesses, celeb, cannon, munching/munchTreat, potty, meal.
- **Dev deep links:** `#<spot>-<method>` (for example `#tree-make`), listed in `prototype/Dev Links.dc.html`. Keep these in debug builds only.

## Design Tokens
- **Font:** Fredoka 400/500/600/700. **Bundle the font files** (the prototype loads them from Google Fonts, and the app must not).
- **Colors:** the prototype uses OKLCH. Approximate hex values:

  | Token | OKLCH | Hex |
  |---|---|---|
  | Page | 0.975 0.018 95 | #faf6ea |
  | Card | 0.995 0.006 95 | #fefdf9 |
  | Ink | 0.32 0.04 150 | #2f3b30 |
  | Leaf green | 0.72 0.14 145 | #64b06a |
  | Leaf green, dark | 0.55 0.12 150 | #4f8f55 |
  | Sun | 0.86 0.16 95 | #f7d34a |
  | Block A (fill / edge) | 0.82 0.12 70 / 0.64 0.14 55 | #f2c27a / #c9783c |
  | Block B (fill / edge) | 0.8 0.09 230 / 0.56 0.11 240 | #a9c9e8 / #5f86b8 |
  | Block G (fill / edge) | 0.82 0.13 140 / 0.6 0.13 148 | #a6dd8f / #5fa26a |
  | Hint coral | 0.86 0.08 15 | #f3c9b5 |
  | Error red | 0.62 0.16 25 | #d9614a |

- **Radii:** 2 (cubes), 8–14 (slots and bars), 18–28 (pills and cards), 50% (circles).
- **Shadows:** solid "chunky" drops of 3–8px in a darker tint, with no blur.
- **Motion:**
  - Slot fill: `slotIn .5s cubic-bezier(.34,1.6,.5,1)`.
  - Blocks: `.7s cubic-bezier(.4,1.3,.5,1)`.
  - Breathing buttons: `breathe 1.8s`.
  - Honour Reduce Motion: no cannon or confetti, and 0.3s moves with no overshoot.

## Assets
- `prototype/icons/`: 512, 192 and 180 PNGs plus a maskable version. **A 1024×1024 App Store icon is still needed** (no alpha, no rounded corners).
- All characters and props are CSS art. Redraw them as SVG for crisp scaling on iPad.
- **Not included yet:** licensed voice audio, store screenshots, final privacy policy, and support/marketing URLs.

## Files
- `prototype/Snaily Story World.dc.html`: the Story World prototype (about 2,200 lines; template plus logic).
- `prototype/Snaily Number Garden.dc.html`: the Number Garden prototype.
- `prototype/Dev Links.dc.html`: deep links to every spot and method.
- `prototype/support.js`: the prototype runtime (viewing only).
- `NUMBER_GARDEN_SPEC.md`: the full Number Garden spec (levels, parent area, voice, sound, timings).
- `STORY_WORLD_DECISIONS.md`: the Story World decision log (teaching flow, Work it out page, rewards).
- `APP_STORE_CHECKLIST.md`: iOS build and submission steps for iPhone and iPad.
- `CLAUDE_CODE_TASKS.md`: the ordered build plan for Claude Code.
- `PRIVACY_POLICY_DRAFT.md`: the privacy policy draft, which needs legal review.
