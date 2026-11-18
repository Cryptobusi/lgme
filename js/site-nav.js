(function () {
  var EPOCH = '2';
  var CURRENT = { 'lgme-v233': 1, 'lgme-gym-v81': 1 };
  function keep(name) {
    if (!name) return true;
    if (name === 'lgme.reset.epoch' || name === 'lgme.reset.note' || name === 'lgme.device.key' || name === 'lgme-gym.seat' || name === 'lgme.health.book' || name === 'lgme.health.email' || name === 'lgme.health.plan' || name === 'lgme.health.contact' || name === 'lgme.health.contactGrants' || name === 'lgme.health.consent' || name === 'lgme.demo.member') return true;
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
  document.documentElement.classList.add('has-site-nav');
  document.body.classList.add('has-site-nav');
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
    var last = 0;
    var toggle = function () {
      var now = Date.now();
      if (now - last < 450) return;
      last = now;
      var open = document.documentElement.classList.toggle('is-more-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.hidden = !open;
    };
    button.addEventListener('pointerdown', function (event) {
      if (event.button && event.button !== 0) return;
      if (button.setPointerCapture && event.pointerId != null) {
        try { button.setPointerCapture(event.pointerId); } catch (error) { /* the tap still counts */ }
      }
    });
    button.addEventListener('pointerup', toggle);
    button.addEventListener('click', toggle);
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
