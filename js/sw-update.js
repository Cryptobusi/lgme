(function () {
  if (!('serviceWorker' in navigator)) return;
  var key = 'lgme.sw.reload';
  if (sessionStorage.getItem(key) === '1') sessionStorage.removeItem(key);
  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;
  window.__lgmeDeferSwReload = function () {
    var active = document.activeElement;
    return Boolean(active && active.closest && active.closest('#ai-dock'));
  };
  function reloadForUpdate() {
    if (reloading || sessionStorage.getItem(key) === '1') return;
    if (window.__lgmeDeferSwReload()) {
      document.addEventListener('focusout', function wait() {
        if (window.__lgmeDeferSwReload()) return;
        document.removeEventListener('focusout', wait, true);
        reloadForUpdate();
      }, true);
      return;
    }
    reloading = true;
    sessionStorage.setItem(key, '1');
    location.reload();
  }
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController) { hadController = true; return; }
    reloadForUpdate();
  });
  function watch(reg) {
    if (!reg || !reg.update) return;
    reg.update().catch(function () {});
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') reg.update().catch(function () {});
    });
  }
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(watch).catch(function () {});
})();
