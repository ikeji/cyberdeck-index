(function () {
  var cards = [].slice.call(document.querySelectorAll('.card'));
  var chips = [].slice.call(document.querySelectorAll('.chip'));
  var input = document.getElementById('q');
  var count = document.getElementById('count');
  var site = '';
  function apply() {
    var q = input ? input.value.trim().toLowerCase() : '';
    var n = 0;
    cards.forEach(function (c) {
      var ok = (!site || c.dataset.site === site) && (!q || c.dataset.title.indexOf(q) >= 0);
      c.classList.toggle('hidden', !ok);
      if (ok) n++;
    });
    if (count) count.textContent = n + (n === 1 ? ' deck' : ' decks');
  }
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      site = b.dataset.site;
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      apply();
    });
  });
  if (input) input.addEventListener('input', apply);
})();
