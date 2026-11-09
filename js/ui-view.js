/**
 * Optional Classic / Sovereign App switch.
 * Default is Classic. A saved choice is applied before the page paints.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    var storage = null;
    try { storage = root.localStorage; } catch (error) { storage = null; }
    api.boot(document, storage, root.location);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var KEY = 'lgme-ui-view';

  function pathOf(pathname) {
    var path = String(pathname || '/');
    var cut = path.search(/[?#]/);
    if (cut >= 0) path = path.slice(0, cut);
    if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
    return path || '/';
  }

  function isHome(pathname) {
    var path = pathOf(pathname);
    return path === '/' || path === '/index.html';
  }

  function isApp(pathname) {
    var path = pathOf(pathname);
    return path === '/my-picture' || path === '/my-picture.html';
  }

  function normalizeView(value) {
    return value === 'app' || value === 'classic' ? value : null;
  }

  function readView(storage) {
    try {
      return normalizeView(storage && storage.getItem(KEY));
    } catch (error) {
      return null;
    }
  }

  function destinationFor(pathname, stored) {
    var view = normalizeView(stored);
    if (view === 'app' && isHome(pathname)) return '/my-picture';
    if (view === 'classic' && isApp(pathname)) return '/';
    return null;
  }

  function viewForPage(pathname, stored) {
    var view = normalizeView(stored);
    if (view) return view;
    return isApp(pathname) ? 'app' : 'classic';
  }

  function boot(doc, storage, location) {
    var stored = readView(storage);
    var view = viewForPage(location && location.pathname, stored);
    doc.documentElement.setAttribute('data-ui-view', view);
    var dest = destinationFor(location && location.pathname, stored);
    if (dest && location && typeof location.replace === 'function') {
      location.replace(dest);
      return;
    }
    function sync() {
      var current = doc.documentElement.getAttribute('data-ui-view') || 'classic';
      var nodes = doc.querySelectorAll('[data-ui-view]');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].setAttribute('aria-checked', nodes[i].getAttribute('data-ui-view') === current ? 'true' : 'false');
      }
    }
    function choose(next) {
      if (next !== 'app' && next !== 'classic') return;
      try { storage.setItem(KEY, next); } catch (error) { /* private mode still navigates */ }
      doc.documentElement.setAttribute('data-ui-view', next);
      sync();
      var go = destinationFor(location.pathname, next);
      if (go && typeof location.assign === 'function') location.assign(go);
    }
    doc.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-ui-view]') : null;
      if (!target) return;
      event.preventDefault();
      choose(target.getAttribute('data-ui-view'));
    });
    doc.addEventListener('keydown', function (event) {
      var target = event.target;
      if (!target || !target.closest || !target.getAttribute || !target.getAttribute('data-ui-view')) return;
      var group = target.closest('[role="radiogroup"]');
      if (!group) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var radios = group.querySelectorAll('[data-ui-view]');
      var index = Array.prototype.indexOf.call(radios, target);
      if (index < 0) return;
      event.preventDefault();
      var dir = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      var next = radios[(index + dir + radios.length) % radios.length];
      next.focus();
      choose(next.getAttribute('data-ui-view'));
    });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', sync);
    else sync();
  }

  return {
    KEY: KEY,
    pathOf: pathOf,
    isHome: isHome,
    isApp: isApp,
    normalizeView: normalizeView,
    readView: readView,
    destinationFor: destinationFor,
    viewForPage: viewForPage,
    boot: boot
  };
});
