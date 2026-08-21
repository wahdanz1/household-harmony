-- Kid schedule for a co-parenting space.
--
-- Stores HANDOVERS, not blocks. Each row is a single transition: at this
-- instant, the kids go to this side. Who has them at any moment is the most
-- recent handover before that moment, and display blocks are derived from
-- consecutive rows.
--
-- Storing transitions rather than start/end pairs makes gaps and overlaps
-- unrepresentable, and moving a pickup time is a one-field edit that both
-- adjacent periods absorb automatically.

-- Which side of the space takes over. Deliberately a side rather than a
-- user id: a co-parent can leave and a new one be invited, and the schedule
-- must keep rendering rather than pointing at a departed account.
--   owner    — whoever created the space
--   coparent — the invited side
CREATE TYPE public.schedule_side AS ENUM ('owner', 'coparent');

-- The usual handover time, so creating one is a date rather than a datetime.
-- Overridable per handover — school days end earlier than weekends.
ALTER TABLE public.coparent_spaces
    ADD COLUMN default_handover_time time NOT NULL DEFAULT '17:00';

CREATE TABLE public.schedule_handovers (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id       uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    at             timestamptz NOT NULL,
    to_side        public.schedule_side NOT NULL,
    encrypted_note text,
    is_encrypted   boolean NOT NULL DEFAULT true,
    created_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    -- Two transitions at the same instant would make "who has them" ambiguous.
    CONSTRAINT schedule_handovers_unique_instant UNIQUE (space_id, at)
);

CREATE INDEX idx_schedule_handovers_space_at
    ON public.schedule_handovers (space_id, at);

-- Append-only record of who changed what, so an edit by the other parent is
-- visible rather than silently overwriting an agreed arrangement.
CREATE TABLE public.schedule_changes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id          uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    actor_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action            text NOT NULL CHECK (action IN ('created', 'moved', 'deleted')),
    encrypted_summary text,
    is_encrypted      boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_changes_space_created
    ON public.schedule_changes (space_id, created_at DESC);


ALTER TABLE public.schedule_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_changes   ENABLE ROW LEVEL SECURITY;


-- Handovers: both parents read and edit freely. Disagreements surface through
-- the change log rather than through a permission wall.
CREATE POLICY "Space members read handovers"
    ON public.schedule_handovers FOR SELECT
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Space members create handovers"
    ON public.schedule_handovers FOR INSERT
    WITH CHECK (
        created_by = (SELECT auth.uid())
        AND public.is_coparent_space_member(space_id, (SELECT auth.uid()))
    );

CREATE POLICY "Space members update handovers"
    ON public.schedule_handovers FOR UPDATE
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())))
    WITH CHECK (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Space members delete handovers"
    ON public.schedule_handovers FOR DELETE
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));


-- Change log is append-only: no UPDATE or DELETE policy exists, so with RLS on
-- neither is possible for any client, and history cannot be quietly rewritten.
CREATE POLICY "Space members read changes"
    ON public.schedule_changes FOR SELECT
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Space members append changes"
    ON public.schedule_changes FOR INSERT
    WITH CHECK (
        actor_user_id = (SELECT auth.uid())
        AND public.is_coparent_space_member(space_id, (SELECT auth.uid()))
    );


CREATE OR REPLACE FUNCTION public.touch_schedule_handover()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_schedule_handover_trg ON public.schedule_handovers;
CREATE TRIGGER touch_schedule_handover_trg
    BEFORE UPDATE ON public.schedule_handovers
    FOR EACH ROW EXECUTE FUNCTION public.touch_schedule_handover();
