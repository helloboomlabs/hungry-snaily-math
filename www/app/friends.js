/* Friends & gifts (home screen only).
   - A grown-up turns Friends on behind the parent gate. That creates an
     anonymous account for this device (no email, no name) and a child card
     with a made-up nickname and a snail colour.
   - Friends are added in person: one device shows a QR code / 6-letter code,
     the other scans or types it. Both sides pass the parent gate.
   - Gifts are game items from the Story Garden collection (plus one free
     surprise a day). No free text anywhere: thank-yous are 4 stickers.
   Backend: Supabase (see supabase/schema.sql). */
(function () {
  'use strict';
  var N = window.SnailyNative, h = N.h, CFG = window.SNAILY_CONFIG || {};
  if (!CFG.friends || !CFG.cloudUrl || !CFG.cloudKey || !window.fetch) return;
  var U = CFG.cloudUrl, K = CFG.cloudKey, KEY = 'snaily-cloud';

  var ITEMS = {
    pond: ['🐚', 'shell', 'shells'], hill: ['🌻', 'sunflower seed', 'sunflower seeds'], bridge: ['💎', 'gem', 'gems'],
    tree: ['🌰', 'acorn', 'acorns'], bakery: ['🍪', 'cookie', 'cookies'], market: ['🪙', 'coin', 'coins'],
    shed: ['🪴', 'flower pot', 'flower pots'], clock: ['⭐', 'star', 'stars'], orchard: ['🍎', 'apple', 'apples'],
    treat: ['🎁', 'surprise', 'surprises']
  };
  var SPOTS = ['pond', 'hill', 'bridge', 'tree', 'bakery', 'market', 'shed', 'clock', 'orchard'];
  var COLORS = { orange: '#f0915f', pink: '#f29bbd', blue: '#73aee6', green: '#79c487', purple: '#ab93e6', yellow: '#f3cb55' };
  var THANKS = { heart: ['❤️', 'a big heart'], star: ['🌟', 'a gold star'], hug: ['🤗', 'a hug'], yum: ['😋', 'a yum face'] };
  var ADJ = ['Sunny', 'Happy', 'Brave', 'Jolly', 'Speedy', 'Lucky', 'Clever', 'Bouncy', 'Cosy', 'Merry', 'Sparkly', 'Giggly', 'Kind', 'Zippy', 'Snuggly', 'Gentle', 'Starry', 'Mighty'];
  var ANIMALS = ['Snail', 'Bee', 'Frog', 'Duck', 'Bunny', 'Ladybug', 'Turtle', 'Owl', 'Fox', 'Mouse', 'Panda', 'Puppy', 'Kitten', 'Hedgehog', 'Robin', 'Otter', 'Koala', 'Penguin'];
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var an = function (w) { return /^[aeiou]/i.test(w) ? 'an ' + w : 'a ' + w; };

  // ---------------------------------------------------------------- storage
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(s) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {} }
  function me() { var s = load(); return s && s.child; }
  function coll() { try { return JSON.parse(localStorage.getItem('snaily-sw-coll') || '{}') || {}; } catch (e) { return {}; } }
  function addColl(k, d) { var c = coll(); c[k] = Math.max(0, (c[k] || 0) + d); localStorage.setItem('snaily-sw-coll', JSON.stringify(c)); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function freeLeft() { return localStorage.getItem('snaily-gift-free') === today() ? 0 : 1; }
  function got() { try { return JSON.parse(localStorage.getItem('snaily-gifts-got') || '[]'); } catch (e) { return []; } }
  function markGot(id) { var g = got(); g.push(id); localStorage.setItem('snaily-gifts-got', JSON.stringify(g.slice(-200))); }

  // -------------------------------------------------------------------- api
  function fail(msg, status) { var e = new Error(msg); e.status = status; return e; }
  var OFFLINE = "Snaily can't reach her friends right now. Is the internet on?";
  function http(path, opt) {
    return fetch(U + path, opt).then(function (r) {
      return r.text().then(function (t) {
        var b = null; try { b = t ? JSON.parse(t) : null; } catch (e) { b = t; }
        if (!r.ok) throw fail((b && (b.message || b.msg || b.error_description)) || 'Something went wrong (' + r.status + ')', r.status);
        return b;
      });
    }, function () { throw fail(OFFLINE, 0); });
  }
  function authCall(path, body) {
    return http('/auth/v1/' + path, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }
  function keep(r) {
    var s = load() || {};
    s.at = r.access_token; s.rt = r.refresh_token; s.exp = Date.now() + (r.expires_in || 3600) * 1000;
    if (r.user && r.user.id) s.uid = r.user.id;
    save(s); return s;
  }
  var refreshing = null;
  function token(force) {
    var s = load();
    if (!s || !s.rt) return Promise.reject(fail('Friends is not turned on.', 401));
    if (!force && s.exp - Date.now() > 60000) return Promise.resolve(s.at);
    if (!refreshing) {
      refreshing = authCall('token?grant_type=refresh_token', { refresh_token: s.rt }).then(keep)
        .then(function (s2) { refreshing = null; return s2.at; }, function (e) { refreshing = null; throw e; });
    }
    return refreshing;
  }
  function rest(method, path, body, retried) {
    return token(retried).then(function (t) {
      return http('/rest/v1/' + path, {
        method: method, body: body ? JSON.stringify(body) : undefined,
        headers: { apikey: K, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'return=representation' }
      });
    }).catch(function (e) {
      if (e.status === 401 && !retried) return rest(method, path, body, true);
      throw e;
    });
  }
  function rpc(fn, args) {
    var a = { me: (me() || {}).id };
    Object.keys(args || {}).forEach(function (k) { a[k] = args[k]; });
    return rest('POST', 'rpc/' + fn, a);
  }
  function signUp(nickname, color) {
    return authCall('signup', {}).then(keep).then(function (s) {
      return rest('POST', 'children', { family: s.uid, nickname: nickname, color: color });
    }).then(function (rows) {
      var s = load(); s.child = rows[0]; save(s); return s.child;
    }).catch(function (e) { if (!(load() || {}).child) save(null); throw e; });
  }
  function turnOff() {
    return rest('POST', 'rpc/delete_family', {}).then(function () { save(null); localStorage.removeItem('snaily-gifts-got'); });
  }

  // -------------------------------------------------------------- libraries
  function lib(name, src) {
    if (window[name]) return Promise.resolve(window[name]);
    return new Promise(function (res) {
      var s = document.createElement('script'); s.src = src;
      s.onload = function () { res(window[name] || null); }; s.onerror = function () { res(null); };
      document.head.appendChild(s);
    });
  }

  // ------------------------------------------------------------------- art
  function snail(color, size) {
    var c = COLORS[color] || COLORS.orange, s = size || 90;
    var svg = '<svg viewBox="0 0 120 96" width="' + s + '" height="' + Math.round(s * 0.8) + '" aria-hidden="true">' +
      '<rect x="6" y="62" width="104" height="26" rx="13" fill="#f2e6a6"/><rect x="80" y="30" width="30" height="50" rx="15" fill="#f2e6a6"/>' +
      '<line x1="88" y1="32" x2="84" y2="10" stroke="#e5d78e" stroke-width="4" stroke-linecap="round"/><line x1="102" y1="32" x2="106" y2="8" stroke="#e5d78e" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="84" cy="9" r="6" fill="#fff" stroke="#e5d78e" stroke-width="2"/><circle cx="106" cy="7" r="6" fill="#fff" stroke="#e5d78e" stroke-width="2"/>' +
      '<circle cx="85" cy="10" r="3" fill="#333"/><circle cx="107" cy="8" r="3" fill="#333"/>' +
      '<path d="M90 54 q6 5 12 0" stroke="#7a4a2a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<circle cx="44" cy="44" r="34" fill="' + c + '"/><path d="M44 44 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="4" stroke-linecap="round"/></svg>';
    var w = h('span', { 'class': 'fr-snail' }); w.innerHTML = svg; return w;
  }
  function itemTxt(k, n) { var it = ITEMS[k] || ITEMS.treat; return n === 1 ? an(it[1]) : n + ' ' + it[2]; }

  // ------------------------------------------------------------ home button
  var frame = document.getElementById('frame');
  var badge = h('span', { 'class': 'fr-badge', hidden: '' });
  var btn = h('button', { 'class': 'fr-open', 'aria-label': 'Friends and presents' }, [
    h('span', { 'class': 'fr-open-ic', text: '🎁' }), h('span', { text: 'Friends' }), badge
  ]);
  frame.appendChild(btn);
  var panel = h('div', { 'class': 'fr', hidden: '' });
  frame.appendChild(panel);
  var inbox = { gifts: [], thanks: [], sent_today: 0 }, friends = [], timers = [];
  function setBadge() {
    var n = me() ? inbox.gifts.length + inbox.thanks.length : 0;
    badge.textContent = String(n); if (n) badge.removeAttribute('hidden'); else badge.setAttribute('hidden', '');
  }
  function refresh() {
    if (!me()) { setBadge(); return Promise.resolve(); }
    return rpc('inbox').then(function (r) { inbox = r || inbox; setBadge(); }).catch(function (e) {
      if (e.status === 401 || e.status === 403) { /* account gone (deleted elsewhere) */ }
    });
  }
  refresh();
  setInterval(function () { if (!document.hidden && panel.hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });

  btn.addEventListener('click', function () { N.fx('pop'); N.stopSay(); open(); });

  // --------------------------------------------------------------- the panel
  function stopTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; stopCam(); }
  function close() { stopTimers(); panel.setAttribute('hidden', ''); panel.innerHTML = ''; N.stopSay(); refresh(); }
  function sayLine(t) { var el = panel.querySelector('.fr-say'); if (el) el.textContent = t; N.say(t); }
  function screen(title, body, opts) {
    stopTimers();
    opts = opts || {};
    panel.innerHTML = '';
    var head = h('div', { 'class': 'fr-head' }, [
      opts.back ? h('button', { 'class': 'fr-x fr-back', 'aria-label': 'Back', onclick: function () { N.fx('pop'); opts.back(); }, text: '‹' }) : null,
      h('h2', { text: title }),
      h('button', { 'class': 'fr-x', 'aria-label': 'Close', onclick: close, text: '✕' })
    ]);
    panel.appendChild(h('div', { 'class': 'fr-card' + (opts.grown ? ' fr-grown' : '') }, [
      head,
      opts.say ? h('div', { 'class': 'fr-sayrow' }, [snail(me() ? me().color : 'orange', 64), h('div', { 'class': 'fr-say', text: opts.say })]) : null,
      h('div', { 'class': 'fr-body' }, body)
    ]));
    panel.removeAttribute('hidden');
    if (opts.say && opts.speak !== false) N.say(opts.say);
  }
  function busy(el, on) { if (el) { el.disabled = !!on; el.classList.toggle('fr-busy', !!on); } }
  function oops(e) {
    sayLine((e && e.message) || OFFLINE);
  }

  function open() {
    if (pendingCode && me()) { var c = pendingCode; pendingCode = null; gate(function () { typeScreen(c); }); return; }
    if (!me()) return introScreen();
    homeScreen(true);
  }
  function gate(fn) { N.parentGate().then(function (ok) { if (ok) fn(); }); }

  // 1. Friends is off: ask a grown-up.
  function introScreen() {
    screen('Friends', [
      h('div', { 'class': 'fr-hero', text: '🎁 🐌 🎁' }),
      h('button', { 'class': 'sn-btn fr-big', text: 'Grown-ups: turn on Friends', onclick: function () { gate(setupScreen); } })
    ], { say: 'Want to send presents to your friends? Ask a grown-up to turn on Friends!' });
  }

  // 2. Grown-up setup: nickname + colour + consent.
  function setupScreen() {
    var nick = pick(ADJ) + ' ' + pick(ANIMALS) + ' ' + (1 + Math.floor(Math.random() * 99)), color = pick(Object.keys(COLORS));
    var nickEl = h('div', { 'class': 'fr-nick', text: nick });
    var av = h('div', { 'class': 'fr-av' }, [snail(color, 120)]);
    var sw = h('div', { 'class': 'fr-swatches' }, Object.keys(COLORS).map(function (k) {
      var b = h('button', { 'class': 'fr-sw', 'aria-label': k, 'aria-pressed': String(k === color), style: 'background:' + COLORS[k] });
      b.addEventListener('click', function () {
        color = k; sw.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        av.innerHTML = ''; av.appendChild(snail(color, 120));
      });
      return b;
    }));
    var go = h('button', { 'class': 'sn-btn fr-big', text: 'Turn on Friends' });
    var msg = h('div', { 'class': 'fr-msg' });
    go.addEventListener('click', function () {
      busy(go, true); msg.textContent = '';
      signUp(nick, color).then(function () { N.fx('yay'); homeScreen(false, 'Hooray! You are ' + nick + '! Now add a friend.'); })
        .catch(function (e) { busy(go, false); msg.textContent = e.message; });
    });
    screen('Turn on Friends', [
      h('div', { 'class': 'fr-setup' }, [
        h('div', { 'class': 'fr-col' }, [
          av, nickEl,
          h('button', { 'class': 'sn-btn sn-btn-ghost', text: '🔀 Another name', onclick: function () { nick = pick(ADJ) + ' ' + pick(ANIMALS) + ' ' + (1 + Math.floor(Math.random() * 99)); nickEl.textContent = nick; } }),
          sw
        ]),
        h('div', { 'class': 'fr-col fr-info' }, [
          h('p', { text: 'Friends lets your child send game presents (shells, stars, apples…) to friends that you add in person.' }),
          h('ul', null, [
            h('li', { text: 'We create an anonymous account for this device. No name, email, photo or location.' }),
            h('li', { text: 'Your child is shown to friends only by this made-up nickname and snail colour.' }),
            h('li', { text: 'No chat and no typing: presents and 4 thank-you stickers only. Up to 3 presents a day.' }),
            h('li', { text: 'Adding a friend needs a grown-up on both devices. Remove or block friends any time in Grown-ups › Friends, where you can also turn Friends off and delete the account.' })
          ]),
          go, msg
        ])
      ])
    ], { grown: true, back: introScreen });
  }

  // 3. The child's friends home.
  function homeScreen(fetchIt, line) {
    var c = me();
    var list = h('div', { 'class': 'fr-list' }, [h('div', { 'class': 'fr-wait', text: 'Looking for your friends…' })]);
    var presents = h('div', { 'class': 'fr-presents' });
    screen('My friends', [
      h('div', { 'class': 'fr-mine' }, [snail(c.color, 70), h('div', null, [h('div', { 'class': 'fr-small', text: 'I am' }), h('div', { 'class': 'fr-name', text: c.nickname })])]),
      presents, list
    ], { say: line || 'Hi ' + c.nickname + '! Who shall we send a present to?', speak: !!line || !fetchIt });
    function draw() {
      presents.innerHTML = '';
      inbox.gifts.forEach(function (g) {
        presents.appendChild(h('button', { 'class': 'fr-present', onclick: function () { openScreen(g); } }, [
          h('span', { 'class': 'fr-box', text: '🎁' }), h('span', { 'class': 'fr-from', text: 'From ' + g.from.nickname })
        ]));
      });
      list.innerHTML = '';
      friends.forEach(function (f) {
        var full = inbox.sent_today >= 3;
        list.appendChild(h('div', { 'class': 'fr-friend' }, [
          snail(f.color, 72), h('div', { 'class': 'fr-name', text: f.nickname }),
          h('button', { 'class': 'sn-btn', text: full ? '3 sent today' : 'Send a present', onclick: function () { if (!full) sendScreen(f); } })
        ].filter(Boolean)));
        if (full) list.lastChild.querySelector('button').setAttribute('disabled', '');
      });
      list.appendChild(h('button', { 'class': 'fr-friend fr-add', onclick: function () { gate(addScreen); } }, [
        h('span', { 'class': 'fr-plus', text: '+' }), h('div', { 'class': 'fr-name', text: 'Add a friend' }), h('div', { 'class': 'fr-small', text: 'Ask a grown-up' })
      ]));
    }
    draw();
    Promise.all([rpc('list_friends'), rpc('inbox')]).then(function (r) {
      friends = r[0] || []; inbox = r[1] || inbox; setBadge(); draw();
      if (inbox.thanks.length) {
        var t = inbox.thanks[0];
        var more = inbox.thanks.length > 1 ? ' And ' + (inbox.thanks.length - 1) + ' more thank-you' + (inbox.thanks.length > 2 ? 's' : '') + '!' : '';
        sayLine((THANKS[t.thanks] || THANKS.heart)[0] + ' ' + t.from.nickname + ' sent you ' + (THANKS[t.thanks] || THANKS.heart)[1] + ' for the ' + ITEMS[t.item][1] + '!' + more);
        rpc('seen_thanks', { ids: inbox.thanks.map(function (x) { return x.id; }) }).then(function () { inbox.thanks = []; setBadge(); });
      } else if (inbox.gifts.length && fetchIt) {
        sayLine('You have ' + (inbox.gifts.length === 1 ? 'a present' : inbox.gifts.length + ' presents') + '! Tap to open!');
      } else if (!friends.length && fetchIt) {
        sayLine('No friends yet. Ask a grown-up to help you add one!');
      } else if (fetchIt && !line) N.say('Hi ' + c.nickname + '! Who shall we send a present to?');
    }).catch(function (e) {
      list.innerHTML = '';
      if (e.status === 401 || e.status === 403) {
        // the account was deleted (e.g. on another device): start over
        save(null); return introScreen();
      }
      list.appendChild(h('div', { 'class': 'fr-wait', text: e.message }));
    });
  }

  // 4. Open a present.
  function openScreen(g) {
    var box = h('button', { 'class': 'fr-bigbox', 'aria-label': 'Open the present', text: '🎁' });
    var after = h('div', { 'class': 'fr-after', hidden: '' });
    screen('A present!', [h('div', { 'class': 'fr-center' }, [box, after])],
      { say: g.from.nickname + ' sent you a present! Tap it to open!', back: function () { homeScreen(false); } });
    box.addEventListener('click', function () {
      busy(box, true);
      rpc('open_gift', { gift: g.id }).then(function () {
        var k = g.item;
        if (k === 'treat') k = pick(SPOTS);
        if (got().indexOf(g.id) < 0) { addColl(k, 1); markGot(g.id); }
        inbox.gifts = inbox.gifts.filter(function (x) { return x.id !== g.id; }); setBadge();
        N.fx('yay'); N.buzz('n', 'SUCCESS');
        busy(box, false); box.disabled = true; box.classList.add('fr-opened'); box.textContent = ITEMS[k][0];
        after.removeAttribute('hidden');
        after.appendChild(h('div', { 'class': 'fr-small', text: 'Say thank you:' }));
        after.appendChild(h('div', { 'class': 'fr-stickers' }, Object.keys(THANKS).map(function (t) {
          return h('button', { 'class': 'fr-sticker', 'aria-label': THANKS[t][1], text: THANKS[t][0], onclick: function (ev) {
            busy(ev.currentTarget, true);
            rpc('open_gift', { gift: g.id, say_thanks: t }).then(function () {
              N.fx('pop'); homeScreen(false, 'Thank you sent to ' + g.from.nickname + '!');
            }).catch(function (e) { busy(ev.currentTarget, false); oops(e); });
          } });
        })));
        var what = itemTxt(k, 1); sayLine(g.item === 'treat' ? 'A surprise! It was ' + what + '! It is in your Story Garden now. Say thank you!' : 'Wow! ' + what.charAt(0).toUpperCase() + what.slice(1) + '! It is in your Story Garden now. Say thank you!');
      }).catch(function (e) { busy(box, false); oops(e); });
    });
  }

  // 5. Send a present to a friend.
  function sendScreen(f) {
    var c = coll(), have = SPOTS.filter(function (k) { return c[k] > 0; });
    var tiles = have.map(function (k) {
      return h('button', { 'class': 'fr-tile', onclick: function () { confirmSend(f, k); } }, [
        h('span', { 'class': 'fr-tile-ic', text: ITEMS[k][0] }), h('span', { text: ITEMS[k][2] }), h('b', { text: '× ' + c[k] })
      ]);
    });
    if (freeLeft()) tiles.unshift(h('button', { 'class': 'fr-tile fr-free', onclick: function () { confirmSend(f, 'treat'); } }, [
      h('span', { 'class': 'fr-tile-ic', text: '🎁' }), h('span', { text: 'Surprise' }), h('b', { text: 'free today' })
    ]));
    screen('Present for ' + f.nickname, [
      tiles.length ? h('div', { 'class': 'fr-tiles' }, tiles)
        : h('div', { 'class': 'fr-wait', text: 'Your Story Garden is empty. Solve stories in Story World to collect things to give!' })
    ], { say: tiles.length ? 'What shall we give ' + f.nickname + '?' : 'Your Story Garden is empty. Solve stories to collect presents!', back: function () { homeScreen(false); } });
  }
  function confirmSend(f, k) {
    var yes = h('button', { 'class': 'sn-btn fr-big', text: 'Wrap it and send! ✓' });
    screen('Present for ' + f.nickname, [h('div', { 'class': 'fr-center' }, [
      h('div', { 'class': 'fr-pair' }, [h('span', { 'class': 'fr-giant', text: ITEMS[k][0] }), h('span', { 'class': 'fr-arrow', text: '➜' }), snail(f.color, 130)]),
      yes
    ])], { say: k === 'treat' ? 'Send a surprise to ' + f.nickname + '?' : 'Give ' + itemTxt(k, 1) + ' to ' + f.nickname + '? It will leave your Story Garden.', back: function () { sendScreen(f); } });
    yes.addEventListener('click', function () {
      busy(yes, true);
      if (k !== 'treat' && !(coll()[k] > 0)) return sendScreen(f);
      rpc('send_gift', { friend: f.id, gift: k }).then(function (r) {
        if (k === 'treat') localStorage.setItem('snaily-gift-free', today()); else addColl(k, -1);
        inbox.sent_today = 3 - ((r && r.left_today) || 0);
        N.fx('yay'); N.buzz('n', 'SUCCESS');
        homeScreen(false, 'Wrapped and sent! ' + f.nickname + ' will love it!');
      }).catch(function (e) { busy(yes, false); oops(e); });
    });
  }

  // 6. Add a friend (grown-up): show my code or scan theirs.
  function addScreen() {
    screen('Add a friend', [h('div', { 'class': 'fr-two' }, [
      h('button', { 'class': 'fr-choice', onclick: showScreen }, [h('span', { 'class': 'fr-giant', text: '📱' }), h('b', { text: 'Show my code' }), h('span', { 'class': 'fr-small', text: 'Your friend scans it' })]),
      h('button', { 'class': 'fr-choice', onclick: scanScreen }, [h('span', { 'class': 'fr-giant', text: '📷' }), h('b', { text: "Scan a friend's code" }), h('span', { 'class': 'fr-small', text: 'Point the camera at their code' })])
    ]), h('button', { 'class': 'sn-btn sn-btn-ghost fr-type', text: 'Type a code instead', onclick: function () { typeScreen(''); } })],
    { say: 'Be together with your friend. One of you shows a code, the other one scans it.', back: function () { homeScreen(false); }, grown: true });
  }
  function showScreen() {
    var qrBox = h('div', { 'class': 'fr-qr' }, [h('div', { 'class': 'fr-wait', text: 'Making your code…' })]);
    var codeEl = h('div', { 'class': 'fr-code' });
    var note = h('div', { 'class': 'fr-small', text: 'The code works once, for 10 minutes.' });
    screen('My friend code', [h('div', { 'class': 'fr-showcode' }, [qrBox, h('div', { 'class': 'fr-col' }, [codeEl, note])])],
      { say: 'Ask your friend to scan this code!', back: addScreen, grown: true });
    function make() {
      rpc('make_invite').then(function (r) {
        codeEl.textContent = r.code.slice(0, 3) + ' ' + r.code.slice(3);
        lib('qrcode', 'vendor/qrcode.js').then(function (qrcode) {
          qrBox.innerHTML = '';
          if (!qrcode) { qrBox.appendChild(h('div', { 'class': 'fr-wait', text: 'Type this code on your friend’s device.' })); return; }
          var qr = qrcode(0, 'M'); qr.addData(CFG.webUrl ? CFG.webUrl + '#friend=' + r.code : 'SNAILY:' + r.code); qr.make();
          qrBox.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
        });
        var poll = setInterval(function () {
          rpc('invite_status', { invite: r.code }).then(function (st) {
            if (st.state === 'used') { clearInterval(poll); madeScreen(st.friend); }
            else if (st.state !== 'waiting') { clearInterval(poll); make(); }
          }).catch(function () {});
        }, 2500);
        timers.push(poll);
      }).catch(function (e) { qrBox.innerHTML = ''; qrBox.appendChild(h('div', { 'class': 'fr-wait', text: e.message })); });
    }
    make();
  }
  function parseCode(t) {
    var m = String(t || '').toUpperCase().match(/(?:FRIEND=|SNAILY:)?([A-HJ-NP-Z2-9]{6})\s*$/);
    return m ? m[1] : null;
  }
  var cam = null;
  function stopCam() { if (cam) { try { cam.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} cam = null; } }
  function scanScreen() {
    var video = h('video', { 'class': 'fr-video', playsinline: '', muted: '', autoplay: '' });
    var msg = h('div', { 'class': 'fr-small', text: 'Point the camera at your friend’s code.' });
    screen("Scan a friend's code", [h('div', { 'class': 'fr-center' }, [h('div', { 'class': 'fr-cam' }, [video, h('div', { 'class': 'fr-aim' })]), msg,
      h('button', { 'class': 'sn-btn sn-btn-ghost', text: 'Type the code instead', onclick: function () { typeScreen(''); } })])],
      { say: 'Point the camera at your friend’s code!', back: addScreen, grown: true });
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { msg.textContent = 'This device can’t use the camera here. Type the code instead.'; return; }
    var detector = null, jsQR = null, canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true }), done = false;
    var ready = ('BarcodeDetector' in window ? window.BarcodeDetector.getSupportedFormats().then(function (f) {
      if (f.indexOf('qr_code') >= 0) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    }).catch(function () {}) : Promise.resolve()).then(function () {
      if (!detector) return lib('jsQR', 'vendor/jsQR.js').then(function (f) { jsQR = f; });
    });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
      if (panel.hidden || !document.body.contains(video)) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      cam = stream; video.srcObject = stream; video.muted = true; video.play().catch(function () {});
      return ready.then(function () {
        if (!detector && !jsQR) { msg.textContent = 'Scanning isn’t available. Type the code instead.'; return; }
        var t = setInterval(function () {
          if (done || video.readyState < 2) return;
          var found = function (txt) {
            var code = parseCode(txt); if (!code || done) return;
            done = true; clearInterval(t); stopCam(); N.fx('pop'); redeem(code, msg);
          };
          if (detector) detector.detect(video).then(function (r) { if (r && r[0]) found(r[0].rawValue); }).catch(function () {});
          else {
            var w = 480, hh = Math.round(480 * video.videoHeight / (video.videoWidth || 1)) || 360;
            canvas.width = w; canvas.height = hh; ctx.drawImage(video, 0, 0, w, hh);
            var res = jsQR(ctx.getImageData(0, 0, w, hh).data, w, hh, { inversionAttempts: 'dontInvert' });
            if (res && res.data) found(res.data);
          }
        }, 250);
        timers.push(t);
      });
    }).catch(function () { msg.textContent = 'The camera is off for Snaily. Type the code instead.'; });
  }
  function typeScreen(pre) {
    var inp = h('input', { 'class': 'fr-input', maxlength: '7', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'ABC 123', 'aria-label': 'Friend code' });
    inp.value = pre || '';
    var msg = h('div', { 'class': 'fr-msg' });
    var go = h('button', { 'class': 'sn-btn fr-big', text: 'Add friend' });
    go.addEventListener('click', function () {
      var code = parseCode(inp.value.replace(/\s+/g, ''));
      if (!code) { msg.textContent = 'A friend code has 6 letters and numbers.'; return; }
      redeem(code, msg, go);
    });
    screen('Type a friend code', [h('div', { 'class': 'fr-center' }, [inp, go, msg])], { back: addScreen, grown: true });
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
  }
  function redeem(code, msg, b) {
    busy(b, true); if (msg) msg.textContent = 'Adding your friend…';
    rpc('redeem_invite', { invite: code }).then(madeScreen).catch(function (e) { busy(b, false); if (msg) msg.textContent = e.message; });
  }
  function madeScreen(f) {
    N.fx('yay'); N.buzz('n', 'SUCCESS');
    screen('New friend!', [h('div', { 'class': 'fr-center' }, [
      h('div', { 'class': 'fr-pair' }, [snail(me().color, 130), h('span', { 'class': 'fr-giant', text: '🤝' }), snail(f.color, 130)]),
      h('div', { 'class': 'fr-name', text: f.nickname }),
      h('button', { 'class': 'sn-btn fr-big', text: 'Yay!', onclick: function () { homeScreen(true); } })
    ])], { say: 'You and ' + f.nickname + ' are friends now!' });
  }

  // ---------------------------------------------- Grown-ups › Friends tab
  function parentTab() {
    var c = me(), P = function (t) { return h('p', { text: t }); };
    if (!c) {
      return h('div', { 'class': 'prose' }, [
        h('h3', { text: 'Friends is off' }),
        P('Friends lets your child send game presents to friends you add in person. To turn it on, tap the Friends button on the home screen.'),
        P('No email, name, photo or location is collected. See Privacy for details.')
      ]);
    }
    var list = h('div', null, [h('div', { 'class': 'row-s', text: 'Loading…' })]);
    function rowFor(f) {
      var rm = h('button', { 'class': 'sn-btn sn-btn-ghost', text: 'Remove' });
      var bl = h('button', { 'class': 'sn-btn danger', text: 'Block' });
      function act(block) {
        busy(rm, true); busy(bl, true);
        rpc('remove_friend', { friend: f.id, block: block }).then(draw).catch(function (e) { busy(rm, false); busy(bl, false); alertRow.textContent = e.message; });
      }
      rm.addEventListener('click', function () { act(false); });
      bl.addEventListener('click', function () { act(true); });
      return h('div', { 'class': 'row' }, [snail(f.color, 56), h('div', { 'class': 'row-l' }, [
        h('div', { 'class': 'row-t', text: f.nickname }),
        h('div', { 'class': 'row-s', text: 'Friends since ' + new Date(f.since).toLocaleDateString() })
      ]), rm, bl]);
    }
    var alertRow = h('div', { 'class': 'row-s' });
    function draw() {
      return rpc('list_friends').then(function (fs) {
        friends = fs || []; list.innerHTML = '';
        if (!friends.length) list.appendChild(h('div', { 'class': 'row-s', text: 'No friends yet.' }));
        friends.forEach(function (f) { list.appendChild(rowFor(f)); });
      }).catch(function (e) { list.innerHTML = ''; list.appendChild(h('div', { 'class': 'row-s', text: e.message })); });
    }
    draw();
    var armed = false, off = h('button', { 'class': 'sn-btn danger', text: 'Turn off Friends' });
    off.addEventListener('click', function () {
      if (!armed) { armed = true; off.textContent = 'Tap again to delete'; setTimeout(function () { armed = false; off.textContent = 'Turn off Friends'; }, 4000); return; }
      busy(off, true);
      turnOff().then(function () { inbox = { gifts: [], thanks: [], sent_today: 0 }; friends = []; setBadge(); off.textContent = 'Deleted ✓'; })
        .catch(function (e) { busy(off, false); alertRow.textContent = e.message; });
    });
    return h('div', null, [
      h('div', { 'class': 'p-grid' }, [
        h('div', { 'class': 'stat' }, [h('h3', { text: 'Your child' }), h('div', { 'class': 'row' }, [snail(c.color, 56), h('div', { 'class': 'row-l' }, [h('div', { 'class': 'row-t', text: c.nickname }), h('div', { 'class': 'row-s', text: 'Made-up nickname shown to friends' })])])]),
        h('div', { 'class': 'stat' }, [h('h3', { text: 'Turn off Friends' }),
          h('div', { 'class': 'row' }, [h('div', { 'class': 'row-l' }, [h('div', { 'class': 'row-s', text: 'Deletes this device’s Friends account, friend list and presents from our server. Game progress on this device is kept.' })]), off])])
      ]),
      h('div', { 'class': 'p-sec', style: 'margin-top:18px', text: 'Friends' }),
      list, alertRow,
      h('div', { 'class': 'p-note', text: 'Remove: they leave the list (you can add them again later). Block: they can’t add your child again.' })
    ]);
  }

  // A scanned web link (…#friend=ABC123) opens the add-friend flow.
  var pendingCode = null;
  (function () {
    var m = /friend=([A-Za-z0-9]{6})/.exec(location.hash || '');
    if (!m) return;
    pendingCode = m[1].toUpperCase();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    setTimeout(function () { if (me()) open(); else { introScreen(); sayLine('To add this friend, ask a grown-up to turn on Friends first!'); pendingCode = null; } }, 600);
  })();

  window.SnailyFriends = { parentTab: parentTab, on: function () { return !!me(); }, refresh: refresh, _rpc: rpc };
})();
