-- Server-side Web Push preferences, multi-device subscriptions, deduplication and delivery state.
-- Run after 20261019_security_and_sync.sql on existing installations, or via schema.sql on fresh installations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.push_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  notify_confirmed_dividend boolean NOT NULL DEFAULT true,
  notify_ex_date boolean NOT NULL DEFAULT true,
  notify_payment_day boolean NOT NULL DEFAULT true,
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
  event_type text NOT NULL CHECK (event_type IN ('DIVIDEND_ANNOUNCED', 'DIVIDEND_UPDATED', 'EX_DATE_REMINDER', 'PAYMENT_REMINDER')),
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

COMMIT;

