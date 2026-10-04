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
    ("kidOn() { return !this.state.voiceName || this.state.voiceName === '__kid'; }", "kidOn() { return SnailyNative.kidVoiceOn(); }", 1),
    ("|| vs[0] || null", "|| vs[0] || SnailyNative.anyVoice()", 1),
    ("  stopVoice() { try { speechSynthesis.cancel(); } catch (e) {}", "  stopVoice() { try { speechSynthesis.cancel(); SnailyNative.stopSay(); } catch (e) {}", 1),
    # Haptics + parent settings hook on every sound effect.
    ("  snd(k) {\n", "  snd(k) {\n    try { SnailyNative.fx(k, this, typeof STEPS !== 'undefined' ? STEPS[this.state.step] : null); } catch (e) {}\n", 1),
]

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

STORY_RE = [
    KID_RE,
    (r'      <div style="[^"]*">Snaily\'s voice</div>\n      <select value="\{\{ voiceName \}\}".*?</select>\n', 1),
]
GARDEN_RE = [
    KID_RE,
    (r'      <sc-if value="\{\{ hasVoices \}\}".*?</sc-if>\n', 1),
]

FORBIDDEN = ["Snaily Story World.dc.html", "Snaily Number Garden.dc.html", "fonts.googleapis", "unpkg.com"]


def patch(src_name, dst_name, extra, extra_re=()):
    text = (SRC / src_name).read_text(encoding="utf-8")
    for pat, n in extra_re:
        text, c = re.subn(pat, (lambda m: KID_SPEAK) if pat == KID_RE[0] else "", text, flags=re.S)
        if c != n:
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
