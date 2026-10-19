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
    const migration1 = readFileSync('supabase/migrations/20261019_security_and_sync.sql', 'utf8');
    const migration2 = readFileSync('supabase/migrations/20261020_server_web_push.sql', 'utf8');
    await db.exec(schema);
    await db.exec(migration1); // upgrade can be rerun safely
    await db.exec(migration2); // server web push migration can be rerun safely
    await db.exec(`SET ROLE anon;`);
    await assert.rejects(() => db.query('SELECT * FROM public.transactions'), /permission denied/);
    await assert.rejects(() => db.query('SELECT * FROM public.push_subscriptions'), /permission denied/);
    await assert.rejects(() => db.query('SELECT * FROM public.push_notification_preferences'), /permission denied/);

    await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';`);
    await db.exec(`INSERT INTO public.transactions(id,user_id,ticker,date,shares,price,total) VALUES ('tx1',auth.uid(),'MXRF11','2026-10-01',10,10,100);`);
    await assert.rejects(() => db.exec(`INSERT INTO public.transactions(id,user_id,ticker,date,shares,price,total) VALUES ('bad','22222222-2222-2222-2222-222222222222','MXRF11','2026-10-01',10,10,100)`), /row-level security/);
    await db.exec(`INSERT INTO public.custom_dividends(user_id,ticker,dividend) VALUES(auth.uid(),'MXRF11',0.10);`);

    // User 1 inserts push preferences and subscription
    await db.exec(`INSERT INTO public.push_notification_preferences(user_id, enabled, daily_time, timezone, privacy_mode) VALUES (auth.uid(), true, '08:00', 'America/Sao_Paulo', 'discreet');`);
    await db.exec(`INSERT INTO public.push_subscriptions(user_id, endpoint, p256dh, auth, device_label) VALUES (auth.uid(), 'https://fcm.googleapis.com/fcm/send/u1-dev1', 'p256dh_key_user_1_device_1_valid_len_123456', 'auth_key_u1_12345', 'iPhone');`);
    // User 1 cannot insert push subscription for User 2
    await assert.rejects(
      () =>
        db.exec(
          `INSERT INTO public.push_subscriptions(user_id, endpoint, p256dh, auth) VALUES ('22222222-2222-2222-2222-222222222222', 'https://fcm.googleapis.com/fcm/send/forged', 'p256dh_key_user_2_device_1_valid_len_123456', 'auth_key_u2_12345')`
        ),
      /row-level security/
    );

    // Switch to User 2: cannot see or modify User 1's transactions or push subscriptions
    await db.exec(`SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';`);
    assert.equal((await db.query('SELECT * FROM public.transactions')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM public.push_subscriptions')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM public.push_notification_preferences')).rows.length, 0);

    await db.exec(`INSERT INTO public.custom_dividends(user_id,ticker,dividend) VALUES(auth.uid(),'MXRF11',0.20);`);
    assert.equal((await db.query('SELECT * FROM public.custom_dividends')).rows.length, 1);

    await db.exec(`SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; SELECT public.delete_portfolio_rows('transactions', ARRAY['tx1']);`);
    await db.exec(`INSERT INTO public.transactions(id,user_id,ticker,date,shares,price,total) VALUES ('tx1',auth.uid(),'MXRF11','2026-10-01',10,10,100);`);
    assert.equal((await db.query('SELECT * FROM public.transactions')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM public.portfolio_deletions')).rows.length, 1);
    await assert.rejects(() => db.query('SELECT * FROM public.widget_tokens'), /permission denied/);
    await assert.rejects(() => db.query("SELECT public.consume_api_limit('forged',1,60)"), /permission denied/);
    await assert.rejects(
      () => db.query("SELECT public.claim_push_user_lock('11111111-1111-1111-1111-111111111111'::uuid, 'w1', 60, now())"),
      /permission denied/
    );

    await db.exec('RESET ROLE; SET ROLE service_role;');
    assert.equal((await db.query<{ allowed: boolean }>("SELECT public.consume_api_limit('test',1,60) AS allowed")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("SELECT public.consume_api_limit('test',1,60) AS allowed")).rows[0].allowed, false);

    // Atomic per-user lock prevents concurrent workers until lease expires or lock is released
    const lock1 = await db.query<{ locked: boolean }>(
      "SELECT public.claim_push_user_lock('11111111-1111-1111-1111-111111111111'::uuid, 'worker-a', 120, '2026-10-20T11:00:00Z'::timestamptz) AS locked"
    );
    assert.equal(lock1.rows[0].locked, true);

    const lock2 = await db.query<{ locked: boolean }>(
      "SELECT public.claim_push_user_lock('11111111-1111-1111-1111-111111111111'::uuid, 'worker-b', 120, '2026-10-20T11:00:30Z'::timestamptz) AS locked"
    );
    assert.equal(lock2.rows[0].locked, false);

    // After lease expires, worker-b can claim the lock to recover interrupted processing
    const lockAfterExpiry = await db.query<{ locked: boolean }>(
      "SELECT public.claim_push_user_lock('11111111-1111-1111-1111-111111111111'::uuid, 'worker-b', 120, '2026-10-20T11:03:00Z'::timestamptz) AS locked"
    );
    assert.equal(lockAfterExpiry.rows[0].locked, true);
  } finally {
    await db.close();
  }
});
