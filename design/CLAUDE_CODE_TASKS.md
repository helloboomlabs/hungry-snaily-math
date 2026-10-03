# Build plan for Claude Code

Read `README.md` first. Before writing code for each step, play the prototypes in a browser: `prototype/Snaily Story World.dc.html` and `prototype/Snaily Number Garden.dc.html`.

1. **Scaffold:** Vite + React + TypeScript, then `npx cap init "Hungry Snaily Math" com.boomlabs.hungrysnaily` and `npx cap add ios`. Bundle the Fredoka woff2 files locally.
2. **Stage:** a `<Stage>` component that renders a fixed 1280×720 canvas, scaled to fit with letterboxing and safe-area padding. It shows the "turn sideways" overlay in portrait.
3. **Port the shared engine** into `src/engine/`:
   - Sounds: the `snd()` Web Audio synth, with reverb and compressor.
   - The cannon and confetti, `celebrate()`.
   - The potty and medal sequence, `startPotty()`.
   - Leaves and the tummy meter.
   - The voice queue.
   - Persistence, using `@capacitor/preferences`.
   Use the timings from the prototype exactly.
4. **Number Garden:** port it 1:1 from its prototype and `NUMBER_GARDEN_SPEC.md`.
5. **Story World data:**
   - Port the `T` generators, `prep`, `fresh`/`SEEN`, `genVisit` (including the must-include groups and the Thinking Tree ordering), `genPractice` and `mentalVis` as pure TypeScript.
   - Unit-test every generator over 1,000 seeds. Each story must yield whole, non-negative numbers, the answers must match the calcs, and the numbers must stay within the layout limits.
6. **Story World renderers:**
   - Port `buildModel` and `buildWork` into React components, one per model type.
   - Keep the element lists stable across steps so the CSS transitions animate. This is critical for the `mental` block animations.
7. **Story flow:**
   - Build → solve → done.
   - Chips with drag or tap, the keypad, wrong-answer hints, and the reveal after 2 misses.
   - "Show me" and "I can do it!", and the Sunflower Hill choice card.
   - Right answer: fill the slot, then wait 900ms before the cannon.
   - The Work it out page.
8. **Map, Treat swap, treat plate, eating time and snacks.** Snaily eats the treat itself, using the same treat art.
9. **Voice:** replace Web Speech and the online kid voice with bundled clips or the on-device TTS plugin. There must be no network calls.
10. **Parent area and settings** (see the Number Garden spec): the parent gate, settings, the progress report and the time limit.
11. **Polish:**
    - Reduce Motion.
    - Haptics.
    - Grow hit areas to 44pt or more.
    - VoiceOver labels.
    - Remove the dev deep links (or keep them only when `import.meta.env.DEV` is set).
12. **iOS release:** follow `APP_STORE_CHECKLIST.md`. Archive in Xcode, upload, run TestFlight, then submit.
