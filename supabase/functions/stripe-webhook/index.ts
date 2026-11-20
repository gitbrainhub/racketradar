// Stripe calls this after every payment event. It is the ONLY thing that can switch someone to Premium or back to Free.
// Deploy with "Verify JWT" turned OFF (Stripe has no Supabase login; the signature check below is the lock).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function verify(raw: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!parts.t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;                       // too old: could be a replay
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, enc.encode(parts.t + '.' + raw)));
  return sigs.some((s) => s.length === mac.length && s === mac);
}

Deno.serve(async (req) => {
  const raw = await req.text();
  const ok = await verify(raw, req.headers.get('stripe-signature') ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  if (!ok) return new Response('bad signature', { status: 400 });

  const ev = JSON.parse(raw);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const obj = ev.data.object;
  let err: { message: string } | null = null;

  if (ev.type === 'checkout.session.completed' && obj.client_reference_id) {
    ({ error: err } = await admin.from('profiles').update({ stripe_customer_id: obj.customer, stripe_subscription_id: obj.subscription }).eq('id', obj.client_reference_id));
  } else if (ev.type.startsWith('customer.subscription.')) {
    const status: string = ev.type === 'customer.subscription.deleted' ? 'canceled' : obj.status;
    const premium = status === 'active' || status === 'trialing' || status === 'past_due';        // past_due: Stripe is still retrying the card
    const end = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
    const patch = {
      plan: premium ? 'premium' : 'free', status, stripe_customer_id: obj.customer, stripe_subscription_id: obj.id,
      current_period_end: end ? new Date(end * 1000).toISOString() : null, cancel_at_period_end: !!obj.cancel_at_period_end,
    };
    const uid = obj.metadata?.user_id;
    ({ error: err } = uid ? await admin.from('profiles').update(patch).eq('id', uid) : await admin.from('profiles').update(patch).eq('stripe_customer_id', obj.customer));
  }
  if (err) return new Response('db error', { status: 500 });                                       // Stripe will retry
  return new Response('ok');
});
