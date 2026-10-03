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
    # Remove the unlicensed online "Kid voice" (Google Translate TTS). On-device voices only.
    ("kidOn() { return !this.state.voiceName || this.state.voiceName === '__kid'; }", "kidOn() { return false; }", 1),
    ("[{ name: '__kid', label: 'Kid voice (online) ★' }].concat(", "[].concat(", 1),
    ("'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=' + encodeURIComponent(q)", "''", 1),
    ("|| vs[0] || null", "|| vs[0] || SnailyNative.anyVoice()", 1),
    # Haptics + parent settings hook on every sound effect.
    ("  snd(k) {\n", "  snd(k) {\n    try { SnailyNative.fx(k, this, typeof STEPS !== 'undefined' ? STEPS[this.state.step] : null); } catch (e) {}\n", 1),
]

STORY = [
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
]

GARDEN = [
    # Reduce Motion: no cannon or confetti; Snaily just eats the leaf.
    ("    if (this.state.cannon) { this.celebQ = (this.celebQ || 0) + 1; return; }\n",
     "    if (this.state.cannon) { this.celebQ = (this.celebQ || 0) + 1; return; }\n"
     "    if (SnailyNative.reduced()) { this.cannonUntil = Date.now() + 1500; this.eat(); setTimeout(() => { if (this.state.leaves >= FULL) setTimeout(() => this.startPotty(), 300); }, 1500); return; }\n", 1),
    ('<a href="Snaily Story World.dc.html" title="Back to Snaily\'s map"', '<a href="index.html" title="Home" aria-label="Home"', 1),
    (">‹ Map</a>", ">‹ Home</a>", 1),
    ('<a href="Snaily Story World.dc.html" style="margin-top:4px', '<a href="story.html" style="margin-top:4px', 1),
]

FORBIDDEN = ["https://", "http://", "Snaily Story World.dc.html", "Snaily Number Garden.dc.html", "translate.google"]


def patch(src_name, dst_name, extra):
    text = (SRC / src_name).read_text(encoding="utf-8")
    for old, new, n in COMMON + extra:
        c = text.count(old)
        if c != n:
            sys.exit(f"[patch] {src_name}: expected {n} match(es) for {old[:70]!r}, found {c}")
        text = text.replace(old, new)
    # The Story World prototype has a few cosmetic http(s) mentions? Fail on any.
    for bad in FORBIDDEN:
        if bad in text:
            line = next(i for i, l in enumerate(text.splitlines(), 1) if bad in l)
            sys.exit(f"[patch] {dst_name}: still contains {bad!r} (line {line})")
    (OUT / dst_name).write_text(text, encoding="utf-8")
    print(f"[patch] wrote www/{dst_name}")


if __name__ == "__main__":
    patch("Snaily Story World.dc.html", "story.html", STORY)
    patch("Snaily Number Garden.dc.html", "garden.html", GARDEN)
