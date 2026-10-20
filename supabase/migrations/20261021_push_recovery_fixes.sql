-- Reserva do resumo e de todos os eventos na mesma transação PostgreSQL.
-- Evita deixar digest sem eventos reservados se o processo for interrompido.
BEGIN;

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
