-- Each member picks their own colour for the shared schedule, and both sides
-- see the same mapping. Co-parents often carry a long-standing convention
-- (one colour each) from whatever they used before this app, and a schedule
-- that renders "mine highlighted, theirs blank" is harder to read than two
-- named colours — it also leaves no way to tell "their day" from "no schedule".
--
-- Stored per membership rather than as a local preference precisely so the
-- convention is shared: you set yours, they set theirs, both see both.

ALTER TABLE public.coparent_space_members
    ADD COLUMN color text NOT NULL DEFAULT 'emerald'
        CHECK (color IN ('emerald', 'violet', 'sky', 'amber', 'rose', 'teal'));

-- The space creator keeps the app's own accent; the invited side starts on a
-- clearly different colour so a fresh schedule is readable before anyone
-- touches a setting.
UPDATE public.coparent_space_members SET color = 'violet' WHERE role <> 'owner';

-- Members already read their own row and their co-parent's; the existing
-- "Members read space membership" policy covers colour. Updating is
-- deliberately restricted to your own row so nobody can recolour the other
-- side out from under them.
CREATE POLICY "Members update their own space membership"
    ON public.coparent_space_members FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
