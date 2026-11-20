(function () {
  var root = document.documentElement;
  var bar = document.getElementById('testnet-notice');
  if (!bar) return;
  function slim(on) {
    root.classList.toggle('notice-slim', on);
    var close = document.getElementById('notice-x');
    if (close) close.setAttribute('aria-label', on ? 'Show the notice' : 'Hide the notice');
    try { localStorage.setItem('lgme.notice.slim', on ? '1' : '0'); } catch (error) { /* the bar still moves */ }
  }
  document.getElementById('notice-x').addEventListener('click', function (event) {
    event.stopPropagation();
    slim(!root.classList.contains('notice-slim'));
  });
  bar.addEventListener('click', function () {
    if (root.classList.contains('notice-slim')) slim(false);
  });
  if (root.classList.contains('notice-slim')) return;
  var done = false;
  var finish = function () { if (done) return; done = true; slim(true); };
  setTimeout(finish, 5000);
  window.addEventListener('scroll', function () { if (window.scrollY > 24) finish(); }, { passive: true });
})();
