-- F1: Idempotency journal for webhook events.
-- Prevents double-payout / double-benefit from duplicate Stripe deliveries.
-- processed_at is set ONLY after business logic succeeds, so retries of
-- failed deliveries can re-run the handler (processed_at IS NULL = retry me).
-- RLS enabled with NO policies → service-role only access; no client writes.

CREATE TABLE IF NOT EXISTS public.webhook_events (
    provider     text        NOT NULL,
    event_id     text        NOT NULL,
    type         text        NOT NULL,
    received_at  timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    payload      jsonb       NOT NULL DEFAULT '{}',

    CONSTRAINT webhook_events_pkey PRIMARY KEY (event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- No POLICY statements = only service-role can read/write.

CREATE INDEX IF NOT EXISTS webhook_events_provider_type_idx
    ON public.webhook_events (provider, type);

CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx
    ON public.webhook_events (provider, received_at)
    WHERE processed_at IS NULL;

COMMENT ON TABLE public.webhook_events IS
    'F1: One row per webhook event_id. processed_at=NULL means received but not yet '
    'successfully handled — Stripe retries may re-run the handler.';
