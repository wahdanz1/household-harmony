-- One-time incomes (gift, lottery, tax refund, bonus, sale, inheritance,
-- other) are stored in monthly_incomes with income_source_id NULL and
-- one_time_name populated. Add a category column so they can be tagged the
-- same way regular income sources are.
--
-- Column is plain text (not a Postgres enum) so the set of categories can
-- evolve client-side without a migration each time.

ALTER TABLE public.monthly_incomes
    ADD COLUMN IF NOT EXISTS one_time_category text;
