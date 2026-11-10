(function () {
  document.querySelectorAll('[data-preview-note]').forEach(function (button) {
    button.addEventListener('click', function () {
      var name = button.getAttribute('data-preview-note') || 'preview';
      var notes = {};
      try { notes = JSON.parse(localStorage.getItem('lgme.preview.note') || '{}'); } catch (error) { notes = {}; }
      notes[name] = 'Tell me when it opens';
      try { localStorage.setItem('lgme.preview.note', JSON.stringify(notes)); } catch (error) { /* the note stays on the button */ }
      button.textContent = 'Noted on this phone.';
    });
  });
})();
