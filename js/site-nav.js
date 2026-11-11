(function () {
  var EPOCH = '2';
  var CURRENT = { 'lgme-v169': 1, 'lgme-gym-v75': 1 };
  function keep(name) {
    if (!name) return true;
    if (name === 'lgme.reset.epoch' || name === 'lgme.reset.note' || name === 'lgme.device.key' || name === 'lgme-gym.seat' || name === 'lgme.health.book' || name === 'lgme.health.email' || name === 'lgme.health.plan' || name === 'lgme.health.contact' || name === 'lgme.health.contactGrants' || name === 'lgme.health.consent') return true;
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
    back.textContent = 'Back';
    var home = document.createElement('a');
    home.id = 'site-home';
    home.href = '/?home=1';
    home.textContent = 'Home';
    bar.appendChild(back);
    bar.appendChild(home);
    document.body.prepend(bar);
  }
  document.documentElement.classList.add('has-site-nav');
  document.body.classList.add('has-site-nav');
  if (!document.querySelector('script[src="/js/sw-update.js"]')) {
    var updater = document.createElement('script');
    updater.src = '/js/sw-update.js';
    document.body.appendChild(updater);
  }
  if (!document.querySelector('script[src="/js/local-ai-panel.mjs"]')) {
    var panel = document.createElement('script');
    panel.type = 'module';
    panel.src = '/js/local-ai-panel.mjs';
    document.body.appendChild(panel);
  }
  var backButton = bar.querySelector('#site-back');
  if (backButton && !backButton.dataset.bound) {
    backButton.dataset.bound = '1';
    backButton.addEventListener('click', function () {
      if (history.length > 1) history.back();
      else location.assign('/?home=1');
    });
  }
})();
