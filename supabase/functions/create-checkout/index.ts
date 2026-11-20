// Starts a Stripe Checkout page for the signed-in person and returns its link.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function stripe(path: string, params: Record<string, string>) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + Deno.env.get('STRIPE_SECRET_KEY'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || 'Stripe error');
  return d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'Please sign in first.' }, 401);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: prof } = await admin.from('profiles').select('plan, stripe_customer_id').eq('id', user.id).single();
    if (prof?.plan === 'premium') return json({ error: 'You already have Premium. Use Billing to manage it.' }, 400);

    let customer = prof?.stripe_customer_id as string | undefined;
    if (!customer) {
      const c = await stripe('customers', { email: user.email ?? '', 'metadata[user_id]': user.id });
      customer = c.id;
      await admin.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }
    const site = Deno.env.get('SITE_URL') ?? 'https://gitbrainhub.github.io/racketradar/';
    const s = await stripe('checkout/sessions', {
      mode: 'subscription', customer: customer!, client_reference_id: user.id,
      'line_items[0][price]': Deno.env.get('STRIPE_PRICE_ID')!, 'line_items[0][quantity]': '1',
      'subscription_data[metadata][user_id]': user.id,
      allow_promotion_codes: 'true',
      success_url: site + '?upgraded=1', cancel_url: site,
    });
    return json({ url: s.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
