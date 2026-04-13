# Household Harmony — Revival Plan

> Last updated: 2026-04-13
> Goal: Fix the month-to-month flow so Daniel + wife can actually use this instead of spreadsheets.

## Phase 1: Quick wins — fix broken things (current)

### 1.1 Fix MonthlyReviewWizard (CRITICAL)
- [x] **Wrong field name**: line 95 uses `m.source_id` — should be `m.income_source_id`
- [x] **Wrong upsert key**: line 150 uses `source_id` — should be `income_source_id`
- [x] **Wrong onConflict**: line 160 uses `household_id,source_id,month` — DB constraint is `(income_source_id, month)`
- [x] **Wrong onConflict**: line 178 uses `household_id,expense_id,month` — DB constraint is `(expense_id, month)`
- **Impact**: Wizard never finds existing records → shows defaults instead of actuals → creates duplicates

### 1.2 Fix financial month usage in one-time forms (CRITICAL)
- [x] `OneTimeIncomeDialog.tsx:50` — uses `startOfMonth(new Date())` instead of `getCurrentFinancialMonth()`
- [x] `SharedExpenseForm.tsx:33` — same issue
- [x] `TemporaryExpenseForm.tsx:40` — same issue
- **Impact**: One-time items land in wrong month bucket

### 1.3 Fix History page month filter
- [x] `History.tsx:65-73` — month filter uses calendar months, should use financial months
- **Impact**: Inconsistent with rest of app

---

## Phase 2: Month-to-month flow (next)

### 2.1 Add month navigation
- [ ] Add previous/next month buttons to Income and Expenses pages
- [ ] Allow viewing and editing past months
- [ ] Show clear indicator of which month you're viewing

### 2.2 Carry-forward from previous month
- [ ] When entering a new month, pre-populate with last month's actual values (not defaults)
- [ ] This replaces the broken smart defaults — simpler and more useful
- [ ] Show visual diff: "last month was X, this month is Y"

### 2.3 Monthly review improvements
- [ ] Show last month's actual values in the review wizard
- [ ] Highlight what changed vs. last month
- [ ] Quick "same as last month" button

---

## Phase 3: Quality of life (later)

### 3.1 Testing flow helper
- [ ] Dev-mode tool to simulate different dates without touching the DB
- [ ] Ability to quickly seed test data for multiple months

### 3.2 UX polish
- [ ] Explicit save button (in addition to autosave) for peace of mind
- [ ] Better error handling on Dashboard Promise.all
- [ ] Autosave: save immediately on page leave, not just on debounce timer

### 3.3 Smart defaults revival (optional)
- [ ] Rewrite backend to work with encrypted fields
- [ ] Or: replace entirely with client-side carry-forward (Phase 2.2)

---

## Notes
- Database schema is in `.schema/dump.sql` (gitignored)
- Supabase CLI is set up and linked
- 58 backend tests passing (encryption, tax, LLM service)
- `supabase/.temp/` is gitignored
