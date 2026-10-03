# Decision log: Story World (review later)

Each line is a choice I made without asking. Tell me which ones to change.

## Structure
1. **Separate file, linked both ways.** The Story World is its own file. The Number Garden start screen links to it, and the garden map links back. Both games keep separate saved progress.
2. **Version control.** Snapshots are in `versions/`, and `VERSIONS.md` says how to restore one. Number Garden v1 is the untouched original.
3. **8 spots, one per topic.** The spots are Lily Pond (adding and taking away), Sunflower Hill (comparing), Two-Step Bridge, Bug Bakery (multiplying and sharing), Garden Market (money), Measuring Shed (length, mass and volume), Clock Tower (time) and Fruit Orchard (fractions). All spots are open from the start.
4. **Collection items.** The spots give shells, seeds, gems, cookies, coins, flower pots, stars and apples. Kids earn one item per story solved, and one per Speedy feed question (changed 2 Oct). The shelf is on the map.

## Teaching
5. **All 7 methods are used:** bar models (part-whole and equal units), comparison bars, number bonds, before and after, work backwards (step diagram and timeline), guess and check, and groups or arrays. Clock faces and timelines are used for time. Pie and fence models are used for fractions.
6. **5 stories per visit.** Each spot has 5 story templates. Story 1 is always the simplest one, and the other 4 come in a random order. Numbers are new every visit.
7. **Difficulty curve:**
   - Story 1: guided. Snaily places each number when the kid taps "Show me", then the kid solves the question.
   - Story 2: the kid builds the model with labelled boxes.
   - Stories 3–4: bigger numbers, plus 1 trick number in the tray.
   - Story 5: 2 trick numbers.
   - The trick numbers can be switched off with the `trickNumbers` tweak.
8. **Building.** The kid drags number chips into the boxes, or taps a chip and then taps a box. A wrong box gives a gentle hint that names what the box is for.
9. **Solving.** The kid types answers on the keypad. Two-step stories ask for the middle step first. After 2 wrong tries, Snaily shows the answer, the same as in Number Garden. Times are typed as digits, so 4 3 0 means 4:30. Fractions are picked from 4 buttons, and equivalent pairs like 1/2 and 2/4 never show together.
10. **Reading aloud (changed 2 Oct).** Snaily now talks by default. She reads each new line and hint on her own, and reads the story when it first appears (not in Speedy feed, and not when the story text is hidden). A new speaker button in the top bar, next to ♪, turns her voice off and on, and the game remembers the choice. ♪ still mutes everything.

## Work it out page (added in v2)
17. **When it appears.** In stories, any 2- or 3-digit adding or taking-away step (for example 461 − 159) opens a "Work it out" page after the model is built. For two-step stories it opens after each step's cannon.
18. **Two ways to work it out.** The page uses the Number Garden methods.
    - **Blocks:** hundreds, tens and ones blocks next to a column sum. The kid types one column at a time, starting with the ones, and taps "Trade!" whenever a trade is needed. This includes chain trades, like trading across a zero in 402 − 159.
    - **Number line:** the second number is split into hundreds + tens + ones, and the kid taps "Jump!" for each part, then types where Snaily landed.
    - Blocks is the default when the sum needs a trade. Otherwise the number line is the default. Kids can switch with the tabs.
19. **Finishing (changed 2 Oct, to match Hungry Snaily Math).** Every typed step on the Work it out page fires the confetti cannon and feeds Snaily a leaf. The last typed step skips its own cannon, because its answer goes straight into the story model and the cannon fires there. Speedy feed fires the cannon on the middle step and on the final answer too.
20. **Speedy feed.** The work page doesn't open on its own, so practice stays fast. A "Show me how" button opens it when needed. The same button appears in stories if the kid closes the work page.
21. **Every kind of maths has small steps (v3).**
    - **Adding and taking away:** blocks go one column at a time, with trades. On the number line, the kid jumps and then types where Snaily landed after each jump.
    - **Multiplying (groups, arrays, equal bars, coin and liter groups):** count on. The kid types the running total after each group (5, 10, 15…).
    - **Sharing and grouping (including thirds):** count on until the goal, then count how many boxes it took.
    - **Halves and quarters:** split the number into easy parts, halve each part, then put them back together. A quarter is half, then half again.
    - **Time:** one hour at a time (7:30 → 8:30 → …). Going backwards works the same way. For "how long", count the hours.
    - **Fractions:** count all the parts (the bottom number), then the shaded parts (the top number), then pick the fraction.
    - **Guess and check:** after each guess, the kid types the bigger amount and the total before Snaily checks it.
22. **One digit at a time (v4, like Number Garden).**
    - **Blocks:** the kid only ever types single digits. When a column makes 10 or more, Snaily says "makes 15 ones, too many!" and the kid taps "Trade!". Then the kid types how many are left (5). The whole answer then appears on its own.
    - **Number line:** after each jump, the kid types only the digit that changed. When a jump crosses a ten or a hundred, Snaily shows where she landed and the kid taps "Next".
    - **Time:** the kid types only the new hour (7:30 → 8:30).
    - **Default view:** Blocks always opens first.
23. **Where it opens.** The work page opens on its own in stories. In Speedy feed, "Show me how" opens it.

24. **Number Garden pacing (v5).** The Blocks steps now follow the Number Garden order, with a "Next" tap between each small step.
    - **Adding:** "Orange blocks are A, blue blocks are B" → "We always start with the ones" → push the blue blocks in → "How many?" If a column has too many: "makes 15, too many!" → Trade → "How many are left?"
    - **Taking away:** "We start with A" → "only 3, not enough!" → Break one open → "Crack! Now there are 13" → the blocks to take away glow red → "How many are left?"
    - **Number line:** it now opens with "That's a hop of 1 hundred, 2 tens and 5 ones."
    - **Only one empty box:** each screen has a single empty input. The keypad readout is gone.

25. **Hungry Snaily Math layout (v5).** Story pages use the Hungry Snaily Math bottom area. Snaily's speech bubble (2 lines at most) sits next to her, and the keys sit in their own row under it, outside the bubble. That row holds whatever the kid taps next: big number chips while building, the 1–0 keys while solving, fraction choices, or one big button (Show me, Next, Trade!). The story is now a 2-line strip, and the extra instruction notes on the right are gone. The Map button is on the right. The `story` tweak hides the story text and leaves only the speaker button. The map, the collection shelf and the Treat Swap are unchanged.

## Treat plate and eating time (added 2 Oct)
26. **Treats go to the plate.** Swapping 10 items no longer feeds Snaily straight away. The treat flies to the treat plate in the top-right corner, which shows on every page.
27. **8 kinds of treats, one per spot.** Shells give jelly, seeds give a cookie, gems give a lollipop, cookies give a cupcake, coins give ice cream, flower pots give a donut, stars give a strawberry, and apples give apple pie. The swap shelf shows an arrow from each item to its treat.
28. **Snacks any time.** Tap the plate, then tap a treat to give Snaily a snack.
29. **Eating time.** One Snaily day lasts 20 minutes (the `mealMinutes` tweak changes this). The plate shows the day number and a countdown, and the countdown turns red in the last minute. When it reaches 0, an "Eating time!" card asks which treat to feed. It waits until any cannon or potty trip is finished. If the plate is empty, the card says so and the kid taps OK. "Skip this meal" also starts the next day. The timer uses the real clock, so it keeps running when the game is closed.
30. **Snaily's answers.** About 72% of the time she says one of 7 ways of "I would love it!" and eats the treat (+3 leaves). About 14% of the time she says "Not now, I will eat it as a snack later!", and about 14% of the time "Nah, not today." When she says no, the treat stays on the plate, and she always says yes to the next one. At eating time the card closes so the kid can watch her eat.

## Rewards (same as Number Garden)
11. **Leaves.** The cannon fires and a leaf is earned only when the kid types a correct answer. A finished model gets a small cheer, not the cannon. Two-step stories earn a leaf for the middle step and another for the final answer. That makes about 5–7 leaves per visit, so a potty trip and medal come about every 2 visits. (Changed 2 Oct: the cannon used to fire when a model was finished, even after Snaily built it.)
12. **Medal choice.** Every 2 medals, the kid chooses to stay at this spot, go to the next spot, or finish and see the medal wall.

## Speedy feed (practice)
13. **Practice per spot.** Each spot has a "Speedy feed" button: 10 quick questions from that topic's templates at mixed difficulty.
14. **Models come ready-made.** In practice, the model is already built, so the kid only solves. Guess and check questions still need typed guesses.
15. **Rewards (changed 2 Oct).** Each correct answer fires the confetti cannon, the same as in stories. After 10 leaves, the usual potty trip earns a medal.
16. **Results card.** At the end, a card shows how many answers were right on the first try and the total time.

## Still open
- Should the Claude Code handoff package include the Story World? I didn't update it.
- The home-screen app still starts on Number Garden. Its start screen links to the Story World.
