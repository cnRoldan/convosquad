import { createClient } from '@supabase/supabase-js';
import { authorizedWorker } from '../_shared/push-event.ts';

type RevenueCatEvent = {
  app_user_id?: unknown; original_app_user_id?: unknown; product_id?: unknown;
  original_transaction_id?: unknown; store?: unknown; type?: unknown; expiration_at_ms?: unknown;
};

const string = (value: unknown) => typeof value === 'string' ? value : '';
const expiration = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null;

Deno.serve(async request => {
  if (!authorizedWorker(request.headers.get('authorization'), Deno.env.get('REVENUECAT_WEBHOOK_SECRET'))) return new Response('Unauthorized', { status: 401 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const payload = await request.json().catch(() => null) as { event?: RevenueCatEvent } | null;
  const event = payload?.event;
  if (!event || !string(event.product_id) || !string(event.original_transaction_id) || !string(event.type)) return new Response('Invalid RevenueCat event', { status: 400 });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Server configuration incomplete', { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('apply_revenuecat_event', {
    p_app_user_id: string(event.app_user_id), p_original_app_user_id: string(event.original_app_user_id),
    p_product_id: string(event.product_id), p_original_transaction_id: string(event.original_transaction_id),
    p_store: string(event.store), p_event_type: string(event.type), p_expiration_at: expiration(event.expiration_at_ms),
  });
  if (error) return new Response('Could not apply RevenueCat event', { status: 500 });
  return Response.json(data);
});
