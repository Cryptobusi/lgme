(function () {
  var MESSAGE = 'View only for now. Only Health can create, sign, post, credit, sync, or anchor.';

  function banner() {
    if (document.getElementById('view-only-banner')) return;
    var node = document.createElement('p');
    node.id = 'view-only-banner';
    node.className = 'view-only-banner';
    node.setAttribute('role', 'status');
    node.textContent = MESSAGE;
    document.body.insertBefore(node, document.body.firstChild);
  }

  function skip(node) {
    return Boolean(node.closest('nav, .tabbar, .tools, .menu-toggle, .view-switch, .deskmenu'));
  }

  function lock(root) {
    root.querySelectorAll('button, input, textarea, select').forEach(function (node) {
      if (skip(node) || node.dataset.viewOk === '1' || node.type === 'hidden') return;
      node.disabled = true;
      node.setAttribute('aria-disabled', 'true');
    });
  }

  function start() {
    banner();
    lock(document);
    new MutationObserver(function () { lock(document); }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
