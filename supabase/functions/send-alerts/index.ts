// Called once an hour by GitHub Actions with the latest prices.
// Finds Premium members whose watched rackets dropped to their "alert me below" price, and emails them once.
// Deploy with "Verify JWT" turned OFF. The ALERT_KEY secret below is the lock.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Price = { now: number; store: string; url: string; name: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Compare two secrets without leaking where they differ.
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const key = Deno.env.get('ALERT_KEY') ?? '';
  if (!key || !same(req.headers.get('x-alert-key') ?? '', key)) return new Response('no', { status: 401 });

  const body = await req.json();
  const prices: Record<string, Price> = body.prices ?? {};
  const fxCAD: number = body.fx?.CAD || 0.7;
  const site = Deno.env.get('SITE_URL') ?? 'https://gitbrainhub.github.io/racketradar/';
  const from = Deno.env.get('ALERT_FROM') ?? 'Racket Radar <onboarding@resend.dev>';

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: people, error } = await admin
    .from('profiles')
    .select('id, email, watch, alerts, alert_state')
    .eq('plan', 'premium')
    .eq('email_alerts', true);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let emailed = 0;
  let failed = 0;
  let checked = 0;

  for (const p of people ?? []) {
    const targets = p.alerts?.targets;
    const cur: string = targets?.cur === 'CAD' ? 'CAD' : 'USD';
    const tv = targets?.v;
    if (!p.email || !tv || !Array.isArray(p.watch)) continue;
    checked++;

    const before = JSON.stringify(p.alert_state ?? {});
    const state: Record<string, number> = { ...(p.alert_state ?? {}) };
    const hits: { id: string; price: number; target: number; info: Price }[] = [];

    for (const id of p.watch as string[]) {
      const info = prices[id];
      const target = Number(tv[id]);
      // Out of stock everywhere, or no target saved: leave things as they are.
      if (!info || !(target > 0)) continue;

      const price = Math.round((cur === 'CAD' ? info.now / fxCAD : info.now) * 100) / 100;
      if (price <= target) {
        // A new drop, or an even lower price than the one we already emailed about.
        if (state[id] == null || price < state[id] - 0.005) {
          hits.push({ id, price, target, info });
          state[id] = price;
        }
      } else {
        // Back above their price: alert again the next time it dips.
        delete state[id];
      }
    }

    if (!hits.length) {
      if (JSON.stringify(state) !== before) await admin.from('profiles').update({ alert_state: state }).eq('id', p.id);
      continue;
    }

    const sym = cur === 'CAD' ? 'C$' : '$';
    const money = (n: number) => sym + n.toFixed(2);
    const subject =
      hits.length === 1
        ? `Price drop: ${hits[0].info.name} is ${money(hits[0].price)}`
        : `${hits.length} of your watched rackets dropped in price`;

    const rows = hits
      .map(
        (h) =>
          `<tr><td style="padding:12px 0;border-bottom:1px solid #e3e8e5">` +
          `<strong style="font-size:16px">${esc(h.info.name)}</strong><br>` +
          `<span style="color:#4a5a53">Now <strong style="color:#0e6a51;font-size:18px">${money(h.price)}</strong> at ${esc(h.info.store)}` +
          ` &nbsp;·&nbsp; your price ${money(h.target)}</span><br>` +
          `<a href="${esc(h.info.url)}" style="color:#0e6a51">View at ${esc(h.info.store)}</a></td></tr>`,
      )
      .join('');

    const html =
      `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#13201b">` +
      `<h2 style="margin:0 0 4px">Racket Radar</h2>` +
      `<p style="margin:0 0 12px;color:#4a5a53">A racket on your watchlist hit your price.</p>` +
      `<table style="width:100%;border-collapse:collapse">${rows}</table>` +
      `<p style="color:#4a5a53;font-size:13px;margin-top:18px">Prices are listed prices before shipping, tax and tariffs. ` +
      `Open <a href="${site}" style="color:#0e6a51">Racket Radar</a> to change your alert prices, or turn these emails off under Settings → Account.</p></div>`;

    const text =
      hits.map((h) => `${h.info.name}: ${money(h.price)} at ${h.info.store} (your price ${money(h.target)})\n${h.info.url}`).join('\n\n') +
      `\n\nChange or turn off alerts: ${site}`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + Deno.env.get('RESEND_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [p.email], subject, html, text }),
    });

    if (r.ok) {
      emailed++;
      await admin.from('profiles').update({ alert_state: state }).eq('id', p.id);
    } else {
      // State is not saved, so the next hour tries again.
      failed++;
      console.log('resend failed', r.status, await r.text());
    }
  }

  return new Response(JSON.stringify({ premium_checked: checked, emailed, failed }), { headers: { 'Content-Type': 'application/json' } });
});
