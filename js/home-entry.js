(function () {
  var KEY = 'lgme.entry.category';
  var routes = {
    health: '/gym',
    campus: '/campus',
    barter: '/exchange',
    wisdom: '/wisdom',
    tutoring: '/good-deeds#tutoring',
    repair: '/good-deeds#repair',
    cleanup: '/good-deeds#cleanup',
    gear: '/good-deeds#gear'
  };

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
  if (params.get('picker') !== '1') {
    var last = '';
    try { last = localStorage.getItem(KEY) || ''; } catch (error) { last = ''; }
    if (registered() && (!last || last === 'health')) location.replace('/gym');
    else if (last && routes[last]) location.replace(routes[last]);
  }

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
