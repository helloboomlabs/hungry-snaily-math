#!/usr/bin/env python3
"""Turn the designer's HTML prototypes into the shipping app pages.

Reads  design/prototype/Snaily Story World.dc.html   -> www/story.html
       design/prototype/Snaily Number Garden.dc.html -> www/garden.html

Every patch must match the expected number of times, so if the designer
changes the prototype in a way that breaks a patch, this script fails loudly
instead of silently shipping an unpatched (online) build.

Run again whenever the prototype files are updated:
    python3 scripts/patch-prototypes.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "prototype"
OUT = ROOT / "www"

HEAD_INCLUDES = (
    '<meta name="referrer" content="no-referrer">\n'
    '<script src="app/config.js"></script>\n'
    '<link rel="stylesheet" href="app/fonts.css">\n'
    '<link rel="stylesheet" href="app/app.css">\n'
    '<script src="vendor/capacitor.js"></script>\n'
    '<script src="vendor/react.production.min.js"></script>\n'
    '<script src="vendor/react-dom.production.min.js"></script>\n'
    '<script src="app/native.js"></script>\n'
    '<script src="support.js"></script>'
)

# (old, new, expected_count)
COMMON = [
    # viewport-fit=cover so env(safe-area-inset-*) works on notched iPhones.
    ('<meta name="viewport" content="width=device-width, initial-scale=1">',
     '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">', 1),
    ('content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
     'content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">', 1),
    # Offline runtime: React is bundled, native bridge loads first.
    ('<script src="./support.js"></script>', HEAD_INCLUDES, 1),
    # No Google Fonts at runtime (Fredoka is bundled in app/fonts.css).
    ('<link rel="preconnect" href="https://fonts.googleapis.com">\n', "", 1),
    ('<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">\n', "", 1),
    ('<link rel="manifest" href="manifest.webmanifest">\n', "", 1),
    ('<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n', "", 1),
    ('<link rel="icon" type="image/png" href="icons/icon-192.png">\n', "", 1),
    # Safe areas (notch / Dynamic Island / home indicator).
    ("position:fixed;inset:0;overflow:hidden;font-family:'Fredoka'",
     "position:fixed;top:var(--sa-t);right:var(--sa-r);bottom:var(--sa-b);left:var(--sa-l);overflow:hidden;font-family:'Fredoka'", 1),
    ("const iw = innerWidth, ih = innerHeight,", "const iw = SnailyNative.vw(), ih = SnailyNative.vh(),", 1),
    # Snaily's kid voice (as designed): used when online, device voice when offline.
    ("kidOn() { return !this.state.voiceName || this.state.voiceName === '__kid'; }", "kidOn() { SnailyNative.watchTalk(this); return SnailyNative.kidVoiceOn(); }", 1),
    ("|| vs[0] || null", "|| vs[0] || SnailyNative.anyVoice()", 1),
    ("  stopVoice() { try { speechSynthesis.cancel(); } catch (e) {}", "  stopVoice() { try { speechSynthesis.cancel(); SnailyNative.stopSay(); } catch (e) {}", 1),
    # Haptics + parent settings hook on every sound effect.
    ("  snd(k) {\n", "  snd(k) {\n    try { SnailyNative.fx(k, this, typeof STEPS !== 'undefined' ? STEPS[this.state.step] : null); } catch (e) {}\n", 1),
]

BADGE = '<div aria-hidden="true" style="position:absolute;left:50%;top:-32px;transform:translateX(-50%);white-space:nowrap;padding:3px 12px;border-radius:14px;background:oklch(0.9 0.15 92);color:oklch(0.38 0.1 70);font-size:17px;font-weight:800;box-shadow:0 2px 0 oklch(0.76 0.12 85);pointer-events:none;">⚡ Faster! {{ selfBadge }}</div>'

TIP = (
    '          <div class="sn-tip" aria-hidden="true" style="position:absolute;left:-6px;top:-16px;width:192px;box-sizing:border-box;padding:8px 10px 9px;border-radius:16px;background:#fff;'
    'box-shadow:0 4px 0 oklch(0.78 0.06 130), 0 10px 22px rgba(40,70,40,.22);display:flex;flex-direction:column;gap:5px;pointer-events:none;z-index:6;">\n'
    '            <div style="font-size:13px;font-weight:700;letter-spacing:.3px;color:oklch(0.5 0.06 150);">Collect here</div>\n'
    '            <div style="display:flex;align-items:center;gap:8px;font-size:19px;font-weight:700;color:oklch(0.36 0.08 150);"><div style="{{ s.itemSt }}"></div><div>{{ s.itemName }}</div></div>\n'
    '            <div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;color:oklch(0.48 0.05 150);white-space:nowrap;"><div>10 {{ s.itemName }} →</div><div style="{{ s.treatSt }}"></div><div>{{ s.treatName }}</div></div>\n'
    '          </div>\n'
)

STORY = [
    # Map: hovering a place shows what you collect there and the treat it swaps for.
    ('        <div style="{{ s.wrap }}">', '        <div class="sn-spot" style="{{ s.wrap }}">', 1),
    ('          <button onClick="{{ s.speedy }}"', TIP + '          <button onClick="{{ s.speedy }}"', 1),
    ("out.spots = SPOTS.map((p, i) => ({ name: p.name, topic: p.topic, ",
     "out.spots = SPOTS.map((p, i) => ({ name: p.name, topic: p.topic, itemName: p.many, itemSt: ITEM(p.item, 24), treatName: TREAT_NAME[TREAT_OF[p.key]].toLowerCase(), treatSt: TREAT(TREAT_OF[p.key], 18), ", 1),
    # Progress report: count each solved story per spot.
    ("    this.setState(st => ({ phase: 'done', wrong: 0, earned: st.earned + 1,",
     "    try { SnailyNative.solved(this.state.spot); } catch (e) {}\n    this.setState(st => ({ phase: 'done', wrong: 0, earned: st.earned + 1,", 1),
    ("    this.setState(st => ({ phase: 'done', wrong: 0, firstTry:",
     "    try { SnailyNative.solved(this.state.spot); } catch (e) {}\n    this.setState(st => ({ phase: 'done', wrong: 0, firstTry:", 1),
    # Reduce Motion: no cannon or confetti; Snaily just eats the leaf.
    ("    if (this.state.cannon) { this.celebQ = (this.celebQ || 0) + 1; return; }\n",
     "    if (this.state.cannon) { this.celebQ = (this.celebQ || 0) + 1; return; }\n"
     "    if (SnailyNative.reduced()) { this.eat(); setTimeout(() => { if (this.state.leaves >= FULL) setTimeout(() => this.startPotty(), 300); else this.unlock(); }, 1500); return; }\n", 1),
    ('<a href="Snaily Number Garden.dc.html" style="height:44px;', '<a href="index.html" aria-label="Home" style="height:44px;', 1),
    (">Hungry Snaily Math ›</a>", ">‹ Home</a>", 1),
    # "take away 0" reads oddly: say "take away none".
    ("say: B[c] > 0 ? `How many ${U[c]} are left?` : `${UC[c]}: take away 0. How many ${U[c]} are left?`, hint: `${tops[c]} take away ${B[c]}.`",
     "say: B[c] > 0 ? `How many ${U[c]} are left?` : `${UC[c]}: take away none. How many ${U[c]} are left?`, hint: `${tops[c]} take away ${B[c] || 'none'}.`", 1),
    # Work it out blocks: real base-ten proportions (flat = 10 rods wide).
    ("const [bw, bh, per, gx] = c === 0 ? [28, 28, 5, 4] : c === 1 ? [8, 62, 10, 5] : [13, 13, 10, 3];",
     "const [bw, bh, per, gx] = c === 0 ? [56, 56, 3, 3] : c === 1 ? [6, 56, 10, 4] : [9, 9, 10, 3];", 1),
    ("c === 1 ? `repeating-linear-gradient(180deg,transparent 0 5px,rgba(60,40,0,.16) 5px 6px),${col}` : `repeating-linear-gradient(180deg,transparent 0 5px,rgba(60,40,0,.14) 5px 6px),repeating-linear-gradient(90deg,transparent 0 5px,rgba(60,40,0,.14) 5px 6px),${col}`;",
     "c === 1 ? `repeating-linear-gradient(180deg,transparent 0 4.2px,rgba(60,40,0,.16) 4.2px 5.2px),${col}` : `repeating-linear-gradient(180deg,transparent 0 4.2px,rgba(60,40,0,.14) 4.2px 5.2px),repeating-linear-gradient(90deg,transparent 0 4.2px,rgba(60,40,0,.14) 4.2px 5.2px),${col}`;", 1),
    ("for (let q = 0; q < (col.bq || 0); q++) add(x0 + 88 - (per * (bw + gx) - gx) / 2 + (q % per) * (bw + gx), 206 + Math.floor(q / per)",
     "for (let q = 0; q < (col.bq || 0); q++) add(x0 + 88 - (per * (bw + gx) - gx) / 2 + (q % per) * (bw + gx), 226 + Math.floor(q / per)", 1),
    # Treat swap list: tap a collectable to go to the place where you find it.
    ('        <div style="display:flex;align-items:center;gap:12px;height:33px;padding:0 10px;border-bottom:4px solid oklch(0.78 0.08 65);">',
     '        <div onClick="{{ r.go }}" style="display:flex;align-items:center;gap:12px;height:33px;padding:0 10px;border-bottom:4px solid oklch(0.78 0.08 65);cursor:pointer;" style-hover="background:oklch(0.97 0.04 80);">', 1),
    ("swap: () => this.swapTreat(p.key, i),",
     "swap: e => { if (e && e.stopPropagation) e.stopPropagation(); this.swapTreat(p.key, i); }, go: () => this.enterSpot(i, 'story'),", 1),
    # Each potty trip also gives a collectable (from the place you are at).
    ('      const say2 = "Ahh, all better! You earned a medal!";\n',
     "      const pk = SPOTS[this.state.screen === 'story' && this.state.spot != null ? this.state.spot : Math.floor(Math.random() * SPOTS.length)];\n"
     "      const say2 = `Ahh, all better! You earned a medal and ${/^[aeiou]/.test(pk.one) ? 'an' : 'a'} ${pk.one}!`;\n", 1),
    ("this.setState(s => ({ potty: 'back', pottySay: say2, medals: s.medals + 1, medalPop: Date.now(), happy: s.happy + 1, leaves: 0 }), () => this.save());",
     "this.setState(s => ({ potty: 'back', pottySay: say2, medals: s.medals + 1, medalPop: Date.now(), happy: s.happy + 1, leaves: 0, coll: { ...s.coll, [pk.key]: (s.coll[pk.key] || 0) + 1 } }), () => this.save());", 1),
    # Meal clock: "Next meal in 12:34" instead of "Snaily day 1 / Eat in 12:34".
    ("out.dayTxt = `Snaily day ${S0.day || 1}`;", "out.dayTxt = S0.meal ? 'Snaily is hungry' : 'Next meal in';", 1),
    ("'Eating time!' : `Eat in ${Math.floor(sec / 60)}", "'Eating time!' : `${Math.floor(sec / 60)}", 1),
    # Speedy feed: "I know how!" skips Snaily's explanations (she just says
    # the sum) and uses the short celebration, for children who want speed.
    ("say = t.type === 'guess' ? this.guessSay(sto) : t.say;",
     "say = t.type === 'guess' ? this.guessSay(sto) : prac && S0.quick ? quickSay(t) : t.say;", 1),
    ("const C = (id, say, hint) => ({ type: 'calc', id, say, hint: hint || say });",
     "const C = (id, say, hint) => ({ type: 'calc', id, say, hint: hint || say });\n"
     "// Speedy feed \"I know how!\": just the sum or the bare question, no explanation.\n"
     "const quickSay = t => {\n"
     "  const raw = String(t.say).split(/(?<=[.!:])\\s+|(?<=\\?)\\s+(?=[A-Z])/).map(x => x.trim()).filter(Boolean), cl = raw.map(x => x.replace(/[.:]$/, ''));\n"
     "  const m = cl.filter(x => /[−+×÷=]/.test(x)).pop();\n"
     "  if (m) { const e = m.replace(/^.*?(?=[\\d$?(][^a-z]*[−+×÷=])/i, ''); return /=/.test(e) ? e : e + ' = ?'; }\n"
     "  if (t.ex) return `${t.ex.a} ${t.ex.op} ${t.ex.b} = ?`;\n"
     "  return raw.filter(x => /\\?$/.test(x)).pop() || cl[cl.length - 1] || t.say;\n"
     "};", 1),
    ("      out.selfBtn = () => { this.ac(); sto.guided = false; this.snd('pop'); this.forceUpdate(); };\n",
     "      out.selfBtn = () => { this.ac(); sto.guided = false; this.snd('pop'); this.forceUpdate(); };\n"
     "      out.selfLabel = 'I can do it!';\n"
     "      if (prac && phase === 'solve' && t && t.type !== 'guess' && !S0.quick && !this.locked && !this.busy() && !S0.celeb) { out.showSelfBtn = true; out.selfLabel = 'I know how!'; out.selfBtn = () => { this.ac(); this.snd('pop'); this.setState({ quick: true }); }; }\n", 1),
    ('box-shadow:0 6px 0 oklch(0.85 0.05 130);white-space:nowrap;">I can do it!</button>',
     'box-shadow:0 6px 0 oklch(0.85 0.05 130);white-space:nowrap;">{{ selfLabel }}</button>', 1),
    ("    if (SnailyNative.reduced()) { this.eat(); setTimeout(() => { if (this.state.leaves >= FULL) setTimeout(() => this.startPotty(), 300); else this.unlock(); }, 1500); return; }\n",
     "    if (SnailyNative.reduced() || (this.state.quick && this.state.mode === 'practice')) { this.eat(); setTimeout(() => { if (this.state.leaves >= FULL) setTimeout(() => this.startPotty(), 300); else this.unlock(); }, 1500); return; }\n", 1),
    # Faster celebration: the confetti cannon now fires about 1 s after a
    # right answer (it was about 3 s).
    ("win(x, y) { this.locked = true; this.snd('pop'); setTimeout(() => { this.snd('yay'); this.burst(x, y); this.celebrate(); }, 900); }",
     "win(x, y) { this.locked = true; this.snd('pop'); setTimeout(() => { this.snd('yay'); this.burst(x, y); this.celebrate(); }, 250); }\n"
     "  // Small steps inside \"Work it out\": a quick yay and a leaf, no cannon.\n"
     "  quickWin() { this.locked = true; this.snd('yay'); this.eat(); setTimeout(() => { if (this.state.leaves >= FULL) setTimeout(() => this.startPotty(), 300); else this.unlock(); }, 700); }", 1),
    ("this.pendingNext = () => { this.setState({ typed: '' }); this.workNext(); }; this.win(x, y); }",
     "this.pendingNext = () => { this.setState({ typed: '' }); this.workNext(); }; this.quickWin(); }", 1),
    # Skip counting: Snaily hops the middle jumps by herself.
    ("    this.setState({ work: { ...w, wi } });\n",
     "    this.setState({ work: { ...w, wi } });\n"
     "    if (steps[wi] && steps[wi].auto) setTimeout(() => { const w2 = this.state.work; if (w2 && w2.wi === wi && !this.locked) this.workNext(); else if (w2 && w2.wi === wi) this.pendingNext = () => this.workNext(); }, 450);\n", 1),
    # Doing it yourself earns 3 collectables; watching Snaily earns 1.
    ("    this.setState(st => ({ phase: 'done', wrong: 0, earned: st.earned + 1, coll: { ...st.coll, [key]: (st.coll[key] || 0) + 1 } }), () => this.save());\n    const [x, y] = this.slotCenter(id); this.win(x, y);",
     "    const sto = this.cur(), gain = sto && !sto.guided && !sto.helped ? SELF_GAIN : 1;\n"
     "    this.setState(st => ({ phase: 'done', wrong: 0, lastGain: gain, earned: st.earned + gain, coll: { ...st.coll, [key]: (st.coll[key] || 0) + gain } }), () => this.save());\n    const [x, y] = this.slotCenter(id); this.win(x, y);", 1),
    ("out.doneTxt = `+1 ${sp.one}`;", "out.doneTxt = prac || (S0.lastGain || 1) === 1 ? `+1 ${sp.one}` : `+${S0.lastGain} ${sp.many}! You did it yourself!`;", 1),
    ("out.vdItems = Array.from({ length: S0.earned }", "out.vdItems = Array.from({ length: Math.min(S0.earned, 12) }", 2),
    ("      out.askShow = () => { this.ac(); sto.askMode = false; sto.guided = true;",
     "      out.askShow = () => { this.ac(); sto.askMode = false; sto.guided = true; sto.helped = true;", 1),
    ("  showMe = () => {\n    if (this.locked || this.busy()) return;\n    const s = this.cur(); if (!s) return; this.ac();\n",
     "  showMe = () => {\n    if (this.locked || this.busy()) return;\n    const s = this.cur(); if (!s) return; this.ac(); s.helped = true;\n", 1),
    ("      out.selfLabel = 'I can do it!';\n",
     "      out.selfLabel = 'I can do it!'; out.selfBadge = `+${SELF_GAIN} ${sp.many}`; out.selfHasBadge = !prac;\n", 1),
    ('white-space:nowrap;">{{ selfLabel }}</button>',
     'white-space:nowrap;position:relative;overflow:visible;"><sc-if value="{{ selfHasBadge }}" hint-placeholder-val="{{ false }}">' + BADGE + '</sc-if>{{ selfLabel }}</button>', 1),
    ('font-size:26px;font-weight:700;cursor:pointer;box-shadow:0 5px 0 oklch(0.55 0.12 150);">I\'ll do it!</button>',
     'font-size:26px;font-weight:700;cursor:pointer;box-shadow:0 5px 0 oklch(0.55 0.12 150);position:relative;overflow:visible;">' + BADGE + 'I\'ll do it!</button>', 1),
    ("const C = (id, say, hint) => ({ type: 'calc', id, say, hint: hint || say });",
     "const C = (id, say, hint) => ({ type: 'calc', id, say, hint: hint || say });\nconst SELF_GAIN = 3;", 1),
    # Bug Bakery: buns, muffins and cupcakes no longer look like cookies.
    ("item: 'cookie', words: ['ladybugs ×'", "item: 'muffin', words: ['ladybugs ×'", 1),
    ("item: 'cookie', words: ['bags ×'", "item: 'bun', words: ['bags ×'", 1),
    ("item: 'cookie', words: ['rows ×'", "item: 'cupcake', words: ['rows ×'", 1),
    ("  if (k === 'drop') return",
     "  if (k === 'bun') return { ...b, height: s * 0.78, borderRadius: '50% 50% 38% 38% / 64% 64% 36% 36%', background: 'radial-gradient(ellipse at 38% 28%, oklch(0.93 0.07 85) 0 14%, transparent 34%), radial-gradient(circle at 30% 42%, oklch(0.97 0.02 90) 0 4%, transparent 5%), radial-gradient(circle at 62% 34%, oklch(0.97 0.02 90) 0 4%, transparent 5%), radial-gradient(circle at 48% 56%, oklch(0.97 0.02 90) 0 4%, transparent 5%), linear-gradient(180deg, oklch(0.74 0.13 62) 0 70%, oklch(0.66 0.12 55) 70%)', border: `${Math.max(1, Math.round(s * 0.05))}px solid oklch(0.58 0.11 52)` };\n"
     "  if (k === 'muffin' || k === 'cupcake') return TREAT(k, s);\n"
     "  if (k === 'drop') return", 1),
    # Mouth moves only while Snaily talks or eats: not while pooping, not
    # while she laughs after a treat.
    (": S0.talking ? {", ": S0.talking && S0.potty !== 'sit' ? {", 1),
    ("animation: 'laugh .22s ease-in-out infinite'", "animation: 'none'", 1),
    # Guess and check: Snaily says "Dot has 40 flies", not "40 in the Dot".
    ("model: { type: 'guess', s, d, small: 'blue pot', big: 'red pot' },", "model: { type: 'guess', s, d, small: 'blue pot', big: 'red pot', unit: 'seeds' },", 1),
    ("model: { type: 'guess', s, d, small: sh(N2), big: sh(N1) },", "model: { type: 'guess', s, d, small: sh(N2), big: sh(N1), unit: 'flies' },", 1),
    ("    const m = sto.model, g = this.state.guesses, gp = this.state.gp || 0;\n"
     "    if (gp === 1) { const x = g[g.length - 1]; return `${x} in the ${m.small}. The ${m.big} has ${m.d} more: ${x} + ${m.d} = ?`; }",
     "    const m = sto.model, g = this.state.guesses, gp = this.state.gp || 0;\n"
     "    const nm = n => /pot$/.test(n) ? 'the ' + n : n, cap = t => t[0].toUpperCase() + t.slice(1), u = m.unit || 'things';\n"
     "    if (gp === 1) { const x = g[g.length - 1]; return `${cap(nm(m.small))} has ${x} ${u}. ${cap(nm(m.big))} has ${m.d} more: ${x} + ${m.d} = ?`; }", 1),
    ("`Let's guess and check! I'll guess the ${m.small} first. Tap “Show me”.` : `Guess how many for ${m.small}. Type a number and tap ✓. I'll check it!`",
     "`Let's guess and check! First I'll guess how many ${u} ${nm(m.small)} has. Tap “Show me”.` : `Guess how many ${u} ${nm(m.small)} has. Type a number and tap ✓. I'll check it!`", 1),
    # No leaf bursts (they popped up away from what the child was doing).
    ("  burst(x, y, n = 16, small, cols) {\n", "  burst(x, y, n = 16, small, cols) { return;\n", 1),
    # Snaily talks 10% slower.
    ("u.rate = 0.88; u.volume = 1;", "u.rate = 0.79; u.volume = 1;", 1),
]

GARDEN = [
    # New numbers every time the game opens: keep the saved level, round and
    # medals, but start the round fresh with a new random seed (the prototype
    # reloaded the saved seed, so a child saw the same sums again).
    ("seed = g('snaily-seed2'); ", "", 1),
    ("step = g('snaily-step'); }", "step = 0; }", 1),
    # Reduce Motion: no cannon or confetti; Snaily just eats the leaf.
    ("    if (this.state.cannon) { this.celebQ = (this.celebQ || 0) + 1; return; }\n",
     "    if (this.state.cannon) { this.celebQ = (this.celebQ || 0) + 1; return; }\n"
     "    if (SnailyNative.reduced()) { this.cannonUntil = Date.now() + 1500; this.eat(); setTimeout(() => { if (this.state.leaves >= FULL) setTimeout(() => this.startPotty(), 300); }, 1500); return; }\n", 1),
    ('<a href="Snaily Story World.dc.html" title="Back to Snaily\'s map"', '<a href="index.html" title="Home" aria-label="Home"', 1),
    (">‹ Map</a>", ">‹ Home</a>", 1),
    ('<a href="Snaily Story World.dc.html" style="margin-top:4px', '<a href="story.html" style="margin-top:4px', 1),
    # "take away 0" reads oddly: say "take away none".
    ("push(just ? `Take away ${B[ci]}.` : `${cap(nm)}: take away ${B[ci]}.`);",
     "push(just ? `Take away ${B[ci] || 'none'}.` : `${cap(nm)}: take away ${B[ci] || 'none'}.`);", 1),
    ("hint: `${cur[ci]} take away ${B[ci]}.`", "hint: `${cur[ci]} take away ${B[ci] || 'none'}.`", 1),
    # Each potty trip also gives a collectable for the Story Garden shelf.
    ('      const say2 = "Ahh, all better! You earned a medal!";\n',
     "      const IT = [['pond', 'shell'], ['hill', 'seed'], ['bridge', 'gem'], ['tree', 'acorn'], ['bakery', 'cookie'], ['market', 'coin'], ['shed', 'flower pot'], ['clock', 'star'], ['orchard', 'apple']], pk = IT[Math.floor(Math.random() * IT.length)];\n"
     "      try { const cl = JSON.parse(localStorage.getItem('snaily-sw-coll') || '{}') || {}; cl[pk[0]] = (cl[pk[0]] || 0) + 1; localStorage.setItem('snaily-sw-coll', JSON.stringify(cl)); } catch (e) {}\n"
     "      const say2 = `Ahh, all better! You earned a medal and ${/^[aeiou]/.test(pk[1]) ? 'an' : 'a'} ${pk[1]} for the Story Garden!`;\n", 1),
    # Mouth moves only while Snaily talks or eats, not while pooping.
    ("        : this.state.talking\n", "        : this.state.talking && this.state.potty !== 'sit'\n", 1),
    # Real base-ten proportions: a cube is one unit, a rod is 10 cubes long,
    # a hundreds flat is 10 rods wide (the prototype's flat was only ~4 rods
    # wide). Flats fan out like cards when several share the Hundreds column.
    ("const DIM = { h: [84, 84], t: [20, 84], o: [22, 22] };",
     "const DIM = { h: [140, 140], t: [14, 140], o: [14, 14] };\nlet HN = 1;", 1),
    ("  if (k === 'h') return [x + 14 + (i % 3) * 88, zy + 4 + Math.floor(i / 3) * 90];\n"
     "  if (k === 't') return [x + 22 + i * 21, zy + 4];\n"
     "  return [x + 80 + (i % 5) * 26, zy + 6 + Math.floor(i / 5) * 26];",
     "  if (k === 'h') { const st = HN > 1 ? Math.min(146, (COLW - 30 - 140) / (HN - 1)) : 0, dy = HN > 1 ? Math.min(8, 30 / (HN - 1)) : 0; return [x + 15 + i * st, zy + 4 + i * dy]; }\n"
     "  if (k === 't') return [x + 22 + i * 16, zy + 4];\n"
     "  return [x + 94 + (i % 5) * 19, zy + 6 + Math.floor(i / 5) * 19];", 1),
    ("function layout(prob, bs) {\n  const out = {};\n",
     "function layout(prob, bs) {\n  const out = {};\n  HN = Math.max(1, prob.A[0] + (prob.type === 'add' ? prob.B[0] + (prob.ids.h.C ? 1 : 0) : 0));\n", 1),
    ("else if (p.k === 't') bg = `repeating-linear-gradient(180deg,transparent 0 7px,rgba(60,40,0,.16) 7px 8px),${c}`;",
     "else if (p.k === 't') bg = `repeating-linear-gradient(180deg,transparent 0 12.6px,rgba(60,40,0,.16) 12.6px 13.6px),${c}`;", 1),
    ("else bg = `repeating-linear-gradient(180deg,transparent 0 7px,rgba(60,40,0,.14) 7px 8px),repeating-linear-gradient(90deg,transparent 0 7px,rgba(60,40,0,.14) 7px 8px),${c}`;",
     "else bg = `repeating-linear-gradient(180deg,transparent 0 12.6px,rgba(60,40,0,.14) 12.6px 13.6px),repeating-linear-gradient(90deg,transparent 0 12.6px,rgba(60,40,0,.14) 12.6px 13.6px),${c}`;", 1),
    # "Meet the blocks" intro picture uses the same proportions.
    ('<div style="width:84px;height:84px;box-sizing:border-box;border:2px solid oklch(0.64 0.14 55);border-radius:5px;background:repeating-linear-gradient(180deg,transparent 0 7px,rgba(60,40,0,.14) 7px 8px),repeating-linear-gradient(90deg,transparent 0 7px,rgba(60,40,0,.14) 7px 8px),',
     '<div style="width:140px;height:140px;box-sizing:border-box;border:2px solid oklch(0.64 0.14 55);border-radius:5px;background:repeating-linear-gradient(180deg,transparent 0 12.6px,rgba(60,40,0,.14) 12.6px 13.6px),repeating-linear-gradient(90deg,transparent 0 12.6px,rgba(60,40,0,.14) 12.6px 13.6px),', 1),
    ('<div style="width:20px;height:84px;box-sizing:border-box;border:2px solid oklch(0.56 0.11 240);border-radius:5px;background:repeating-linear-gradient(180deg,transparent 0 7px,rgba(60,40,0,.16) 7px 8px),',
     '<div style="width:14px;height:140px;box-sizing:border-box;border:2px solid oklch(0.56 0.11 240);border-radius:5px;background:repeating-linear-gradient(180deg,transparent 0 12.6px,rgba(60,40,0,.16) 12.6px 13.6px),', 1),
    ('<div style="width:22px;height:22px;box-sizing:border-box;border:2px solid oklch(0.6 0.13 148);border-radius:6px;',
     '<div style="width:14px;height:14px;box-sizing:border-box;border:2px solid oklch(0.6 0.13 148);border-radius:4px;', 1),
    # No leaf bursts (they popped up away from what the child was doing).
    ("  burst(x, y, n = 16, small) {\n", "  burst(x, y, n = 16, small) { return;\n", 1),
    # Snaily talks 10% slower.
    ("u.rate = 0.88; u.volume = 1;", "u.rate = 0.79; u.volume = 1;", 1),
]

# Regex removals: (pattern, expected_count). Removes the voice pickers so
# Snaily always uses her one kid voice.
import re
# The prototype made a new <audio> per sentence, which iPhone/iPad Safari
# (and Chrome before the first tap on each page) refuse to play. The kid voice
# now goes through SnailyNative.speakKid: same voice, one unlocked player.
KID_SPEAK = '''  speakKid(t) {
    if (this.engine === 'device') { this.speakDevice(t); return; }
    const token = {}; this.curU = token; this.speaking = true;
    const live = () => this.curU === token;
    SnailyNative.speakKid(t, {
      live,
      start: () => { if (live()) this.setState({ talking: true }); },
      gap: () => { if (live()) this.setState({ talking: false }); },
      end: () => { if (!live()) return; this.setState({ talking: false }); this.onSpeechEnd(token); },
      blocked: () => { if (!live()) return; this.speaking = false; this.setState({ talking: false }); if (typeof this.schedule === 'function') this.schedule(); },
      fail: rest => { if (live()) this.speakDevice(rest); }
    });
  }
'''
KID_RE = (r'  speakKid\(t\) \{\n.*?(?=  rankVoices\(\) \{)', 1)

MK_SKIP = """function mkSkip(o) {
  // Snaily hops the middle jumps herself, so a child types the first two
  // jumps, watches the pattern, and types the last one (not 10 in a row).
  const hop = (j, n) => n >= 5 && j >= 3 && j < n;
  const HOP = "Hop, hop! I'll do the middle jumps for you.";
  const steps = [];
  if (o.kind === 'mul') {
    let n = o.n, k = o.k;
    // Turn it around: 10 groups of 5 is 5 groups of 10 (fewer jumps).
    const turned = n > k && k >= 2; if (turned) [n, k] = [k, n];
    for (let j = 1; j <= n; j++) steps.push(hop(j, n) ? { kind: 'hop', auto: true, ans: String(j * k), say: HOP } : { kind: 'type', ans: String(j * k), say: j === 1 ? (turned ? `Turn it around! ${o.n} groups of ${o.k} is the same as ${n} groups of ${k}. Count by ${k}s! 1 group of ${k} makes how many?` : `Count by ${k}s! 1 group of ${k} makes how many?`) : `${j - 1} ${j - 1 === 1 ? 'group makes' : 'groups make'} ${(j - 1) * k}. One more group: ${(j - 1) * k} + ${k} = ?`, hint: `${(j - 1) * k} + ${k} = ?` });
    return { steps, per: k, count: n, all: true, eq: turned ? `${o.n} × ${o.k} = ${n} × ${k}` : `${o.n} × ${o.k}`, done: `${o.n} × ${o.k} = ${o.n * o.k}` };
  }
  const q = o.t / o.per;
  for (let j = 1; j <= q; j++) steps.push(hop(j, q) ? { kind: 'hop', auto: true, ans: String(j * o.per), say: HOP } : { kind: 'type', ans: String(j * o.per), say: (j === 1 ? (o.share ? `Share ${o.t} into ${o.per} equal groups. Each round gives 1 to every group, so ${o.per} each round. ` : `Make groups of ${o.per} until we reach ${o.t}. `) : '') + `${(j - 1) * o.per} + ${o.per} = ?`, hint: `${(j - 1) * o.per} + ${o.per} = ?` });
  steps.push({ kind: 'type', count: true, ans: String(q), say: o.share ? `We reached ${o.t}! How many rounds did it take? That's how many each group gets.` : `We reached ${o.t}! How many groups of ${o.per} did we make?`, hint: 'Count the boxes. Each box is one jump.' });
  return { steps, per: o.per, count: q, all: false, eq: o.share ? `${o.t} shared into ${o.per} equal groups` : `${o.t} in groups of ${o.per}`, done: o.share ? `${o.t} ÷ ${o.per} = ${q} each` : `${q} groups of ${o.per}` };
}
"""

STORY_RE = [
    (r'function mkSkip\(o\) \{\n.*?\n\}\n(?=function mkLadder)', 1, MK_SKIP),
    KID_RE,
    (r'      <div style="[^"]*">Snaily\'s voice</div>\n      <select value="\{\{ voiceName \}\}".*?</select>\n', 1),
]
GARDEN_RE = [
    KID_RE,
    (r'      <sc-if value="\{\{ hasVoices \}\}".*?</sc-if>\n', 1),
]


# Snappier cannon (both games): it rolls in faster and fires about 1 s
# sooner; everything after the boom keeps its rhythm.
CELEB_TIMES = {1150: 600, 1450: 750, 2150: 1150, 2050: 1050, 2780: 1780, 3330: 2330, 4500: 3500, 5600: 4600}
CELEB_RE = [
    (r"(\bT2?\()(1150|1450|2150|2050|2780|3330|4500|5600)(, \(\) =>)", lambda m: m.group(1) + str(CELEB_TIMES[int(m.group(2))]) + m.group(3), 8),
    (r"cannonIn \.95s", lambda m: "cannonIn .6s", 1),
    (r"spinIn \.95s", lambda m: "spinIn .6s", 1),
    (r"animation: 'spark \.9s linear forwards", lambda m: "animation: 'spark .45s linear forwards", 1),
    (r"this\.cannonUntil = Date\.now\(\) \+ 5800;", lambda m: "this.cannonUntil = Date.now() + 4800;", -1),
]

FORBIDDEN = ["Snaily Story World.dc.html", "Snaily Number Garden.dc.html", "fonts.googleapis", "unpkg.com"]


def patch(src_name, dst_name, extra, extra_re=()):
    text = (SRC / src_name).read_text(encoding="utf-8")
    for item in extra_re:
        pat, n = item[0], item[1]
        rep = item[2] if len(item) > 2 else (KID_SPEAK if pat == KID_RE[0] else "")
        text, c = re.subn(pat, lambda m: rep, text, flags=re.S)
        if c != n:
            sys.exit(f"[patch] {src_name}: expected {n} match(es) for regex {pat[:60]!r}, found {c}")
    for pat, fn, n in CELEB_RE:
        text, c = re.subn(pat, fn, text)
        if n >= 0 and c != n:
            sys.exit(f"[patch] {src_name}: expected {n} match(es) for regex {pat[:60]!r}, found {c}")
    for old, new, n in COMMON + extra:
        c = text.count(old)
        if c != n:
            sys.exit(f"[patch] {src_name}: expected {n} match(es) for {old[:70]!r}, found {c}")
        text = text.replace(old, new)
    for bad in FORBIDDEN:
        if bad in text:
            line = next(i for i, l in enumerate(text.splitlines(), 1) if bad in l)
            sys.exit(f"[patch] {dst_name}: still contains {bad!r} (line {line})")
    (OUT / dst_name).write_text(text, encoding="utf-8")
    print(f"[patch] wrote www/{dst_name}")


if __name__ == "__main__":
    patch("Snaily Story World.dc.html", "story.html", STORY, STORY_RE)
    patch("Snaily Number Garden.dc.html", "garden.html", GARDEN, GARDEN_RE)
