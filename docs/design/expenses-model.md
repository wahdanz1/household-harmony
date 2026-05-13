# Expenses domain model

The canonical answer to "what is an Expense in HH?" and how the Expenses / Subscriptions / Insurances surfaces relate. Settled 2026-05-13 after a grilling session on the Claude Design Row component iterations.

---

## Mental model

**One concept, two visual states.**

Every recurring cost in HH — rent, electricity, Netflix, groceries, fuel — is "money I plan to spend monthly." The only axis that matters visually is **exact vs. estimate**. Rent and groceries are the same kind of thing; rent just happens to be exact and groceries doesn't.

The "has billing date?" axis is real but already encoded by the table you're in (Subs/Insurances carry cadence; Expenses are implicitly monthly). It does **not** need its own row variant.

The "softly fluctuating" middle state (electricity, phone, broadband) **does not exist as a separate row type.** These are FIXED in the user's head — provider bills with known cadence, slight monthly variance is acceptable noise.

---

## Surface framing

| Surface | Purpose |
|---|---|
| **Expenses page** | Inventory ("what we pay"). Pure catalog. Not a planning surface. Not a current-month view. |
| **Subscriptions / Insurances sections** | Same logical role as Expenses but with cadence (often non-monthly) and provider context. |
| **Forecast** (future page) | Planning surface. "In January we get hit with 5 000 kr in insurances." Where time-frame math lives. |
| **Overview** | Current-month check-in. Where actuals appear ("are we on track?"). |
| **Monthly Review Wizard** | Past-month close-out. Where actuals get filled (manually now, semi-auto via CSV/bank API later). |

**Rule:** the Expenses page never shows actuals or progress. Actuals live only on Overview / Review / Forecast. This is what keeps HH from drifting into transaction-tracker territory.

---

## Data model (current, kept as-is)

Three tables, kept separate:

- `expenses` — recurring household items (rent, internet, phone, electricity, groceries, fuel, …). Has `default_amount` and a `category` from `EXPENSE_CATEGORIES`.
- `monthly_expenses` — per-month instance with `encrypted_budget_amount` + `encrypted_actual_amount`. Supports one-offs via `one_time_name` / `one_time_category` (expense_id NULL).
- `subscriptions` — provider services with `billing_cycle` enum (monthly/quarterly/semi_annually/yearly) + nullable `billing_month` / `billing_day`.
- `insurances` — same shape as subscriptions (aligned by migration `20260511170000_align_insurance_subscription_billing.sql`).
- `monthly_incomes` — mirror of `monthly_expenses` for incomes.

**The budget-vs-actual split already lives at the per-month-instance level.** The design system was trying to express this at the row-type level, which is the wrong layer.

---

## Row component spec

### Row A — Expenses page (the inventory list)

- **Content:** icon · name · amount. Nothing else by default.
- **No cadence badge** on the row (monthly is implicit).
- **No billing-day inline** (rent on the 1st, electricity on the 28th — users know; they look in their bank/mail). Editing the expense reveals cadence/billing-day inputs.
- **No `/mån` suffix on the amount** (it's the default frame; redundant).
- **Two visual states**, driven by category metadata:
  - **Fixed** (category default): `14 500 kr` — normal weight, normal color.
  - **Budget** (category default): `~ 6 000 kr` — muted color, `~` prefix.
- **Flag location:** category-derived via `isBudgeted: boolean` on `EXPENSE_CATEGORIES`. No per-expense override yet (YAGNI — add later if real users complain). No schema migration.

**Category defaults:**

| isBudgeted: false (fixed) | isBudgeted: true (budget) | Edge cases |
|---|---|---|
| rent | groceries | car_repairs (default false) |
| internet | dining_out | healthcare (default false) |
| phone_plan | fuel | credit_card (default false) |
| electricity | entertainment | other (default false) |
| memberships | shopping | |
| | travel | |

### Row B — Subscriptions / Insurances list

- **Content:** icon · name · cadence badge · amount with cadence suffix when non-monthly.
- **Cadence badge** always present (`Månatlig` / `Årlig` / `Kvartal` / `Halvår`).
- **Amount suffix** when non-monthly: `2 148 kr/år`, `555 kr/6 mån`. Monthly subs render plainly: `99 kr`.
- **Billing-day inline only for non-monthly** items: `förfaller 15 jan`. Monthly subs don't show it in the row.
- **Never use `~` prefix.** These are provider bills with known amounts.

---

## Section header pattern

Current app already does this nicely on Insurances: `222 SEK/month · 2664 SEK/year · 111 SEK avg`. Extend to all three section headers (Expenses, Subs, Insurances): per-month · per-year · one contextual third frame. Tighten "avg" to be unambiguous (e.g. `snitt 111 kr/post`).

This pairs naturally with the eventual Forecast page (which is fundamentally about expressing money in different time frames).

---

## What's explicitly out of scope

- **Retroactive vs prospective billing** (rent paid beforehand vs electricity paid after usage). Real distinction, real Swedish-billing reality, but it's an accounting question, not a row question. The `default_amount` is just "what we expect monthly" regardless of when in the cycle the cash leaves.
- **Per-expense `is_budgeted` override.** Category-derived is enough for v1. Add an override column if a real user actually asks.
- **Transaction list / per-purchase tracking.** HH is planning, budgeting, awareness, saving — not history. Bank API / CSV imports fill `encrypted_actual_amount` (aggregated), they don't store individual transactions.

---

## Killed proposals

- **Three-rhythm taxonomy** (Fast / Variabel / Budget). The middle "Variabel" state is unnecessary; electricity is fixed in the user's head.
- **Per-expense `is_budgeted` flag at creation.** Adds friction at add-time for the 95% case where category default is right.
- **Smart-default-confidence-driven estimate cue.** Fragile for first months and for stable budgets.
- **Showing actuals on the Expenses page.** Risks transaction-tracker drift. Confined to Overview / Review / Forecast.
- **Billing-day on monthly Expenses rows.** Noise. Users know when rent is due.
