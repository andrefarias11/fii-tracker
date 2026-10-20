-- Adds curated news and B3 session alerts to server-side Push preferences.
BEGIN;

ALTER TABLE public.push_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_important_news boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_macro_news boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_market_session boolean NOT NULL DEFAULT true;

ALTER TABLE public.push_alert_events
  DROP CONSTRAINT IF EXISTS push_alert_events_event_type_check;
ALTER TABLE public.push_alert_events
  ADD CONSTRAINT push_alert_events_event_type_check CHECK (event_type IN (
    'DIVIDEND_ANNOUNCED', 'DIVIDEND_UPDATED', 'EX_DATE_REMINDER', 'PAYMENT_REMINDER',
    'FII_NEWS', 'MACRO_NEWS', 'MARKET_OPEN', 'MARKET_CLOSE'
  ));

COMMIT;
