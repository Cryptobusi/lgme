(function () {
  if (!('serviceWorker' in navigator)) return;
  var key = 'lgme.sw.reload';
  if (sessionStorage.getItem(key) === '1') sessionStorage.removeItem(key);
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
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
  navigator.serviceWorker.register('/sw.js').then(watch).catch(function () {});
})();
