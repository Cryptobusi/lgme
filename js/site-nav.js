(function () {
  var bar = document.getElementById('site-nav');
  if (!bar) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/site-nav.css';
    document.head.appendChild(link);
    bar = document.createElement('nav');
    bar.id = 'site-nav';
    bar.setAttribute('aria-label', 'Site');
    var back = document.createElement('button');
    back.type = 'button';
    back.id = 'site-back';
    back.textContent = 'Back';
    var home = document.createElement('a');
    home.id = 'site-home';
    home.href = '/?home=1';
    home.textContent = 'Home';
    bar.appendChild(back);
    bar.appendChild(home);
    document.body.prepend(bar);
  }
  document.documentElement.classList.add('has-site-nav');
  document.body.classList.add('has-site-nav');
  if (!document.querySelector('script[src="/js/local-ai-panel.mjs"]')) {
    var panel = document.createElement('script');
    panel.type = 'module';
    panel.src = '/js/local-ai-panel.mjs';
    document.body.appendChild(panel);
  }
  var backButton = bar.querySelector('#site-back');
  if (backButton && !backButton.dataset.bound) {
    backButton.dataset.bound = '1';
    backButton.addEventListener('click', function () {
      if (history.length > 1) history.back();
      else location.assign('/?home=1');
    });
  }
})();
