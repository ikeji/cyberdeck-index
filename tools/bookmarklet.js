(function () {
  var O = '__ORIGIN__';
  var w = window.open(O + '/add#loading', 'cyberdeck_add');
  function done(p) {
    var s = btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    var u = O + '/add#' + s;
    if (w) { w.location.href = u; w.focus(); } else { location.href = u; }
  }
  function meta(n) {
    var e = document.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]');
    return e ? e.content : '';
  }
  function uniq(a) {
    var r = [];
    a.forEach(function (x) { if (x && r.indexOf(x) < 0) r.push(x); });
    return r;
  }
  var host = location.hostname;
  var P = { url: location.href.split('#')[0], title: document.title, images: [] };

  function generic() {
    P.title = meta('og:title') || document.title;
    var im = [meta('og:image'), meta('twitter:image')];
    [].slice.call(document.images).forEach(function (i) {
      if (i.naturalWidth >= 400 && i.naturalHeight >= 300) im.push(i.currentSrc || i.src);
    });
    P.images = uniq(im).slice(0, 12);
  }

  if (/(^|\.)reddit\.com$/.test(host) && /\/comments\//.test(location.pathname)) {
    var j = location.origin + location.pathname.replace(/\/?$/, '/') + '.json?raw_json=1';
    fetch(j, { credentials: 'include' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      var p = d[0].data.children[0].data;
      var q = (p.crosspost_parent_list && p.crosspost_parent_list[0]) || p;
      var im = [];
      if (q.is_gallery && q.gallery_data && q.media_metadata) {
        q.gallery_data.items.forEach(function (it) {
          var m = q.media_metadata[it.media_id];
          if (m && m.s) im.push(m.s.u || m.s.gif);
        });
      } else if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(q.url_overridden_by_dest || '')) {
        im.push(q.url_overridden_by_dest);
      } else if (q.preview && q.preview.images && q.preview.images[0]) {
        im.push(q.preview.images[0].source.url);
      }
      P.url = 'https://www.reddit.com' + p.permalink;
      P.title = p.title;
      P.images = uniq(im);
      done(P);
    }).catch(function () {
      generic();
      P.images = P.images.filter(function (u) { return /redd\.it\//.test(u); });
      done(P);
    });
    return;
  }

  var yt = location.hostname === 'youtu.be' ? location.pathname.slice(1) : (/(^|\.)youtube\.com$/.test(host) ? new URLSearchParams(location.search).get('v') : null);
  if (yt) {
    P.title = meta('og:title') || document.title.replace(/ - YouTube$/, '');
    P.images = ['https://img.youtube.com/vi/' + yt + '/maxresdefault.jpg'];
    done(P);
    return;
  }

  if (/^(www\.)?(x|twitter)\.com$/.test(host)) {
    var art = document.querySelector('article');
    var im = [];
    [].slice.call((art || document).querySelectorAll('img[src*="pbs.twimg.com/media/"]')).forEach(function (i) {
      im.push(i.src.replace(/([?&])name=\w+/, '$1name=large'));
    });
    P.images = uniq(im);
    done(P);
    return;
  }

  generic();
  done(P);
})();
