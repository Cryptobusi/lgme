(function () {
  var EPOCH = '2';
  var CURRENT = { 'lgme-v265': 1, 'lgme-gym-v81': 1 };
  function keep(name) {
    if (!name) return true;
    if (name === 'lgme.reset.epoch' || name === 'lgme.reset.note' || name === 'lgme.device.key' || name === 'lgme.display.step' || name === 'lgme.display.easy' || name === 'lgme.text.tip' || name === 'lgme.ui.mode' || name === 'lgme.ui.uses' || name === 'lgme.ui.offer' || name === 'lgme.ui.shortcuts' || name === 'lgme.learn.path' || name === 'lgme-gym.seat' || name === 'lgme.health.book' || name === 'lgme.health.email' || name === 'lgme.health.plan' || name === 'lgme.health.contact' || name === 'lgme.health.contactGrants' || name === 'lgme.health.consent' || name === 'lgme.demo.member') return true;
    return name.indexOf('lgme-sim:peer:') === 0 || name.indexOf('lgme.health.page:') === 0;
  }
  function arm() {
    try {
      var names = [];
      for (var i = 0; i < localStorage.length; i += 1) names.push(localStorage.key(i));
      names.forEach(function (name) { if (!keep(name)) localStorage.removeItem(name); });
      sessionStorage.clear();
      localStorage.setItem('lgme.reset.epoch', EPOCH);
      localStorage.setItem('lgme.reset.note', '1');
    } catch (error) { /* a private window still loads */ }
    var jobs = [];
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
      }).catch(function () {}));
    }
    if (window.caches && caches.keys) {
      jobs.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      }).catch(function () {}));
    }
    var keepDb = { 'lgme-health-page': 1, 'lgme-tile-photo': 1, 'lgme-sim-vault': 1, 'lgme-device-profile': 1 };
    if (window.indexedDB && indexedDB.databases) {
      jobs.push(indexedDB.databases().then(function (rows) {
        return Promise.all((rows || []).map(function (row) {
          if (!row || !row.name || keepDb[row.name]) return Promise.resolve();
          return new Promise(function (resolve) {
            var req = indexedDB.deleteDatabase(row.name);
            req.onsuccess = req.onerror = req.onblocked = function () { resolve(); };
          });
        }));
      }).catch(function () {}));
    }
    Promise.all(jobs).then(function () { location.reload(); });
  }
  var epoch = '';
  try { epoch = localStorage.getItem('lgme.reset.epoch') || ''; } catch (error) { epoch = EPOCH; }
  if (epoch && epoch !== EPOCH) { arm(); return; }
  if (!epoch) {
    try { localStorage.setItem('lgme.reset.epoch', EPOCH); } catch (error) { /* private mode */ }
    var controlled = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    if (controlled) { arm(); return; }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        if ((keys || []).some(function (key) { return !CURRENT[key]; })) arm();
      }).catch(function () {});
    }
  }
  var bar = document.getElementById('site-nav');
  if (!bar) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/site-nav.css';
    document.head.appendChild(link);
    bar = document.createElement('nav');
    bar.id = 'site-nav';
    bar.setAttribute('aria-label', 'Site');
    var back = document.createElement('button');
    back.type = 'button';
    back.id = 'site-back';
    back.setAttribute('aria-label', 'Back');
    back.textContent = '‹';
    var home = document.createElement('a');
    home.id = 'site-home';
    home.href = '/?home=1';
    home.setAttribute('aria-label', 'Home');
    home.textContent = '⌂';
    var next = document.createElement('button');
    next.type = 'button';
    next.id = 'site-next';
    next.setAttribute('aria-label', 'Next');
    next.textContent = '›';
    next.hidden = true;
    var mark = document.createElement('span');
    mark.id = 'ai-head';
    mark.textContent = 'AI off';
    bar.appendChild(back);
    bar.appendChild(home);
    bar.appendChild(next);
    bar.appendChild(mark);
    document.body.prepend(bar);
  }
  function fitButton(id, text, label, detail) {
    var button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('lgme-display', { detail: detail }));
    });
    return button;
  }
  if (!bar.querySelector('#font-chip')) {
    var chip = document.createElement('span');
    chip.id = 'font-chip';
    chip.setAttribute('role', 'group');
    chip.setAttribute('aria-label', 'Text');
    var name = document.createElement('span');
    name.className = 'text-name';
    name.textContent = 'Text';
    var down = fitButton('font-down', 'A−', 'Make text smaller', { step: -1 });
    var reset = fitButton('font-reset', '100%', 'Reset text size', { reset: true });
    var up = fitButton('font-up', 'A+', 'Make text bigger', { step: 1 });
    var tip = document.createElement('span');
    tip.id = 'text-tip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = 'Make text smaller / reset / bigger; saved on this phone';
    var seenTip = false;
    try {
      seenTip = localStorage.getItem('lgme.text.tip') === '1' || localStorage.getItem('lgme.display.step') !== null;
    } catch (error) { seenTip = false; }
    tip.hidden = seenTip;
    var percents = ['85%', '100%', '115%', '130%', '150%'];
    var paintText = function (step) {
      var index = 1;
      if (Number.isInteger(step)) index = step;
      else {
        try {
          var saved = Number(localStorage.getItem('lgme.display.step'));
          if (Number.isInteger(saved)) index = saved;
        } catch (error) { index = 1; }
      }
      if (index < 0 || index > 4) index = 1;
      reset.textContent = percents[index];
      down.disabled = index <= 0;
      up.disabled = index >= 4;
      down.setAttribute('aria-disabled', down.disabled ? 'true' : 'false');
      up.setAttribute('aria-disabled', up.disabled ? 'true' : 'false');
    };
    var hideTip = function () {
      tip.hidden = true;
      try { localStorage.setItem('lgme.text.tip', '1'); } catch (error) { /* the tip still closes */ }
    };
    [down, reset, up].forEach(function (button) { button.addEventListener('click', hideTip); });
    if (!tip.hidden) {
      window.setTimeout(hideTip, 2200);
      document.addEventListener('pointerdown', function (event) {
        if (event.target && chip.contains(event.target)) return;
        hideTip();
      });
    }
    chip.appendChild(name);
    chip.appendChild(down);
    chip.appendChild(reset);
    chip.appendChild(up);
    chip.appendChild(tip);
    var easy = document.createElement('button');
    easy.type = 'button';
    easy.id = 'easy-read';
    easy.setAttribute('aria-label', 'Easy read');
    easy.setAttribute('aria-pressed', 'false');
    easy.setAttribute('data-explain', 'Easy read makes type larger and the contrast stronger. Tap again to turn it off.');
    easy.textContent = 'Easy';
    var slot = bar.querySelector('#ai-head');
    if (slot) {
      bar.insertBefore(chip, slot);
      bar.insertBefore(easy, slot);
    } else {
      bar.appendChild(chip);
      bar.appendChild(easy);
    }
    paintText();
    var placeText = function () {
      var settings = document.getElementById('text-settings');
      chip.hidden = !!(settings && settings.getClientRects().length);
    };
    document.addEventListener('lgme-display-state', function (event) {
      var on = !!(event.detail && event.detail.easy);
      easy.setAttribute('aria-pressed', on ? 'true' : 'false');
      easy.textContent = on ? 'Standard' : 'Easy';
      paintText(event.detail && event.detail.step);
      placeText();
    });
    window.addEventListener('lgme-view', placeText);
    window.addEventListener('hashchange', placeText);
  }
  document.documentElement.classList.add('has-site-nav');
  document.body.classList.add('has-site-nav');
  if (!document.getElementById('hand-bar')) {
    document.documentElement.classList.add('has-hand');
    var hand = document.createElement('nav');
    hand.id = 'hand-bar';
    hand.setAttribute('aria-label', 'Phone');
    var recentSheet = document.createElement('div');
    recentSheet.id = 'hand-recent-sheet';
    recentSheet.hidden = true;
    var routes = [
      { href: '/', name: 'Home' },
      { href: '/gym', name: 'Health' },
      { href: '/gym#/ididit', name: 'IdidIt' },
      { href: '/gym#/train', name: 'Train' },
      { href: '/gym#/people', name: 'People' },
      { href: '/gym#/groups', name: 'Groups' },
      { href: '/gym#/more', name: 'Settings' },
      { href: '/exchange', name: 'Exchange' },
      { href: '/help', name: 'Help' },
      { href: '/inventory', name: 'Inventory' },
      { href: '/books', name: 'SobeIt' },
      { href: '/introduction', name: 'Introduction' }
    ];
    var pathNow = function () {
      var path = String(location.pathname || '/').replace(/\.html$/, '') || '/';
      if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
      return path;
    };
    var hereIndex = function () {
      var full = pathNow() + (location.hash || '');
      var path = pathNow();
      var exact = -1;
      var loose = -1;
      for (var i = 0; i < routes.length; i += 1) {
        if (routes[i].href === full) exact = i;
        if (routes[i].href === path) loose = i;
      }
      if (exact >= 0) return exact;
      if (!location.hash || location.hash === '#' || location.hash === '#/') return loose;
      return -1;
    };
    var pageLabel = function () {
      var full = pathNow() + (location.hash || '');
      var path = pathNow();
      for (var i = 0; i < routes.length; i += 1) {
        if (routes[i].href === full) return routes[i].name;
      }
      if (!location.hash || location.hash === '#' || location.hash === '#/') {
        for (var j = 0; j < routes.length; j += 1) {
          if (routes[j].href === path) return routes[j].name;
        }
      }
      var heading = document.querySelector('#gym-panel h2, main h1, h1');
      if (heading && !(heading.closest && heading.closest('#ai-dock, #hand-bar'))) {
        var text = String(heading.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && text.length <= 42 && !/printed the money|prove what you did/i.test(text)) return text;
      }
      var title = String(document.title || '').replace(/\s*·\s*lgme.*/i, '').replace(/^lgme\s*/i, '').trim();
      return title || 'This page';
    };
    var remember = function () {
      var href = pathNow() + (location.hash || '');
      var name = pageLabel();
      var list = [];
      try { list = JSON.parse(sessionStorage.getItem('lgme.hand.recent') || '[]'); } catch (error) { list = []; }
      if (!Array.isArray(list)) list = [];
      list = list.filter(function (item) { return item && item.href !== href; });
      list.unshift({ href: href, name: name });
      try { sessionStorage.setItem('lgme.hand.recent', JSON.stringify(list.slice(0, 6))); } catch (error) { /* the row still shows this page */ }
      return list.slice(0, 6);
    };
    var paintRecent = function () {
      var list = remember();
      recentSheet.replaceChildren();
      list.forEach(function (item) {
        var link = document.createElement('a');
        link.href = item.href;
        link.textContent = item.name;
        recentSheet.appendChild(link);
      });
    };
    var go = function (delta) {
      var index = hereIndex();
      if (index < 0) {
        if (delta < 0 && history.length > 1) history.back();
        else location.assign(delta < 0 ? '/' : '/gym');
        return;
      }
      var next = Math.max(0, Math.min(routes.length - 1, index + delta));
      if (next === index) return;
      location.assign(routes[next].href);
    };
    var handButton = function (id, name, shortExplain, explain) {
      var button = document.createElement('button');
      button.type = 'button';
      button.id = id;
      var full = explain || shortExplain;
      button.setAttribute('aria-label', full);
      button.setAttribute('data-explain', full);
      var title = document.createElement('b');
      title.textContent = name;
      var note = document.createElement('small');
      note.textContent = shortExplain;
      button.appendChild(title);
      button.appendChild(note);
      return button;
    };
    var prev = handButton('hand-prev', 'Previous', 'Page before', 'Previous page. Nothing is sent.');
    var recent = handButton('hand-recent', 'Bigger', 'Full helper', 'Opens the helper to the full screen. The prompt stays above this bar.');
    var home = handButton('hand-home', 'Home', 'Start here', 'Goes home.');
    var back = handButton('hand-back', 'Back', 'Last page', 'Goes back to the previous page.');
    var next = handButton('hand-next', 'Next', 'Page after', 'Next page. Nothing is sent.');
    var markIcon = function (button, icon) {
      var glyph = document.createElement('i');
      glyph.className = 'hand-icon';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = icon;
      button.insertBefore(glyph, button.firstChild);
    };
    markIcon(prev, '‹');
    markIcon(recent, '⤢');
    markIcon(home, '⌂');
    markIcon(back, '↩');
    markIcon(next, '›');
    var pagePurpose = function () {
      var full = pathNow() + (location.hash || '');
      var path = pathNow();
      var lines = [
        ['/', '', 'Home shows Health and the things on this phone.'],
        ['/gym', '/ididit', 'IdidIt records what you did. It stays here until you tap OK.'],
        ['/gym', '/train', 'Train is a workout on this phone. Nothing is posted until you confirm.'],
        ['/gym', '/people', 'People are the members on this phone. You choose who can see a receipt.'],
        ['/gym', '/groups', 'Groups are the clubs on this phone. A message stays here until you send it.'],
        ['/gym', '/more', 'Health settings stay on this phone.'],
        ['/gym', '', 'Health is the open club. A workout stays on this phone until you confirm.'],
        ['/exchange', '', 'Exchange is for listings and receipts. Nothing is paid until you tap OK.'],
        ['/help', '', 'Help explains the words. Nothing is sent by reading.'],
        ['/inventory', '', 'Inventory is the list on this phone. Nothing is published until you tap OK.'],
        ['/books', '', 'SobeIt is the book list on this phone. Reading does not send anything.'],
        ['/introduction', '', 'Introduction is the short start. It does not sign you up.']
      ];
      for (var i = 0; i < lines.length; i += 1) {
        if (lines[i][1] && full.indexOf(lines[i][1]) >= 0 && path === lines[i][0]) return lines[i][2];
      }
      for (var j = 0; j < lines.length; j += 1) {
        if (!lines[j][1] && path === lines[j][0] && (!location.hash || location.hash === '#' || location.hash === '#/')) return lines[j][2];
      }
      return pageLabel() + '. Nothing is sent until you tap OK.';
    };
    var nameBtn = document.createElement('button');
    nameBtn.type = 'button';
    nameBtn.id = 'hand-name';
    nameBtn.textContent = 'This page';
    nameBtn.setAttribute('aria-label', 'This page');
    var power = handButton('frame-power', '○', 'AI on or off');
    var menuBtn = handButton('frame-menu', '≡', 'Page menu');
    var displayBtn = handButton('frame-display', '▣', 'Show or hide the AI display');
    var away = handButton('frame-away', '×', 'Leave this page');
    power.className = 'frame-icon';
    menuBtn.className = 'frame-icon';
    displayBtn.className = 'frame-icon';
    away.className = 'frame-icon';
    var chrome = document.createElement('div');
    chrome.id = 'page-chrome';
    var menu = document.createElement('div');
    menu.id = 'page-menu';
    menu.hidden = true;
    var colors = {
      Home: '#c6a15b', Health: '#8fd6a8', IdidIt: '#e2b657', Train: '#f0a36a', People: '#9ec7c1',
      Groups: '#d7c4a3', Settings: '#c6a15b', Exchange: '#e7d7a8', Help: '#f4f1e8', Inventory: '#8fd6a8',
      SobeIt: '#d7c4a3', Introduction: '#f4f1e8'
    };
    var pageColor = function (name) { return colors[name] || '#c6a15b'; };
    var pageFeatures = function () {
      var full = pathNow() + (location.hash || '');
      var path = pathNow();
      var items = [];
      if (path === '/') items.push({ label: 'Health', href: '/gym' }, { label: 'Exchange', href: '/exchange' }, { label: 'Help', href: '/help' });
      else if (full.indexOf('#/ididit') >= 0) items.push({ label: 'Walk', fill: ['gym-ididit-activity', 'Walk'] }, { label: '20 min', fill: ['gym-ididit-minutes', '20'] }, { label: 'Confirm', click: 'gym-ididit-confirm' });
      else if (full.indexOf('#/train') >= 0) items.push({ label: 'Start', click: 'gym-train-start' }, { label: 'IdidIt', href: '/gym#/ididit' });
      else if (full.indexOf('#/people') >= 0) items.push({ label: 'IdidIt', href: '/gym#/ididit' });
      else if (full.indexOf('#/groups') >= 0) items.push({ label: 'IdidIt', href: '/gym#/ididit' });
      else if (full.indexOf('#/more') >= 0) items.push({ label: 'Health', href: '/gym' });
      else if (path === '/gym') items.push({ label: 'IdidIt', href: '/gym#/ididit' }, { label: 'Train', href: '/gym#/train' }, { label: 'People', href: '/gym#/people' }, { label: 'Groups', href: '/gym#/groups' }, { label: 'Settings', href: '/gym#/more' });
      else if (path === '/exchange') items.push({ label: 'Help', href: '/help' }, { label: 'Inventory', href: '/inventory' });
      else if (path === '/inventory') items.push({ label: 'Exchange', href: '/exchange' });
      else if (path === '/help') items.push({ label: 'Health', href: '/gym' });
      else if (path === '/books') items.push({ label: 'Health', href: '/gym' });
      items.push({ label: 'AI search', action: 'search' }, { label: 'Prefill', action: 'prefill' }, { label: 'Next', action: 'next' });
      return items;
    };
    var runFeature = function (item) {
      if (item.href) { location.assign(item.href); return; }
      if (item.fill) {
        var field = document.getElementById(item.fill[0]);
        if (field) {
          field.value = item.fill[1];
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.focus();
        }
        return;
      }
      if (item.click) {
        var button = document.getElementById(item.click);
        if (button) button.click();
        return;
      }
      if (item.action === 'search') {
        document.dispatchEvent(new CustomEvent('lgme-page-prompt'));
        var ask = document.getElementById('ai-ask');
        if (ask) ask.focus();
        return;
      }
      if (item.action === 'prefill' || item.action === 'next') focusNext(item.action === 'prefill');
    };
    var focusNext = function (fromStart) {
      var fields = Array.prototype.slice.call(document.querySelectorAll('input, textarea, select')).filter(function (field) {
        if (field.disabled || field.type === 'hidden') return false;
        if (field.closest && field.closest('#ai-dock, #page-chrome, #page-menu, #hand-bar, #site-nav')) return false;
        return true;
      });
      var current = document.activeElement;
      var start = fromStart ? -1 : fields.indexOf(current);
      var nextField = null;
      for (var i = start + 1; i < fields.length; i += 1) {
        if (!String(fields[i].value || '').trim()) { nextField = fields[i]; break; }
      }
      if (!nextField) nextField = fields[start + 1] || fields[0];
      if (nextField) nextField.focus();
      else document.dispatchEvent(new CustomEvent('lgme-page-prompt'));
    };
    var paintMenu = function () {
      menu.replaceChildren();
      pageFeatures().forEach(function (item) {
        var node = item.href ? document.createElement('a') : document.createElement('button');
        if (!item.href) node.type = 'button';
        node.textContent = item.label;
        if (item.href) node.href = item.href;
        else node.addEventListener('click', function () { runFeature(item); menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); });
        menu.appendChild(node);
      });
    };
    nameBtn.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('lgme-page-prompt', { detail: { name: pageLabel() } }));
    });
    power.addEventListener('click', function () {
      var sw = document.getElementById('ai-switch');
      if (sw) sw.click();
      window.setTimeout(paintChrome, 50);
    });
    menuBtn.addEventListener('click', function () {
      menu.hidden = !menu.hidden;
      menuBtn.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
      if (!menu.hidden) paintMenu();
    });
    displayBtn.addEventListener('click', function () {
      var expand = document.getElementById('ai-expand');
      if (expand) expand.click();
      window.setTimeout(paintChrome, 50);
    });
    away.addEventListener('click', function () {
      var hash = location.hash || '';
      if (hash && hash !== '#' && hash !== '#/') location.hash = '';
      else if (history.length > 1) history.back();
      else location.assign('/');
    });
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    home.addEventListener('click', function () { location.assign('/?home=1'); });
    back.addEventListener('click', function () {
      if (history.length > 1) history.back();
      else location.assign('/?home=1');
    });
    recent.addEventListener('click', function () {
      var dock = document.getElementById('ai-dock');
      var big = false;
      var compose = dock && dock.querySelector('.ai-compose');
      if (dock) {
        big = !dock.classList.contains('is-big');
        dock.classList.toggle('is-big', big);
        dock.classList.add('is-open');
        var expand = dock.querySelector('#ai-expand');
        if (expand) {
          expand.setAttribute('aria-expanded', 'true');
          expand.textContent = 'Close';
        }
      }
      if (big && dock && compose) {
        dock.insertBefore(recentSheet, compose);
        recentSheet.classList.add('is-in-dock');
        recentSheet.hidden = false;
        paintRecent();
        compose.scrollIntoView({ block: 'nearest' });
      } else {
        recentSheet.classList.remove('is-in-dock');
        recentSheet.hidden = true;
        document.body.appendChild(recentSheet);
      }
      recent.setAttribute('aria-pressed', big ? 'true' : 'false');
    });
    var paintEnds = function () {
      var index = hereIndex();
      prev.disabled = index <= 0;
      next.disabled = index >= routes.length - 1;
      prev.setAttribute('aria-disabled', prev.disabled ? 'true' : 'false');
      next.setAttribute('aria-disabled', next.disabled ? 'true' : 'false');
    };
    var paintChrome = function () {
      var name = pageLabel();
      var path = pathNow();
      var hash = location.hash || '';
      var sub = hash && hash !== '#' && hash !== '#/';
      var parent = path === '/' ? 'Home' : (path === '/gym' ? 'Health' : name);
      nameBtn.textContent = name;
      nameBtn.setAttribute('aria-label', name + '. ' + pagePurpose());
      var purpose = document.getElementById('hand-purpose');
      if (purpose) purpose.textContent = pagePurpose();
      document.documentElement.dataset.page = String(parent).toLowerCase();
      if (sub) document.documentElement.dataset.sub = String(name).toLowerCase().replace(/\s+/g, '-');
      else delete document.documentElement.dataset.sub;
      document.documentElement.style.setProperty('--page-line', pageColor(parent));
      document.documentElement.style.setProperty('--sub-line', pageColor(sub ? name : parent));
      var sw = document.getElementById('ai-switch');
      var on = !!(sw && (sw.getAttribute('aria-checked') === 'true' || sw.classList.contains('is-on')));
      power.setAttribute('aria-pressed', on ? 'true' : 'false');
      power.textContent = on ? '⏻' : '○';
      var dock = document.getElementById('ai-dock');
      var open = !!(dock && dock.classList.contains('is-open'));
      displayBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
      if (!menu.hidden) paintMenu();
    };
    var purpose = document.createElement('p');
    purpose.id = 'hand-purpose';
    purpose.textContent = pagePurpose();
    var row = document.createElement('div');
    row.id = 'hand-row';
    var mail = handButton('hand-mail', 'Mail', 'Messages', 'Messages waiting. Tap to open them.');
    var ai = handButton('hand-ai', 'AI', 'Prompt', 'Opens the prompt lines. Green means they are showing.');
    var fields = handButton('hand-fields', 'Fields', 'Left to fill', 'Hold to see what is still empty.');
    markIcon(mail, '\u2709');
    markIcon(ai, '\u2726');
    markIcon(fields, '\u2630');
    var mailCount = document.createElement('span');
    mailCount.className = 'hand-count';
    mailCount.id = 'hand-mail-count';
    mail.appendChild(mailCount);
    var fieldCount = document.createElement('span');
    fieldCount.className = 'hand-count';
    fieldCount.id = 'hand-field-count';
    fields.appendChild(fieldCount);
    var paintCounts = function () {
      var list = document.getElementById('message-list');
      var waiting = list ? list.querySelectorAll('li').length : 0;
      mailCount.textContent = waiting ? String(waiting) : '';
      mailCount.hidden = !waiting;
      var blanks = [];
      document.querySelectorAll('#home-board .dash-card, #home-board button').forEach(function (card) {
        if (/None yet/i.test(card.textContent || '')) blanks.push((card.textContent || '').replace(/None yet/i, '').trim().slice(0, 24));
      });
      fieldCount.textContent = blanks.length ? String(blanks.length) : '';
      fieldCount.hidden = !blanks.length;
      fields.dataset.blanks = blanks.join('|');
    };
    mail.addEventListener('click', function () {
      var open = document.getElementById('messages-open');
      if (open) { open.click(); return; }
      var panel = document.getElementById('message-panel');
      if (panel) panel.scrollIntoView({ block: 'start' });
    });
    var voiceBar = document.createElement('div');
    voiceBar.id = 'ai-voice-bar';
    voiceBar.hidden = true;
    var mic = document.createElement('button');
    mic.type = 'button';
    mic.setAttribute('aria-label', 'Voice');
    mic.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
    mic.addEventListener('click', function () {
      var real = document.getElementById('ai-mic-btn');
      if (real) real.click();
    });
    var voiceSet = document.createElement('button');
    voiceSet.type = 'button';
    voiceSet.setAttribute('aria-label', 'Settings');
    voiceSet.textContent = '\u2699';
    voiceSet.addEventListener('click', function () {
      var gear = document.getElementById('page-gear');
      if (gear) gear.click();
    });
    voiceBar.appendChild(mic);
    voiceBar.appendChild(voiceSet);
    document.body.appendChild(voiceBar);
    if (!document.getElementById('page-gear')) {
      var gear = document.createElement('button');
      gear.type = 'button';
      gear.id = 'page-gear';
      gear.setAttribute('aria-label', 'Settings');
      gear.textContent = '\u2699';
      gear.addEventListener('click', function (event) {
        event.stopPropagation();
        var more = document.getElementById('one-more');
        if (more) more.click();
      });
      document.body.appendChild(gear);
    }
    ai.addEventListener('click', function () {
      var on = voiceBar.hidden;
      voiceBar.hidden = !on;
      document.documentElement.classList.toggle('hand-ai-on', on);
      ai.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var fieldList = document.createElement('ul');
    fieldList.id = 'hand-field-list';
    fieldList.hidden = true;
    var showFields = function (on) {
      fieldList.hidden = !on;
      if (!on) return;
      paintCounts();
      fieldList.replaceChildren();
      var names = (fields.dataset.blanks || '').split('|').filter(Boolean);
      if (!names.length) {
        var empty = document.createElement('li');
        empty.textContent = 'None left';
        fieldList.appendChild(empty);
        return;
      }
      names.forEach(function (name) {
        var item = document.createElement('li');
        item.textContent = name;
        fieldList.appendChild(item);
      });
    };
    fields.addEventListener('pointerdown', function () { showFields(true); });
    fields.addEventListener('pointerup', function () { showFields(false); });
    fields.addEventListener('pointercancel', function () { showFields(false); });
    fields.addEventListener('pointerleave', function () { showFields(false); });
    document.body.appendChild(fieldList);
    paintCounts();
    window.setTimeout(paintCounts, 600);
    row.appendChild(mail);
    row.appendChild(ai);
    row.appendChild(fields);
    row.appendChild(prev);
    row.appendChild(recent);
    row.appendChild(home);
    row.appendChild(back);
    row.appendChild(next);
    hand.appendChild(purpose);
    hand.appendChild(row);
    chrome.appendChild(nameBtn);
    chrome.appendChild(power);
    chrome.appendChild(menuBtn);
    chrome.appendChild(displayBtn);
    chrome.appendChild(away);
    var nav = document.getElementById('site-nav');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(chrome, nav.nextSibling);
    else document.body.insertBefore(chrome, document.body.firstChild);
    if (chrome.nextSibling) chrome.parentNode.insertBefore(menu, chrome.nextSibling);
    else document.body.appendChild(menu);
    document.body.appendChild(recentSheet);
    document.body.appendChild(hand);
    var pinHand = function () {
      hand.style.position = 'fixed';
      hand.style.left = '0';
      hand.style.right = '0';
      hand.style.bottom = '0px';
      hand.style.top = 'auto';
      hand.style.zIndex = '80';
      var view = window.visualViewport;
      var viewTop = view ? view.offsetTop : 0;
      var viewH = view ? view.height : window.innerHeight;
      var want = viewTop + viewH - hand.getBoundingClientRect().height;
      var box = hand.getBoundingClientRect();
      if (Math.abs(box.top - want) > 28) {
        hand.style.position = 'absolute';
        hand.style.top = (window.scrollY + want) + 'px';
        hand.style.bottom = 'auto';
        hand.style.width = '100%';
      }
      document.documentElement.style.setProperty('--hand-h', hand.offsetHeight + 'px');
    };
    pinHand();
    window.addEventListener('scroll', pinHand, { passive: true });
    window.addEventListener('resize', pinHand);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', pinHand);
      window.visualViewport.addEventListener('scroll', pinHand);
    }
    paintEnds();
    paintChrome();
    remember();
    window.addEventListener('hashchange', function () {
      menu.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      paintEnds();
      paintChrome();
      remember();
      window.setTimeout(paintChrome, 400);
    });
  }
  if (!document.querySelector('script[src="/js/sw-update.js"]')) {
    var updater = document.createElement('script');
    updater.src = '/js/sw-update.js';
    document.body.appendChild(updater);
  }
  if (!document.querySelector('script[src="/js/hedera-choices.mjs"]')) {
    var hederaChoices = document.createElement('script');
    hederaChoices.type = 'module';
    hederaChoices.src = '/js/hedera-choices.mjs';
    document.body.appendChild(hederaChoices);
  }
  if (!document.querySelector('script[src="/js/tape-scroll.mjs"]')) {
    var tapeScroll = document.createElement('script');
    tapeScroll.type = 'module';
    tapeScroll.src = '/js/tape-scroll.mjs';
    document.body.appendChild(tapeScroll);
  }
  if (!document.querySelector('script[src="/js/local-ai-panel.mjs"]')) {
    var panel = document.createElement('script');
    panel.type = 'module';
    panel.src = '/js/local-ai-panel.mjs';
    document.body.appendChild(panel);
  }
  if (!document.querySelector('script[src="/js/display-fit.mjs"]')) {
    var displayFit = document.createElement('script');
    displayFit.type = 'module';
    displayFit.src = '/js/display-fit.mjs';
    document.body.appendChild(displayFit);
  }
  if (!document.querySelector('script[src="/js/visit-notice.js"]')) {
    var visitNotice = document.createElement('script');
    visitNotice.src = '/js/visit-notice.js';
    document.body.appendChild(visitNotice);
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-copy]');
    if (!button || !navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(button.getAttribute('data-copy')).then(function () { button.textContent = 'Copied'; }).catch(function () {});
  });
  var armOneTab = function () {
    var button = document.getElementById('one-more');
    if (!button) return;
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    var menu = document.getElementById('one-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'one-menu';
      menu.hidden = true;
      button.insertAdjacentElement('afterend', menu);
    }
    var intro = menu.querySelector('[data-intro]');
    if (!intro) {
      intro = document.createElement('a');
      intro.href = '/introduction';
      intro.dataset.intro = '1';
      intro.textContent = 'Introduction';
    }
    if (menu.firstElementChild !== intro) menu.insertBefore(intro, menu.firstChild);
    if (!menu.querySelector('#inventory-open')) {
      var inventory = document.createElement('a');
      inventory.href = '/inventory';
      inventory.id = 'inventory-open';
      inventory.textContent = 'Inventory';
      intro.insertAdjacentElement('afterend', inventory);
    }
    if (!menu.querySelector('#sobeit-open')) {
      var sobeit = document.createElement('a');
      sobeit.href = '/books';
      sobeit.id = 'sobeit-open';
      sobeit.textContent = 'SobeIt';
      var inventoryLink = menu.querySelector('#inventory-open');
      if (inventoryLink) inventoryLink.insertAdjacentElement('afterend', sobeit);
      else intro.insertAdjacentElement('afterend', sobeit);
    }
    var tape = menu.querySelector('#tape-sound');
    if (!tape) {
      tape = document.createElement('button');
      tape.type = 'button';
      tape.id = 'tape-sound';
      intro.insertAdjacentElement('afterend', tape);
    }
    var paintTape = function () {
      var saved = '';
      var hidden = false;
      var quiet = false;
      var sounds = true;
      try { saved = localStorage.getItem('lgme.tape.sound') || ''; } catch (error) { saved = ''; }
      try { hidden = localStorage.getItem('lgme.incognito') === '1'; } catch (error) { hidden = false; }
      try { sounds = localStorage.getItem('lgme.sounds') !== 'off'; } catch (error) { sounds = true; }
      try { quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { quiet = false; }
      var on = !hidden && sounds && saved !== 'off' && (saved === 'on' || !quiet);
      tape.setAttribute('aria-pressed', on ? 'true' : 'false');
      tape.textContent = on ? 'Tape sound on' : 'Tape sound off';
    };
    if (!menu.querySelector('#incognito-menu')) {
      var incog = document.createElement('button');
      incog.type = 'button';
      incog.id = 'incognito-menu';
      incog.setAttribute('aria-pressed', 'false');
      var paintIncog = function () {
        var on = false;
        try { on = localStorage.getItem('lgme.incognito') === '1'; } catch (error) { on = false; }
        incog.setAttribute('aria-pressed', on ? 'true' : 'false');
        incog.textContent = on ? 'Incognito on' : 'Incognito off';
      };
      incog.addEventListener('click', function () {
        var on = false;
        try { on = localStorage.getItem('lgme.incognito') === '1'; } catch (error) { on = false; }
        try { localStorage.setItem('lgme.incognito', on ? '0' : '1'); } catch (error) { /* the label still changes */ }
        paintIncog();
        document.dispatchEvent(new CustomEvent('lgme-incognito'));
      });
      document.addEventListener('lgme-incognito', paintIncog);
      tape.insertAdjacentElement('afterend', incog);
      paintIncog();
    }
    if (tape.dataset.bound !== '1') {
      tape.dataset.bound = '1';
      tape.addEventListener('click', function () {
        var saved = '';
        try { saved = localStorage.getItem('lgme.tape.sound') || ''; } catch (error) { saved = ''; }
        try { localStorage.setItem('lgme.tape.sound', saved === 'off' ? 'on' : 'off'); } catch (error) { /* the button still shows the choice */ }
        paintTape();
      });
    }
    paintTape();
    var oldSteps = menu.querySelector('#font-steps');
    if (oldSteps) oldSteps.remove();
    var oldEasy = menu.querySelector('#easy-read-menu');
    if (oldEasy) oldEasy.remove();
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    var safePad = function () {
      var probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
      document.body.appendChild(probe);
      var style = getComputedStyle(probe);
      var pad = {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0
      };
      probe.remove();
      return pad;
    };
    var placeMenu = function () {
      if (menu.hidden) return;
      var view = window.visualViewport;
      var pad = safePad();
      var viewTop = view ? view.offsetTop : 0;
      var viewRight = view ? Math.max(0, window.innerWidth - (view.offsetLeft + view.width)) : 0;
      var nav = document.getElementById('site-nav');
      var navBottom = nav ? nav.getBoundingClientRect().bottom : viewTop;
      var edge = Math.max(viewTop + pad.top + 8, navBottom + 4);
      var moreTop = button.getBoundingClientRect().top;
      var dock = document.getElementById('ai-dock');
      var dockTop = dock ? dock.getBoundingClientRect().top : viewTop + (view ? view.height : window.innerHeight);
      var limit = Math.min(moreTop, dockTop) - 8;
      if (limit < edge + 48) edge = Math.max(viewTop + pad.top, limit - 48);
      var room = Math.max(48, limit - edge);
      var layoutH = window.innerHeight;
      menu.style.setProperty('--more-bottom', Math.max(8, layoutH - limit) + 'px');
      menu.style.setProperty('--more-max', room + 'px');
      menu.style.setProperty('--more-right', (viewRight + pad.right + 8) + 'px');
    };
    var closeMenu = function () {
      document.documentElement.classList.remove('is-more-open');
      button.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    };
    var last = 0;
    var toggle = function () {
      var now = Date.now();
      if (now - last < 450) return;
      last = now;
      var open = document.documentElement.classList.toggle('is-more-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.hidden = !open;
      if (open) {
        menu.scrollTop = 0;
        placeMenu();
      }
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', placeMenu);
      window.visualViewport.addEventListener('scroll', placeMenu);
    }
    window.addEventListener('resize', placeMenu);
    button.addEventListener('pointerdown', function (event) {
      if (event.button && event.button !== 0) return;
      if (button.setPointerCapture && event.pointerId != null) {
        try { button.setPointerCapture(event.pointerId); } catch (error) { /* the tap still counts */ }
      }
    });
    button.addEventListener('pointerup', toggle);
    button.addEventListener('click', toggle);
    menu.addEventListener('click', function (event) {
      var item = event.target.closest && event.target.closest('a, button');
      if (!item || !menu.contains(item)) return;
      if (item.id === 'hedera-open' || (item.closest && item.closest('#hedera-choices'))) return;
      var route = item.getAttribute('data-route');
      if (route) {
        if (document.getElementById('gym-panel')) location.hash = route;
        else location.assign('/gym#' + route);
      }
      closeMenu();
    });
    document.addEventListener('click', function (event) {
      if (menu.hidden) return;
      var node = event.target;
      if (node && node.closest && node.closest('#one-menu, #one-more, #page-gear, #ai-voice-bar, #category-board, #ai-dock, #field-hint')) return;
      closeMenu();
    }, true);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
    var back = document.getElementById('site-back');
    if (back) back.addEventListener('click', closeMenu);
  };
  if (document.body) armOneTab();
  else document.addEventListener('DOMContentLoaded', armOneTab);
  var backButton = bar.querySelector('#site-back');
  if (backButton && !backButton.dataset.bound) {
    backButton.dataset.bound = '1';
    backButton.setAttribute('aria-label', 'Back');
    backButton.textContent = '‹';
    backButton.addEventListener('click', function () {
      if (history.length > 1) history.back();
      else location.assign('/?home=1');
    });
  }
  var homeLink = bar.querySelector('#site-home');
  if (homeLink) {
    homeLink.setAttribute('aria-label', 'Home');
    homeLink.textContent = '⌂';
  }
  var nextButton = bar.querySelector('#site-next');
  if (!nextButton) {
    nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.id = 'site-next';
    nextButton.setAttribute('aria-label', 'Next');
    nextButton.textContent = '›';
    nextButton.hidden = true;
    var markSlot = bar.querySelector('#ai-head');
    if (markSlot) bar.insertBefore(nextButton, markSlot);
    else bar.appendChild(nextButton);
  }
  function shown(el) {
    if (!el || el.hidden || el.disabled) return false;
    if (el.closest('#ai-dock, #site-nav, [hidden]')) return false;
    var box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }
  function inView(el) {
    if (!shown(el)) return false;
    var box = el.getBoundingClientRect();
    return box.bottom > 36 && box.top < window.innerHeight * 0.72;
  }
  function findNext() {
    var picks = [];
    var sections = ['step-email', 'step-fingerprint', 'step-ai'].map(function (id) { return document.getElementById(id); }).filter(shown);
    var current = 0;
    sections.forEach(function (section, index) {
      if (section.getBoundingClientRect().top < 72) current = index;
    });
    if (sections[current] && inView(sections[current]) && sections[current + 1]) picks.push(sections[current + 1]);
    var screen = document.querySelector('#onboarding .screen:not([hidden])');
    var jump = screen && screen.querySelector('[data-next]');
    if (screen && jump && inView(screen) && shown(jump)) picks.push(jump);
    var stepper = document.getElementById('stepper-next');
    if (stepper && inView(stepper) && (stepper.textContent || '').trim() === 'Next') picks.push(stepper);
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      if (button.id === 'site-next') continue;
      if ((button.textContent || '').trim() !== 'Next') continue;
      if (inView(button)) picks.push(button);
    }
    var articles = document.querySelectorAll('.steps > article');
    for (var s = 0; s < articles.length - 1; s += 1) {
      if (inView(articles[s]) && shown(articles[s + 1])) { picks.push(articles[s + 1]); break; }
    }
    if (!picks.length) return null;
    picks.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
    return picks[0];
  }
  function syncNext() {
    var show = !!findNext();
    if (nextButton.hidden === !show) return;
    nextButton.hidden = !show;
  }
  if (!nextButton.dataset.bound) {
    nextButton.dataset.bound = '1';
    nextButton.addEventListener('click', function () {
      var target = findNext();
      if (!target) { syncNext(); return; }
      if (target.matches && target.matches('button, a')) target.click();
      else target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    var queued = 0;
    var schedule = function () {
      if (queued) return;
      queued = requestAnimationFrame(function () { queued = 0; syncNext(); });
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('hashchange', schedule);
    window.addEventListener('resize', schedule);
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });
    schedule();
  }
})();

(function () {
  var labels = ['85', '100', '115', '130', '150'];
  function paint(step) {
    var button = document.getElementById('sz-cycle');
    if (!button) return;
    var index = Number(step);
    if (!Number.isInteger(index) || index < 0 || index > 4) index = 1;
    button.textContent = 'sz ' + labels[index];
    button.setAttribute('aria-label', 'Screen size ' + labels[index] + ' percent. Tap for the next size, from smallest to largest.');
  }
  function mount() {
    if (document.getElementById('sz-cycle')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'sz-cycle';
    button.textContent = 'sz';
    button.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('lgme-display', { detail: { cycle: true } }));
    });
    document.body.appendChild(button);
    var saved = 1;
    try { saved = Number(localStorage.getItem('lgme.display.step')); } catch (error) { saved = 1; }
    paint(saved);
  }
  document.addEventListener('lgme-display-state', function (event) {
    paint(event.detail && event.detail.step);
  });
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
