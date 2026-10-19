import { getSupabaseClient } from './supabase';

export async function authenticatedFetch(url: string, init: RequestInit = {}) {
  const session = await getSupabaseClient()?.auth.getSession();
  const token = session?.data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers, cache: 'no-store' });
}
