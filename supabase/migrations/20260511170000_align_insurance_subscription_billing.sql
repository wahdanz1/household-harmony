-- Align insurances and subscriptions on the same "recurring cost cadence"
-- shape: shared billing_cycle_enum, billing_month + billing_day on both,
-- consistent column names.
--
-- Behaviour unchanged — billing_month and billing_day stay nullable so the
-- form can soft-hint without forcing. Code paths that consume these fields
-- already gracefully handle nulls (no date → no due-this-month warning).

CREATE TYPE public.billing_cycle_enum AS ENUM (
    'monthly', 'quarterly', 'semi_annually', 'yearly'
);

ALTER TABLE public.insurances RENAME COLUMN invoice_month TO billing_month;

ALTER TABLE public.insurances
    ADD COLUMN IF NOT EXISTS billing_day integer
    CHECK (billing_day IS NULL OR (billing_day BETWEEN 1 AND 31));

ALTER TABLE public.insurances RENAME COLUMN payment_frequency TO billing_cycle;

ALTER TABLE public.insurances
    ALTER COLUMN billing_cycle DROP DEFAULT,
    ALTER COLUMN billing_cycle TYPE public.billing_cycle_enum
        USING billing_cycle::public.billing_cycle_enum,
    ALTER COLUMN billing_cycle SET DEFAULT 'yearly'::public.billing_cycle_enum;

ALTER TABLE public.subscriptions
    ALTER COLUMN billing_cycle DROP DEFAULT,
    ALTER COLUMN billing_cycle TYPE public.billing_cycle_enum
        USING billing_cycle::public.billing_cycle_enum,
    ALTER COLUMN billing_cycle SET DEFAULT 'monthly'::public.billing_cycle_enum;
