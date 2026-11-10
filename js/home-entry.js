(function () {
  var KEY = 'lgme.entry.category';

  function registered() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf('lgme-sim:peer:') !== 0) continue;
        var peer = JSON.parse(localStorage.getItem(key) || 'null');
        if (peer && peer.example !== true && peer.gymProgress && peer.gymProgress.chosen && peer.gymProgress.chosen.length >= 3) return true;
      }
    } catch (error) { /* stay on the picker */ }
    return false;
  }

  var params = new URLSearchParams(location.search);
  if (params.get('picker') !== '1' && registered()) location.replace('/gym');

  function bind() {
    document.querySelectorAll('[data-entry]').forEach(function (tile) {
      tile.addEventListener('click', function () {
        try { localStorage.setItem(KEY, tile.getAttribute('data-entry')); } catch (error) { /* the link still opens */ }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
