-- Two new expense categories: "Home & appliances" (furniture/appliances split
-- out from Shopping) and "Treats & comfort" (alcohol, nicotine, kiosk treats).
-- Positioned before 'other' to mirror the frontend ordering.

ALTER TYPE public.expense_category_enum ADD VALUE IF NOT EXISTS 'home_appliances' BEFORE 'other';
ALTER TYPE public.expense_category_enum ADD VALUE IF NOT EXISTS 'treats_comfort' BEFORE 'other';
