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
  function say(m, ok) { msg = m || ''; msgOk = !!ok; sig = ''; RR.repaintSettings(); }
  function bump() { sig = ''; RR.repaintSettings(); }

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
    sb.from('profiles').select('plan,status,current_period_end,cancel_at_period_end,watch,alerts,stripe_customer_id').eq('id', user.id).maybeSingle().then(function (r) {
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
    if (profile && profile.plan === 'premium') { RR.openSettings('billing'); say('You are Premium. Thank you!', true); return; }
    RR.openSettings('billing'); busy = 'wait'; say('Payment received. Turning on Premium…', true);
    var n = 0, iv = setInterval(function () {
      n++; sb.from('profiles').select('plan,status,current_period_end,cancel_at_period_end,watch,alerts,stripe_customer_id').eq('id', user.id).maybeSingle().then(function (r) {
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
  RR.upgrade = function () {
    if (!user) { mode = 'up'; RR.openSettings('account'); say('Create a free account first, then you can upgrade.', true); return; }
    RR.openSettings('billing'); go('create-checkout');
  };

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
        '<div><button type="button" class="btn" data-ac="portal"' + (busy ? ' disabled' : '') + '>Manage billing</button></div><p>Update your card, see invoices, or cancel any time.</p></div>';
    }
    return '<div class="ac">' + planRow('sm-plan2') + perks() + m() + '<div><button type="button" class="btn" data-ac="upgrade"' + (busy ? ' disabled' : '') + '>' + esc(busy === 'create-checkout' ? 'Opening checkout…' : RR.t('upgradeBtn')) + '</button></div></div>';
  }

  RR.paint = function (root, tab) {
    var key = [tab, !!user, loaded, RR.paid, RR.premium, mode, busy, msg, user && user.email, profile && profile.current_period_end, profile && profile.cancel_at_period_end].join('|');
    if (key === sig) return; sig = key;
    var a = root.querySelector('[data-sec="account"]'), b = root.querySelector('[data-sec="billing"]');
    if (a) a.innerHTML = accountHtml(); if (b) b.innerHTML = billingHtml();
  };

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
    else if (a === 'portal') go('billing-portal');
  });
  window.addEventListener('pagehide', function () { clearTimeout(saveTimer); });
})();
