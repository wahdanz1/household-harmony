# Credit-card flow

Why credit cards exist as a first-class concept in Household Harmony, what the
PDF import flow accomplishes, and how it composes with the rest of the app.

This is canon. Read alongside [expenses-model.md](./expenses-model.md) (one
concept, two visual states) and [design-system-tiers.md](./design-system-tiers.md)
(primitives → patterns → pages).

---

## The mental model

HH separates **planning** from **reconciliation**:

| Surface | Role | Touches |
|---|---|---|
| Expenses page | Plan — the inventory of what you expect to spend | `expenses.default_amount`, `monthly_expenses.budget_amount` |
| Monthly Review | Reconcile — fill in what you actually spent | `monthly_expenses.actual_amount` |
| Overview | Awareness — current-month state at a glance | reads from both |

Credit-card imports are a **reconciliation** tool. They run at the start of a
new financial month, after the previous month's statement has finally landed,
and they fill in actuals for the categories you paid with the card. They never
touch budgets.

This is the load-bearing distinction. Everything below follows from it.

---

## The real-life timing

A typical financial month (HH uses a configurable `financial_month_start`,
default 25th). Concrete example, with financial month N-1 = Mar–Apr and
N = Apr–May:

```
~17 Apr  ──  Statement lands covering ~17 Mar → ~17 Apr.
             Approximately the credit-card spending for month N-1.
 25 Apr  ──  Month N-1 closes. Month N begins. Salaries land.
        ──  ★ Monthly Review for N-1 runs here:
              · Import the statement → fill N-1's actuals
              · Verify N's income amounts going forward
              · Adjust N's planned expenses (past + future-dated items)
              · Finalize N-1
```

**The Review for month N opens at the start of N and reconciles N-1.** The
imported statement attributes to **N-1's** `actual_amount`, never N's. This
is straightforward because Review-for-N-1 is the only time anything writes to
N-1's actuals.

The statement period (~17→17) doesn't align perfectly with the financial
month boundary (25→25) — there's ~8 days of slop at each end. HH accepts
this. Credit cards bill on *usage* (you pay for what you spent), and
financial-month accuracy at the day level is an accounting concern, not a
budgeting one. See [expenses-model.md § Retroactive vs prospective billing](./expenses-model.md)
for the broader prepay-vs-usage distinction.

---

## What gets marked as credit-paid

A category is `is_credit=true` when the user routinely pays for it with a
credit card. Typical examples: **groceries**, **fuel**, **dining**,
**shopping**. Typical *non*-credit: **rent**, **electricity**, **phone**,
**subscriptions** (these are direct-debit / invoice-paid).

The `is_credit` flag lives on the `expenses` table itself — credit-paid
expenses are *not* a separate concept, they're regular expenses with a flag.
They appear in the All-tab Expenses block alongside everything else,
distinguished by a credit chip on the row.

`is_credit` is set when the expense is created (a toggle in the Add Expense
dialog) and can be edited later. It is independent of `is_budgeted`. Most
credit-paid categories happen to also be budgeted (groceries, fuel — variable
spending the user estimates), but they don't have to be.

---

## PDF import flow

The pipeline runs server-side (LLM-backed) and produces a list of
`(date, merchant, amount, suggested_category, confidence)` tuples per
transaction. The user reviews the categorization, accepts, and the totals are
aggregated per `is_credit=true` expense row and written to
**`monthly_expenses.actual_amount`** for the month being reconciled.

### What the import writes

- **Writes** `monthly_expenses.actual_amount` (encrypted) for each
  credit-marked category, summed across all transactions assigned to that
  category.
- **Never writes** `monthly_expenses.budget_amount`. The plan is preserved
  intact for variance display, histograms, and the future smart-defaults
  pipeline.
- **Never stores** individual transaction rows. HH is a budgeting and planning
  app, not a transaction tracker — see [expenses-model.md § Out of scope](./expenses-model.md).
  The raw PDF is consumed and discarded; only the per-category aggregate
  persists.

### Variance signal

With `budget_amount` and `actual_amount` both preserved, every reconciled
credit row carries a variance signal — useful immediately (overview tiles,
"how well did we stick to plan this month?") and as training data for the
**smart-defaults** system (next month's suggested budget can drift toward
observed actuals if a user consistently over- or under-spends).

---

## Privacy tradeoff (explicit)

HH is privacy-first and end-to-end encrypted. The PDF import is the one
deliberate exception:

- The statement PDF leaves the user's device temporarily, hitting a
  server-side LLM parser (Groq or Gemini, depending on availability).
- The parser returns per-transaction tuples; only the **per-category
  aggregates** are written back into HH, and those aggregates are encrypted
  before storage.
- Individual transactions and the raw PDF are *not* retained server-side
  past the parse window.
- This tradeoff exists because LLM-grade parsing of arbitrary bank PDFs is
  not feasible on-device today and the actuals workflow is high-value enough
  to justify the round trip. The user opts in via the Extra Features
  toggle — credit-card support is off by default for new households.

If/when on-device parsing becomes viable (or a Klarna-style structured API
ships — see § Future), this tradeoff should be revisited.

### Chain-of-truth, not trust-us

HH's stance is to show the chain rather than ask for trust:

- Surface the tradeoff explicitly: the Extra Features toggle in Settings,
  the first-import confirm dialog, and the Security tab all spell out which
  provider parses the PDF and what does/doesn't get retained.
- Prefer providers with public transparency about logging and retention;
  link to that documentation from the UI so the user can verify directly.
- Goal state: an on-device parser, or at minimum a free provider with
  audit-friendly guarantees. Path to there is open (on-device LLM-grade PDF
  parsing isn't free or self-hostable today without operating
  infrastructure, which conflicts with HH's no-server stance).

Until then: opt-in, disclosed, and a known limitation rather than a
silently-broken privacy promise.

---

## Card limits

Each credit card has a `monthly_limit` stored on the `credit_cards` table.
This is the user's self-imposed or bank-imposed cap for the card, not a
budget — it's awareness, not enforcement. HH never blocks or warns based on
plan vs. limit; that's a future "Overview tile" candidate (sum of
credit-marked planned budgets vs. card limit), not a core flow.

Multi-card households are supported by the schema but not by any UI
partitioning today (cards aren't bound to specific categories).

---

## Where this lives in the app

| Action | Surface |
|---|---|
| Mark an expense as credit-paid | Add/Edit Expense dialog (toggle) |
| See which expenses are credit-paid | All-tab Expenses block, chip on row |
| Add or edit credit cards (name, limit) | Settings → Household → its own SettingsCard |
| Import a statement PDF | Monthly Review wizard step |
| View card limit utilisation | (Future) Overview tile |
| Configure whether credit features are visible | Settings → Household → Extra features |

There is **no dedicated Credit tab** on the Expenses page. The previous
implementation surfaced credit as its own tab; that was wrong — credit isn't
a *kind* of expense, it's a *payment method* on otherwise-regular expenses.
Surfacing it as a tab implied it was its own domain.

---

## Future / out of scope

- **Klarna API integration.** Klarna covers the slice of monthly spending
  that doesn't go through the credit card (primarily online orders). A
  structured API integration would let HH pull Klarna transactions
  automatically, categorize them, and feed the same `actual_amount` field
  before the Monthly Review even opens. Pending Klarna API access and
  whether it's free for personal use.
- **Smart-defaults learning loop.** With `budget_amount` and `actual_amount`
  both preserved month-over-month, a learning pipeline can propose budget
  adjustments based on observed variance. The current `services/smartDefaults.ts`
  is a placeholder; the real version waits on enough actuals data.
- **On-device PDF parsing.** Revisit when LLM-on-device makes this viable;
  collapses the privacy tradeoff entirely.
- **Per-card category routing.** Multi-card households today can't say
  "card A pays groceries, card B pays fuel." If real users ask, add a
  `default_card_id` on `expenses` or similar. Not a v1 concern.
- **Non-credit, non-Klarna actuals.** Cash and Swish spending. Today: not
  captured. Future: manual entry on the Monthly Review step, alongside the
  imported numbers.

---

## Out of scope for this doc

- **Cash flow / settlements.** Whether "you paid the card invoice in April"
  vs. "you spent on the card in April" is an accounting question. HH treats
  the statement total as the month's actual; the timing of when the cash
  actually leaves the bank account is not modelled.
- **Co-parent shared expenses.** Different domain. See `shared_expenses`
  table + Monthly Review's settlement step (when documented).
