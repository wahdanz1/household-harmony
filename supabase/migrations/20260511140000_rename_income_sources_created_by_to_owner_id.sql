-- Rename income_sources.created_by → owner_id.
--
-- Same drift pattern as households: the FK is already called
-- income_sources_owner_id_fkey, the UI form fields are named owner_id, and
-- every read/write trampolines through a manual created_by ↔ owner_id swap.
-- An income source is conceptually owned by a specific household member
-- (whose salary it is), so owner_id is the right name.

ALTER TABLE public.income_sources RENAME COLUMN created_by TO owner_id;
