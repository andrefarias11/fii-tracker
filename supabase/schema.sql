-- ==========================================
-- FII TRACKER - ESTRUTURA DO BANCO DE DADOS
-- Execute este script no SQL Editor do Supabase
-- ==========================================

-- 1. Tabela de Transações (Aportes, Vendas e Proventos B3)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'BUY' CHECK (type IN ('BUY', 'SELL', 'DIVIDEND')),
    date DATE NOT NULL,
    shares NUMERIC NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    broker TEXT NOT NULL DEFAULT 'XP Investimentos',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migração idempotente caso a coluna type ainda não exista em base já criada
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'BUY' CHECK (type IN ('BUY', 'SELL', 'DIVIDEND'));

-- Índices para acelerar busca por ticker, data e tipo
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON public.transactions (ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (type);

-- 2. Tabela de Metas da Carteira
CREATE TABLE IF NOT EXISTS public.portfolio_goals (
    id TEXT PRIMARY KEY DEFAULT 'default_goals',
    monthly_target NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    milestone_equity_target NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    monthly_income_target NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir metas padrão se ainda não existirem
INSERT INTO public.portfolio_goals (id, monthly_target, milestone_equity_target, monthly_income_target)
VALUES ('default_goals', 200.00, 1000.00, 10.00)
ON CONFLICT (id) DO NOTHING;

-- 3. Tabela de Dividendos Customizados (para ajuste fino de proventos)
CREATE TABLE IF NOT EXISTS public.custom_dividends (
    ticker TEXT PRIMARY KEY,
    dividend NUMERIC(10, 3) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Renda Fixa e Caixinhas (Reserva de Emergência, Nubank, CDBs e Tesouro Direto)
CREATE TABLE IF NOT EXISTS public.fixed_income_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    institution TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CAIXINHA', 'CDB', 'TESOURO_SELIC', 'TESOURO_IPCA', 'TESOURO_PREFIXADO', 'LCI_LCA', 'OUTROS')),
    invested_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rate_type TEXT NOT NULL DEFAULT 'CDI' CHECK (rate_type IN ('CDI', 'IPCA', 'PREFIXADO')),
    rate_percent NUMERIC(8, 2) NOT NULL DEFAULT 100.00,
    is_exempt BOOLEAN NOT NULL DEFAULT false,
    maturity_date DATE,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fixed_income_type ON public.fixed_income_assets (type);
CREATE INDEX IF NOT EXISTS idx_fixed_income_created_at ON public.fixed_income_assets (created_at);


-- Security and synchronization migration (also executable independently for upgrades).
-- Run after schema.sql for a fresh installation, or directly on an existing installation.
-- Existing rows without an owner remain inaccessible. Assign only after verifying ownership.
BEGIN;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.portfolio_goals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.custom_dividends ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.fixed_income_assets ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS split_adjustment jsonb;
ALTER TABLE public.custom_dividends ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.custom_dividends DROP CONSTRAINT IF EXISTS custom_dividends_pkey;
ALTER TABLE public.custom_dividends ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS custom_dividends_owner_ticker ON public.custom_dividends(user_id, ticker);
CREATE INDEX IF NOT EXISTS transactions_owner_date ON public.transactions(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_goals_owner ON public.portfolio_goals(user_id);
CREATE INDEX IF NOT EXISTS fixed_income_owner ON public.fixed_income_assets(user_id);

CREATE TABLE IF NOT EXISTS public.portfolio_deletions (
  user_id uuid NOT NULL REFERENCES auth.users(id), table_name text NOT NULL,
  row_id text NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, table_name, row_id),
  CHECK (table_name IN ('transactions', 'fixed_income_assets'))
);
CREATE TABLE IF NOT EXISTS public.widget_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id), token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket text PRIMARY KEY, window_start timestamptz NOT NULL, requests integer NOT NULL
);

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','portfolio_goals','custom_dividends','fixed_income_assets','portfolio_deletions','widget_tokens','api_rate_limits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    IF t IN ('transactions','portfolio_goals','custom_dividends','fixed_income_assets') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))', t);
    ELSIF t = 'portfolio_deletions' THEN
      EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))', t);
      EXECUTE format('CREATE POLICY owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))', t);
    END IF;
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.remember_portfolio_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  INSERT INTO portfolio_deletions(user_id, table_name, row_id)
    VALUES(OLD.user_id, TG_TABLE_NAME, OLD.id) ON CONFLICT DO NOTHING;
  RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION public.prevent_portfolio_resurrection() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM portfolio_deletions WHERE user_id = NEW.user_id AND table_name = TG_TABLE_NAME AND row_id = NEW.id) THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.updated_at < OLD.updated_at THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','fixed_income_assets'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS remember_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER remember_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.remember_portfolio_delete()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS prevent_resurrection ON public.%I', t);
    EXECUTE format('CREATE TRIGGER prevent_resurrection BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_portfolio_resurrection()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.delete_portfolio_rows(target_table text, row_ids text[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR target_table NOT IN ('transactions','fixed_income_assets','custom_dividends') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF target_table = 'custom_dividends' THEN
    DELETE FROM custom_dividends WHERE user_id = auth.uid() AND ticker = ANY(row_ids);
    RETURN;
  END IF;
  INSERT INTO portfolio_deletions(user_id, table_name, row_id)
    SELECT auth.uid(), target_table, unnest(row_ids) ON CONFLICT DO NOTHING;
  EXECUTE format('DELETE FROM public.%I WHERE user_id = auth.uid() AND id = ANY($1)', target_table) USING row_ids;
END $$;
REVOKE ALL ON FUNCTION public.delete_portfolio_rows(text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_portfolio_rows(text,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_api_limit(bucket_key text, max_requests integer, window_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE used integer;
BEGIN
  DELETE FROM api_rate_limits WHERE window_start < now() - interval '2 days';
  INSERT INTO api_rate_limits AS limits(bucket, window_start, requests) VALUES(bucket_key, now(), 1)
  ON CONFLICT(bucket) DO UPDATE SET
    requests = CASE WHEN limits.window_start < now() - make_interval(secs => window_seconds) THEN 1 ELSE limits.requests + 1 END,
    window_start = CASE WHEN limits.window_start < now() - make_interval(secs => window_seconds) THEN now() ELSE limits.window_start END
  RETURNING requests INTO used;
  RETURN used <= max_requests;
END $$;
REVOKE ALL ON FUNCTION public.consume_api_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_limit(text,integer,integer) TO service_role;
-- Legacy admin RPC must never be callable with a public client key.
DO $$ BEGIN
  IF to_regprocedure('public.get_admin_accounts_overview()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_admin_accounts_overview() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_admin_accounts_overview() TO service_role;
  END IF;
END $$;

-- 5. Server-side Web Push preferences, multi-device subscriptions, deduplication and delivery state
CREATE TABLE IF NOT EXISTS public.push_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  notify_confirmed_dividend boolean NOT NULL DEFAULT true,
  notify_ex_date boolean NOT NULL DEFAULT true,
  notify_payment_day boolean NOT NULL DEFAULT true,
  notify_important_news boolean NOT NULL DEFAULT true,
  notify_macro_news boolean NOT NULL DEFAULT true,
  notify_market_session boolean NOT NULL DEFAULT true,
  notify_price_opportunity boolean NOT NULL DEFAULT true,
  notify_market_bargain boolean NOT NULL DEFAULT true,
  notify_mentor_consensus boolean NOT NULL DEFAULT true,
  daily_time text NOT NULL DEFAULT '08:00' CHECK (daily_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  privacy_mode text NOT NULL DEFAULT 'discreet' CHECK (privacy_mode IN ('discreet', 'detailed')),
  last_processed_at timestamptz,
  last_processed_local_date date,
  last_process_status text CHECK (last_process_status IN ('idle', 'no_events', 'queued', 'sent', 'partial_failure', 'failed', 'skipped_no_devices')),
  last_process_message text,
  last_push_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  device_label text,
  is_active boolean NOT NULL DEFAULT true,
  deactivated_reason text,
  last_status_code integer,
  last_accepted_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON public.push_subscriptions (user_id, is_active);

CREATE TABLE IF NOT EXISTS public.push_daily_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  digest_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL,
  tag text NOT NULL,
  events_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'retry_pending', 'failed', 'skipped_no_devices')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_date, digest_key)
);

CREATE INDEX IF NOT EXISTS idx_push_daily_digests_user_date
  ON public.push_daily_digests (user_id, local_date DESC);

CREATE INDEX IF NOT EXISTS idx_push_daily_digests_pending
  ON public.push_daily_digests (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS public.push_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('DIVIDEND_ANNOUNCED', 'DIVIDEND_UPDATED', 'EX_DATE_REMINDER', 'PAYMENT_REMINDER', 'FII_NEWS', 'MACRO_NEWS', 'MARKET_OPEN', 'MARKET_CLOSE')),
  event_reference text NOT NULL,
  data_version text NOT NULL,
  source text NOT NULL,
  source_event_date text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  digest_id uuid REFERENCES public.push_daily_digests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker, event_type, event_reference, data_version)
);

CREATE INDEX IF NOT EXISTS idx_push_alert_events_lookup
  ON public.push_alert_events (user_id, ticker, event_reference);

CREATE TABLE IF NOT EXISTS public.push_device_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id uuid NOT NULL REFERENCES public.push_daily_digests(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'accepted', 'retry_pending', 'failed_permanent', 'expired_subscription')),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_status_code integer,
  last_error text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (digest_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_push_device_deliveries_digest
  ON public.push_device_deliveries (digest_id, status);

CREATE INDEX IF NOT EXISTS idx_push_device_deliveries_user
  ON public.push_device_deliveries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.push_user_locks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz NOT NULL
);

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'push_notification_preferences',
    'push_subscriptions',
    'push_daily_digests',
    'push_alert_events',
    'push_device_deliveries',
    'push_user_locks'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    IF t IN ('push_notification_preferences', 'push_subscriptions') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))', t);
    ELSIF t IN ('push_daily_digests', 'push_alert_events', 'push_device_deliveries') THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))', t);
    END IF;
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.claim_push_user_lock(
  p_user_id uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60,
  p_now timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE claimed uuid;
BEGIN
  INSERT INTO public.push_user_locks AS l (user_id, worker_id, locked_at, locked_until)
  VALUES (
    p_user_id,
    p_worker_id,
    p_now,
    p_now + make_interval(secs => GREATEST(1, p_lease_seconds))
  )
  ON CONFLICT (user_id) DO UPDATE SET
    worker_id = EXCLUDED.worker_id,
    locked_at = p_now,
    locked_until = EXCLUDED.locked_until
  WHERE l.locked_until <= p_now OR l.worker_id = EXCLUDED.worker_id
  RETURNING user_id INTO claimed;

  RETURN claimed IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION public.claim_push_user_lock(uuid, text, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_user_lock(uuid, text, integer, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.release_push_user_lock(
  p_user_id uuid,
  p_worker_id text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  DELETE FROM public.push_user_locks
  WHERE user_id = p_user_id AND worker_id = p_worker_id;
END $$;

REVOKE ALL ON FUNCTION public.release_push_user_lock(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_push_user_lock(uuid, text) TO service_role;

-- Reserva do resumo e de todos os eventos na mesma transação PostgreSQL.
CREATE OR REPLACE FUNCTION public.reserve_push_digest_and_events(
  p_user_id uuid,
  p_local_date date,
  p_digest_key text,
  p_title text,
  p_body text,
  p_url text,
  p_tag text,
  p_events jsonb,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 300,
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  digest_row public.push_daily_digests;
  event_row jsonb;
  inserted_count integer := 0;
  row_count integer := 0;
BEGIN
  INSERT INTO public.push_daily_digests (
    user_id, local_date, digest_key, title, body, url, tag, events_json,
    status, next_attempt_at, locked_by, locked_until, updated_at
  ) VALUES (
    p_user_id, p_local_date, p_digest_key, p_title, p_body, p_url, p_tag, p_events,
    'processing', p_now, p_worker_id,
    p_now + make_interval(secs => GREATEST(1, p_lease_seconds)), p_now
  )
  ON CONFLICT (user_id, local_date, digest_key) DO NOTHING
  RETURNING * INTO digest_row;

  IF digest_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  FOR event_row IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    INSERT INTO public.push_alert_events (
      user_id, ticker, event_type, event_reference, data_version, source,
      source_event_date, payload, digest_id, status, updated_at
    ) VALUES (
      p_user_id,
      event_row->>'ticker',
      event_row->>'eventType',
      event_row->>'eventReference',
      event_row->>'dataVersion',
      event_row->>'source',
      event_row->>'sourceEventDate',
      jsonb_build_object(
        'amountPerShare', event_row->'amountPerShare',
        'exDate', event_row->'exDate',
        'paymentDate', event_row->'paymentDate',
        'referenceCycle', left(event_row->>'paymentDate', 7)
      ),
      digest_row.id,
      'reserved',
      p_now
    )
    ON CONFLICT (user_id, ticker, event_type, event_reference, data_version) DO NOTHING;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    inserted_count := inserted_count + row_count;
  END LOOP;

  RETURN jsonb_build_object(
    'digest', to_jsonb(digest_row),
    'reservedEventsCount', inserted_count
  );
END $$;

REVOKE ALL ON FUNCTION public.reserve_push_digest_and_events(uuid, date, text, text, text, text, text, jsonb, text, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_push_digest_and_events(uuid, date, text, text, text, text, text, jsonb, text, integer, timestamptz) TO service_role;

COMMIT;
