(function () {
  if (document.getElementById('site-nav')) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/site-nav.css';
  document.head.appendChild(link);
  var bar = document.createElement('nav');
  bar.id = 'site-nav';
  bar.setAttribute('aria-label', 'Site');
  var back = document.createElement('button');
  back.type = 'button';
  back.id = 'site-back';
  back.textContent = 'Back';
  var home = document.createElement('a');
  home.id = 'site-home';
  home.href = '/';
  home.textContent = 'Home';
  back.addEventListener('click', function () {
    if (history.length > 1) history.back();
    else location.assign('/');
  });
  bar.appendChild(back);
  bar.appendChild(home);
  document.body.prepend(bar);
  document.body.classList.add('has-site-nav');
})();
