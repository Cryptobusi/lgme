(function () {
  var path = location.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (/^\/(exchange|campus|mutual-credit)(\.html)?$/.test(path)) return;
  var key = 'lgme.visit.notice';
  try { if (localStorage.getItem(key) === '1') return; } catch (error) { return; }
  if (!document.querySelector('link[href="/css/visit-notice.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/visit-notice.css';
    document.head.appendChild(link);
  }
  var bar = document.createElement('aside');
  bar.id = 'visit-notice';
  bar.setAttribute('role', 'note');
  var text = document.createElement('p');
  text.append('This browser can send the owner one visit note a day. It is not sold. ');
  var privacy = document.createElement('a');
  privacy.href = '/privacy';
  privacy.textContent = 'Privacy';
  text.append(privacy);
  var button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Dismiss';
  button.addEventListener('click', function () {
    try { localStorage.setItem(key, '1'); } catch (error) { /* private window */ }
    bar.remove();
  });
  bar.append(text, button);
  var anchor = document.getElementById('testnet-notice');
  if (anchor) anchor.insertAdjacentElement('afterend', bar);
  else document.body.insertBefore(bar, document.body.firstChild);
})();
