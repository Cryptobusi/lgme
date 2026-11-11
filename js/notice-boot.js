(function () {
  try {
    var size = localStorage.getItem('lgme.top.size') || 'normal';
    if (size !== 'compact' && size !== 'tall') size = 'normal';
    document.documentElement.classList.add('top-' + size);
    if (localStorage.getItem('lgme.notice.slim') === '1') document.documentElement.classList.add('notice-slim');
  } catch (error) { /* the full notice still shows */ }
})();
