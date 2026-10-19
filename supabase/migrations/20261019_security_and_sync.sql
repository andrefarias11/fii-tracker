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
COMMIT;
