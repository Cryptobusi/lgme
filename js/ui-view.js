/**
 * Optional Classic / My Picture / Sovereign App / One-Tap Entry switch.
 * Default is Classic. A saved choice is applied before the page paints.
 * One-Tap Entry reuses the /tap-entry page.
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

  var VIEWS = {
    classic: '/',
    picture: '/my-picture-classic',
    app: '/my-picture',
    tap: '/tap-entry'
  };

  function isApp(pathname) {
    var path = pathOf(pathname);
    return path === '/my-picture' || path === '/my-picture.html';
  }

  function isPicture(pathname) {
    var path = pathOf(pathname);
    return path === '/my-picture-classic' || path === '/my-picture-classic.html';
  }

  function isTap(pathname) {
    var path = pathOf(pathname);
    return path === '/tap-entry' || path === '/tap-entry.html';
  }

  function pageKind(pathname) {
    if (isHome(pathname)) return 'classic';
    if (isPicture(pathname)) return 'picture';
    if (isApp(pathname)) return 'app';
    if (isTap(pathname)) return 'tap';
    return null;
  }

  function normalizeView(value) {
    return Object.prototype.hasOwnProperty.call(VIEWS, value) ? value : null;
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
    var here = pageKind(pathname);
    if (!view || !here || view === here) return null;
    return VIEWS[view];
  }

  function viewForPage(pathname, stored) {
    var view = normalizeView(stored);
    if (view) return view;
    return pageKind(pathname) || 'classic';
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
    function radiosOf(node) {
      return node.querySelectorAll('[role="radio"][data-ui-view]');
    }
    function radioFrom(target) {
      var node = target && target.closest ? target.closest('[data-ui-view]') : null;
      if (!node || node.getAttribute('role') !== 'radio') return null;
      return node;
    }
    function sync() {
      var current = doc.documentElement.getAttribute('data-ui-view') || 'classic';
      var nodes = radiosOf(doc);
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].setAttribute('aria-checked', nodes[i].getAttribute('data-ui-view') === current ? 'true' : 'false');
      }
    }
    function choose(next) {
      if (!normalizeView(next)) return;
      try { storage.setItem(KEY, next); } catch (error) { /* private mode still navigates */ }
      doc.documentElement.setAttribute('data-ui-view', next);
      sync();
      var go = destinationFor(location.pathname, next);
      if (go && typeof location.assign === 'function') location.assign(go);
    }
    doc.addEventListener('click', function (event) {
      var target = radioFrom(event.target);
      if (!target) return;
      event.preventDefault();
      choose(target.getAttribute('data-ui-view'));
    });
    doc.addEventListener('keydown', function (event) {
      var target = radioFrom(event.target);
      if (!target) return;
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
    VIEWS: VIEWS,
    isHome: isHome,
    isApp: isApp,
    isPicture: isPicture,
    isTap: isTap,
    pageKind: pageKind,
    normalizeView: normalizeView,
    readView: readView,
    destinationFor: destinationFor,
    viewForPage: viewForPage,
    boot: boot
  };
});
