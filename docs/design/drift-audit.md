# Drift audit — live app vs. Chlorophyll design system

Audit date: 2026-05-13. Compares `frontend/src/` (live) against `design-system/household-harmony-design-system/project/` (canonical handoff bundle).

Severity legend:
- 🔴 **Load-bearing** — implements the design model directly. Must fix.
- 🟡 **Structural** — meaningful drift, not model-breaking. Fix in rollout.
- 🟢 **Polish** — small visual difference. Nice to have.
- ⚪ **Deferred** — out of scope for this rollout (e.g., patterns waiting for flows).

---

## 0 · Already aligned (no action)

These are tracking the design system cleanly today. Listed so the rollout doesn't accidentally re-touch them.

- **Token contract** — `frontend/src/index.css` and `colors_and_type.css` have identical OKLCH values. Triplet form vs. full `oklch()` form is intentional (Tailwind opacity-modifier syntax).
- **Money formatter** — `frontend/src/components/ui/money.tsx` matches design's `fmtKr`: non-breaking space thousand separator, trailing `kr`, mono + tabular-nums, real minus.
- **Button primitive** — `frontend/src/components/ui/button.tsx` has every variant the design needs (primary, secondary, ghost, destructive, accentSoft, link) plus legacy aliases. Sizes match (36/44/52 → rounded 10/12/14).
- **MetricTile** — `frontend/src/components/ui/metric-tile.tsx` matches design's `MetricTile`: same layout, same icon-top + label + Money + secondary-or-progress.
- **Nav order + icons** — `DesktopNav.tsx` and `MobileNav.tsx` already render Overview / Income / Expenses (Income before Expenses). Income uses `HandCoins`. Settings uses `Settings` cog.
- **Category constants** — `expenseCategories.ts`, `subscriptionCategories.ts`, `insuranceTypes.ts`, `incomeCategories.ts` all match the design system's category tables (icon names, hues).
- **Lucide-react** — the live frontend uses the same icon library as the design system specifies (the in-bundle `Icon` component is just an inline approximation).

---

## 1 · Tokens & globals

### 1.1 🟡 Backwards-compat token aliases (live only)
**Where:** `frontend/src/index.css` lines 67-105.
**What:** Old shadcn names (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--destructive`, `--ring`, `--sidebar-*`, etc.) aliased to the new canonical names.
**Why drift exists:** Phased migration. README in `index.css` says "can be removed once all primitives + pages are refactored."
**Fix:** Confirmed as Stage 1 in the rollout. Grep every usage of the old aliases (`bg-primary`, `text-foreground`, `border-border`, etc.) and migrate to canonical names. Then delete the alias block. **Stage 1 action item.**

### 1.2 🟢 Missing `--shadow` token export in live `index.css`
**Where:** `colors_and_type.css` defines `--shadow: 0 1px 2px rgba(0,0,0,0.04)` (light) / `0.4` (dark). Live `index.css` doesn't expose it as a CSS var (the value is hard-coded in some components instead).
**Fix:** Add `--shadow` to both theme blocks in `index.css`. Update Tailwind config if `shadow-default` should map to it. Low priority — only used for active segmented-tab pill and toggle thumb.

### 1.3 🟢 Missing `--overlay` documentation
**Where:** Live `index.css` has `--overlay: rgba(20, 15, 10, 0.32)` (light) / `0.45` (dark) but no Tailwind utility uses it. The design system specifies it as the canonical modal scrim.
**Fix:** Make sure all dialog/sheet primitives use `var(--overlay)` rather than hardcoded `rgba(0,0,0,0.5)` (which several shadcn dialogs do by default).

---

## 2 · Row primitive — THE big one

### 2.1 🔴 Row has no `isBudgeted` state
**Where:** `frontend/src/components/ui/row-item.tsx` is a generic flush row. The Expenses-specific row logic lives in `frontend/src/components/expenses/AllTabBlockView.tsx` (`ExpenseRow` and similar).
**What's missing:** The design model's central rule — `isBudgeted=true` rows render `~ X kr` muted (DM Mono 500, `--ink-2`, leading `~` in `--accent-dk`); `isBudgeted=false` rows render `X kr` exact (DM Mono 600, `--ink`).
**Where it should live:** `EXPENSE_CATEGORIES` constant gets an `isBudgeted: boolean` field per [`expenses-model.md`](./expenses-model.md). The row component reads from the category.
**Fix:** **Stage 1 action item.** Three steps:
1. Add `isBudgeted: boolean` to `ExpenseCategory` interface and assign per-category per [`expenses-model.md` § "Category defaults"](./expenses-model.md#row-a--expenses-page-the-inventory-list). Default false for `other` and edge cases.
2. Update `Money` component (or extend it) to support an `estimate` prop that prefixes `~` and switches color/weight: `text-ink-2 font-medium` + `~` rendered in `text-accent-dk` (Swedish reading order — see § 9 for `~` placement question).
3. Update `ExpenseRow` in `AllTabBlockView.tsx` to read `category.isBudgeted` and pass to Money.

### 2.2 🔴 Row hover state lacks edit/delete fade
**Where:** Design system `Row` (in `screens-dashboard.jsx` line 90-119) shows pattern: amount fades out on hover, edit/delete icon buttons (32×32, surface bg, line border, 8px radius) fade in.
**Live:** `ExpenseRow` in `AllTabBlockView.tsx` has some hover affordances but inconsistent. Need to verify each row type (expense, subscription, insurance) implements the swap.
**Fix:** Stage 2 (composed components). One canonical hover-actions slot on RowItem, used by every list-row implementation.

### 2.3 🟡 Row sub-line conventions not standardized
**Where:** Design system `Row` accepts a generic `sub` slot. Bundle's `ExpenseRow` shows:
- Expenses: no sub-line at all (matches the model)
- Subs/Insurances: cadence badge + optional `förfaller 15 mar` for non-monthly only
**Live:** `ExpenseRow` in `AllTabBlockView.tsx` likely shows things like `Månatlig · 1 i månaden` for monthly expenses, which we explicitly killed.
**Fix:** Stage 1 — sweep ExpenseRow logic in `AllTabBlockView.tsx`. For `kind="expense"` rows, no sub. For `kind="sub"/"insurance"`, cadence badge + non-monthly billing-day only.

---

## 3 · Section headers — triple-frame totals

### 3.1 🔴 Triple-frame totals missing on section headers
**Where:** Design system `CollapsibleSection` (`screens-app.jsx` line 265-324) renders three frames on the section header: `kr/mån (primary, bold) · kr/år (muted) · varav budget X kr` (or `snitt/post X kr/mån`).
**Live:** `ExpenseBlock` in `AllTabBlockView.tsx` accepts a `headerMetrics` prop — flexible but not standardized. Each call site builds its own.
**Fix:** Stage 2 (composed components). Build a canonical `SectionFrames` component that takes `[{v, unit, primary?, label?}]` and renders the row. Centralize the conventions:
- Expenses: `kr/mån · kr/år · varav budget X kr`
- Subs/Insurances: `kr/mån · kr/år · snitt/post X kr/mån`

### 3.2 🔴 Mobile: triple-frame collapses to compact total
**Where:** Design system collapses to `primary only` on mobile (`isDesktop ? full : compact`). Live: ExpenseBlock header may overflow on small screens with current frame logic (you saw this — `var bud…` truncation).
**Fix:** Same component as 3.1. Pass `isDesktop` (or use Tailwind responsive classes). Mobile renders only primary frame + count.

---

## 4 · Page-level drifts

### 4.1 🔴 Översikt — "Senaste aktivitet" feed not implemented
**Where:** Design system `Dashboard` (`screens-dashboard.jsx` line 314-351) shows a Recent Activity feed listing one-offs, settlements, inventory changes. The activity item has a kind-label badge (`Engångsutgift`, `Engångsinkomst`, `Avräkning`, `Inventarie`) + amount + time.
**Live:** Overview.tsx doesn't surface this section. The i18n `overview.json` has the keys (`activity.shared`, `activity.oneTimeIncome`) but no component consumes them.
**Decision needed:** Build this section now, or defer? The data exists (`monthly_expenses` one-offs, `monthly_incomes` one-offs, settlement entries) — composing the feed is straightforward. **See § 9, question 2.**

### 4.2 🟡 Utgifter — hero card per-year sub-line
**Where:** Design system Expenses hero (`screens-app.jsx` line 38-58): title + amount + `kr/år per år` sub-line.
**Live:** Expenses page hero shows only title + amount. Same pattern works on Income (which shows `3 aktiva källor · 770 400 kr per år`).
**Fix:** Stage 3 — add the per-year sub-line to Expenses hero. Match Income's structure.

### 4.3 🟡 Utgifter — "Sambo" tab → "Delat"
**Where:** Design system `tabs` constant (`screens-app.jsx` line 14): `{ id: 'co', label: 'Delat' }`. Live: tab label is `Sambo`.
**Why:** "Sambo" implies live-in partner; the feature is for co-parents you don't live with.
**Fix:** Stage 3 — rename in Expenses tab strip + any i18n keys + the `coparent` tab value in Expenses.tsx (currently uses `"coparent"` as value, just relabel display).

### 4.4 🟡 Utgifter — "Lägg till utgift" + "Engångsutgift" CTAs
**Where:** Design system shows two CTAs in a row right under the segmented tabs on the Alla tab (`screens-app.jsx` line 86-95): `Lägg till utgift` (primary) + `Engångsutgift` (secondary with sparkle icon).
**Live:** Expenses.tsx has these but layout/icon may differ. Verify and align.
**Fix:** Stage 3 — match the desktop two-button row pattern; mobile uses the bottom-sticky CTA (already exists).

### 4.5 🔴 Inkomst — pause toggle and "Månatlig" badge on rows
**Where:** Live Income rows show an inline pause/resume toggle per source + `Månatlig` badge. Per our recent grilling: both should go (toggle moves to form, cadence badge implies non-monthly cadences that aren't supported).
**Design system:** Income source rows in the bundle still show toggle + Månatlig badge (the bundle hasn't fully caught up to this asks from our last Claude Design round).
**Fix:** Stage 3 — remove from live. Pause/resume happens inside the form's status field. No cadence badge on monthly-only sources.
**Note to Claude Design:** the bundle's Income screen still has these — flag in next review.

### 4.6 🔴 Inställningar — restructure to 4 tabs
**Where:** Design system `SettingsScreen` (`screens-app.jsx` line 727-790) has 4 tabs: Allmänt / Personligt / Hushåll / Säkerhet, with 2-col grid on desktop.
**Live:** Settings.tsx has 3 tabs: General / Personal / Security. Cards inside don't all map cleanly (e.g., HouseholdInfoCard + HouseholdMembersCard live under General; design moves them to Hushåll tab).
**Fix:** Stage 3 — full Settings page refactor.
**Mapping plan:**

| Live tab | Live cards | New tab |
|---|---|---|
| General | HouseholdInfoCard | Hushåll |
| General | HouseholdMembersCard | Hushåll |
| General | ExtraFeaturesCard | Hushåll |
| General | SubjectsCard | Hushåll |
| General | SetupWizardCard | Hushåll |
| General | ResetDataCard | Hushåll (destructive, owner-only) |
| Personal | PersonalSettingsCard | Personligt |
| Personal | Appearance (ThemeToggle) | Allmänt |
| Security | RecoveryCodeCard | Säkerhet |
| Security | ApiKeysCard | Säkerhet |
| (new) | Language placeholder | Allmänt |
| (new) | Auto-lock interval | Säkerhet |
| (new) | Notification preferences | Allmänt or new Notiser section |

### 4.7 🟡 Mobile top-bar avatar trigger
**Where:** Design system shows an `AvatarTrigger` (round, accent-tinted) in every screen header on mobile (`screens-dashboard.jsx` line 228, `screens-app.jsx` line 34). It opens a `UserMenu` sheet with: Byt hushåll, Inställningar, Logga ut.
**Live:** No avatar in mobile top bar. Settings lives as 4th bottom tab; logout lives inside Settings page.
**Decision needed:** Adopt the avatar-menu pattern on mobile? If yes, Settings moves out of the bottom tab bar (which becomes Översikt / Inkomst / Utgifter, 3 tabs). If no, keep current 4-tab pattern and don't add the avatar. **See § 9, question 3.**

### 4.8 🟢 Desktop user-card refactor
**Where:** Design system desktop `Sidebar` has user-card at bottom that opens `UserMenu` popover (Byt hushåll / Inställningar / Logga ut). Live: user-card has a Settings cog icon button that navigates straight to /settings + a Logout button.
**Fix:** Stage 3 — if § 4.7 chooses avatar-menu pattern, refactor user-card to match (clicking opens menu). Otherwise leave the cog-icon shortcut as-is.

---

## 5 · Patterns (deferred per lazy strategy)

⚪ All 5 patterns deferred until their flow is touched:

| Pattern | Built when |
|---|---|
| Step indicator | Setup wizard / Leave / Join refactor |
| Picker list w/ checkboxes | Leave / Join refactor |
| Reconciliation summary card | Monthly Review refactor |
| Tab pair on a page | (Documentation only; the Tabs primitive exists) |
| Confirm-with-stakes dialog | Any destructive-action refactor (Leave, Delete account, Reset data, Regenerate recovery code) |

Pattern previews live in `design-system/household-harmony-design-system/project/preview/patterns-*.html` — refer to these when building.

---

## 6 · Wizards / dialogs (deferred)

⚪ Live wizards/dialogs that exist but don't yet use canonical patterns:

- `MonthlyReviewWizard` (`frontend/src/components/overview/MonthlyReviewWizard.tsx`)
- `HouseholdSetupWizard` (`frontend/src/components/overview/HouseholdSetupWizard.tsx`)
- "Bring things with you" picker (Leave Household)
- "Bring things to household" picker (Join Household)
- Destructive confirms (ResetDataCard, delete confirmations across forms)

Each will get pattern-aligned when it's touched for other reasons. Don't pre-refactor.

---

## 7 · Forecast page

⚪ Not in live. Not in design system bundle (mentioned in nav icons table as `LineChart`, but no screen mock). Out of scope for this rollout.

---

## 8 · Rollout plan summary

### Stage 1 — Tokens + primitives (1-2 sessions)
- 1.1: Migrate all usages of backwards-compat token aliases to canonical names, then delete the alias block.
- 1.2: Add `--shadow` token export.
- 1.3: Audit dialog/sheet primitives use `var(--overlay)`.
- 2.1: Add `isBudgeted` to `EXPENSE_CATEGORIES`. Extend `Money` (or build `EstimateMoney`) for the `~` muted state. Update `ExpenseRow` to read it.
- 2.3: Strip "X i månaden" sub-lines from monthly Expenses rows.

### Stage 2 — Composed components (1 session)
- 2.2: Canonical row hover-actions slot.
- 3.1, 3.2: `SectionFrames` component for triple-frame totals (responsive: full on desktop, compact on mobile).

### Stage 3 — Page refactors (3-5 sessions)
- 4.2: Utgifter hero per-year sub-line.
- 4.3: "Sambo" → "Delat" rename.
- 4.4: Verify Lägg till / Engångs CTA placement.
- 4.5: Inkomst row simplification (drop toggle + Månatlig badge).
- 4.6: Inställningar 4-tab refactor (largest single piece of work).
- 4.7 + 4.8: Avatar/user-menu pattern (decision-gated — see § 9).
- 4.1: Senaste aktivitet feed (decision-gated — see § 9).

---

## 9 · Open questions for decision before Stage 3

1. **`~` placement in mono.** Design system writes `~ 6 000 kr`. Should the `~` be visually integrated into the Money component (rendered in accent-dk before the digits) or applied as a string prefix in the caller? Affects whether we extend Money or build a wrapper.
2. **Senaste aktivitet feed (§ 4.1).** Build now in Stage 3, or defer until the data sources stabilize? The bundle has it specced; the live app has data but no feed.
3. **Mobile avatar trigger (§ 4.7).** Adopt the user-menu pattern (avatar in top-right, sheet menu, Settings moves out of bottom tabs) or keep current 4-bottom-tab pattern with Settings as 4th tab?

---

## Appendix — files read for this audit

**Live:**
- `frontend/src/index.css`
- `frontend/src/components/ui/{button,money,metric-tile,row-item}.tsx`
- `frontend/src/components/{DesktopNav,MobileNav}.tsx`
- `frontend/src/components/expenses/AllTabBlockView.tsx` (header)
- `frontend/src/pages/{Overview,Income,Expenses,Settings}.tsx` (key sections)
- `frontend/src/constants/{expense,subscription,insurance,income}Categories.ts`
- `frontend/src/services/smartDefaults.ts`

**Design system:**
- `design-system/household-harmony-design-system/README.md`
- `design-system/household-harmony-design-system/project/{README,SKILL}.md`
- `design-system/household-harmony-design-system/project/colors_and_type.css`
- `design-system/household-harmony-design-system/project/ui_kits/app/{primitives,screens-dashboard,screens-app}.jsx`

Not yet read (worth a pass before Stage 2/3): the 32 `preview/*.html` cards (component specimens), `screens-app.jsx` lines 400-1300 (Income screen detail, Sidebar, UserMenu, BudgetApp shell), tailwind.config.ts.
