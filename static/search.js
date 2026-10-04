(function () {
  var app = document.getElementById('app');
  var base = app.dataset.base;
  var input = document.getElementById('q');
  var out = document.getElementById('results');

  // 英数は単語、CJK は bigram(1文字のみの場合は unigram)
  function tokenize(text) {
    var t = String(text).toLowerCase();
    var tokens = [];
    var re = /[a-z0-9_.\-]+|[぀-ヿ㐀-鿿ｦ-ﾟ]+/g, m;
    while ((m = re.exec(t))) {
      var s = m[0];
      if (/^[a-z0-9]/.test(s)) { tokens.push(s); continue; }
      if (s.length === 1) tokens.push(s);
      for (var i = 0; i < s.length - 1; i++) tokens.push(s.slice(i, i + 2));
    }
    return tokens;
  }
  var opts = { fields: ['title', 'text'], storeFields: ['title', 'url', 'site'], tokenize: tokenize, searchOptions: { boost: { title: 3 }, prefix: true, combineWith: 'AND' } };

  fetch(base + 'search-index.json').then(function (r) { return r.json(); }).then(function (docs) {
    var ms = new MiniSearch(opts);
    ms.addAll(docs);
    function render() {
      var q = input.value.trim();
      var hits = q ? ms.search(q).slice(0, 100) : [];
      out.innerHTML = '';
      hits.forEach(function (h) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = base + h.url; a.textContent = h.title;
        li.appendChild(a);
        if (h.site) { var s = document.createElement('small'); s.textContent = ' ' + h.site; li.appendChild(s); }
        out.appendChild(li);
      });
      if (q && !hits.length) out.innerHTML = '<li>No results</li>';
    }
    input.addEventListener('input', render);
    var p = new URLSearchParams(location.search).get('q');
    if (p) { input.value = p; render(); }
  });
})();
