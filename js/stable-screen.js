(function () {
  var root = document.documentElement;
  root.classList.add('has-site-nav');
  try {
    var pending = JSON.parse(sessionStorage.getItem('lgme.demo.pending') || 'null');
    if (pending && pending.step && pending.step !== 'home') root.classList.add('demo-form');
  } catch (error) { /* a broken note does not open the form */ }
})();
