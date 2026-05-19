# Amount model

The canonical answer to "where do amounts live, what edits them, and how do mid-month changes flow." Settled 2026-05-17 after a grilling session on the inline-edit confusion.

Pairs with [expenses-model.md](./expenses-model.md) (which says *what* an expense is) and [review-attribution](../../) (which says *when* the bi-temporal review happens). This doc says *how the numbers move*.

---

## Mental model

**One canonical budget per source. One snapshot per month. One actual per month.** No third user-editable layer.

- **Source budget** (`budget` on `income_sources` / `expenses` / `subscriptions` / `insurances`) — the user's plan. "Rent is 9 500 kr." Rounded up by intent ([budget is a ceiling, not a forecast](../../../.claude/projects/c--Users-dwahl-Code-apps-household-harmony/memory/project_budget_philosophy.md)). The only amount the user ever edits directly.
- **Monthly snapshot** (`budget_snapshot` on `monthly_*`) — system-managed frozen value of `source.budget` as it was when month N opened. Auto-updates if the source is edited mid-month, recording the previous value + timestamp so Monthly Review can surface the change.
- **Monthly actual** (`actual_amount` on `monthly_*`) — what really happened. Filled in Monthly Review for month N at the start of month N+1.

Inline editing on the Income/Expenses list is **gone.** The row is read-only display; tap anywhere on the row opens the edit dialog.

---

## Amortizing mindset

Non-monthly bills are **amortized into monthly snapshots** by default. The mental frame, in Sarah's words: *"we put aside X/12 every month so the money is already there when the invoice arrives."* This is how the household thinks about insurances (always billed yearly or semi-annually) and the occasional yearly subscription (PlayStation Plus).

**Why:** in January HH might face 4–6 000 kr of insurance bills landing at once, right after Christmas (which itself runs over budget). If you didn't earmark money each month, you have to take it from one salary. Amortizing turns "surprise bill" into "money already set aside."

**When it doesn't apply:** if a sub/insurance is billed monthly (some households pay insurances monthly), there's nothing to amortize — the snapshot is just `source.budget`. Whether to amortize is **derived from `billing_cycle`** on the source: monthly → no amortization (snapshot = budget); anything else → amortize (snapshot = budget ÷ months-in-cycle, only the billing month gets the full charge as actual).

No global setting needed. The decision is per-source, encoded in `billing_cycle`. Daniel's PSN Plus (yearly) and home insurance (yearly) both amortize; his Netflix (monthly) doesn't. Andreas's monthly-billed insurances don't either. A future Settings preference for "show cash-flow view instead of amortized view" is out of scope.

---

## Schema (final state)

### Source tables (`income_sources`, `expenses`, `subscriptions`, `insurances`)

| Column | Type | Notes |
|---|---|---|
| `encrypted_budget` | text | renamed from `encrypted_default_amount` (and `encrypted_amount` on subs / `encrypted_total_amount` on insurances) for uniform vocabulary across all source tables |
| `is_active` | bool | unchanged. OFF = "disable from now forward" |

### Monthly tables (`monthly_incomes`, `monthly_expenses`)

| Column | Type | Notes |
|---|---|---|
| `encrypted_budget_snapshot` | text | renamed from `encrypted_budget_amount`. Frozen at month-open; auto-updates on mid-month source edits. **Never user-editable.** |
| `encrypted_previous_budget_snapshot` | text NULL | the value before the most recent mid-month change. NULL means no mid-month change has happened |
| `budget_changed_at` | timestamptz NULL | when the snapshot was last auto-updated mid-month. NULL means no mid-month change |
| `encrypted_actual_amount` | text NULL | filled by Monthly Review **or** by the mid-month "Mark paid" affordance. NULL = not yet reconciled or no charge expected this month |
| `actual_recorded_at` | timestamptz NULL | when `actual_amount` was filled, if filled outside of Monthly Review via "Mark paid." NULL when set during Review or not yet set |
| ~~`encrypted_amount`~~ | — | **dropped.** Legacy column from before the budget/actual split |

### Subscriptions / Insurances gain monthly rows

For symmetry with Income/Expenses, subs and insurances get the same `monthly_*` shape:

- New tables `monthly_subscriptions`, `monthly_insurances` mirroring `monthly_expenses` (snapshot, previous_snapshot, changed_at, actual).
- For **monthly billing cycles**, 12 rows/year with `budget_snapshot = source.budget`.
- For **non-monthly cycles** (yearly, semi-annually, quarterly), 12 rows/year with **amortized** snapshot (`source.budget / months_in_cycle`). `actual_amount` is **NULL in non-billing months** and the full charge in the billing month.

---

## Behavior by surface

### Income page / Expenses page rows

- Display only. Amount renders as plain text, not an input.
- Tap anywhere on the row → opens the edit dialog.
- Hidden when `source.is_active = false` (server-filtered, unchanged).
- No on-screen keyboard, no autosave, no stuck-at-zero state.

### Edit dialog (income source / expense / subscription / insurance)

- **Amount field** writes to `source.budget`.
- When the value changes from its current value, the dialog shows an inline hint under the field: **"Applies to May 2026 and onwards."** Disappears when the field matches the existing value.
- **Active toggle** flips `source.is_active`. Inline hint when toggled OFF: **"Disabled from May 2026 onwards. May 2026 will be reconciled in your next Monthly Review."**
- Saving with a changed budget mid-month triggers: `monthly_*.previous_budget_snapshot ← current snapshot`, `monthly_*.budget_snapshot ← new value`, `monthly_*.budget_changed_at ← now()` for month N's row.

### Monthly Review

- For month N's reconciliation (which happens at the start of N+1):
  - Renders each `monthly_*` row of N with `budget_snapshot` as the expected value and prompts for `actual_amount`.
  - If `previous_budget_snapshot IS NOT NULL`, render a small pill on the row: **"Changed 12 May · was 149 kr"** (auto-accepted; tap to revert to previous_snapshot if the change was accidental).
  - If `actual_recorded_at IS NOT NULL`, render: **"Recorded 3 Jun · 6 000 kr"** badge (auto-accepted; tap to edit if mistaken).
  - If `is_active` was flipped OFF mid-month, render: **"Inactivated 12 May"** badge. Row stays, user reconciles actual (often 0 or a final partial charge).
  - For **amortized non-monthly** rows: row is **hidden from Review** in non-billing months. Surfaces only in the billing month, where `budget_snapshot` is the amortized monthly value but the user enters the **full charge** as `actual_amount` (the variance UI knows the row is non-monthly and handles the math).

### Mid-month actual recording (optional power flow)

Default flow: actuals are filled in the next Monthly Review (start of N+1 reconciles N).

**Power flow** — when a user knows a bill has been paid mid-month (e-invoice received, autogiro charged) and doesn't want to risk forgetting:

- Open the edit dialog for the source.
- A **"Mark paid this month"** section reveals an actual-amount input, pre-filled with `budget_snapshot` for this month.
- Saving writes to `monthly_*.actual_amount` and stamps `actual_recorded_at = now()`.
- Next Review surfaces the row with a **"Recorded 3 Jun · 6 000 kr"** badge (auto-accepted; tap to edit).

This is opt-in. Users who prefer the "do it all in Review" cadence never see it unless they open the dialog. Mirrors the Netflix-price-update flow: an "act now while you remember" affordance with Review as the safety net.

### Carry-forward (new month opens)

- Backend job (or first-fetch trigger) creates new `monthly_*` rows for active sources with `budget_snapshot = source.budget`. Smart-defaults logic from `smartDefaults.ts` and the 3-month-average seeding from `carryForward.ts` is **removed** from this path.
- The "learn from corrections" auto-update behavior (bump `source.budget` after N consecutive `actual > budget` reconciliations) is **deferred** to a separate design and lives in its own future doc.

---

## Migration steps

In order. Each step is a separate migration file.

1. **Rename `encrypted_default_amount` → `encrypted_budget`** on `income_sources`, `expenses`. Same migration: rename `encrypted_amount` → `encrypted_budget` on `subscriptions`, `encrypted_total_amount` → `encrypted_budget` on `insurances`.
2. **Rename `encrypted_budget_amount` → `encrypted_budget_snapshot`** on `monthly_incomes`, `monthly_expenses`.
3. **Add `encrypted_previous_budget_snapshot text NULL`, `budget_changed_at timestamptz NULL`, and `actual_recorded_at timestamptz NULL`** to `monthly_incomes`, `monthly_expenses`. Clean slate — NULL for all existing rows.
4. **Drop legacy `encrypted_amount`** from `monthly_incomes`, `monthly_expenses`.
5. **Create `monthly_subscriptions` and `monthly_insurances`** tables (same shape as `monthly_expenses`). Backfill the current month's rows from the active sources, amortized for non-monthly billing.
6. **Update `useEncryptedFields.ts`** field maps to match the renames.
7. **Update frontend writes**: edit dialog writes `source.budget`; "Mark paid" writes `actual_amount` + `actual_recorded_at`; Monthly Review writes `actual_amount`. Remove inline-edit handlers from `IncomeSourceItem.tsx` and `AllTabBlockView.tsx`.
8. **Update carry-forward** to seed `budget_snapshot ← source.budget` only (amortized for non-monthly cycles). Delete `smartDefaults.ts` and the history-fetch path in `carryForward.ts`.
9. **Add mid-month detection trigger** (DB trigger or app-layer in the edit-dialog save handler — TBD by simplest correct path): on `source.budget` change, update current month's `monthly_*` row to record previous + timestamp.

---

## Edge cases

- **Source created mid-month**: snapshot the source's budget into the current month's `monthly_*` row immediately. No previous_snapshot (NULL).
- **`source.budget` changed multiple times in one month**: each save overwrites `previous_budget_snapshot` with the **most recent prior value** (not the original). Rationale: Review only needs to show "what was it before this matters today"; full audit history is out of scope.
- **Source deleted mid-month**: monthly_* row kept (history); soft-delete the source.
- **One-offs (existing `one_time_name` rows)**: unchanged. They already only have `budget_snapshot` / `actual_amount` semantics; no source means no mid-month-change concept.
- **`actual_amount = 0`**: valid. Means "this month I didn't pay." Only reachable through Monthly Review.
- **`budget_snapshot = 0`**: invalid in steady state. The dialog rejects budget = 0 on the source. (If you want to skip a month, use Active toggle or set `actual_amount = 0` in Review.)

---

## Out of scope

- Smart-defaults / learn-from-corrections logic. Designed separately; will live in its own doc when built.
- Per-expense `is_budgeted` override (still category-derived per [expenses-model.md](./expenses-model.md)).
- Transaction-level tracking. Actuals are aggregated per-month, full stop.
- Currency / multi-currency. Single currency (SEK) assumed.
- Plan page math (future-month adjustments beyond "current + forward"; scheduled changes like "in August we drop Netflix"). Lives in a future Plan doc.

---

## Killed proposals

- **Inline edit on Income/Expenses rows.** Created a third concurrent edit point that desynced from the dialog and the Review. The strikethrough-at-zero "skip" mechanic was a feature of the inline path that no longer needs replacing — Active toggle handles "from now forward," Monthly Review actuals handle "this month was different."
- **`budget` (per-month) as a user-editable layer.** Same problem reframed — two budgets confuse the user.
- **`actual_amount = 0` in non-billing months for amortized bills.** Created false-positive "under budget" variance every month.
- **Heuristic backfill of `previous_budget_snapshot`** (e.g. compare against last month's snapshot). Likely wrong in edge cases; NULL is honest.
- **Separate `source_amount_changes` audit table.** Overkill — we only need the most recent prior value, not full history.
