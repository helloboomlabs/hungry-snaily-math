/* Hungry Snaily Math: native bridge shared by every page.
 *
 * Loaded in <head> BEFORE support.js on the game pages, and on the home page.
 * - Parent settings (sound, voice, haptics, reduce motion, time limit, ...)
 *   and feeding them into the prototype components as prop defaults.
 * - Safe-area aware viewport size for the 1280x720 stage.
 * - Saved progress mirrored into Capacitor Preferences (iOS can purge
 *   WebView storage; Preferences = UserDefaults, which it never purges).
 * - Haptics on correct answers, bites and medals.
 * - Parent gate (hold 2 s + adult question) and the break-time lock.
 * No network access of any kind.
 */
(function () {
  'use strict';

  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var plugin = function (name) {
    if (!isNative) return null;
    try { return Cap.registerPlugin ? Cap.registerPlugin(name) : (Cap.Plugins && Cap.Plugins[name]) || null; } catch (e) { return null; }
  };

  // ---------------------------------------------------------------- settings
  var SETTINGS_KEY = 'snaily-settings';
  var DEFAULTS = {
    sound: true, voice: true, haptics: true, reduceMotion: false,
    speed: 'normal', autoAdvance: true,          // Number Garden
    trickNumbers: true, mealMinutes: 20,         // Story World
    timeLimit: 0                                 // minutes, 0 = off
  };
  function getSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) {}
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = (k in s) ? s[k] : DEFAULTS[k]; });
    return out;
  }
  function setSettings(patch) {
    var s = getSettings();
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
    applyMotion();
    return s;
  }

  // ------------------------------------------------- persistence (mirroring)
  var Prefs = plugin('Preferences');
  var isOurKey = function (k) { return typeof k === 'string' && k.indexOf('snaily') === 0; };
  if (Prefs) {
    var sp = Storage.prototype, origSet = sp.setItem, origRemove = sp.removeItem;
    sp.setItem = function (k, v) {
      origSet.call(this, k, v);
      if (this === window.localStorage && isOurKey(k)) { try { Prefs.set({ key: k, value: String(v) }); } catch (e) {} }
    };
    sp.removeItem = function (k) {
      origRemove.call(this, k);
      if (this === window.localStorage && isOurKey(k)) { try { Prefs.remove({ key: k }); } catch (e) {} }
    };
  }
  // Called by the home page at launch: copies saved progress back into
  // localStorage if iOS cleared the WebView's storage.
  function restore() {
    if (!Prefs) return Promise.resolve(0);
    return Prefs.keys().then(function (r) {
      var keys = (r && r.keys || []).filter(isOurKey);
      return Promise.all(keys.map(function (k) {
        return Prefs.get({ key: k }).then(function (g) {
          if (g && g.value != null && localStorage.getItem(k) == null) {
            Storage.prototype.setItem.call(localStorage, k, g.value);
            return 1;
          }
          return 0;
        });
      }));
    }).then(function (a) { return a.reduce(function (x, y) { return x + y; }, 0); })
      .catch(function () { return 0; });
  }
  function resetProgress() {
    var keep = [SETTINGS_KEY, 'snaily-voice2'];
    var ks = [];
    for (var i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
    ks.forEach(function (k) { if (isOurKey(k) && keep.indexOf(k) < 0) localStorage.removeItem(k); });
  }

  // --------------------------------------------------------- safe-area size
  var probe = null;
  function insets() {
    if (!document.body) return { t: 0, r: 0, b: 0, l: 0 };
    if (!probe) {
      probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
      document.body.appendChild(probe);
    }
    var cs = getComputedStyle(probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }
  function vw() { var i = insets(); return Math.max(320, window.innerWidth - i.l - i.r); }
  function vh() { var i = insets(); return Math.max(240, window.innerHeight - i.t - i.b); }

  // ------------------------------------------------------------------ voice
  function anyVoice() {
    try {
      var vs = speechSynthesis.getVoices();
      return vs.find(function (v) { return /^en[-_]US/i.test(v.lang) && /Samantha|Ava|Allison|Susan|Zoe|Nicky/i.test(v.name); }) ||
             vs.find(function (v) { return /^en[-_]US/i.test(v.lang); }) ||
             vs.find(function (v) { return /^en/i.test(v.lang); }) || null;
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- haptics
  var Haptics = plugin('Haptics');
  function buzz(kind, style) {
    if (!Haptics || !getSettings().haptics) return;
    try {
      if (kind === 'n') Haptics.notification({ type: style });
      else Haptics.impact({ style: style });
    } catch (e) {}
  }
  // Progress report stats (device only). Number Garden: right/wrong per
  // problem type and per check kind (typing a digit vs. dragging a trade).
  // Story World: correct steps / mistakes per garden spot.
  function stats() { try { return JSON.parse(localStorage.getItem('snaily-stats') || '{}') || {}; } catch (e) { return {}; } }
  function track(k, ctx, step) {
    if (k !== 'yay' && k !== 'oops' && k !== 'pop') return;
    var st = stats(), ok = k !== 'oops', rec;
    if (step && step.title) {                       // Number Garden
      if (k === 'pop') return;
      st.ng = st.ng || {};
      rec = st.ng[step.title] = st.ng[step.title] || { r: 0, w: 0, dw: 0 };
      if (ok) rec.r++; else { rec.w++; if (step.cp && step.cp.type === 'drag') rec.dw++; }
    } else if (k === 'oops' && ctx && ctx.state && ctx.state.screen === 'story' && typeof ctx.state.spot === 'number') {
      st.sw = st.sw || {};                          // Story World mistake
      rec = st.sw[ctx.state.spot] = st.sw[ctx.state.spot] || { r: 0, w: 0 };
      rec.w++;
    } else return;
    try { localStorage.setItem('snaily-stats', JSON.stringify(st)); } catch (e) {}
  }
  function solved(spot) {                           // Story World story solved
    var st = stats(); st.sw = st.sw || {};
    var rec = st.sw[spot] = st.sw[spot] || { r: 0, w: 0 }; rec.r++;
    try { localStorage.setItem('snaily-stats', JSON.stringify(st)); } catch (e) {}
  }
  function fx(k, ctx, step) {
    try { track(k, ctx, step); } catch (e) {}
    if (k === 'yay') buzz('n', 'SUCCESS');                         // correct answer
    else if (k === 'medal') { buzz('n', 'SUCCESS'); setTimeout(function () { buzz('i', 'HEAVY'); }, 250); }
    else if (k === 'munch') [0, 300, 600, 900].forEach(function (d) { setTimeout(function () { buzz('i', 'LIGHT'); }, d); }); // each bite
    else if (k === 'boom') buzz('i', 'MEDIUM');
    else if (k === 'pop') buzz('i', 'LIGHT');
  }

  // ---------------------------------------------------------- reduce motion
  function applyMotion() {
    var sysRM = false;
    try { sysRM = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    document.documentElement.classList.toggle('rm', !!(getSettings().reduceMotion || sysRM));
  }
  applyMotion();

  // ------------------------------------- settings -> prototype prop defaults
  var PROP_KEYS = ['sound', 'voice', 'speed', 'autoAdvance', 'trickNumbers', 'mealMinutes'];
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.querySelector('script[data-dc-script][data-props]');
    if (!el) return;
    try {
      var meta = JSON.parse(el.getAttribute('data-props'));
      var s = getSettings();
      PROP_KEYS.forEach(function (k) { if (meta[k]) meta[k]['default'] = s[k]; });
      el.setAttribute('data-props', JSON.stringify(meta));
    } catch (e) { console.warn('[snaily] could not apply settings', e); }
  });

  // ---------------------------------------------------------- tiny UI kit
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'style') e.style.cssText = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  // Hold-to-activate: calls fn after `ms` of continuous press. Shows a ring.
  function holdButton(btn, ms, fn) {
    var t = null, start = 0, raf = 0;
    var ring = btn.querySelector('.sn-ring');
    function prog() {
      var p = Math.min(1, (Date.now() - start) / ms);
      if (ring) ring.style.setProperty('--p', String(p));
      if (p < 1) raf = requestAnimationFrame(prog);
    }
    function down(e) {
      e.preventDefault();
      start = Date.now(); btn.classList.add('sn-holding'); prog();
      t = setTimeout(function () { up(); buzz('i', 'MEDIUM'); fn(); }, ms);
    }
    function up() {
      clearTimeout(t); t = null; cancelAnimationFrame(raf);
      btn.classList.remove('sn-holding');
      if (ring) ring.style.setProperty('--p', '0');
    }
    btn.addEventListener('pointerdown', down);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, up); });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // Parent gate: an adult question answered on an on-screen keypad.
  function parentGate() {
    return new Promise(function (resolve) {
      var a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4), typed = '';
      var out = h('div', { 'class': 'sn-gate-ans', 'aria-live': 'polite', text: '?' });
      var overlay;
      function close(ok) { overlay.remove(); resolve(ok); }
      function press(d) {
        if (d === 'del') typed = typed.slice(0, -1); else if (typed.length < 3) typed += d;
        out.textContent = typed || '?';
        if (typed.length >= String(a * b).length) {
          if (+typed === a * b) setTimeout(function () { close(true); }, 150);
          else { out.classList.add('sn-shake'); setTimeout(function () { out.classList.remove('sn-shake'); typed = ''; out.textContent = '?'; }, 450); }
        }
      }
      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0'].map(function (d) {
        return h('button', { 'class': 'sn-key', 'aria-label': d === 'del' ? 'Delete' : d, onclick: function () { press(d); }, text: d === 'del' ? '⌫' : d });
      });
      overlay = h('div', { 'class': 'sn-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Grown-ups only' }, [
        h('div', { 'class': 'sn-card sn-gate' }, [
          h('div', { 'class': 'sn-gate-title', text: 'Grown-ups only' }),
          h('div', { 'class': 'sn-gate-q', text: 'What is ' + a + ' × ' + b + '?' }),
          out,
          h('div', { 'class': 'sn-keys' }, keys),
          h('button', { 'class': 'sn-btn sn-btn-ghost', onclick: function () { close(false); }, text: 'Cancel' })
        ])
      ]);
      document.body.appendChild(overlay);
    });
  }

  // ----------------------------------------- play time + break-time lock
  var isGame = /(garden|story)\.html$/.test(location.pathname);
  if (isGame) document.documentElement.classList.add('game');
  var TICK = 5;
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function playDays() { try { return JSON.parse(localStorage.getItem('snaily-play-days') || '{}') || {}; } catch (e) { return {}; } }
  function weekSeconds() {
    var days = playDays(), total = 0, now = new Date();
    for (var i = 0; i < 7; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      total += days[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()] || 0;
    }
    return total;
  }
  var breakEl = null;
  function breakUntil() { return +localStorage.getItem('snaily-break-until') || 0; }
  function showBreak() {
    if (breakEl) return;
    try { speechSynthesis.cancel(); } catch (e) {}
    var btn = h('button', { 'class': 'sn-btn sn-btn-ghost sn-hold', 'aria-label': 'Grown-up: hold to unlock' }, [
      h('span', { 'class': 'sn-ring' }), 'Grown-up? Hold to unlock'
    ]);
    breakEl = h('div', { 'class': 'sn-overlay sn-break', role: 'dialog', 'aria-modal': 'true' }, [
      h('div', { 'class': 'sn-card' }, [
        h('div', { 'class': 'sn-zzz', text: 'z z z' }),
        h('div', { 'class': 'sn-break-title', text: 'Snaily is sleepy!' }),
        h('div', { 'class': 'sn-break-sub', text: "Time for a break. Let's play again later." }),
        btn
      ])
    ]);
    holdButton(btn, 2000, function () {
      parentGate().then(function (ok) {
        if (!ok) return;
        localStorage.setItem('snaily-break-until', '0');
        localStorage.setItem('snaily-session-secs', '0');
        hideBreak();
      });
    });
    document.body.appendChild(breakEl);
    setTimeout(function () {
      try {
        if (!getSettings().voice) return;
        var u = new SpeechSynthesisUtterance("I'm so sleepy! Time for a break. Let's play again later.");
        var v = anyVoice(); if (v) u.voice = v; u.pitch = 1.6; u.rate = 0.88; speechSynthesis.speak(u);
      } catch (e) {}
    }, 400);
  }
  function hideBreak() { if (breakEl) { breakEl.remove(); breakEl = null; } }
  function tick() {
    var bu = breakUntil();
    if (bu && Date.now() < bu) { showBreak(); return; }
    if (bu && Date.now() >= bu) { localStorage.setItem('snaily-break-until', '0'); localStorage.setItem('snaily-session-secs', '0'); hideBreak(); }
    if (document.hidden || !isGame) return;
    var days = playDays(), k = today();
    days[k] = (days[k] || 0) + TICK;
    var keys = Object.keys(days).sort(function (x, y) { return new Date(x) - new Date(y); });
    while (keys.length > 21) delete days[keys.shift()];
    localStorage.setItem('snaily-play-days', JSON.stringify(days));
    var sess = (+localStorage.getItem('snaily-session-secs') || 0) + TICK;
    localStorage.setItem('snaily-session-secs', String(sess));
    var lim = +getSettings().timeLimit || 0;
    if (lim > 0 && sess >= lim * 60) {
      localStorage.setItem('snaily-break-until', String(Date.now() + 30 * 60 * 1000));
      showBreak();
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    tick(); setInterval(tick, TICK * 1000);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { try { speechSynthesis.cancel(); } catch (e) {} }
  });

  window.SnailyNative = {
    isNative: isNative,
    getSettings: getSettings, setSettings: setSettings, DEFAULTS: DEFAULTS,
    restore: restore, resetProgress: resetProgress,
    vw: vw, vh: vh, insets: insets,
    anyVoice: anyVoice, fx: fx, buzz: buzz, stats: stats, solved: solved,
    reduced: function () { return document.documentElement.classList.contains('rm'); },
    parentGate: parentGate, holdButton: holdButton, h: h,
    weekSeconds: weekSeconds, breakUntil: breakUntil, showBreak: showBreak
  };
})();
