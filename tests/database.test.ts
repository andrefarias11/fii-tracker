import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('migration enforces real PostgreSQL ownership, revokes anonymous access and prevents resurrection', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      INSERT INTO auth.users VALUES ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');`);
    const schema = readFileSync('supabase/schema.sql', 'utf8');
    const migration = readFileSync('supabase/migrations/20261019_security_and_sync.sql', 'utf8');
    await db.exec(schema);
    await db.exec(migration); // upgrade can be rerun safely
    await db.exec(`SET ROLE anon;`);
    await assert.rejects(() => db.query('SELECT * FROM public.transactions'), /permission denied/);
    await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';`);
    await db.exec(`INSERT INTO public.transactions(id,user_id,ticker,date,shares,price,total) VALUES ('tx1',auth.uid(),'MXRF11','2026-10-01',10,10,100);`);
    await assert.rejects(() => db.exec(`INSERT INTO public.transactions(id,user_id,ticker,date,shares,price,total) VALUES ('bad','22222222-2222-2222-2222-222222222222','MXRF11','2026-10-01',10,10,100)`), /row-level security/);
    await db.exec(`INSERT INTO public.custom_dividends(user_id,ticker,dividend) VALUES(auth.uid(),'MXRF11',0.10);`);
    await db.exec(`SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';`);
    assert.equal((await db.query('SELECT * FROM public.transactions')).rows.length, 0);
    await db.exec(`INSERT INTO public.custom_dividends(user_id,ticker,dividend) VALUES(auth.uid(),'MXRF11',0.20);`);
    assert.equal((await db.query('SELECT * FROM public.custom_dividends')).rows.length, 1);
    await db.exec(`SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; SELECT public.delete_portfolio_rows('transactions', ARRAY['tx1']);`);
    await db.exec(`INSERT INTO public.transactions(id,user_id,ticker,date,shares,price,total) VALUES ('tx1',auth.uid(),'MXRF11','2026-10-01',10,10,100);`);
    assert.equal((await db.query('SELECT * FROM public.transactions')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM public.portfolio_deletions')).rows.length, 1);
    await assert.rejects(() => db.query('SELECT * FROM public.widget_tokens'), /permission denied/);
    await assert.rejects(() => db.query("SELECT public.consume_api_limit('forged',1,60)"), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE service_role;');
    assert.equal((await db.query<{ allowed: boolean }>("SELECT public.consume_api_limit('test',1,60) AS allowed")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("SELECT public.consume_api_limit('test',1,60) AS allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
});
