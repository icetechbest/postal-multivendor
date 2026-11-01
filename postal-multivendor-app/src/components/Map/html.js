// HTML page rendered inside the WebView. A tiny dependency-free slippy-map
// engine (Web Mercator, 256px raster tiles, drag / pinch / wheel, animations).
// It talks to React Native through window.ReactNativeWebView.postMessage and
// receives commands through window.__cmd(...).
//
// NOTE: keep this file ES5 and free of backticks / "${" inside BOOT.

const BOOT = `
(function () {
  var CFG = window.__CFG;
  var TILE = 256;
  var MAX_NATIVE = 19;
  var mapEl = document.getElementById('map');
  var layer = document.getElementById('layer');
  var W = mapEl.clientWidth, H = mapEl.clientHeight;

  function post(o) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---- projection (normalized web mercator, 0..1) ----
  function mx(lng) { return (lng + 180) / 360; }
  function my(lat) {
    lat = clamp(lat, -85.0511, 85.0511);
    var s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  function lngOf(x) { return x * 360 - 180; }
  function latOf(y) {
    var n = Math.PI - 2 * Math.PI * y;
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  // ---- view state ----
  var minZ = CFG.minZoom, maxZ = CFG.maxZoom;
  var cx = 0.5, cy = 0.5, z = 2;
  function scale() { return TILE * Math.pow(2, z); }
  function clampView() {
    z = clamp(z, minZ, maxZ);
    var half = (H / scale()) / 2;
    cy = half >= 0.5 ? 0.5 : clamp(cy, half, 1 - half);
    cx = ((cx % 1) + 1) % 1;
  }

  function state() { return { lat: latOf(cy), lng: lngOf(cx), zoom: z, w: W, h: H }; }
  function region() {
    var s = scale();
    var top = cy - (H / s) / 2, bottom = cy + (H / s) / 2;
    return {
      latitude: latOf(cy), longitude: lngOf(cx),
      latitudeDelta: Math.abs(latOf(top) - latOf(bottom)),
      longitudeDelta: (W / s) * 360
    };
  }

  // ---- tiles ----
  var tiles = {};      // key -> { img, tz, tx, ty, loaded }
  var pending = 0;
  var pruneTimer = 0;

  function tileUrl(tz, tx, ty) {
    var n = Math.pow(2, tz);
    var x = ((tx % n) + n) % n;
    return CFG.tileUrl
      .replace('{z}', tz).replace('{x}', x).replace('{y}', ty)
      .replace('{s}', 'abc'.charAt((x + ty) % 3));
  }

  function render() {
    var s = scale();
    var tz = clamp(Math.round(z), 0, MAX_NATIVE);
    var n = Math.pow(2, tz);
    var tsz = TILE * Math.pow(2, z - tz);
    var left = cx * s - W / 2, top = cy * s - H / 2;
    var x0 = Math.floor(left / tsz), x1 = Math.floor((left + W) / tsz);
    var y0 = Math.max(0, Math.floor(top / tsz)), y1 = Math.min(n - 1, Math.floor((top + H) / tsz));

    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var key = tz + '/' + tx + '/' + ty;
        if (!tiles[key]) {
          var img = document.createElement('img');
          img.draggable = false;
          img.style.zIndex = '2';
          var t = { img: img, tz: tz, tx: tx, ty: ty, loaded: false };
          pending++;
          (function (t) {
            t.img.onload = function () { t.loaded = true; t.img.style.opacity = '1'; done(); };
            t.img.onerror = function () { t.loaded = true; done(); };
          })(t);
          img.src = tileUrl(tz, tx, ty);
          layer.appendChild(img);
          tiles[key] = t;
        }
      }
    }

    for (var k in tiles) {
      var tl = tiles[k];
      var size = TILE * Math.pow(2, z - tl.tz);
      var px = tl.tx * size - left, py = tl.ty * size - top;
      var st = tl.img.style;
      st.width = size + 0.5 + 'px';
      st.height = size + 0.5 + 'px';
      st.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0)';
      st.zIndex = tl.tz === tz ? '2' : '1';
      if (tl.tz === tz) {
        // drop current-zoom tiles that are far outside the viewport
        if (tl.tx < x0 - 2 || tl.tx > x1 + 2 || tl.ty < y0 - 2 || tl.ty > y1 + 2) removeTile(k);
      }
    }
    schedulePrune(tz);
  }

  function removeTile(k) {
    var t = tiles[k];
    if (!t) return;
    if (!t.loaded) pending = Math.max(0, pending - 1);
    t.img.onload = t.img.onerror = null;
    if (t.img.parentNode) t.img.parentNode.removeChild(t.img);
    delete tiles[k];
  }
  function done() {
    pending = Math.max(0, pending - 1);
    schedulePrune();
  }
  function schedulePrune() {
    clearTimeout(pruneTimer);
    pruneTimer = setTimeout(function () {
      var tz = clamp(Math.round(z), 0, MAX_NATIVE);
      var allLoaded = true;
      for (var k in tiles) if (tiles[k].tz === tz && !tiles[k].loaded) allLoaded = false;
      if (!allLoaded) { schedulePrune(); return; }
      for (var k2 in tiles) if (tiles[k2].tz !== tz) removeTile(k2);
    }, 250);
  }

  // ---- change notifications ----
  var moveQueued = false;
  function notifyMove() {
    render();
    if (moveQueued) return;
    moveQueued = true;
    requestAnimationFrame(function () { moveQueued = false; post({ t: 'move', s: state() }); });
  }
  var silent = false;
  function notifyEnd() {
    render();
    if (silent) return;
    post({ t: 'end', s: state(), r: region() });
  }

  // ---- animation ----
  var anim = null;
  function stopAnim() { if (anim) { anim.cancelled = true; anim = null; } }
  function animateTo(tcx, tcy, tz, ms) {
    stopAnim();
    tz = clamp(tz, minZ, maxZ);
    if (!ms || ms < 16) {
      cx = tcx; cy = tcy; z = tz; clampView(); notifyEnd();
      return;
    }
    var a = { cancelled: false };
    anim = a;
    var sx = cx, sy = cy, sz = z, t0 = null;
    // take the shortest way around the antimeridian
    if (tcx - sx > 0.5) tcx -= 1; else if (sx - tcx > 0.5) tcx += 1;
    function step(ts) {
      if (a.cancelled) return;
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / ms);
      var e = 1 - Math.pow(1 - p, 3);
      cx = sx + (tcx - sx) * e; cy = sy + (tcy - sy) * e; z = sz + (tz - sz) * e;
      clampView();
      if (p < 1) { notifyMove(); requestAnimationFrame(step); }
      else { anim = null; notifyEnd(); }
    }
    requestAnimationFrame(step);
  }

  // zoom while keeping screen point (px,py) fixed
  function zoomAround(px, py, newZ) {
    newZ = clamp(newZ, minZ, maxZ);
    var s0 = scale();
    var wx = cx + (px - W / 2) / s0, wy = cy + (py - H / 2) / s0;
    z = newZ;
    var s1 = scale();
    cx = wx - (px - W / 2) / s1;
    cy = wy - (py - H / 2) / s1;
    clampView();
  }

  // ---- gestures ----
  var ptrs = {};
  var lastPinch = null;
  var downInfo = null;
  var vel = { x: 0, y: 0, t: 0 };
  var gestureMoved = false;

  function count() { var c = 0; for (var k in ptrs) c++; return c; }
  function two() {
    var a = [];
    for (var k in ptrs) a.push(ptrs[k]);
    return a;
  }

  mapEl.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('.ctl')) return;
    stopAnim();
    try { mapEl.setPointerCapture(e.pointerId); } catch (x) {}
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (count() === 1) {
      downInfo = { x: e.clientX, y: e.clientY, t: Date.now() };
      gestureMoved = false;
      vel = { x: 0, y: 0, t: Date.now() };
    }
    if (count() === 2) {
      var p = two();
      lastPinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2 };
    }
  });

  mapEl.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId];
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 8) gestureMoved = true;

    if (count() === 1 && CFG.scroll) {
      if (!gestureMoved) return;
      var s = scale();
      cx -= dx / s; cy -= dy / s;
      var now = Date.now(), dt = Math.max(1, now - vel.t);
      vel.x = 0.8 * vel.x + 0.2 * (dx / dt); vel.y = 0.8 * vel.y + 0.2 * (dy / dt); vel.t = now;
      clampView(); notifyMove();
    } else if (count() === 2 && lastPinch) {
      var q = two();
      var d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y);
      var mxp = (q[0].x + q[1].x) / 2, myp = (q[0].y + q[1].y) / 2;
      var r = mapEl.getBoundingClientRect();
      if (CFG.scroll) {
        var s2 = scale();
        cx -= (mxp - lastPinch.mx) / s2; cy -= (myp - lastPinch.my) / s2;
      }
      if (CFG.zoom && lastPinch.d > 0) zoomAround(mxp - r.left, myp - r.top, z + Math.log(d / lastPinch.d) / Math.LN2);
      lastPinch = { d: d, mx: mxp, my: myp };
      gestureMoved = true;
      clampView(); notifyMove();
    }
  });

  function endPointer(e) {
    var had = ptrs[e.pointerId];
    if (!had) return;
    delete ptrs[e.pointerId];
    var left = count();
    if (left === 1) {
      lastPinch = null;
      vel = { x: 0, y: 0, t: Date.now() };
      return;
    }
    if (left > 0) return;
    lastPinch = null;
    if (!gestureMoved && downInfo && e.type === 'pointerup' && Date.now() - downInfo.t < 600) {
      var r = mapEl.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top, s = scale();
      var wx = cx + (px - W / 2) / s, wy = cy + (py - H / 2) / s;
      post({ t: 'tap', lat: latOf(wy), lng: lngOf(wx) });
      return;
    }
    if (!gestureMoved) return;
    // inertia
    var speed = Math.hypot(vel.x, vel.y);
    if (CFG.scroll && speed > 0.15 && Date.now() - vel.t < 80) {
      var vx = vel.x, vy = vel.y, last = null;
      var a = { cancelled: false };
      stopAnim(); anim = a;
      (function step(ts) {
        if (a.cancelled) return;
        if (last === null) last = ts;
        var dt = Math.min(32, ts - last); last = ts;
        var s3 = scale();
        cx -= vx * dt / s3; cy -= vy * dt / s3;
        vx *= Math.pow(0.0025, dt / 1000); vy *= Math.pow(0.0025, dt / 1000);
        clampView();
        if (Math.hypot(vx, vy) > 0.02) { notifyMove(); requestAnimationFrame(step); }
        else { anim = null; notifyEnd(); }
      })(performance.now());
    } else {
      notifyEnd();
    }
  }
  mapEl.addEventListener('pointerup', endPointer);
  mapEl.addEventListener('pointercancel', endPointer);

  mapEl.addEventListener('wheel', function (e) {
    if (!CFG.zoom) return;
    e.preventDefault();
    var r = mapEl.getBoundingClientRect();
    zoomAround(e.clientX - r.left, e.clientY - r.top, z - e.deltaY / 300);
    notifyMove();
    clearTimeout(mapEl.__wt);
    mapEl.__wt = setTimeout(notifyEnd, 150);
  }, { passive: false });

  var booted = false;
  window.addEventListener('resize', function () {
    W = mapEl.clientWidth; H = mapEl.clientHeight;
    if (!booted) { boot(); return; }
    clampView(); notifyEnd();
  });

  // ---- zoom buttons / attribution ----
  if (CFG.zoomControl) {
    var box = document.createElement('div');
    box.className = 'ctl zoom';
    var plus = document.createElement('a'); plus.textContent = '+';
    var minus = document.createElement('a'); minus.textContent = String.fromCharCode(8722);
    plus.onclick = function () { animateTo(cx, cy, Math.round(z) + 1, 250); };
    minus.onclick = function () { animateTo(cx, cy, Math.round(z) - 1, 250); };
    box.appendChild(plus); box.appendChild(minus);
    mapEl.appendChild(box);
  }
  var attr = document.createElement('div');
  attr.className = 'ctl attr';
  attr.innerHTML = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  attr.querySelector('a').onclick = function (e) {
    e.preventDefault();
    post({ t: 'link', url: 'https://www.openstreetmap.org/copyright' });
  };
  mapEl.appendChild(attr);

  // ---- commands from React Native ----
  function fitBounds(minLat, minLng, maxLat, maxLng, pad, ms) {
    pad = pad || {};
    var pt = pad.top || 0, pb = pad.bottom || 0, pl = pad.left || 0, pr = pad.right || 0;
    var aw = Math.max(40, W - pl - pr), ah = Math.max(40, H - pt - pb);
    var x0 = mx(minLng), x1 = mx(maxLng), y0 = my(maxLat), y1 = my(minLat);
    var spanX = Math.max(x1 - x0, 1e-9), spanY = Math.max(y1 - y0, 1e-9);
    var zz = Math.min(Math.log(aw / (TILE * spanX)) / Math.LN2, Math.log(ah / (TILE * spanY)) / Math.LN2);
    zz = clamp(zz, minZ, maxZ);
    var s = TILE * Math.pow(2, zz);
    var bx = (x0 + x1) / 2, by = (y0 + y1) / 2;
    // shift so the box centre lands in the middle of the padded area
    var tcx = bx + (W / 2 - (pl + aw / 2)) / s;
    var tcy = by + (H / 2 - (pt + ah / 2)) / s;
    animateTo(tcx, tcy, zz, ms);
  }

  // react-native-maps semantics: the region centre stays the centre, the zoom
  // is the largest one that still shows the whole lat/lng span.
  function fitRegion(r, ms) {
    var lat0 = clamp(r.latitude - r.latitudeDelta / 2, -85, 85), lat1 = clamp(r.latitude + r.latitudeDelta / 2, -85, 85);
    var spanY = 2 * Math.max(Math.abs(my(r.latitude) - my(lat0)), Math.abs(my(lat1) - my(r.latitude)), 1e-9);
    var spanX = Math.max(Math.abs(r.longitudeDelta) / 360, 1e-9);
    var zz = Math.min(Math.log(W / (TILE * spanX)) / Math.LN2, Math.log(H / (TILE * spanY)) / Math.LN2);
    animateTo(mx(r.longitude), my(r.latitude), clamp(zz, minZ, maxZ), ms);
  }

  window.__cmd = function (c) {
    if (c.k === 'region') {
      fitRegion(c.r, c.ms);
    } else if (c.k === 'camera') {
      animateTo(mx(c.lng), my(c.lat), c.zoom == null ? z : c.zoom, c.ms);
    } else if (c.k === 'fit') {
      var pts = c.pts || [];
      if (!pts.length) return;
      var a = 90, b = -90, d = 180, f = -180, i;
      for (i = 0; i < pts.length; i++) {
        a = Math.min(a, pts[i].latitude); b = Math.max(b, pts[i].latitude);
        d = Math.min(d, pts[i].longitude); f = Math.max(f, pts[i].longitude);
      }
      if (pts.length === 1 || (a === b && d === f)) animateTo(mx(d), my(a), 15, c.ms);
      else fitBounds(a, d, b, f, c.pad, c.ms);
    } else if (c.k === 'dark') {
      document.body.className = c.v ? 'dark' : '';
    }
  };

  // ---- boot ----
  document.body.className = CFG.dark ? 'dark' : '';
  function boot() {
    if (booted || !W || !H) return;
    booted = true;
    silent = true;
    fitRegion(CFG.region, 0);
    silent = false;
    post({ t: 'ready', s: state(), r: region() });
  }
  boot();
})();
`

const STYLE = `
html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#e5e3df;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#map{position:relative;touch-action:none;font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif}
#layer{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden}
#layer img{position:absolute;left:0;top:0;max-width:none;pointer-events:none;will-change:transform}
.dark #layer img{filter:invert(1) hue-rotate(180deg) brightness(.95) contrast(.9)}
.dark #map{background:#2b2b2b}
.ctl{position:absolute;z-index:10}
.attr{left:0;bottom:0;font-size:10px;padding:1px 5px;background:rgba(255,255,255,.75);color:#333;border-top-right-radius:4px}
.attr a{color:#0b5cad;text-decoration:none}
.zoom{right:10px;top:10px;display:flex;flex-direction:column;box-shadow:0 1px 5px rgba(0,0,0,.4);border-radius:4px;overflow:hidden}
.zoom a{width:34px;height:34px;line-height:34px;text-align:center;background:#fff;color:#222;font:bold 20px/34px sans-serif;cursor:pointer}
.zoom a+a{border-top:1px solid #ccc}
`

export default function buildHtml(cfg) {
  // "<" is escaped so the config can never close the <script> tag.
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c')
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>' + STYLE + '</style></head><body>' +
    '<div id="map"><div id="layer"></div></div>' +
    '<script>window.__CFG=' + json + ';</script>' +
    '<script>' + BOOT + '</script></body></html>'
  )
}
