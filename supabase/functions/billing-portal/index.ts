// Opens Stripe's customer portal (update card, see invoices, cancel) for the signed-in person.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'Please sign in first.' }, 401);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: prof } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    if (!prof?.stripe_customer_id) return json({ error: 'No billing account yet.' }, 400);

    const r = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + Deno.env.get('STRIPE_SECRET_KEY'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customer: prof.stripe_customer_id, return_url: Deno.env.get('SITE_URL') ?? 'https://gitbrainhub.github.io/racketradar/' }),
    });
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message || 'Stripe error' }, 500);
    return json({ url: d.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
