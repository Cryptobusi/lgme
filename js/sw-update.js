(function () {
  if (!('serviceWorker' in navigator)) return;
  var key = 'lgme.sw.reload';
  if (sessionStorage.getItem(key) === '1') sessionStorage.removeItem(key);
  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController) { hadController = true; return; }
    if (reloading || sessionStorage.getItem(key) === '1') return;
    reloading = true;
    sessionStorage.setItem(key, '1');
    location.reload();
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
