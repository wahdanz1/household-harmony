-- Frontend offered two category options the enums never gained: "Memberships
-- & dues" (expense) and "Child" (insurance). Picking either failed the insert.
-- Also adds "Childcare & school" (expense) and "Pension" (income).
-- Positioned to mirror the frontend ordering.

ALTER TYPE public.expense_category_enum ADD VALUE IF NOT EXISTS 'memberships' BEFORE 'other';
ALTER TYPE public.expense_category_enum ADD VALUE IF NOT EXISTS 'childcare' BEFORE 'other';

ALTER TYPE public.insurance_category_enum ADD VALUE IF NOT EXISTS 'child' AFTER 'health';

ALTER TYPE public.income_category_enum ADD VALUE IF NOT EXISTS 'pension' BEFORE 'other';
