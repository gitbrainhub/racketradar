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
    s.textContent = '.card{grid-template-columns:minmax(0,1fr)}.hist,.hist-main,.hist-store,.hist-chart,.chart-scroll{min-width:0;max-width:100%}.chart-frame{position:relative;margin-top:6px}.chart2{width:100%;user-select:none;-webkit-user-select:none;overscroll-behavior-x:none}html,body{overscroll-behavior-x:none}.hmodal{position:fixed;inset:0;z-index:60;background:rgba(8,14,11,.6);overflow-y:auto;padding:20px 12px}.hmodal[hidden]{display:none}.hm-in{max-width:980px;margin:0 auto;background:var(--surface);border-radius:18px;padding:22px 22px 28px;box-shadow:0 12px 40px rgba(0,0,0,.3)}.hm-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}.hm-top h2{margin:2px 0 0;font-size:26px}.noscroll{overflow:hidden}.spark-open{cursor:pointer;border-radius:10px}.spark-open:hover{outline:2px solid var(--court);outline-offset:3px}.chart-fit{position:absolute;top:-4px;right:0;z-index:4;font:600 12px var(--font-body);background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:5px 11px;cursor:pointer}.chart-fit[hidden]{display:none}.chart-fit:hover{border-color:var(--court)}.chart2 svg{display:block}' +
      '.chart-wrap{position:relative}' +
      '.chart{display:block;overflow:visible}' +
      '.chart .grid{stroke:var(--line);stroke-width:1}.chart .axis{stroke:var(--ink-2);stroke-width:1.4}' +
      '.chart .ln{fill:none;stroke:var(--court);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}' +
      '.chart .pt{fill:var(--surface);stroke:var(--court);stroke-width:2.2}' +
      '.chart .pt.on{fill:var(--court);stroke:var(--surface);stroke-width:2.5}.chart .hl{fill:var(--court);stroke:var(--surface);stroke-width:2.5}' +
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
  var CH = {L: 50, R: 16, T: 14, B: 34, H: 190, PPD: 34}, bigCharts = false;
  function chartSvg(hist, label) {
    return '<div class="chart-frame" data-h="' + (bigCharts ? 320 : CH.H) + '" data-hist="' + esc(JSON.stringify(hist)) + '" data-label="' + esc(label) + '"><div class="chart2"></div>' +
      '<button type="button" class="chart-fit" hidden>' + esc(t('histFit')) + '</button><div class="tip" hidden></div></div>';
  }
  function chartInit(fr) {
    var box = fr.querySelector('.chart2'), W = box.clientWidth;
    if (!W) return;                                                                         // hidden for now, set up when it opens
    var c = fr._c;
    if (c && c.W === W && c.cur === cur()) return;
    var u = cur() === 'CAD' ? 1 / FX : 1, sym = cur() === 'CAD' ? 'C$' : '$';
    var pts = JSON.parse(fr.getAttribute('data-hist')).map(function (x) { return {t: dayMs(x[0]), v: x[1] * u, d: x[0]}; });
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t, pw = W - CH.L - CH.R, span = Math.max(t1 - t0, 5 * 864e5);
    var vals = pts.map(function (q) { return q.v; }), nt = niceTicks(Math.min.apply(null, vals), Math.max.apply(null, vals), 4);
    var fitPpd = pw / (span / 864e5);                                                       // most zoomed out: every point, first at the left axis
    fr._c = {pts: pts, W: W, H: +fr.getAttribute('data-h') || CH.H, cur: cur(), sym: sym, t0: t0, t1: t1, span: span, ppd: fitPpd, fitPpd: fitPpd, pw: pw, nt: nt, sel: -1, drag: null, tl: t0, raf: 0};
    chartDraw(fr);
  }
  function chartFit(c) { return c.ppd <= c.fitPpd * 1.001; }
  function chartDraw(fr) {
    var c = fr._c, box = fr.querySelector('.chart2'), L = CH.L, R = CH.R, T = CH.T, B = CH.B, H = c.H, W = c.W, nt = c.nt;
    var lo = nt.ticks[0], hi = nt.ticks[nt.ticks.length - 1], dec = nt.step >= 1 ? 0 : 2, k = c.ppd / 864e5;
    function X(t) { return L + (t - c.tl) * k; }
    function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var id = 'cp' + Math.random().toString(36).slice(2, 7), fit = chartFit(c);
    var stepD = [1, 2, 3, 7, 14, 30, 60, 90, 180, 365].filter(function (s) { return s * c.ppd >= 72; })[0] || 365, g = '', y = '';
    nt.ticks.forEach(function (v) {
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
      y += '<text class="ylab" x="' + (L - 7) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(c.sym + v.toFixed(dec)) + '</text>';
    });
    var xl = '', n0 = Math.max(0, Math.floor((c.tl - c.t0) / 864e5 / stepD) - 1);
    for (var n = n0; ; n++) {
      var t = c.t0 + n * stepD * 864e5, x = X(t);
      if (x > W - R + 1) break;
      if (x < L - 1) continue;
      g += '<line class="grid v" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
      xl += '<text class="xlab" x="' + x.toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + esc(shortDate(t)) + '</text>';
    }
    var path = c.pts.map(function (q, i) { return (i ? 'L' : 'M') + X(q.t).toFixed(1) + ' ' + Y(q.v).toFixed(1); }).join(' ');
    var dots = c.pts.length > 400 ? '' : c.pts.map(function (q, i) { var x = X(q.t); return x < L - 8 || x > W - R + 8 ? '' : '<circle class="pt' + (i === c.sel ? ' on' : '') + '" cx="' + x.toFixed(1) + '" cy="' + Y(q.v).toFixed(1) + '" r="' + (i === c.sel ? 6 : 3.6) + '"/>'; }).join('');
    box.innerHTML = '<svg class="chart" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(fr.getAttribute('data-label')) + '"><defs>' +
      '<clipPath id="' + id + 'a"><rect x="' + L + '" y="0" width="' + (W - R - L + 1) + '" height="' + H + '"/></clipPath>' +
      '<clipPath id="' + id + 'b"><rect x="' + (L - 7) + '" y="0" width="' + (W - L + 7) + '" height="' + H + '"/></clipPath>' +
      '<clipPath id="' + id + 'c"><rect x="' + (L - 18) + '" y="0" width="' + (W - L + 18) + '" height="' + H + '"/></clipPath></defs>' +
      '<g clip-path="url(#' + id + 'a)">' + g + '<path class="ln" d="' + path + '"/></g><g clip-path="url(#' + id + 'b)">' + dots + '</g><g clip-path="url(#' + id + 'c)">' + xl + '</g>' + y +
      '<line class="axis" x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (H - B) + '"/><line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/></svg>';
    box.style.touchAction = fit ? 'auto' : 'pan-y'; if (!c.drag) box.style.cursor = fit ? '' : 'grab';
    fr.querySelector('.chart-fit').hidden = fit;
    var tip = fr.querySelector('.tip'), q = c.sel >= 0 && c.pts[c.sel];
    if (q && X(q.t) >= L - 1 && X(q.t) <= W - R + 1) {                                      // the bubble rides along with its dot
      tip.innerHTML = '<strong>' + esc(c.sym + q.v.toFixed(2)) + '</strong><span>' + esc(longDate(q.d)) + '</span>'; tip.hidden = false;
      tip.style.left = Math.min(W - 58, Math.max(58, X(q.t))) + 'px'; tip.style.top = Y(q.v) + 'px';
    } else tip.hidden = true;
  }
  function chartClamp(c, tl) { return Math.min(Math.max(c.t0, c.t1 - c.pw / c.ppd * 864e5), Math.max(c.t0, tl)); }
  function chartView(fr, ppd, tl, sel) {                                                    // glide to a new zoom/position
    var c = fr._c, p0 = c.ppd, l0 = c.tl, st = Date.now(), dur = 240;
    cancelAnimationFrame(c.raf); c.sel = -1;
    (function step() {
      var f = Math.min(1, (Date.now() - st) / dur), e = 1 - Math.pow(1 - f, 3);
      c.ppd = p0 + (ppd - p0) * e; c.tl = l0 + (tl - l0) * e;
      if (f >= 1) { c.ppd = ppd; c.tl = chartClamp(c, tl); c.sel = sel; chartDraw(fr); return; }
      chartDraw(fr); c.raf = requestAnimationFrame(step);
    })();
  }
  function chartZoomTo(fr, i) {
    var c = fr._c, ppd = Math.max(c.fitPpd * 3, 44), tp = c.pts[i].t;
    if (c.ppd >= ppd * 0.98 && c.sel === i) { chartView(fr, c.fitPpd, c.t0, -1); return; }   // tap the same dot again: back out
    var span = c.pw / ppd * 864e5, tl = Math.min(Math.max(c.t0, c.t1 - span), Math.max(c.t0, tp - span / 2));
    chartView(fr, ppd, tl, i);
  }
  function chartNear(fr, e, reach) {
    var c = fr._c, r = fr.querySelector('svg').getBoundingClientRect(), k = c.ppd / 864e5, best = -1, bd = 1e9, lo = c.nt.ticks[0], hi = c.nt.ticks[c.nt.ticks.length - 1];
    c.pts.forEach(function (q, i) {
      var x = CH.L + (q.t - c.tl) * k, y = CH.T + (1 - (q.v - lo) / (hi - lo)) * (c.H - CH.T - CH.B);
      if (x < CH.L - 4 || x > c.W - CH.R + 4) return;
      var d = Math.sqrt(Math.pow(r.left + x - e.clientX, 2) + Math.pow(r.top + y - e.clientY, 2));
      if (d < bd) { bd = d; best = i; }
    });
    return bd <= reach ? best : -1;
  }
  function chartPan(fr, dpx) {                                                              // positive = look at later dates
    var c = fr._c; if (!c || chartFit(c)) return false;
    var nl = chartClamp(c, c.tl + dpx / c.ppd * 864e5);
    if (nl === c.tl) return false;
    c.tl = nl; chartDraw(fr); return true;
  }
  function scrollCharts() { Array.prototype.forEach.call(document.querySelectorAll('.chart-frame'), chartInit); }
  window.addEventListener('resize', function () { Array.prototype.forEach.call(document.querySelectorAll('.chart-frame'), function (f) { if (f._c) { f._c.W = 0; } chartInit(f); }); });
  function frameOf(e) { var b = e.target.closest && e.target.closest('.chart2'); return b && b.parentNode; }
  document.addEventListener('mouseover', function (e) { if (e.target.closest && e.target.closest('.hist-store')) scrollCharts(); });   // hover-opened charts need setting up too
  document.addEventListener('wheel', function (e) {
    var fr = frameOf(e); if (!fr || !fr._c) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;                                   // up/down keeps scrolling the page
    e.preventDefault();                                                                     // sideways swipes never trigger the browser's back/forward gesture
    chartPan(fr, e.deltaX);
  }, {passive: false});
  document.addEventListener('pointerdown', function (e) {
    var fr = frameOf(e); if (!fr || !fr._c) return;
    fr._c.drag = {x: e.clientX, moved: false, id: e.pointerId};
    if (!chartFit(fr._c)) { fr.querySelector('.chart2').style.cursor = 'grabbing'; try { fr.querySelector('.chart2').setPointerCapture(e.pointerId); } catch (x) {} }   // keep following the mouse outside the chart
  });
  document.addEventListener('pointermove', function (e) {
    var fr = frameOf(e), dr;
    if (!fr || !fr._c) return;
    dr = fr._c.drag;
    if (dr && dr.id === e.pointerId) {
      var dx = e.clientX - dr.x;
      if (Math.abs(dx) > 4) dr.moved = true;
      if (dr.moved && !chartFit(fr._c)) { dr.x = e.clientX; chartPan(fr, -dx); fr._c.sel = -1; return; }
      if (e.pointerType !== 'mouse') return;
    }
    if (e.pointerType === 'mouse' && e.buttons === 0) { var i = chartNear(fr, e, 22); if (i !== fr._c.sel) { fr._c.sel = i; chartDraw(fr); } }   // hover only reacts when really close to a dot
  });
  document.addEventListener('pointerup', function (e) {
    var fr = frameOf(e); if (!fr || !fr._c) return;
    var dr = fr._c.drag; fr._c.drag = null; fr.querySelector('.chart2').style.cursor = chartFit(fr._c) ? '' : 'grab';
    if (!dr || dr.moved) return;
    var i = chartNear(fr, e, e.pointerType === 'mouse' ? 24 : 28);
    if (i >= 0) chartZoomTo(fr, i); else if (fr._c.sel >= 0) { fr._c.sel = -1; chartDraw(fr); }
  });
  document.addEventListener('pointerout', function (e) {
    var fr = frameOf(e); if (fr && fr._c && e.pointerType === 'mouse' && !fr._c.drag && !(e.relatedTarget && fr.contains(e.relatedTarget)) && fr._c.sel >= 0 && !fr._c.zoomed) { fr._c.sel = -1; chartDraw(fr); }
  });
  document.addEventListener('click', function (e) {
    var bt = e.target.closest && e.target.closest('.chart-fit'); if (!bt) return;
    var fr = bt.parentNode; if (fr._c) chartView(fr, fr._c.fitPpd, fr._c.t0, -1);
  });
  document.addEventListener('dblclick', function (e) { var fr = frameOf(e); if (fr && fr._c && !chartFit(fr._c)) chartView(fr, fr._c.fitPpd, fr._c.t0, -1); });
  /* ---------- full-page price history (opens from the watchlist graph) ---------- */
  var modalEl = null;
  function closeModal() { if (modalEl) { modalEl.hidden = true; modalEl.innerHTML = ''; } document.documentElement.classList.remove('noscroll'); bigCharts = false; }
  function openModal(id) {
    var it = byId(id); if (!it || !premium) return;
    if (!modalEl) { modalEl = document.createElement('div'); modalEl.className = 'hmodal'; modalEl.setAttribute('role', 'dialog'); modalEl.setAttribute('aria-modal', 'true'); document.body.appendChild(modalEl); }
    bigCharts = true;
    modalEl.innerHTML = '<div class="hm-in"><div class="hm-top"><div><span class="brand">' + esc(brandName(it.brand)) + '</span><h2>' + esc(localName(it)) + '</h2></div><button type="button" class="btn ghost hm-close">' + esc(t('histClose')) + '</button></div>' + histBlock(it) + '</div>';
    bigCharts = false; modalEl.hidden = false; document.documentElement.classList.add('noscroll');
    bigCharts = true; scrollCharts(); bigCharts = false;
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('[data-modal]'); if (o) { openModal(o.getAttribute('data-modal')); return; }
    if (e.target.closest && (e.target.closest('.hm-close') || e.target === modalEl)) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('data-modal')) { e.preventDefault(); openModal(e.target.getAttribute('data-modal')); }
  });
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
      extra = (hist ? '<div class="spark-open" role="button" tabindex="0" data-modal="' + esc(it.id) + '" aria-label="' + esc(t('histBtn')) + '">' + spark(hist) + '</div>' : '<p class="spark-cap">' + esc(t('histStart')) + '</p>') +
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
    var items = watch.map(byId).filter(Boolean), aside = document.querySelector('.watch');
    var html = premium ? items.map(watchCard).join('') : '<li class="slot off" aria-hidden="true"></li><li class="slot off" aria-hidden="true"></li><li class="slot off" aria-hidden="true"></li>';
    if (premium && !items.length) html = '<li class="slot">' + esc(t('emptyPrem')) + '</li>';
    $('#watch-list').innerHTML = html;
    $('#watch-count').textContent = premium ? t('watching', { n: items.length }) : '🔒';
    $('#watch-sub').textContent = premium ? t('subPrem') : t('subFree');
    aside.classList.toggle('is-locked', !premium);
    $('#limit-note').hidden = true;
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
    return '<li' + (isBest ? ' class="best"' : '') + '><a class="row-link" href="' + esc(storeUrl(it, k)) + '" target="_blank" rel="noopener" aria-label="' + esc(s.name) + '"></a><span class="store">' + esc(s.name) + badges + '</span>' + cell + brk + '</li>';
  }
  function cardHtml(it) {
    var b = best(it), on = totalsOn(), watched = watch.indexOf(it.id) >= 0;
    var rows = Object.keys(STORES).map(function (k) { return rowHtml(it, k, b, on); }).join('');
    var buy = b ? '<a class="btn small" href="' + esc(storeUrl(it, b.key)) + '" target="_blank" rel="noopener" title="' + esc(STORES[b.key].name) + '">' + esc(t('view')) + '</a>' : '';
    return '<article class="card"' + (premium ? ' draggable="true" data-card="' + esc(it.id) + '"' : '') + '>' + thumbHtml(it) + '<div class="card-top"><div><span class="brand">' + esc(brandName(it.brand)) + '</span><h3>' + esc(localName(it)) + '</h3><p class="color">' + esc((localName(it) !== it.name ? it.brand + ' ' + it.name + (it.color ? ' · ' : '') : '') + (it.color || '')) + '</p></div>' +
      '<button class="btn small ghost" type="button" data-action="watch" data-id="' + esc(it.id) + '" aria-pressed="' + watched + '">' + esc(watched ? t('watchingBtn') : t('watch')) + (premium ? '' : ' 🔒') + '</button></div>' +
      '<div class="specs">' + ((it.weights && it.weights.length ? it.weights : (it.weight ? [it.weight] : [])).map(function (w) { return '<span class="spec" title="' + esc(w === '4U' ? tipFor('4U') : '') + '">' + esc(w) + '</span>'; }).join('')) +
      (it.balance ? '<span class="spec" title="' + esc(tipFor(it.balance)) + '">' + esc(BAL[it.balance.toLowerCase()] ? t(BAL[it.balance.toLowerCase()]) : it.balance) + '</span>' : '') +
      (it.grade ? '<span class="spec">' + esc(GRD[it.grade.toLowerCase()] ? t(GRD[it.grade.toLowerCase()]) : it.grade) + '</span>' : '') + '</div>' +
      '<ul class="prices">' + rows + '</ul><div class="card-foot">' + buy +
      '<button class="btn small ghost" type="button" data-action="hist" data-id="' + esc(it.id) + '" aria-expanded="' + (premium && !!openHist[it.id]) + '">' + esc(premium && openHist[it.id] ? t('histHide') : t('histBtn')) + (premium ? '' : ' 🔒') + '</button></div>' +
      (premium && openHist[it.id] ? histBlock(it) : '') +
      (lockId === it.id && !premium ? '<p class="inline-note" role="status">' + esc(t('histLock')) + ' <button class="link-btn" type="button" data-action="premium-on">' + esc(t('previewSw')) + '</button></p>' : '') +
      (limitId === it.id && !premium ? '<p class="inline-note" role="status">' + esc(t('subFree')) + ' <button class="link-btn" type="button" data-action="premium-on">' + esc(t('previewSw')) + '</button></p>' : '') + '</article>';
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
    scrollCharts();
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
  /* ---------- settings window ---------- */
  var THEME_KEY = 'rr-theme', smEl = null, smTab = 'account', gearBtn = null;
  function getTheme() { try { var v = localStorage.getItem(THEME_KEY); if (v === 'light' || v === 'dark') return v; } catch (e) {} return 'auto'; }
  function applyTheme(v) {
    if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
    try { if (v === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, v); } catch (e) {}
  }
  var SM_TABS = [['account', 'setAccount'], ['appearance', 'setAppearance'], ['lang', 'lang'], ['region', 'setRegion'], ['billing', 'setBilling']];
  function buildSettings() {
    var css = document.createElement('style');
    css.textContent = '.gear{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}.gear:hover{border-color:var(--court)}' +
      '.smodal{position:fixed;inset:0;z-index:70;background:rgba(8,14,11,.6);overflow-y:auto;padding:20px 12px}.smodal[hidden]{display:none}' +
      '.sm-in{max-width:680px;margin:0 auto;background:var(--surface);color:var(--ink);border-radius:18px;padding:20px 22px 26px;box-shadow:0 12px 40px rgba(0,0,0,.3)}' +
      '.sm-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.sm-top h2{margin:0;font-size:26px}' +
      '.sm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}.sm-tab{font:600 14px var(--font-body);border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:7px 14px;cursor:pointer}.sm-tab[aria-selected="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}' +
      '.sm-sec{display:grid;gap:12px;min-height:150px;align-content:start}.sm-seg{align-items:flex-start}.sm-sec[hidden]{display:none}.sm-sec p{margin:0;color:var(--ink-2)}.sm-sec label{display:grid;gap:6px;font-size:13px;color:var(--ink-2)}.sm-sec select{font:inherit;font-size:15px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:9px 10px}' +
      '.sm-seg{display:flex;gap:8px;flex-wrap:wrap}.sm-seg button{font:600 14px var(--font-body);border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:10px 16px;cursor:pointer}.sm-seg button[aria-pressed="true"]{border-color:var(--court);box-shadow:0 0 0 2px var(--court) inset}' +
      '.sm-row{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:12px 14px}.sm-row strong{font-weight:600}';
    document.head.appendChild(css);
    smEl = document.createElement('div'); smEl.className = 'smodal'; smEl.hidden = true; smEl.setAttribute('role', 'dialog'); smEl.setAttribute('aria-modal', 'true'); smEl.setAttribute('aria-labelledby', 'sm-h');
    smEl.innerHTML = '<div class="sm-in"><div class="sm-top"><h2 id="sm-h" data-i18n="settings"></h2><button type="button" class="btn ghost small" data-sm="close" data-i18n="histClose"></button></div>' +
      '<div class="sm-tabs" role="tablist">' + SM_TABS.map(function (x) { return '<button type="button" class="sm-tab" role="tab" data-sm="tab" data-tab="' + x[0] + '" data-i18n="' + x[1] + '"></button>'; }).join('') + '</div>' +
      '<section class="sm-sec" data-sec="account"><div class="sm-row"><span data-i18n="planNow"></span><strong id="sm-plan"></strong></div><p data-i18n="acctInfo"></p><div><button type="button" class="btn" disabled data-i18n="acctBtn"></button></div></section>' +
      '<section class="sm-sec" data-sec="appearance"><div class="sm-seg" id="sm-theme">' + [['light', 'themeLight'], ['dark', 'themeDark'], ['auto', 'themeAuto']].map(function (x) { return '<button type="button" data-sm="theme" data-v="' + x[0] + '" data-i18n="' + x[1] + '"></button>'; }).join('') + '</div></section>' +
      '<section class="sm-sec" data-sec="lang"></section><section class="sm-sec" data-sec="region"></section>' +
      '<section class="sm-sec" data-sec="billing"><div class="sm-row"><span data-i18n="planNow"></span><strong id="sm-plan2"></strong></div><p data-i18n="billInfo"></p><div><button type="button" class="btn" data-sm="plan" id="sm-planbtn"></button></div></section></div>';
    document.body.appendChild(smEl);
    var labels = document.querySelectorAll('.prefs > label');                                 // the language / country / state pickers move in here
    smEl.querySelector('[data-sec="region"]').appendChild(labels[0]); smEl.querySelector('[data-sec="region"]').appendChild(labels[1]); smEl.querySelector('[data-sec="lang"]').appendChild(labels[2]);
    var pf = document.querySelector('.prefs'); if (pf) pf.hidden = true;
    gearBtn = document.createElement('button'); gearBtn.type = 'button'; gearBtn.className = 'gear';
    gearBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
    var plan = document.querySelector('.plan'); if (plan) plan.insertBefore(gearBtn, plan.firstChild);
    gearBtn.addEventListener('click', function () { openSettings(); });
    smEl.addEventListener('click', function (e) {
      if (e.target === smEl) { closeSettings(); return; }
      var b = e.target.closest('[data-sm]'); if (!b) return;
      var a = b.getAttribute('data-sm');
      if (a === 'close') closeSettings();
      else if (a === 'tab') { smTab = b.getAttribute('data-tab'); renderSettings(); }
      else if (a === 'theme') { applyTheme(b.getAttribute('data-v')); renderSettings(); }
      else if (a === 'plan') { setPremium(!premium); renderSettings(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && smEl && !smEl.hidden) closeSettings(); });
  }
  function renderSettings() {
    if (!smEl) return;
    Array.prototype.forEach.call(smEl.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    Array.prototype.forEach.call(smEl.querySelectorAll('.sm-tab'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === smTab)); });
    Array.prototype.forEach.call(smEl.querySelectorAll('.sm-sec'), function (sec) { sec.hidden = sec.getAttribute('data-sec') !== smTab; });
    Array.prototype.forEach.call(smEl.querySelectorAll('#sm-theme button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === getTheme())); });
    var pn = premium ? t('preview') : t('free'); $('#sm-plan').textContent = pn; $('#sm-plan2').textContent = pn;
    $('#sm-planbtn').textContent = premium ? t('previewOff') : t('previewSw');
    if (gearBtn) { gearBtn.setAttribute('aria-label', t('settings')); gearBtn.title = t('settings'); }
  }
  function openSettings() { smEl.hidden = false; document.documentElement.classList.add('noscroll'); renderSettings(); var c = smEl.querySelector('[data-sm="close"]'); if (c) c.focus(); }
  function closeSettings() { smEl.hidden = true; document.documentElement.classList.remove('noscroll'); if (gearBtn) gearBtn.focus(); }
  applyTheme(getTheme());

  function renderAll() { renderStatic(); renderWatch(); renderBrands(); renderResults(); renderSettings(); }

  /* ---------- actions ---------- */
  function setPremium(v) {
    premium = v; limitId = ''; limitMsgKey = ''; lockId = '';
    renderAll();
  }
  function toggleWatch(id) {
    if (!premium) { limitId = limitId === id ? '' : id; renderResults(); return; }          // free plan: explain it is a premium feature
    var i = watch.indexOf(id); limitId = ''; limitMsgKey = '';
    if (i >= 0) watch.splice(i, 1);
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
  /* drag a racket card onto the watchlist (premium) */
  (function () {
    var box = function () { return document.querySelector('.watch'); };
    document.addEventListener('dragstart', function (e) {
      var c = e.target.closest && e.target.closest('.card[data-card]'); if (!c || !premium) return;
      e.dataTransfer.setData('text/plain', 'rr:' + c.getAttribute('data-card')); e.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add('dragging');
    });
    document.addEventListener('dragend', function () { document.body.classList.remove('dragging'); box().classList.remove('drop'); });
    document.addEventListener('dragover', function (e) { if (premium && e.target.closest && e.target.closest('.watch')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; box().classList.add('drop'); } });
    document.addEventListener('dragleave', function (e) { var w = box(); if (!e.relatedTarget || !w.contains(e.relatedTarget)) w.classList.remove('drop'); });
    document.addEventListener('drop', function (e) {
      if (!premium || !(e.target.closest && e.target.closest('.watch'))) return;
      e.preventDefault(); document.body.classList.remove('dragging'); box().classList.remove('drop');
      var d = e.dataTransfer.getData('text/plain') || '', id = d.indexOf('rr:') === 0 ? d.slice(3) : '';
      if (id && byId(id) && watch.indexOf(id) < 0) { watch.push(id); saveWatch(); renderAll(); }
    });
  })();
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
  buildSettings();
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
