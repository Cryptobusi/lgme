import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { module: { exports: {} }, exports: {}, globalThis, console };
vm.runInNewContext(readFileSync(join(root, 'js/ui-view.js'), 'utf8'), sandbox, { filename: 'ui-view.js' });
const ui = sandbox.module.exports;
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
}

test('the default view is classic and an unsaved visit stays put', () => {
  assert.equal(ui.KEY, 'lgme-ui-view');
  assert.equal(ui.normalizeView(null), null);
  assert.equal(ui.normalizeView('later'), null);
  assert.equal(ui.normalizeView(''), null);
  assert.equal(ui.normalizeView('toString'), null);
  assert.equal(ui.viewForPage('/', null), 'classic');
  assert.equal(ui.viewForPage('/study', undefined), 'classic');
  assert.equal(ui.viewForPage('/my-picture', null), 'app');
  assert.equal(ui.viewForPage('/my-picture-classic', null), 'picture');
  assert.equal(ui.viewForPage('/tap-entry', null), 'tap');
  assert.equal(ui.destinationFor('/', null), null);
  assert.equal(ui.destinationFor('/my-picture', null), null);
  assert.equal(ui.destinationFor('/my-picture-classic', null), null);
  assert.equal(ui.destinationFor('/tap-entry', null), null);
  assert.equal(ui.destinationFor('/campus', 'app'), null);
  assert.equal(ui.destinationFor('/campus', 'picture'), null);
  assert.equal(ui.destinationFor('/campus', 'tap'), null);
  assert.equal(ui.readView(memory()), null);
});

test('each saved view persists and switches among classic, picture, app, and one-tap entry', () => {
  assert.deepEqual({ ...ui.VIEWS }, {
    classic: '/',
    picture: '/my-picture-classic',
    app: '/my-picture',
    tap: '/tap-entry'
  });
  assert.equal(ui.destinationFor('/', 'app'), '/my-picture');
  assert.equal(ui.destinationFor('/index.html', 'picture'), '/my-picture-classic');
  assert.equal(ui.destinationFor('/my-picture', 'picture'), '/my-picture-classic');
  assert.equal(ui.destinationFor('/my-picture-classic', 'app'), '/my-picture');
  assert.equal(ui.destinationFor('/my-picture-classic.html', 'classic'), '/');
  assert.equal(ui.destinationFor('/my-picture.html', 'classic'), '/');
  assert.equal(ui.destinationFor('/', 'classic'), null);
  assert.equal(ui.destinationFor('/my-picture', 'app'), null);
  assert.equal(ui.destinationFor('/my-picture-classic', 'picture'), null);
  assert.equal(ui.viewForPage('/', 'picture'), 'picture');
  assert.equal(ui.viewForPage('/my-picture', 'classic'), 'classic');
  assert.equal(ui.viewForPage('/my-picture-classic', 'app'), 'app');
  const store = memory();
  for (const value of ['classic', 'picture', 'app', 'tap']) {
    store.setItem(ui.KEY, value);
    assert.equal(ui.readView(store), value);
  }
  assert.equal(ui.readView({ getItem() { throw new Error('blocked'); } }), null);
});

test('one-tap entry reuses /tap-entry and still returns to the other views', () => {
  assert.equal(ui.isTap('/tap-entry'), true);
  assert.equal(ui.isTap('/tap-entry.html'), true);
  assert.equal(ui.isTap('/tap-entry/'), true);
  assert.equal(ui.isTap('/'), false);
  assert.equal(ui.pageKind('/tap-entry'), 'tap');
  assert.equal(ui.normalizeView('tap'), 'tap');
  assert.equal(ui.destinationFor('/', 'tap'), '/tap-entry');
  assert.equal(ui.destinationFor('/index.html', 'tap'), '/tap-entry');
  assert.equal(ui.destinationFor('/my-picture', 'tap'), '/tap-entry');
  assert.equal(ui.destinationFor('/my-picture.html', 'tap'), '/tap-entry');
  assert.equal(ui.destinationFor('/my-picture-classic', 'tap'), '/tap-entry');
  assert.equal(ui.destinationFor('/my-picture-classic.html', 'tap'), '/tap-entry');
  assert.equal(ui.destinationFor('/tap-entry', 'classic'), '/');
  assert.equal(ui.destinationFor('/tap-entry.html', 'picture'), '/my-picture-classic');
  assert.equal(ui.destinationFor('/tap-entry/', 'app'), '/my-picture');
  assert.equal(ui.destinationFor('/tap-entry', 'tap'), null);
  assert.equal(ui.destinationFor('/tap-entry.html', 'tap'), null);
  assert.equal(ui.viewForPage('/', 'tap'), 'tap');
  assert.equal(ui.viewForPage('/tap-entry', 'classic'), 'classic');
  assert.equal(ui.viewForPage('/tap-entry', 'picture'), 'picture');
  assert.equal(ui.viewForPage('/tap-entry', 'app'), 'app');
  assert.equal(ui.destinationFor('/exchange', 'tap'), null);
  assert.equal(ui.destinationFor('/campus', 'tap'), null);
  assert.equal(ui.destinationFor('/mutual-credit', 'tap'), null);
  assert.equal(ui.destinationFor('/workflow', 'tap'), null);
  assert.equal(ui.destinationFor('/clearing-engine', 'tap'), null);
});

test('unknown or old saved values fall back to classic and do not navigate', () => {
  for (const stale of ['later', '', 'sovereign', 'one-tap', 'entry', 'toString']) {
    assert.equal(ui.normalizeView(stale), null, stale);
    assert.equal(ui.readView({ getItem() { return stale; } }), null, stale);
    assert.equal(ui.viewForPage('/', stale), 'classic', stale);
    assert.equal(ui.viewForPage('/study', stale), 'classic', stale);
    assert.equal(ui.viewForPage('/exchange', stale), 'classic', stale);
    assert.equal(ui.destinationFor('/', stale), null, stale);
    assert.equal(ui.destinationFor('/tap-entry', stale), null, stale);
    assert.equal(ui.destinationFor('/my-picture', stale), null, stale);
    assert.equal(ui.destinationFor('/campus', stale), null, stale);
  }
});

test('classic, my picture, the sovereign app, and one-tap entry all carry the switcher', () => {
  for (const file of ['index.html', 'my-picture.html', 'my-picture-classic.html', 'tap-entry.html']) {
    const page = text(file);
    const scriptAt = page.indexOf('src="/js/ui-view.js"');
    const bodyAt = page.indexOf('<body');
    assert.equal(scriptAt > 0 && scriptAt < bodyAt, true, file);
    assert.equal(page.includes('href="/css/ui-view.css"'), true, file);
    assert.equal(page.includes('role="radiogroup" aria-label="View"'), true, file);
    assert.equal(page.includes('data-ui-view="classic"'), true, file);
    assert.equal(page.includes('data-ui-view="picture"'), true, file);
    assert.equal(page.includes('data-ui-view="app"'), true, file);
    assert.equal(page.includes('data-ui-view="tap"'), true, file);
    assert.equal(page.includes('href="/tap-entry" data-ui-view="tap"'), true, file);
    assert.equal(page.includes('>Classic</a>'), true, file);
    assert.equal(page.includes('>My Picture</a>'), true, file);
    assert.equal(page.includes('>Sovereign App</a>'), true, file);
    assert.equal(page.includes('>One-Tap Entry</a>'), true, file);
    const classicAt = page.indexOf('data-ui-view="classic"');
    const pictureAt = page.indexOf('data-ui-view="picture"');
    const appAt = page.indexOf('data-ui-view="app"');
    const tapAt = page.indexOf('data-ui-view="tap"');
    assert.equal(classicAt < pictureAt && pictureAt < appAt && appAt < tapAt, true, file);
    assert.equal(/<script(?![^>]*\bsrc=)/i.test(page), false, file);
  }
  assert.equal(text('tap-entry.html').includes('data-ui-view="tap" aria-checked="true"'), true);
  assert.equal(text('index.html').includes('data-ui-view="tap" aria-checked="false"'), true);
  assert.equal(text('my-picture.html').includes('data-ui-view="app" aria-checked="true"'), true);
  assert.equal(text('my-picture-classic.html').includes('data-ui-view="picture" aria-checked="true"'), true);
  const home = text('index.html');
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  assert.equal(nav.includes('Sovereign App'), false);
  assert.equal(nav.includes('My Picture'), false);
  const css = text('css/ui-view.css');
  assert.equal(css.includes('data-ui-view="picture"'), true);
  assert.equal(css.includes('data-ui-view="tap"'), true);
  assert.equal(css.includes('max-width: 100%'), true);
  assert.equal(css.includes('max-width: 480px'), true);
  assert.equal(text('tap-entry.html').includes('src="/js/tap-entry-ui.mjs"'), true);
  assert.equal(text('js/ui-view.js').includes('tap-entry-ui'), false);
  assert.equal(text('js/ui-view.js').includes('from \'./tap-entry'), false);
});

function harness(pathname, storage) {
  const radios = ['classic', 'picture', 'app', 'tap'].map((view) => ({
    attrs: { role: 'radio', 'data-ui-view': view, 'aria-checked': 'false' },
    focused: false,
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    focus() { this.focused = true; }
  }));
  const group = {
    querySelectorAll(sel) { return sel === '[role="radio"][data-ui-view]' || sel === '[data-ui-view]' ? radios : []; }
  };
  for (const el of radios) {
    el.closest = (sel) => {
      if (sel === '[data-ui-view]') return el;
      if (sel === '[role="radiogroup"]') return group;
      return null;
    };
  }
  const html = {
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; }
  };
  const listeners = {};
  const doc = {
    documentElement: html,
    readyState: 'complete',
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    querySelectorAll(sel) { return sel === '[role="radio"][data-ui-view]' || sel === '[data-ui-view]' ? radios : []; }
  };
  const location = {
    pathname,
    replaced: null,
    assigned: null,
    replace(url) { this.replaced = url; },
    assign(url) { this.assigned = url; }
  };
  ui.boot(doc, storage, location);
  return { html, radios, listeners, location };
}

function fire(listeners, type, event) {
  for (const fn of listeners[type] || []) fn(event);
}

function checked(radios) {
  return radios.filter((radio) => radio.getAttribute('aria-checked') === 'true').map((radio) => radio.getAttribute('data-ui-view'));
}

test('boot saves the choice, routes to /tap-entry, and routes back', () => {
  const away = harness('/', memoryAt('tap'));
  assert.equal(away.location.replaced, '/tap-entry');
  assert.equal(away.listeners.click, undefined);

  const back = harness('/tap-entry', memoryAt('classic'));
  assert.equal(back.location.replaced, '/');
  assert.equal(harness('/tap-entry.html', memoryAt('picture')).location.replaced, '/my-picture-classic');
  assert.equal(harness('/tap-entry/', memoryAt('app')).location.replaced, '/my-picture');
  assert.equal(harness('/my-picture', memoryAt('tap')).location.replaced, '/tap-entry');
  assert.equal(harness('/my-picture-classic', memoryAt('tap')).location.replaced, '/tap-entry');

  const here = harness('/tap-entry', memoryAt('tap'));
  assert.equal(here.location.replaced, null);
  assert.equal(here.html.getAttribute('data-ui-view'), 'tap');
  assert.deepEqual(checked(here.radios), ['tap']);

  const home = harness('/', memory());
  assert.equal(home.location.replaced, null);
  assert.equal(home.html.getAttribute('data-ui-view'), 'classic');
  assert.deepEqual(checked(home.radios), ['classic']);

  const store = memory();
  const desk = harness('/', store);
  fire(desk.listeners, 'click', { target: desk.radios[3], preventDefault() {} });
  assert.equal(store.getItem(ui.KEY), 'tap');
  assert.equal(desk.location.assigned, '/tap-entry');
  assert.deepEqual(checked(desk.radios), ['tap']);

  const entry = harness('/tap-entry', memoryAt('tap'));
  fire(entry.listeners, 'click', { target: entry.radios[0], preventDefault() {} });
  assert.equal(entry.location.assigned, '/');

  const picture = harness('/tap-entry', memoryAt('tap'));
  fire(picture.listeners, 'click', { target: picture.radios[1], preventDefault() {} });
  assert.equal(picture.location.assigned, '/my-picture-classic');
  const app = harness('/tap-entry', memoryAt('tap'));
  fire(app.listeners, 'click', { target: app.radios[2], preventDefault() {} });
  assert.equal(app.location.assigned, '/my-picture');

  const keys = harness('/', memory());
  let prevented = false;
  fire(keys.listeners, 'keydown', {
    key: 'ArrowLeft',
    target: keys.radios[0],
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(keys.radios[3].focused, true);
  assert.equal(keys.location.assigned, '/tap-entry');

  const right = harness('/tap-entry', memoryAt('tap'));
  fire(right.listeners, 'keydown', {
    key: 'ArrowRight',
    target: right.radios[3],
    preventDefault() {}
  });
  assert.equal(right.radios[0].focused, true);
  assert.equal(right.location.assigned, '/');

  const decoy = harness('/tap-entry', memory());
  const outside = {
    getAttribute(name) { return name === 'data-ui-view' ? 'classic' : null; },
    closest(sel) { return sel === '[data-ui-view]' ? this : null; }
  };
  fire(decoy.listeners, 'click', { target: outside, preventDefault() { this.prevented = true; } });
  assert.equal(decoy.location.assigned, null);
  assert.equal(decoy.html.getAttribute('data-ui-view'), 'tap');
  fire(decoy.listeners, 'keydown', { key: 'ArrowLeft', target: outside, preventDefault() {} });
  assert.equal(decoy.location.assigned, null);

  const blocked = {
    getItem() { return null; },
    setItem() { throw new Error('blocked'); }
  };
  const priv = harness('/tap-entry', blocked);
  fire(priv.listeners, 'click', { target: priv.radios[0], preventDefault() {} });
  assert.equal(priv.location.assigned, '/');
});

function memoryAt(value) {
  const store = memory();
  store.setItem(ui.KEY, value);
  return store;
}

test('boot ignores an unknown saved value and keeps the page that is open', () => {
  const home = harness('/', { getItem() { return 'later'; } });
  assert.equal(home.location.replaced, null);
  assert.equal(home.location.assigned, null);
  assert.equal(home.html.getAttribute('data-ui-view'), 'classic');
  assert.deepEqual(checked(home.radios), ['classic']);

  const entry = harness('/tap-entry', { getItem() { return 'one-tap-entry'; } });
  assert.equal(entry.location.replaced, null);
  assert.equal(entry.html.getAttribute('data-ui-view'), 'tap');
  assert.deepEqual(checked(entry.radios), ['tap']);

  const campus = harness('/campus', memoryAt('tap'));
  assert.equal(campus.location.replaced, null);
  assert.equal(campus.location.assigned, null);
  const exchange = harness('/exchange', memoryAt('app'));
  assert.equal(exchange.location.replaced, null);
});
