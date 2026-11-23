/* Accounts and Premium: sign-in with Supabase, payment with Stripe (through two small server functions).
   Premium is decided by the server only. The browser just asks "what plan am I on?". */
(function () {
  'use strict';
  var RR = window.RR, cfg = window.RR_CFG;
  if (!RR || !RR.live || !cfg || !window.supabase) return;
  var esc = RR.esc;
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var session = null, user = null, profile = null, loaded = false, mode = 'in', email = '', msg = '', msgOk = false, busy = '', sig = '', saveTimer = 0, pushing = false;

  var css = document.createElement('style');
  css.textContent = '.ac{display:grid;gap:12px}.ac h3{margin:0;font-size:20px}.ac label{display:grid;gap:6px;font-size:13px;color:var(--ink-2)}' +
    '.ac input{font:inherit;font-size:16px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.ac input:focus{outline:2px solid var(--court);outline-offset:1px}' +
    '.ac .msg{font-size:14px;padding:10px 12px;border-radius:8px;background:color-mix(in srgb,#d33 14%,transparent);color:var(--ink)}.ac .msg.ok{background:color-mix(in srgb,var(--court) 18%,transparent)}' +
    '.ac .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ac .linkish{background:none;border:0;padding:0;font:inherit;font-size:14px;color:var(--court);text-decoration:underline;cursor:pointer}' +
    '.ac .perks{margin:0;padding-left:18px;color:var(--ink-2);display:grid;gap:4px;font-size:14px}.ac .btn[disabled]{opacity:.6;cursor:wait}';
  document.head.appendChild(css);

  function fmt(d) { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } }
  function say(m, ok) { msg = m || ''; msgOk = !!ok; sig = ''; RR.repaintSettings(); pagePaint(); }
  function bump() { sig = ''; RR.repaintSettings(); pagePaint(); }

  /* ---- profile / plan ---- */
  function applyProfile(p, keepLocal) {
    profile = p; var paid = !!(p && p.plan === 'premium'); RR.paid = paid; loaded = true;
    if (paid && p) {
      var server = Array.isArray(p.watch) ? p.watch : [], local = RR.getWatch();
      if (!server.length && local.length && keepLocal !== false) pushWatch(local); else RR.setWatch(server);
      if (p.alerts && p.alerts.targets) RR.setTargets(p.alerts.targets);
    }
    RR.setPremium(paid); bump();
  }
  function loadProfile(then) {
    if (!user) return;
    sb.from('profiles').select('plan,status,current_period_end,cancel_at_period_end,watch,alerts,email_alerts,stripe_customer_id').eq('id', user.id).maybeSingle().then(function (r) {
      if (r.error) { say('Could not load your plan. Refresh and try again.'); return; }
      if (!r.data) { setTimeout(function () { loadProfile(then); }, 1200); return; }               // the sign-up row is still being created
      applyProfile(r.data); if (then) then(r.data);
    });
  }
  sb.auth.onAuthStateChange(function (ev, s) {
    if (ev === 'PASSWORD_RECOVERY') { mode = 'reset'; RR.openSettings('account'); }
    setTimeout(function () {                                                                      // never call the database inside this callback directly
      session = s; user = s ? s.user : null;
      if (user) loadProfile(function () { if (/[?&]upgraded=1/.test(location.search)) afterCheckout(); });
      else if (loaded || ev === 'SIGNED_OUT') { profile = null; RR.paid = false; RR.setPremium(false); loaded = true; bump(); }
      else { loaded = true; bump(); }
    }, 0);
  });
  sb.auth.getSession().then(function (r) { if (!r.data.session) { loaded = true; bump(); } });

  /* ---- coming back from Stripe: the payment notice can take a few seconds to arrive ---- */
  function afterCheckout() {
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    if (profile && profile.plan === 'premium') { openPricing(); say('You are Premium. Thank you!', true); return; }
    openPricing(); busy = 'wait'; say('Payment received. Turning on Premium…', true);
    var n = 0, iv = setInterval(function () {
      n++; sb.from('profiles').select('plan,status,current_period_end,cancel_at_period_end,watch,alerts,email_alerts,stripe_customer_id').eq('id', user.id).maybeSingle().then(function (r) {
        if (r.data && r.data.plan === 'premium') { clearInterval(iv); busy = ''; applyProfile(r.data); say('You are Premium. Thank you!', true); }
        else if (n >= 12) { clearInterval(iv); busy = ''; say('Your payment is still being confirmed. Refresh in a minute; if Premium does not appear, contact support.'); }
      });
    }, 2500);
  }

  /* ---- watchlist and alert prices follow the account ---- */
  function pushWatch(list) {
    if (!user || !RR.paid) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      sb.from('profiles').update({ watch: list, alerts: { targets: RR.getTargets() } }).eq('id', user.id).then(function () {});
    }, 700);
  }
  RR.onWatch = pushWatch;
  RR.onTargets = function () { pushWatch(RR.getWatch()); };

  /* ---- calls to the payment functions ---- */
  function callFn(name) {
    return sb.auth.getSession().then(function (r) {
      var tok = r.data.session && r.data.session.access_token; if (!tok) throw new Error('Please sign in first.');
      return fetch(cfg.supabaseUrl + '/functions/v1/' + name, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, apikey: cfg.anonKey, 'Content-Type': 'application/json' }, body: '{}' });
    }).then(function (res) { return res.json().then(function (d) { if (!res.ok || !d.url) throw new Error(d.error || 'Something went wrong. Try again.'); return d.url; }); });
  }
  function go(name) {
    busy = name; msg = ''; bump();
    callFn(name).then(function (u) { location.href = u; }).catch(function (e) { busy = ''; say(e.message); });
  }
  RR.upgrade = function () { if (!user) mode = 'up'; openPricing(); };
  function checkout() { go('rapid-function'); }                  // 'rapid-function' is the Supabase slug of the create-checkout function

  /* ---- the Account and Billing tabs ---- */
  function m() { return msg ? '<p class="msg' + (msgOk ? ' ok' : '') + '" role="status">' + esc(msg) + '</p>' : ''; }
  function planRow(id) { return '<div class="sm-row"><span>' + esc(RR.t('planNow')) + '</span><strong id="' + id + '">' + esc(RR.premium ? (RR.paid ? RR.t('premium') : RR.t('preview')) : RR.t('free')) + '</strong></div>'; }
  function perks() { return '<ul class="perks"><li>' + [RR.t('p1'), RR.t('p2'), RR.t('p3'), RR.t('p4')].map(esc).join('</li><li>') + '</li></ul>'; }

  function accountHtml() {
    if (!loaded) return '<div class="ac"><p>Loading…</p></div>';
    if (user && mode === 'reset') {
      return '<div class="ac"><h3>Choose a new password</h3>' + m() + '<form data-ac="form" novalidate><div class="ac"><label>New password<input type="password" name="pw" autocomplete="new-password" minlength="8" required></label><div class="row"><button type="submit" class="btn"' + (busy ? ' disabled' : '') + '>Save password</button></div></div></form></div>';
    }
    if (user) {
      return '<div class="ac">' + planRow('sm-plan') + '<div class="sm-row"><span>Signed in as</span><strong>' + esc(user.email || '') + '</strong></div>' + m() +
        (RR.paid ? '<label class="sm-row" style="cursor:pointer"><span>Email me when a watched racket hits my price</span><input type="checkbox" data-ac="toggle-email"' + (profile && profile.email_alerts === false ? '' : ' checked') + '></label>' : '') +
        '<div class="row">' + (RR.paid ? '' : '<button type="button" class="btn" data-ac="upgrade"' + (busy ? ' disabled' : '') + '>' + esc(RR.t('upgradeBtn')) + '</button>') +
        '<button type="button" class="btn ghost" data-ac="out">Sign out</button></div></div>';
    }
    var up = mode === 'up', forgot = mode === 'forgot', reset = mode === 'reset';
    return '<div class="ac"><h3>' + (forgot ? 'Reset your password' : up ? 'Create your account' : 'Sign in') + '</h3>' + (up ? '<p>Free to join. Your Premium plan and watchlist follow you on any device.</p>' : '') + m() +
      '<form data-ac="form" novalidate><div class="ac"><label>Email<input type="email" name="email" autocomplete="email" required value="' + esc(email) + '"></label>' +
      (forgot ? '' : '<label>Password<input type="password" name="pw" autocomplete="' + (up ? 'new-password' : 'current-password') + '" minlength="8" required></label>') +
      '<div class="row"><button type="submit" class="btn"' + (busy ? ' disabled' : '') + '>' + (forgot ? 'Email me a reset link' : up ? 'Create account' : 'Sign in') + '</button>' +
      (forgot ? '<button type="button" class="linkish" data-ac="mode-in">Back to sign in</button>' : up ? '<button type="button" class="linkish" data-ac="mode-in">I already have an account</button>' : '<button type="button" class="linkish" data-ac="mode-up">Create an account</button><button type="button" class="linkish" data-ac="mode-forgot">Forgot password?</button>') +
      '</div></div></form></div>';
  }
  function billingHtml() {
    if (!user) return '<div class="ac">' + planRow('sm-plan2') + '<p>Sign in to upgrade or manage billing.</p><div><button type="button" class="btn" data-ac="signin">Sign in</button></div></div>';
    if (RR.paid) {
      var end = profile && profile.current_period_end ? fmt(profile.current_period_end) : '';
      return '<div class="ac">' + planRow('sm-plan2') + (end ? '<p>' + (profile.cancel_at_period_end ? 'Premium ends on ' : 'Renews on ') + esc(end) + '.</p>' : '') + m() +
        '<div class="row"><button type="button" class="btn" data-ac="portal"' + (busy ? ' disabled' : '') + '>Manage billing</button><button type="button" class="btn ghost" data-ac="open-pricing">View plan</button></div><p>Update your card, see invoices, or cancel any time.</p></div>';
    }
    return '<div class="ac">' + planRow('sm-plan2') + perks() + m() + '<div><button type="button" class="btn" data-ac="upgrade">' + esc(RR.t('upgradeBtn')) + '</button></div></div>';
  }

  RR.paint = function (root, tab) {
    var key = [tab, !!user, loaded, RR.paid, RR.premium, mode, busy, msg, user && user.email, profile && profile.current_period_end, profile && profile.cancel_at_period_end, profile && profile.email_alerts].join('|');
    if (key === sig) return; sig = key;
    var a = root.querySelector('[data-sec="account"]'), b = root.querySelector('[data-sec="billing"]');
    if (a) a.innerHTML = accountHtml(); if (b) b.innerHTML = billingHtml();
  };


  /* ---- the Premium page: its own full-screen page with its own address (#premium) ---- */
  var pg = null, pgKey = '';
  var pcss = document.createElement('style');
  pcss.textContent = '.pg{position:fixed;inset:0;z-index:60;background:var(--bg);color:var(--ink);overflow-y:auto;overscroll-behavior:contain}.pg[hidden]{display:none}' +
    '.pg-in{max-width:960px;margin:0 auto;padding:18px max(16px,env(safe-area-inset-right)) 56px max(16px,env(safe-area-inset-left))}' +
    '.pg-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:28px}.pg-back{font:600 14px var(--font-body);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:9px 16px;cursor:pointer}.pg-back:hover{border-color:var(--court)}' +
    '.pg-brand{font:700 22px var(--font-display);letter-spacing:.01em}' +
    '.pg-hero{text-align:center;max-width:640px;margin:0 auto 30px}.pg-hero h1{font-size:clamp(38px,7vw,60px);line-height:1;margin:0 0 12px}.pg-hero p{margin:0;font-size:18px;color:var(--ink-2)}' +
    '.pg-plans{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch}@media(max-width:720px){.pg-plans{grid-template-columns:1fr}}' +
    '.pg-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px 22px 24px;display:flex;flex-direction:column;gap:14px}' +
    '.pg-card.pro{border:2px solid var(--court);box-shadow:0 0 0 6px color-mix(in srgb,var(--court) 12%,transparent),0 18px 44px color-mix(in srgb,var(--court) 18%,transparent);position:relative}' +
    '.pg-tag{position:absolute;top:-12px;left:20px;background:var(--court);color:var(--court-ink);font:600 12px var(--font-mono);letter-spacing:.05em;text-transform:uppercase;padding:5px 10px;border-radius:999px}' +
    '.pg-card h2{margin:0;font-size:26px}.pg-price{font:700 46px/1 var(--font-display)}.pg-price small{font:500 15px var(--font-body);color:var(--ink-2)}' +
    '.pg-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;flex:1}.pg-list li{display:flex;gap:10px;align-items:flex-start;font-size:15px}.pg-list .ck{flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:var(--court);color:var(--court-ink);margin-top:1px}.pg-list .no{background:var(--surface-2);color:var(--ink-2)}.pg-list .off{color:var(--ink-2)}' +
    '.pg-soon{font:500 10px var(--font-mono);letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--line);color:var(--ink-2);border-radius:999px;padding:2px 7px;margin-left:6px;white-space:nowrap}' +
    '.pg .btn.big{font-size:17px;padding:14px 22px;justify-content:center;width:100%}.pg .msg{font-size:14px;padding:10px 12px;border-radius:8px;background:color-mix(in srgb,#d33 14%,transparent)}.pg .msg.ok{background:color-mix(in srgb,var(--court) 18%,transparent)}' +
    '.pg-auth{max-width:440px;margin:22px auto 0;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px}.pg-auth .ac{gap:12px}' +
    '.pg-note{text-align:center;color:var(--ink-2);font-size:13px;margin:18px 0 0}.pg-faq{margin:38px auto 0;max-width:640px;display:grid;gap:10px}.pg-faq h3{margin:0 0 4px;font-size:24px}.pg-faq details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 16px}.pg-faq summary{cursor:pointer;font-weight:600}.pg-faq p{margin:8px 0 0;color:var(--ink-2)}';
  document.head.appendChild(pcss);

  function pgFeat(on, text, soon) { return '<li class="' + (on ? '' : 'off') + '"><span class="ck ' + (on ? '' : 'no') + '">' + (on ? '✓' : '–') + '</span><span>' + esc(text) + (soon ? '<span class="pg-soon">Coming soon</span>' : '') + '</span></li>'; }
  function pageHtml() {
    var price = cfg.priceLabel || '$4.99', paid = RR.paid, end = profile && profile.current_period_end ? fmt(profile.current_period_end) : '';
    var cta;
    if (!loaded) cta = '<button class="btn big" disabled>Loading…</button>';
    else if (paid) cta = '<button class="btn big" data-ac="portal"' + (busy ? ' disabled' : '') + '>Manage billing</button>' + (end ? '<p class="pg-note" style="margin:0">' + (profile.cancel_at_period_end ? 'Premium ends on ' : 'Renews on ') + esc(end) + '</p>' : '');
    else if (user) cta = '<button class="btn big" data-ac="checkout"' + (busy ? ' disabled' : '') + '>' + esc(busy === 'rapid-function' ? 'Opening secure checkout…' : 'Subscribe for ' + price + '/month') + '</button>';
    else cta = '<button class="btn big" data-ac="mode-up-scroll">Create account to subscribe</button>';
    var auth = (!loaded || user) ? '' : '<div class="pg-auth" id="pg-auth"><p style="margin:0 0 10px;color:var(--ink-2)">Step 1 of 2. Make your free account, then you can subscribe.</p>' + accountHtml() + '</div>';
    var m2 = (user || !msg) ? '' : '';
    return '<div class="pg-in"><div class="pg-top"><button class="pg-back" data-ac="back" type="button">← Back to rackets</button><span class="pg-brand">Racket Radar</span></div>' +
      '<div class="pg-hero"><h1>Never overpay for a racket.</h1><p>Premium watches the prices for you across every store.</p></div>' +
      (user && msg ? '<div style="max-width:640px;margin:0 auto 16px"><p class="msg' + (msgOk ? ' ok' : '') + '" role="status">' + esc(msg) + '</p></div>' : '') +
      '<div class="pg-plans">' +
        '<div class="pg-card"><div><h2>Free</h2></div><div class="pg-price">$0<small> forever</small></div><ul class="pg-list">' +
          pgFeat(true, 'Compare prices across all stores') + pgFeat(true, 'Prices refreshed every 3 days') + pgFeat(true, 'Totals with shipping, tax and tariffs') + pgFeat(false, 'Watchlist') + pgFeat(false, 'Price history charts') + pgFeat(false, 'Price drop email alerts') + '</ul>' +
          '<div class="pg-note" style="margin:0;text-align:left">' + (paid ? '' : (user ? 'Your current plan' : '')) + '</div></div>' +
        '<div class="pg-card pro"><span class="pg-tag">' + (paid ? 'Your plan' : 'Premium') + '</span><div><h2>Premium</h2></div><div class="pg-price">' + esc(price) + '<small> / month</small></div><ul class="pg-list">' +
          pgFeat(true, 'Everything in Free') + pgFeat(true, 'Watchlist for up to 25 items, saved to your account') + pgFeat(true, 'Full price history chart for every racket') + pgFeat(true, 'Email alerts when a price drops') + pgFeat(true, 'Prices checked every hour for your alerts') + pgFeat(true, 'Text message alerts', true) + pgFeat(true, 'More stores', true) + '</ul>' + cta + '</div>' +
      '</div>' + auth +
      '<p class="pg-note">Secure payment by Stripe. We never see your card. Cancel any time from Billing.</p>' +
      '<div class="pg-faq"><h3>Questions</h3>' +
        '<details><summary>Can I cancel any time?</summary><p>Yes. Open Billing and click Manage billing. You keep Premium until the end of the period you paid for.</p></details>' +
        '<details><summary>Do my watchlist and settings follow me?</summary><p>Yes. They are saved to your account, so they appear on any device when you sign in.</p></details>' +
        '<details><summary>What are the “Coming soon” items?</summary><p>Text message alerts and extra stores are being built. They switch on for Premium members as they launch, at no extra cost.</p></details>' +
      '</div></div>';
  }
  function pagePaint() {
    if (!pg || pg.hidden) return;
    var key = [!!user, loaded, RR.paid, mode, busy, msg, msgOk, profile && profile.current_period_end, profile && profile.cancel_at_period_end].join('|');
    if (key === pgKey) return; pgKey = key;
    var top = pg.scrollTop; pg.innerHTML = pageHtml(); pg.scrollTop = top;
  }
  function pgSync() {
    var want = location.hash === '#premium';
    if (want && !pg) { pg = document.createElement('div'); pg.className = 'pg'; pg.hidden = true; pg.setAttribute('role', 'dialog'); pg.setAttribute('aria-label', 'Premium'); document.body.appendChild(pg); }
    if (!pg) return;
    if (want && pg.hidden) { pg.hidden = false; pgKey = ''; document.documentElement.classList.add('noscroll'); pagePaint(); pg.scrollTop = 0; }
    else if (!want && !pg.hidden) { pg.hidden = true; document.documentElement.classList.remove('noscroll'); }
  }
  function openPricing() { RR.closeSettings(); if (location.hash !== '#premium') history.pushState(null, '', location.pathname + location.search + '#premium'); pgSync(); }
  function closePricing() { if (location.hash === '#premium') history.pushState(null, '', location.pathname + location.search); pgSync(); }
  window.addEventListener('hashchange', pgSync); window.addEventListener('popstate', pgSync);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pg && !pg.hidden) closePricing(); });
  pgSync();

  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('[data-ac="form"]'); if (!f) return; e.preventDefault();
    if (mode === 'reset') {
      var np = f.elements.pw.value; if (np.length < 8) { say('Your password needs at least 8 characters.'); return; }
      busy = 'x'; bump(); sb.auth.updateUser({ password: np }).then(function (r) { busy = ''; mode = 'in'; say(r.error ? r.error.message : 'Password updated.', !r.error); }); return;
    }
    email = (f.elements.email.value || '').trim(); var pw = f.elements.pw ? f.elements.pw.value : '';
    if (!/^\S+@\S+\.\S+$/.test(email)) { say('Enter a valid email.'); return; }
    if (mode === 'forgot') {
      busy = 'x'; bump(); sb.auth.resetPasswordForEmail(email, { redirectTo: cfg.siteUrl }).then(function (r) { busy = ''; say(r.error ? r.error.message : 'If that email has an account, a reset link is on its way.', !r.error); }); return;
    }
    if (pw.length < 8) { say('Your password needs at least 8 characters.'); return; }
    busy = 'x'; bump();
    var p = mode === 'up' ? sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: cfg.siteUrl } }) : sb.auth.signInWithPassword({ email: email, password: pw });
    p.then(function (r) {
      busy = '';
      if (r.error) { say(r.error.message); return; }
      if (mode === 'up' && !r.data.session) { say('Check your email to confirm your account, then sign in.', true); mode = 'in'; return; }
      msg = ''; bump();
    });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ac]'); if (!b || b.getAttribute('data-ac') === 'form') return;
    var a = b.getAttribute('data-ac');
    if (a === 'mode-in' || a === 'mode-up' || a === 'mode-forgot') { mode = a.slice(5); msg = ''; bump(); }
    else if (a === 'signin') { mode = 'in'; RR.openSettings('account'); bump(); }
    else if (a === 'out') { sb.auth.signOut().then(function () { RR.setWatch([]); msg = ''; bump(); }); }
    else if (a === 'upgrade') RR.upgrade();
    else if (a === 'checkout') checkout();
    else if (a === 'toggle-email') { var on = b.checked; if (profile) profile.email_alerts = on; sb.from('profiles').update({ email_alerts: on }).eq('id', user.id).then(function (r) { if (r.error) { if (profile) profile.email_alerts = !on; say('Could not save that. Try again.'); } }); return; }
    else if (a === 'back') closePricing();
    else if (a === 'open-pricing') openPricing();
    else if (a === 'mode-up-scroll') { mode = 'up'; bump(); var au = document.getElementById('pg-auth'); if (au) au.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else if (a === 'portal') go('billing-portal');
  });
  window.addEventListener('pagehide', function () { clearTimeout(saveTimer); });
})();
