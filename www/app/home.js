/* Home screen: pick a mode, parent gate, parent area (settings, progress,
   time limit, privacy). Plain JS, no network. */
(function () {
  'use strict';
  var N = window.SnailyNative, h = N.h;
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), frame = $('frame');

  // ------------------------------------------------------------- scaling
  function fit() {
    var iw = N.vw(), ih = N.vh();
    var land = iw >= ih ? iw / ih : ih / iw;
    var W = Math.round(Math.min(1600, Math.max(1280, 720 * land)));
    var H = Math.round(Math.min(960, Math.max(720, 1280 / land)));
    var s = Math.min(iw / W, ih / H);
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    frame.style.left = Math.round((W - 1280) / 2) + 'px';
    frame.style.top = Math.round((H - 720) / 2) + 'px';
  }
  fit();
  addEventListener('resize', fit);
  addEventListener('orientationchange', function () { setTimeout(fit, 200); });

  // --------------------------------------------------------- progress data
  var num = function (k) { return +localStorage.getItem(k) || 0; };
  var obj = function (k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  function refreshCards() {
    $('ng-medals').textContent = plural(num('snaily-medals'), 'medal');
    $('sw-medals').textContent = plural(num('snaily-sw-medals'), 'medal');
  }
  N.restore().then(refreshCards);
  refreshCards();

  // ------------------------------------------------------------ Snaily says
  function say(t) { $('say').textContent = t; N.say(t); }
  document.querySelector('.snail').addEventListener('click', function () {
    say("Hi! I'm Snaily, and I'm hungry! Which garden shall we visit?");
  });
  document.querySelectorAll('.mode').forEach(function (a) {
    a.addEventListener('click', function () { N.fx('pop'); N.stopSay(); });
  });

  // ------------------------------------------------------- parent gate
  N.holdButton($('gear'), 2000, function () {
    N.parentGate().then(function (ok) { if (ok) openParent('settings'); });
  });

  // ------------------------------------------------------- parent area
  var panel = $('parent');
  var LEVEL_NAMES = ['Level 1 · Adding & taking away', 'Level 2 · One trade', 'Level 3 · Two trades', 'Level 4 · Mix it up'];
  var SPOTS = [['pond', 'Lily Pond', 'shells'], ['hill', 'Sunflower Hill', 'seeds'], ['bridge', 'Two-Step Bridge', 'gems'],
    ['tree', 'Thinking Tree', 'acorns'], ['bakery', 'Bug Bakery', 'cookies'], ['market', 'Garden Market', 'coins'],
    ['shed', 'Measuring Shed', 'flower pots'], ['clock', 'Clock Tower', 'stars'], ['orchard', 'Fruit Orchard', 'apples']];
  var TREATS = { jelly: 'jelly', cookie: 'cookie', lolly: 'lollipop', cupcake: 'cupcake', icecream: 'ice cream', donut: 'donut', berry: 'strawberry', pie: 'apple pie', muffin: 'muffin' };

  function toggle(key, label, sub) {
    var s = N.getSettings();
    var b = h('button', { 'class': 'toggle', role: 'switch', 'aria-checked': String(!!s[key]), 'aria-label': label });
    b.addEventListener('click', function () {
      var v = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(v));
      var p = {}; p[key] = v; N.setSettings(p);
      if (key === 'haptics' && v) N.buzz('i', 'MEDIUM');
    });
    return row(label, sub, b);
  }
  function seg(key, label, sub, opts) {
    var s = N.getSettings();
    var wrap = h('div', { 'class': 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(function (o) {
      var b = h('button', { role: 'radio', 'aria-checked': String(s[key] === o[0]), text: o[1] });
      b.addEventListener('click', function () {
        wrap.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
        var p = {}; p[key] = o[0]; N.setSettings(p);
      });
      wrap.appendChild(b);
    });
    return row(label, sub, wrap);
  }
  function row(label, sub, ctl) {
    return h('div', { 'class': 'row' }, [
      h('div', { 'class': 'row-l' }, [h('div', { 'class': 'row-t', text: label }), sub ? h('div', { 'class': 'row-s', text: sub }) : null]),
      ctl
    ]);
  }
  function kv(k, v) { return h('div', { 'class': 'kv' }, [h('span', { text: k }), h('b', { text: String(v) })]); }
  function fmtMins(sec) { var m = Math.round(sec / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }

  function settingsTab() {
    return h('div', { 'class': 'p-grid' }, [
      h('div', { 'class': 'p-sec', text: 'Sound & feel' }),
      toggle('sound', 'Sound effects', 'Pops, cheers and the cannon'),
      toggle('voice', "Snaily's voice", 'Snaily reads stories aloud in her kid voice'),
      toggle('haptics', 'Haptics', 'Little buzzes for right answers, bites and medals'),
      toggle('reduceMotion', 'Reduce motion', 'No confetti; calmer movement'),
      h('div', { 'class': 'p-sec', text: 'Number Garden' }),
      levelSeg(),
      seg('speed', 'Narration speed', null, [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]),
      toggle('autoAdvance', 'Auto-advance', 'Steps move on by themselves'),
      h('div', { 'class': 'p-sec', text: 'Story World' }),
      toggle('trickNumbers', 'Trick numbers', 'Extra number chips that are not needed'),
      seg('mealMinutes', 'Meal time', 'How often Snaily asks for a treat ("Next meal in…")', [[10, '10m'], [20, '20m'], [30, '30m']]),
      h('div', { 'class': 'p-sec', text: 'Night time' }),
      seg('bedtime', 'Night comes after', 'Minutes of play. Snaily sleeps and the game is locked for 5 min, then starts again', [[0, 'Off'], [30, '30'], [45, '45'], [60, '60'], [90, '90']]),
      h('div', { 'class': 'row' }, [
        h('div', { 'class': 'row-l' }, [h('div', { 'class': 'row-t', text: 'Reset progress' }), h('div', { 'class': 'row-s', text: 'Clears medals, items, treats and levels' })]),
        resetButton()
      ])
    ]);
  }
  // Number Garden level (the game itself only changes level after medals).
  function levelSeg() {
    var cur = Math.min(4, Math.max(1, num('snaily-level') || 1));
    var wrap = h('div', { 'class': 'seg', role: 'radiogroup', 'aria-label': 'Number Garden level' });
    [1, 2, 3, 4].forEach(function (n) {
      var b = h('button', { role: 'radio', 'aria-checked': String(n === cur), text: String(n) });
      b.addEventListener('click', function () {
        wrap.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
        if (!(num('snaily-seed2') > 0)) localStorage.setItem('snaily-seed2', String(Math.floor(Math.random() * 1e9) + 1));
        localStorage.setItem('snaily-level', String(n));
        localStorage.setItem('snaily-round', '0');
        localStorage.setItem('snaily-step', '0');
      });
      wrap.appendChild(b);
    });
    return row('Level', '1 Adding & taking away · 2 One trade · 3 Two trades · 4 Mix it up', wrap);
  }
  function resetButton() {
    var armed = false, b = h('button', { 'class': 'sn-btn danger', text: 'Reset' });
    b.addEventListener('click', function () {
      if (!armed) { armed = true; b.textContent = 'Tap again to confirm'; setTimeout(function () { armed = false; b.textContent = 'Reset'; }, 4000); return; }
      N.resetProgress(); refreshCards(); b.textContent = 'Done ✓'; armed = false;
    });
    return b;
  }

  function progressTab() {
    var coll = obj('snaily-sw-coll'), pantry = obj('snaily-sw-pantry');
    var lvl = Math.min(4, Math.max(1, num('snaily-level') || 1));
    var items = SPOTS.filter(function (s) { return coll[s[0]]; }).map(function (s) { return h('span', { 'class': 'chip', text: s[1] + ': ' + coll[s[0]] + ' ' + s[2] }); });
    var treats = Object.keys(pantry).filter(function (k) { return pantry[k] > 0; }).map(function (k) { return h('span', { 'class': 'chip', text: pantry[k] + ' × ' + (TREATS[k] || k) }); });
    var bu = N.breakUntil();
    return h('div', null, [
      h('div', { 'class': 'p-grid' }, [
        h('div', { 'class': 'stat' }, [
          h('h3', { text: 'Number Garden' }),
          kv('Medals', num('snaily-medals')),
          kv('Current level', LEVEL_NAMES[lvl - 1]),
          kv('Round in level', num('snaily-round') + 1)
        ]),
        h('div', { 'class': 'stat' }, [
          h('h3', { text: 'Story World' }),
          kv('Medals', num('snaily-sw-medals')),
          kv("Snaily's day", num('snaily-sw-day') || 1),
          h('div', { 'class': 'row-s', text: 'Items collected' }),
          h('div', { 'class': 'chips' }, items.length ? items : [h('span', { 'class': 'chip', text: 'None yet' })]),
          h('div', { 'class': 'row-s', style: 'margin-top:8px', text: 'Treats on the plate' }),
          h('div', { 'class': 'chips' }, treats.length ? treats : [h('span', { 'class': 'chip', text: 'None yet' })])
        ]),
        accuracyCard(),
        storyAccuracyCard(),
        h('div', { 'class': 'stat' }, [
          h('h3', { text: 'Play time' }),
          kv('Last 7 days', fmtMins(N.weekSeconds())),
          kv('Since last night', fmtMins(num('snaily-session-secs'))),
          kv('Night time', bu > Date.now() ? 'Snaily is asleep until ' + new Date(bu).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : N.bedtimeLeft() >= 0 ? 'in ' + fmtMins(N.bedtimeLeft()) : 'off')
        ])
      ]),
      h('div', { 'class': 'p-note', text: 'All progress is stored only on this device. Nothing is sent anywhere.' })
    ]);
  }

  var NG_TYPES = [['Meet the blocks', 'Reading place value'], ['Adding', 'Adding, no trades'], ['Adding with trades', 'Adding with trades'],
    ['Taking away', 'Taking away, no trades'], ['Taking away with trades', 'Taking away with trades'], ['Hop along', 'Number line hops']];
  var pct = function (r, w) { return r + w ? Math.round(100 * r / (r + w)) + '%' : '–'; };
  function accuracyCard() {
    var ng = (N.stats().ng) || {}, rows = [], worst = null;
    NG_TYPES.forEach(function (t) {
      var rec = ng[t[0]]; if (!rec) return;
      rows.push(kv(t[1], pct(rec.r, rec.w) + '  (' + rec.r + ' right, ' + rec.w + ' wrong)'));
      if (rec.w && (!worst || rec.w > worst.w)) worst = { w: rec.w, dw: rec.dw, name: t[1], key: t[0] };
    });
    var tip = 'No mistakes recorded yet.';
    if (worst) {
      tip = 'Most mistakes: ' + worst.name.toLowerCase() + '.';
      if (worst.dw && /with trades/.test(worst.key)) tip += /Adding/.test(worst.key) ? ' Often: forgetting to trade 10 ones for a ten.' : ' Often: forgetting to break a ten before taking away.';
      else if (/trades/.test(worst.key)) tip += ' Often: forgetting the traded 1.';
    }
    return h('div', { 'class': 'stat' }, [h('h3', { text: 'Number Garden accuracy' })]
      .concat(rows.length ? rows : [h('div', { 'class': 'row-s', text: 'Play a round to see accuracy here.' })])
      .concat([h('div', { 'class': 'row-s', style: 'margin-top:8px', text: tip })]));
  }
  function storyAccuracyCard() {
    var sw = (N.stats().sw) || {}, rows = [];
    SPOTS.forEach(function (sp, i) { var rec = sw[i]; if (rec) rows.push(kv(sp[1], rec.r + ' solved · ' + rec.w + ' mistake' + (rec.w === 1 ? '' : 's'))); });
    return h('div', { 'class': 'stat' }, [h('h3', { text: 'Story World: stories solved' })]
      .concat(rows.length ? rows : [h('div', { 'class': 'row-s', text: 'Visit a garden spot to see results here.' })]));
  }

  function aboutTab() {
    var P = function (t) { return h('p', { text: t }); };
    var LI = function (t) { return h('li', { text: t }); };
    return h('div', { 'class': 'prose' }, [
      (!N.isNative && !N.standalone) ? h('div', { 'class': 'stat', style: 'margin-bottom:12px' }, [
        h('h3', { text: 'Put Snaily on the Home Screen' }),
        P('On iPhone or iPad, open this page in Safari, tap the Share button, then tap “Add to Home Screen”. Snaily then opens full screen like an app and keeps working without internet.')
      ]) : null,
      h('h3', { text: 'Privacy policy' }),
      P('Hungry Snaily Math is a math game for young children. We do not collect, store or share any personal information.'),
      h('h3', { text: 'What the app stores' }),
      P('Game progress (levels, medals, items, settings and play time) is saved only on this device. It is never sent to us or to anyone else. You can delete it at any time with Reset progress, or by deleting the app.'),
      h('h3', { text: "What we don't do" }),
      h('ul', null, [
        LI('No accounts, sign-in, names or photos.'),
        LI('No advertising, and no ad or analytics tools.'),
        LI('No location, contacts, camera or microphone access.'),
        LI('No in-app purchases.'),
        LI("Snaily's voice: when the device is online, the sentence Snaily is about to say (only the game's own text, never anything the child types) is sent to Google's text-to-speech service to make her kid voice, so Google receives that text and the device's IP address. Turn Snaily's voice off in Settings to stop this. Offline, the device's built-in voice is used instead."),
        N.isNative ? null : LI('This web version is hosted on GitHub Pages, which may keep standard server logs (such as IP address) when the page loads.')
      ]),
      h('h3', { text: 'Children' }),
      P('The app is designed for children aged 6–8 and follows the Apple Kids Category rules. Because we collect no personal information, there is no data for us to access, change or delete.'),
      h('h3', { text: 'Contact' }),
      P((window.SNAILY_CONFIG || {}).developer + ' · ' + (window.SNAILY_CONFIG || {}).supportEmail),
      h('p', { 'class': 'p-note', text: 'Hungry Snaily Math · version ' + ((window.SNAILY_CONFIG || {}).version || '1.0.0') + ' · Font: Fredoka (SIL Open Font License)' })
    ]);
  }

  function openParent(tab) {
    N.stopSay();
    panel.innerHTML = '';
    var body = h('div', { 'class': 'p-body' });
    var tabs = [['settings', 'Settings', settingsTab], ['progress', 'Progress', progressTab], ['about', 'Privacy', aboutTab]];
    var tabBtns = tabs.map(function (t) {
      var b = h('button', { 'class': 'p-tab', role: 'tab', 'aria-selected': String(t[0] === tab), text: t[1] });
      b.addEventListener('click', function () { show(t); });
      return b;
    });
    function show(t) {
      tabBtns.forEach(function (b, i) { b.setAttribute('aria-selected', String(tabs[i] === t)); });
      body.innerHTML = ''; body.appendChild(t[2]()); body.scrollTop = 0;
    }
    var done = h('button', { 'class': 'sn-btn done', text: 'Done' });
    done.addEventListener('click', function () { panel.hidden = true; refreshCards(); });
    panel.appendChild(h('div', { 'class': 'p-card', role: 'dialog', 'aria-label': 'Parent area' }, [
      h('div', { 'class': 'p-head' }, [h('h2', { text: 'Grown-ups' }), h('div', { 'class': 'p-tabs', role: 'tablist' }, tabBtns), done]),
      body
    ]));
    show(tabs.filter(function (t) { return t[0] === tab; })[0]);
    panel.hidden = false;
  }
  window.__openParent = openParent; // used by the screenshot tool only
})();
