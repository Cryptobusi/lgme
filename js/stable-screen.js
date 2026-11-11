(function () {
  var root = document.documentElement;
  root.classList.add('has-site-nav');
  var path = location.pathname;
  var home = path === '/' || path === '/index.html';
  if (!home) return;
  var member = null;
  try { member = localStorage.getItem('lgme.demo.member'); } catch (error) { member = null; }
  if (!member) root.classList.add('demo-gate');
  else root.classList.add('demo-member');
})();
