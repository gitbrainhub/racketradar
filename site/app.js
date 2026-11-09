(function () {
  'use strict';

  /* ---------- settings you may want to tweak ---------- */
  var TARIFF_RATE = 0.15;       // rough guess for US tariffs on Yumo (Canada) orders. The real amount shows at Yumo's checkout.
  var FREE_LIMIT = 3;
  var PAGE = 24;

  /* ---------- shipping rules (checked Nov 2026 from each store's own policy pages) ---------- */
  // sure: 1 = confirmed from the store's policy, 0 = estimate
  var RULES = {
    joy:       { us: function (p) { return { v: p >= 150 ? 0 : 15, sure: 1 }; }, ca: null },
    corner:    { us: function ()  { return { v: 10, sure: 0 }; }, ca: null },
    warehouse: { us: function ()  { return { v: 0, sure: 1 }; }, ca: null },
    avenue:    { us: function (p) { return p >= 150 ? { v: 0, sure: 1 } : { v: 15, sure: 0 }; }, ca: function () { return { v: 35, sure: 1 }; } },
    yumo:      { fromCA: true }   // Canadian dollars: US free over C$350, C$15 over C$250, else C$35. Canada free over C$200, else C$24.
  };

  /* ---------- rough average sales tax (state plus local), percent ---------- */
  var US = { AL: ['Alabama', 9.46], AK: ['Alaska', 1.82], AZ: ['Arizona', 8.4], AR: ['Arkansas', 9.46], CA: ['California', 8.85], CO: ['Colorado', 7.78], CT: ['Connecticut', 6.35], DE: ['Delaware', 0], DC: ['District of Columbia', 6], FL: ['Florida', 6.98], GA: ['Georgia', 7.42], HI: ['Hawaii', 4.5], ID: ['Idaho', 6.03], IL: ['Illinois', 8.87], IN: ['Indiana', 7], IA: ['Iowa', 6.94], KS: ['Kansas', 8.68], KY: ['Kentucky', 6], LA: ['Louisiana', 10.11], ME: ['Maine', 5.5], MD: ['Maryland', 6], MA: ['Massachusetts', 6.25], MI: ['Michigan', 6], MN: ['Minnesota', 7.49], MS: ['Mississippi', 7.06], MO: ['Missouri', 8.4], MT: ['Montana', 0], NE: ['Nebraska', 6.97], NV: ['Nevada', 8.23], NH: ['New Hampshire', 0], NJ: ['New Jersey', 6.6], NM: ['New Mexico', 7.62], NY: ['New York', 8.53], NC: ['North Carolina', 6.99], ND: ['North Dakota', 7.04], OH: ['Ohio', 7.24], OK: ['Oklahoma', 8.98], OR: ['Oregon', 0], PA: ['Pennsylvania', 6.34], RI: ['Rhode Island', 7], SC: ['South Carolina', 7.46], SD: ['South Dakota', 6.11], TN: ['Tennessee', 9.61], TX: ['Texas', 8.19], UT: ['Utah', 7.25], VT: ['Vermont', 6.39], VA: ['Virginia', 5.77], WA: ['Washington', 9.43], WV: ['West Virginia', 6.57], WI: ['Wisconsin', 5.7], WY: ['Wyoming', 5.46] };
  var CA = { AB: ['Alberta', 5], BC: ['British Columbia', 12], MB: ['Manitoba', 12], NB: ['New Brunswick', 15], NL: ['Newfoundland and Labrador', 15], NS: ['Nova Scotia', 14], NT: ['Northwest Territories', 5], NU: ['Nunavut', 5], ON: ['Ontario', 13], PE: ['Prince Edward Island', 15], QC: ['Quebec', 14.975], SK: ['Saskatchewan', 11], YT: ['Yukon', 5] };

  /* ---------- words on the page: made by tools/build_i18n.py into i18n.js ---------- */
  var T = window.RR_T || { en: {} }, LANGS = window.RR_LANGS || { en: 'English' }, NAMES = window.RR_NAMES || {};
  var BAL = { 'head heavy': 'sHH', 'head light': 'sHL', 'headlight': 'sHL', 'even balance': 'sEB' };
  var GRD = { beginner: 'sBeg', intermediate: 'sInt', advanced: 'sAdv', pro: 'sPro' };
  function tipFor(label) {
    var k = { '4u': 'g4u', 'head heavy': 'ghh', 'head light': 'ghl', 'headlight': 'ghl', 'even balance': 'tipEB' }[String(label).toLowerCase()];
    return k ? t(k) : '';
  }
  /* racket and brand names in Chinese (English line names are swapped for the Chinese ones people use) */
  function imgUrl(u, w) { return /cdn\.shopify\.com/.test(u) ? u + '?width=' + w : u; }
  var RACKET_ICON = '<svg viewBox="0 0 24 44" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="2" width="20" height="40"/><line x1="2" y1="22" x2="22" y2="22"/><line x1="12" y1="2" x2="12" y2="42"/></svg>';
  function thumbHtml(it) {
    if (!it.image) return '<div class="thumb none">' + RACKET_ICON + '</div>';
    return '<button type="button" class="thumb" data-action="zoom" data-id="' + esc(it.id) + '" aria-label="' + esc(localName(it)) + '"><img src="' + esc(imgUrl(it.image, 720)) + '" srcset="' + esc(imgUrl(it.image, 480)) + ' 480w, ' + esc(imgUrl(it.image, 720)) + ' 720w, ' + esc(imgUrl(it.image, 1100)) + ' 1100w" sizes="(max-width: 700px) 92vw, 340px" alt="' + esc(brandName(it.brand) + ' ' + localName(it)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>';
  }
  function brandName(b) { var m = NAMES[prefs.lang]; return (m && m.brands[b]) || b; }
  function localName(it) {
    var m = NAMES[prefs.lang]; if (!m) return it.name;
    var n = it.name;
    m.lines.forEach(function (p) { n = n.replace(new RegExp('\\b' + p[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), p[1]); });
    return n;
  }


  /* chart styles live here so they always match this script */
  (function () {
    var s = document.createElement('style');
    s.textContent = '.card{grid-template-columns:minmax(0,1fr)}.hist,.hist-main,.hist-store,.hist-chart,.chart-scroll{min-width:0;max-width:100%}.chart-frame{position:relative;margin-top:6px}.chart-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '.chart-wrap{position:relative}' +
      '.chart{width:100%;height:auto;display:block;overflow:visible;cursor:default;touch-action:pan-x pan-y}' +
      '.chart .grid{stroke:var(--line);stroke-width:1}.chart .axis{stroke:var(--ink-2);stroke-width:1.4}' +
      '.chart .ln{fill:none;stroke:var(--court);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}' +
      '.chart .pt{fill:var(--surface);stroke:var(--court);stroke-width:2.2}' +
      '.chart .hl{fill:var(--court);stroke:var(--surface);stroke-width:2.5}' +
      '.chart text{font:400 10px var(--font-mono);fill:var(--ink-2)}' +
      '.tip{position:absolute;transform:translate(-50%,calc(-100% - 14px));background:#16231c;color:#fff;border-radius:10px;padding:7px 12px;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;white-space:nowrap;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.25);line-height:1.2}' +
      '.tip::after{content:"";position:absolute;left:50%;bottom:-5px;width:10px;height:10px;background:#16231c;transform:translateX(-50%) rotate(45deg);border-radius:2px}' +
      '.tip[hidden]{display:none}.tip strong{font:600 15px var(--font-mono);letter-spacing:.01em}.tip span{font:400 12px var(--font-body);opacity:.8}';
    document.head.appendChild(s);
  })();

  /* ---------- state ---------- */
  var STORES = {}, ITEMS = [], FX = 0.71, loaded = false, updatedISO = '';
  var prefs = loadPrefs();
  var openHist = {}, lockId = '';
  var premium = false, brand = 'All', shown = PAGE, limitId = '', limitMsgKey = '', targets = {};
  var watch = loadWatch();

  function $(s) { return document.querySelector(s); }
  function t(k, v) { var s = (T[prefs.lang] && T[prefs.lang][k]) || (T.en && T.en[k]) || k; if (v) Object.keys(v).forEach(function (n) { s = s.replace('{' + n + '}', v[n]); }); return s; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function byId(id) { return ITEMS.filter(function (i) { return i.id === id; })[0]; }

  function pickLang(l) {
    l = String(l || 'en').toLowerCase();
    if (/^zh/.test(l)) return /hant|-tw|-hk|-mo/.test(l) ? 'zh-TW' : 'zh';
    var base = l.split('-')[0];
    return T[base] ? base : 'en';
  }
  function loadPrefs() {
    var p = { lang: 'en', country: 'US', region: '' };
    try {
      var l = (navigator.language || 'en').toLowerCase();
      p.lang = pickLang(l);
      if (/-ca$/.test(l)) p.country = 'CA';
      var s = JSON.parse(localStorage.getItem('rr-prefs'));
      if (s && typeof s === 'object') { if (T[s.lang]) p.lang = s.lang; p.country = s.country === 'CA' ? 'CA' : 'US'; p.region = typeof s.region === 'string' ? s.region : ''; }
    } catch (e) {}
    return p;
  }
  function savePrefs() { try { localStorage.setItem('rr-prefs', JSON.stringify(prefs)); } catch (e) {} }
  function loadWatch() { try { var v = JSON.parse(localStorage.getItem('rr-watch')); if (Array.isArray(v)) return v; } catch (e) {} return []; }
  function saveWatch() { try { localStorage.setItem('rr-watch', JSON.stringify(watch)); } catch (e) {} }

  /* ---------- money ---------- */
  function cur() { return prefs.country === 'CA' ? 'CAD' : 'USD'; }
  function money(usd) {
    var n = cur() === 'CAD' ? usd / FX : usd;
    return (cur() === 'CAD' ? 'C$' : '$') + n.toFixed(2);
  }
  function regionTable() { return prefs.country === 'CA' ? CA : US; }
  function taxRate() { var r = regionTable()[prefs.region]; return r ? r[1] / 100 : 0; }
  function totalsOn() { return !!prefs.region && regionTable()[prefs.region] && !(prefs.country === 'US' && (prefs.region === 'AK' || prefs.region === 'HI')); }

  /* what one racket really costs you: { total, parts: [[label, usd]], sure, note } or null if unknown */
  function totalFor(it, key) {
    var o = it.prices[key]; if (!o) return null;
    var p = o.now, r = RULES[key] || {}, ship = 0, sure = 1, tax = 0, tariff = 0, note = '', cad = p / FX;
    if (r.fromCA) {
      if (prefs.country === 'US') {
        ship = (cad >= 350 ? 0 : (cad >= 250 ? 15 : 35)) * FX;
        tariff = p * TARIFF_RATE; sure = 0;
      } else {
        ship = (cad >= 200 ? 0 : 24) * FX;
        tax = (p + ship) * taxRate();
      }
    } else if (prefs.country === 'US') {
      var s = r.us ? r.us(p) : { v: 10, sure: 0 };
      ship = s.v; sure = s.sure; tax = (p + ship) * taxRate();
    } else {
      if (!r.ca) return { unknown: true };
      var c = r.ca(); ship = c.v; sure = c.sure; note = 'importTax';
    }
    return { total: p + ship + tax + tariff, ship: ship, tax: tax, tariff: tariff, sure: sure, note: note };
  }

  /* cheapest in-stock store: by estimated total when totals are on, else by listed price */
  function best(it) {
    var b = null, on = totalsOn();
    Object.keys(STORES).forEach(function (k) {
      var p = it.prices[k]; if (!p || !p.stock) return;
      var amount = p.now;
      if (on) { var tt = totalFor(it, k); if (!tt || tt.unknown) return; amount = tt.total; }
      if (!b || amount < b.amount) b = { key: k, amount: amount, now: p.now, was: p.was, path: p.path };
    });
    if (!b && on) { // nothing has a computable total: fall back to listed price
      Object.keys(STORES).forEach(function (k) { var p = it.prices[k]; if (p && p.stock && (!b || p.now < b.amount)) b = { key: k, amount: p.now, now: p.now, was: p.was, path: p.path, noTotal: true }; });
    }
    return b;
  }
  function storeUrl(it, key) { var p = it.prices[key]; return p.path ? STORES[key].home + p.path : STORES[key].home; }
  function topDiscount(it) { var d = 0; Object.keys(it.prices).forEach(function (k) { var p = it.prices[k]; if (p.was) d = Math.max(d, 1 - p.now / p.was); }); return d; }

  /* ---------- tiny price chart ---------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function realHistory(it, key) { var h = it.history && it.history[key]; return h && h.length >= 2 ? h : null; }
  function spark(hist) {
    var pts = hist.map(function (x) { return x[1]; }), N = pts.length;
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), W = 200, H = 44, pad = 6;
    var xy = pts.map(function (p, i) { return [(i / (N - 1)) * (W - 2 * pad) + pad, H - pad - ((p - lo) / (hi - lo || 1)) * (H - 2 * pad)]; });
    var line = xy.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    var area = line + ' ' + xy[N - 1][0].toFixed(1) + ',' + H + ' ' + xy[0][0].toFixed(1) + ',' + H;
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('realHist', { d: hist[0][0] })) + '">' +
      '<polygon class="area" points="' + area + '"/><polyline class="line" points="' + line + '"/>' +
      '<circle class="dot" cx="' + xy[N - 1][0].toFixed(1) + '" cy="' + xy[N - 1][1].toFixed(1) + '" r="3.5"/></svg>' +
      '<p class="spark-cap">' + esc(t('realHist', { d: hist[0][0] })) + '. ' + esc(t('lowHigh', { l: money(lo), h: money(hi) })) + '</p>';
  }

  /* ---------- price history: a real chart, lowest-ever line, other stores tucked away ---------- */
  function dayMs(d) { return new Date(d + 'T12:00:00').getTime(); }
  function shortDate(ms) { return new Date(ms).toLocaleDateString(prefs.lang === 'zh' ? 'zh-CN' : prefs.lang, { month: 'short', day: 'numeric' }); }
  function longDate(d) { return new Date(dayMs(d)).toLocaleDateString(prefs.lang === 'zh' ? 'zh-CN' : prefs.lang, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function niceTicks(lo, hi, n) {
    if (hi - lo < 1e-9) { var pad = Math.max(1, Math.abs(hi) * 0.06); lo -= pad; hi += pad; }
    var raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
    var a0 = Math.floor(lo / step) * step, b0 = Math.ceil(hi / step) * step, out = [];
    for (var v = a0; v <= b0 + step / 2; v += step) out.push(Math.round(v * 100) / 100);
    return { ticks: out, step: step };
  }
  function chartSvg(hist, label) {
    var L = 50, R = 16, T = 14, B = 34, H = 190, PER = 34;                                  // PER: pixels per data point before the chart starts to scroll
    var u = cur() === 'CAD' ? 1 / FX : 1, sym = cur() === 'CAD' ? 'C$' : '$';
    var pts = hist.map(function (x) { return { t: dayMs(x[0]), v: x[1] * u, d: x[0] }; });
    var W = Math.max(320, L + R + pts.length * PER);
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t; if (t1 - t0 < 5 * 864e5) t1 = t0 + 5 * 864e5;   // time starts at the first recorded day, at the far left
    var vals = pts.map(function (q) { return q.v; }), nt = niceTicks(Math.min.apply(null, vals), Math.max.apply(null, vals), 4);
    var lo = nt.ticks[0], hi = nt.ticks[nt.ticks.length - 1], dec = nt.step >= 1 ? 0 : 2;
    function X(t) { return L + (t - t0) / (t1 - t0) * (W - L - R); }
    function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var g = '';
    nt.ticks.forEach(function (v) {
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="ylab" x="' + (L - 7) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(sym + v.toFixed(dec)) + '</text>';
    });
    var days = Math.round((t1 - t0) / 864e5), nx = Math.max(1, Math.min(days, Math.floor((W - L - R) / 72))), xt = [];
    for (var k = 0; k <= nx; k++) xt.push(t0 + (t1 - t0) * k / nx);
    xt.forEach(function (t, k) {
      g += '<line class="grid v" x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '"/><text class="xlab" x="' + X(t).toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="' + (k === 0 ? 'start' : k === nx ? 'end' : 'middle') + '">' + esc(shortDate(t)) + '</text>';
    });
    var path = pts.map(function (q, i) { return (i ? 'L' : 'M') + X(q.t).toFixed(1) + ' ' + Y(q.v).toFixed(1); }).join(' ');
    var dots = pts.length <= 60 ? pts.map(function (q) { return '<circle class="pt" cx="' + X(q.t).toFixed(1) + '" cy="' + Y(q.v).toFixed(1) + '" r="3.6"/>'; }).join('') : '';
    var data = pts.map(function (q) { return [+X(q.t).toFixed(1), +Y(q.v).toFixed(1), longDate(q.d), sym + q.v.toFixed(2)]; });
    return '<div class="chart-frame"><div class="chart-scroll"><div class="chart-wrap" style="min-width:' + W + 'px"><svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '" data-pts="' + esc(JSON.stringify(data)) + '" data-w="' + W + '" data-h="' + H + '">' + g +
      '<line class="axis" x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (H - B) + '"/><line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>' +
      '<path class="ln" d="' + path + '"/>' + dots + '<circle class="hl" r="6" style="display:none"></circle></svg></div></div><div class="tip" hidden></div></div>';
  }
  function showTip(svg, e, reach) {
    var data = svg._pts || (svg._pts = JSON.parse(svg.getAttribute('data-pts'))), r = svg.getBoundingClientRect();
    var W = +svg.getAttribute('data-w'), H = +svg.getAttribute('data-h'), k = r.width / W;                     // screen pixels per chart unit
    var x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, best = null, bd = 1e9;
    data.forEach(function (p) { var d = Math.sqrt(Math.pow((p[0] - x) * k, 2) + Math.pow((p[1] - y) * k, 2)); if (d < bd) { bd = d; best = p; } });
    if (!best || bd > reach) { hideTip(svg); return; }                                                      // only react when the cursor is actually close to a dot
    var hl = svg.querySelector('.hl'); hl.setAttribute('cx', best[0]); hl.setAttribute('cy', best[1]); hl.style.display = '';
    var frame = svg.closest('.chart-frame'), tip = frame.querySelector('.tip'), f = frame.getBoundingClientRect();
    tip.innerHTML = '<strong>' + esc(best[3]) + '</strong><span>' + esc(best[2]) + '</span>'; tip.hidden = false;
    tip.style.left = Math.min(f.width - 58, Math.max(58, r.left + best[0] * k - f.left)) + 'px'; tip.style.top = (r.top + best[1] * k - f.top) + 'px';
  }
  function hideTip(svg) { var hl = svg.querySelector('.hl'); if (hl) hl.style.display = 'none'; var fr = svg.closest('.chart-frame'), tip = fr && fr.querySelector('.tip'); if (tip) tip.hidden = true; }
  function scrollCharts() {                                                                                    // long charts open showing the newest data
    Array.prototype.forEach.call(document.querySelectorAll('.chart-scroll'), function (s) { if (s.scrollWidth > s.clientWidth && !s._done) { s.scrollLeft = s.scrollWidth; s._done = true; } });
  }
  document.addEventListener('pointermove', function (e) { var s = e.target.closest && e.target.closest('svg.chart'); if (s && e.pointerType === 'mouse') showTip(s, e, 22); });
  document.addEventListener('pointerout', function (e) { var s = e.target.closest && e.target.closest('svg.chart'); if (s && e.pointerType === 'mouse' && !(e.relatedTarget && s.contains(e.relatedTarget))) hideTip(s); });
  document.addEventListener('click', function (e) { var s = e.target.closest && e.target.closest('svg.chart'); if (s) showTip(s, e, 24); });
  document.addEventListener('scroll', function (e) { var s = e.target.querySelector && e.target.querySelector('svg.chart'); if (s && e.target.classList && e.target.classList.contains('chart-scroll')) hideTip(s); }, true);
  function storeChart(it, k) {
    var raw = it.history && it.history[k], p = it.prices[k];
    if (!raw || !raw.length) raw = [[(updatedISO || '').slice(0, 10) || new Date().toISOString().slice(0, 10), p.now]];
    var vals = raw.map(function (x) { return x[1]; });
    return chartSvg(raw, STORES[k].name) + (raw.length >= 2 ? '<p class="spark-cap">' + esc(t('lowHigh', { l: money(Math.min.apply(null, vals)), h: money(Math.max.apply(null, vals)) })) + '</p>' : '<p class="spark-cap">' + esc(t('histStart')) + '</p>');
  }
  function histBlock(it) {
    var keys = Object.keys(STORES).filter(function (k) { return it.prices[k]; });
    if (!keys.length) return '';
    // lowest price ever recorded, over every store
    var low = null;
    keys.forEach(function (k) {
      var h = (it.history && it.history[k] && it.history[k].length) ? it.history[k] : [[(updatedISO || '').slice(0, 10), it.prices[k].now]];
      h.forEach(function (x) { if (x[1] > 0 && (!low || x[1] < low.p || (x[1] === low.p && x[0] < low.d))) low = { p: x[1], d: x[0], k: k }; });
    });
    var b = best(it), main = (b && b.key) || keys[0];
    var html = '<div class="hist">';
    if (low) html += '<p class="hist-low">' + esc(t('histLowest', { p: money(low.p), s: STORES[low.k].name, d: low.d ? longDate(low.d) : '' })) + '</p>';
    html += '<div class="hist-main"><strong>' + esc(STORES[main].name) + '</strong>' + storeChart(it, main) + '</div>';
    var others = keys.filter(function (k) { return k !== main; });
    if (others.length) {
      html += '<p class="hist-more">' + esc(t('histMore')) + '</p>';
      others.forEach(function (k) {
        html += '<div class="hist-store"><button type="button" class="hist-toggle" data-action="histstore" aria-expanded="false"><span>' + esc(STORES[k].name) + '</span><span class="hprice">' + esc(money(it.prices[k].now)) + ' ▾</span></button><div class="hist-chart">' + storeChart(it, k) + '</div></div>';
      });
    }
    return html + '</div>';
  }

  /* ---------- watchlist ---------- */
  function watchCard(it) {
    var b = best(it);
    if (targets[it.id] == null && b) targets[it.id] = Math.floor((cur() === 'CAD' ? b.now / FX : b.now) * 0.9);
    var priceHtml = b
      ? '<span class="big">' + money(b.now) + '</span><span class="at">' + esc(t('at', { s: STORES[b.key].name })) + '</span>'
      : '<span class="at">' + esc(t('outAll')) + '</span>';
    var extra;
    if (premium && b) {
      var hist = realHistory(it, b.key);
      extra = (hist ? spark(hist) : '<p class="spark-cap">' + esc(t('histStart')) + '</p>') +
        '<div class="alert-row"><label for="t-' + esc(it.id) + '">' + esc(t('alertBelow')) + '</label>' +
        '<span class="money-in">' + (cur() === 'CAD' ? 'C$' : '$') + '<input id="t-' + esc(it.id) + '" class="target-input" data-id="' + esc(it.id) + '" type="number" inputmode="decimal" min="0" step="1" value="' + targets[it.id] + '"></span>' +
        '<span class="chip" id="hit-' + esc(it.id) + '"' + ((cur() === 'CAD' ? b.now / FX : b.now) <= targets[it.id] ? '' : ' hidden') + '>' + esc(t('hit')) + '</span>' +
        '<span class="at">' + esc(t('alertsOn')) + '</span></div>';
    } else extra = '<p class="locked">' + esc(t('lockedHist')) + '</p>';
    return '<li class="wcard"><div class="wtop"><div>' + (it.image ? '<img class="wthumb" src="' + esc(imgUrl(it.image, 120)) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '<div><span class="brand">' + esc(brandName(it.brand)) + '</span><h3>' + esc(localName(it)) + '</h3></div></div>' +
      '<button class="link-btn" type="button" data-action="remove" data-id="' + esc(it.id) + '" aria-label="' + esc(t('remove') + ' ' + localName(it)) + '">' + esc(t('remove')) + '</button></div>' +
      '<div class="wprice">' + priceHtml + '</div>' + extra + '</li>';
  }
  function renderWatch() {
    var items = watch.map(byId).filter(Boolean);
    var html = items.map(watchCard).join('');
    if (!premium) { for (var i = items.length; i < FREE_LIMIT; i++) html += '<li class="slot">' + esc(t('openSlot')) + '</li>'; }
    else if (!items.length) html = '<li class="slot">' + esc(t('emptyPrem')) + '</li>';
    $('#watch-list').innerHTML = html;
    $('#watch-count').textContent = premium ? t('watching', { n: items.length }) : t('slots', { n: items.length, m: FREE_LIMIT });
    $('#watch-sub').textContent = premium ? t('subPrem') : t('subFree');
    var note = $('#limit-note'); note.hidden = !limitMsgKey; $('#limit-text').textContent = limitMsgKey ? t(limitMsgKey) : '';
    $('#upgrade').hidden = premium;
  }

  /* ---------- racket cards ---------- */
  function rowHtml(it, k, b, on) {
    var p = it.prices[k], s = STORES[k]; if (!p) return '';
    var isBest = b && b.key === k, tt = on && p.stock ? totalFor(it, k) : null;
    var cell = p.stock
      ? '<span class="pc">' + money(p.now) + (p.was ? '<s>' + money(p.was) + '</s>' : '') + '</span>'
      : '<span class="pc out">' + esc(t('out')) + '</span>';
    var badges = (RULES[k] && RULES[k].fromCA && prefs.country === 'US' ? '<span class="sample" title="' + esc(t('tariff')) + '">' + esc(t('fromCA')) + '</span>' : '') + (isBest ? '<span class="low">' + esc(t('lowest')) + '</span>' : '');
    var brk = '';
    if (tt && tt.unknown) brk = '<div class="brk">' + esc(t('unknownShip')) + '</div>';
    else if (tt) {
      var bits = [];
      bits.push(tt.ship === 0 ? t('freeShip') : '+' + money(tt.ship) + ' ' + t('ship'));
      if (tt.tax > 0) bits.push('+' + money(tt.tax) + ' ' + t('tax'));
      if (tt.tariff > 0) bits.push('+' + money(tt.tariff) + ' ' + t('tariff'));
      brk = '<div class="brk"><strong>' + esc(t('total', { t: money(tt.total) })) + '</strong> · ' + esc(bits.join(' · ')) + (tt.sure ? '' : ' · ' + esc(t('est'))) + (tt.note ? ' · ' + esc(t(tt.note)) : '') + '</div>';
    }
    return '<li' + (isBest ? ' class="best"' : '') + '><span class="store">' + esc(s.name) + badges + '</span>' + cell + brk + '</li>';
  }
  function cardHtml(it) {
    var b = best(it), on = totalsOn(), watched = watch.indexOf(it.id) >= 0;
    var rows = Object.keys(STORES).map(function (k) { return rowHtml(it, k, b, on); }).join('');
    var buy = b ? '<a class="btn small" href="' + esc(storeUrl(it, b.key)) + '" target="_blank" rel="noopener">' + esc(t('view', { s: STORES[b.key].name })) + '</a>' : '';
    return '<article class="card">' + thumbHtml(it) + '<div class="card-top"><div><span class="brand">' + esc(brandName(it.brand)) + '</span><h3>' + esc(localName(it)) + '</h3><p class="color">' + esc((localName(it) !== it.name ? it.brand + ' ' + it.name + (it.color ? ' · ' : '') : '') + (it.color || '')) + '</p></div>' +
      '<button class="btn small ghost" type="button" data-action="watch" data-id="' + esc(it.id) + '" aria-pressed="' + watched + '">' + esc(watched ? t('watchingBtn') : t('watch')) + '</button></div>' +
      '<div class="specs">' + ((it.weights && it.weights.length ? it.weights : (it.weight ? [it.weight] : [])).map(function (w) { return '<span class="spec" title="' + esc(w === '4U' ? tipFor('4U') : '') + '">' + esc(w) + '</span>'; }).join('')) +
      (it.balance ? '<span class="spec" title="' + esc(tipFor(it.balance)) + '">' + esc(BAL[it.balance.toLowerCase()] ? t(BAL[it.balance.toLowerCase()]) : it.balance) + '</span>' : '') +
      (it.grade ? '<span class="spec">' + esc(GRD[it.grade.toLowerCase()] ? t(GRD[it.grade.toLowerCase()]) : it.grade) + '</span>' : '') + '</div>' +
      '<ul class="prices">' + rows + '</ul><div class="card-foot">' + buy +
      '<button class="btn small ghost" type="button" data-action="hist" data-id="' + esc(it.id) + '" aria-expanded="' + (premium && !!openHist[it.id]) + '">' + esc(premium && openHist[it.id] ? t('histHide') : t('histBtn')) + (premium ? '' : ' 🔒') + '</button></div>' +
      (premium && openHist[it.id] ? histBlock(it) : '') +
      (lockId === it.id && !premium ? '<p class="inline-note" role="status">' + esc(t('histLock')) + ' <button class="link-btn" type="button" data-action="premium-on">' + esc(t('previewSw')) + '</button></p>' : '') +
      (limitId === it.id ? '<p class="inline-note" role="status">' + esc(t('limit2')) + '</p>' : '') + '</article>';
  }
  function renderResults() {
    if (!loaded) { $('#results').innerHTML = '<p class="empty">' + esc(t(loadError ? 'loadFail' : 'loading')) + '</p>'; return; }
    var q = $('#q').value.trim().toLowerCase(), sort = $('#sort').value;
    var list = ITEMS.filter(function (it) { return (brand === 'All' || it.brand === brand) && (it.brand + ' ' + brandName(it.brand) + ' ' + it.name + ' ' + localName(it) + ' ' + (it.color || '')).toLowerCase().indexOf(q) >= 0; });
    function amt(it) { var b = best(it); return b ? b.amount : Infinity; }
    list.sort(function (a, b) {
      if (sort === 'high') return (amt(b) === Infinity ? -1 : amt(b)) - (amt(a) === Infinity ? -1 : amt(a));
      if (sort === 'off') return topDiscount(b) - topDiscount(a);
      if (sort === 'stores') return (Object.keys(b.prices).length - Object.keys(a.prices).length) || (amt(a) - amt(b));
      return amt(a) - amt(b);
    });
    $('#results').innerHTML = list.length
      ? list.slice(0, shown).map(cardHtml).join('') + (list.length > shown ? '<button class="btn ghost" type="button" data-action="more" style="grid-column:1/-1">' + esc(t('more', { n: list.length - shown })) + '</button>' : '')
      : '<p class="empty">' + esc(t('none')) + '</p>';
    $('#results-meta').textContent = list.length === 1 ? t('racket1') : t('rackets', { n: list.length });
  }
  function renderBrands() {
    var counts = {}, names = ['All'];
    ITEMS.forEach(function (i) { counts[i.brand] = (counts[i.brand] || 0) + 1; });
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 14).forEach(function (n) { names.push(n); });
    $('#brands').innerHTML = names.map(function (n) {
      return '<button class="chip-btn" type="button" data-action="brand" data-brand="' + esc(n) + '" aria-pressed="' + (n === brand) + '">' + esc(n === 'All' ? t('all') : brandName(n)) + '</button>';
    }).join('');
  }

  /* ---------- header, notes, pickers ---------- */
  function renderStatic() {
    document.documentElement.lang = { zh: 'zh-CN', 'zh-TW': 'zh-TW' }[prefs.lang] || prefs.lang;
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $('#q').placeholder = t('search'); $('#q').setAttribute('aria-label', t('search'));
    $('#lbl-country').textContent = t('country'); $('#lbl-lang').textContent = t('lang');
    $('#lbl-region').textContent = prefs.country === 'CA' ? t('regionCA') : t('region');
    var tbl = regionTable(), codes = Object.keys(tbl).sort(function (a, b) { return tbl[a][0] < tbl[b][0] ? -1 : 1; });
    $('#region').innerHTML = '<option value="">' + esc(t('pick')) + '</option>' + codes.map(function (c) { return '<option value="' + c + '"' + (c === prefs.region ? ' selected' : '') + '>' + esc(tbl[c][0]) + '</option>'; }).join('');
    var ls = $('#lang'); if (!ls.options.length) ls.innerHTML = Object.keys(LANGS).map(function (c) { return '<option value="' + c + '">' + esc(LANGS[c]) + '</option>'; }).join('');
    $('#country').value = prefs.country; ls.value = prefs.lang;
    var p = $('#plan-pill'); p.textContent = premium ? t('preview') : t('free'); p.className = 'pill' + (premium ? ' on' : '');
    $('#premium-switch').setAttribute('aria-checked', String(premium));
    var hint = $('#totals-hint');
    if (prefs.country === 'US' && (prefs.region === 'AK' || prefs.region === 'HI')) { hint.hidden = false; hint.textContent = t('hintAKHI'); }
    else if (!totalsOn()) { hint.hidden = false; hint.textContent = t('hint', { r: (prefs.country === 'CA' ? t('regionCA') : t('region')).toLowerCase() }); }
    else hint.hidden = true;
    var d = updatedISO ? new Date(updatedISO).toLocaleDateString(prefs.lang === 'zh' ? 'zh-CN' : prefs.lang, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    var names = Object.keys(STORES).filter(function (k) { return STORES[k].ok !== false; }).map(function (k) { return STORES[k].name; });
    $('#note').innerHTML = loaded ? '<strong>' + esc(t('updated', { d: d })) + '</strong> ' + esc(t('comparing', { s: names.join(', ') })) + ' ' + esc(totalsOn() ? t('noteTotals') : t('noteNoTotals')) : esc(t('loading'));
  }
  function renderAll() { renderStatic(); renderWatch(); renderBrands(); renderResults(); }

  /* ---------- actions ---------- */
  function setPremium(v) {
    premium = v; limitId = ''; limitMsgKey = ''; lockId = '';
    if (!premium && watch.length > FREE_LIMIT) { watch = watch.slice(0, FREE_LIMIT); limitMsgKey = 'limit3'; saveWatch(); }
    renderAll();
  }
  function toggleWatch(id) {
    var i = watch.indexOf(id); limitId = ''; limitMsgKey = '';
    if (i >= 0) watch.splice(i, 1);
    else if (!premium && watch.length >= FREE_LIMIT) { limitId = id; limitMsgKey = 'limit1'; }
    else watch.push(id);
    saveWatch(); renderAll();
    var btn = document.querySelector('[data-action="watch"][data-id="' + id + '"]'); if (btn) btn.focus();
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]'); if (!el) return;
    var a = el.getAttribute('data-action'), id = el.getAttribute('data-id');
    if (a === 'histstore') { var hs = el.parentNode; var op = hs.classList.toggle('open'); el.setAttribute('aria-expanded', String(op)); scrollCharts(); return; }
    if (a === 'hist') { if (premium) openHist[id] = !openHist[id]; else lockId = lockId === id ? '' : id; renderResults(); scrollCharts(); var hb = document.querySelector('[data-action="hist"][data-id="' + id + '"]'); if (hb) hb.focus(); return; }
    if (a === 'zoom') { var z = byId(id); if (z) { var lb = $('#lightbox'); $('#lb-img').src = imgUrl(z.image, 1000); $('#lb-img').alt = localName(z); $('#lb-cap').textContent = brandName(z.brand) + ' ' + localName(z); lb.hidden = false; } }
    else if (a === 'watch') toggleWatch(id);
    else if (a === 'remove') { limitId = ''; limitMsgKey = ''; watch.splice(watch.indexOf(id), 1); saveWatch(); renderAll(); }
    else if (a === 'premium-on') setPremium(true);
    else if (a === 'brand') { brand = el.getAttribute('data-brand'); shown = PAGE; renderBrands(); renderResults(); }
    else if (a === 'more') { shown += PAGE; renderResults(); }
  });
  $('#lightbox').addEventListener('click', function () { this.hidden = true; $('#lb-img').removeAttribute('src'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var lb = $('#lightbox'); lb.hidden = true; } });
  document.addEventListener('error', function (e) {      // a photo that will not load: show the plain racket icon instead
    var im = e.target; if (!im || im.tagName !== 'IMG') return;
    var b = im.closest && im.closest('.thumb'); if (b) { b.className = 'thumb none'; b.removeAttribute('data-action'); b.innerHTML = RACKET_ICON; } else if (im.classList.contains('wthumb')) im.remove();
  }, true);
  $('#premium-switch').addEventListener('click', function () { setPremium(!premium); });
  $('#q').addEventListener('input', function () { shown = PAGE; renderResults(); });
  $('#sort').addEventListener('change', function () { shown = PAGE; renderResults(); });
  $('#country').addEventListener('change', function (e) { prefs.country = e.target.value === 'CA' ? 'CA' : 'US'; prefs.region = ''; targets = {}; savePrefs(); renderAll(); });
  $('#region').addEventListener('change', function (e) { prefs.region = e.target.value; savePrefs(); renderStatic(); renderWatch(); renderResults(); });
  $('#lang').addEventListener('change', function (e) { prefs.lang = T[e.target.value] ? e.target.value : 'en'; savePrefs(); renderAll(); });
  document.addEventListener('input', function (e) {
    if (!e.target.classList || !e.target.classList.contains('target-input')) return;
    var id = e.target.getAttribute('data-id'), it = byId(id), b = it && best(it), v = parseFloat(e.target.value);
    targets[id] = isNaN(v) ? 0 : v;
    var chip = document.getElementById('hit-' + id);
    if (chip && b) chip.hidden = !((cur() === 'CAD' ? b.now / FX : b.now) <= targets[id]);
  });

  /* ---------- load the price file ---------- */
  var loadError = false;
  renderAll();
  fetch('data.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (d) {
    if (!d.items || !d.items.length) throw new Error('empty');
    Object.keys(d.stores).forEach(function (k) { STORES[k] = { name: d.stores[k].name, home: d.stores[k].home, ok: d.stores[k].ok }; });
    ITEMS = d.items; updatedISO = d.updated; loaded = true;
    FX = (d.fx && d.fx.CAD) || (d.stores.yumo && d.stores.yumo.rate) || 0.71;
    watch = watch.filter(function (id) { return byId(id); });
    renderAll();
  }).catch(function () { loadError = true; renderAll(); });
})();
