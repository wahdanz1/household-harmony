---
name: household-harmony-design
description: Apply the Chlorophyll design system when building or modifying UI in Household Harmony. Fires on any React/Tailwind work — pages, components, dialogs, settings, dashboards.
---

# Household Harmony — Chlorophyll design system

Privacy-first Swedish household finance + planner. The design system is HH-scoped (one product, one brand color) — not abstracted across a brand layer. If a second product ever ships under the same umbrella, the visual primitives extract cleanly; until then the rules below are HH's.

## Canonical sources

Always cross-reference the live code over any external mockups. The bundle that produced this system has been retired; **these docs are now the source of truth**:

- **Domain model** — [`docs/design/expenses-model.md`](../../docs/design/expenses-model.md). One concept, two visual states. The `isBudgeted` axis. What "an expense" means in HH and what each surface (Expenses inventory, Subs, Insurances, Overview, Forecast, Review) is for.
- **System tiers** — [`docs/design/design-system-tiers.md`](../../docs/design/design-system-tiers.md). Three tiers (primitives → patterns → pages). The five canonical patterns and which flows compose which.
- **Icons + categories** — [`docs/design/icons-and-categories.md`](../../docs/design/icons-and-categories.md). Lucide names per nav surface and per category, plus the OKLCH hue palette.
- **Token contract** — [`frontend/src/index.css`](../../frontend/src/index.css). Canonical OKLCH triplets for both themes. Tailwind config maps `bg-accent`, `text-ink`, `border-line`, etc. to these.
- **Drift audit** — [`docs/design/drift-audit.md`](../../docs/design/drift-audit.md). What's done, what's deferred. Reference when planning system-touching work.

## Hard rules (these are not stylistic — they're load-bearing)

### 1. One saturated color: chlorophyll green
- `bg-accent` / `text-accent` / `text-accent-dk` / `bg-accent-tint` / `text-accent-ink` — that's the entire palette for the accent.
- Use for: primary CTAs, positive totals, active tab indicator, brand mark.
- Never for: decoration, card backgrounds, borders, "branding."
- `text-danger` (red) and `text-warn` (amber) are reserved for destructive actions and limits respectively. Never as "branding."

### 2. All numerics in DM Mono + tabular-nums
- Every amount, percentage, date with digits, and id renders with `font-mono whitespace-nowrap tabular-nums`.
- Use the `<Money>` primitive in [`frontend/src/components/ui/money.tsx`](../../frontend/src/components/ui/money.tsx) — never roll currency formatting inline.
- `Money`'s `estimate` prop renders `~ X kr` muted (text-ink-2 weight 500 + leading `~` in accent-dk). Use it for budget-category rows (groceries, fuel, dining, etc. — anywhere `isCategoryBudgeted(category)` is true).
- For section-header totals (per-month, per-year, contextual third), use [`<SectionFrames>`](../../frontend/src/components/ui/section-frames.tsx) — never compose your own `kr/mån · kr/år` strings.

### 3. Two-state row model on Expenses
Every recurring cost is "money I plan to spend monthly." The only visual axis on an Expenses-page row is **exact vs. estimate**, driven by `isBudgeted` on the category.

- **Fixed** (`isBudgeted=false`): rent, internet, phone, electricity, memberships. Renders `14 500 kr`, full weight, normal ink.
- **Budget** (`isBudgeted=true`): groceries, fuel, dining, entertainment, shopping, travel. Renders `~ 6 000 kr` muted via `Money estimate`.
- **No third "variable" state.** Softly-fluctuating bills (electricity, mobile) are Fixed — slight monthly variance is acceptable noise.

Cadence (Månatlig/Kvartal/Årlig) belongs on Subs/Insurances surfaces ONLY, never on Expenses rows. See `docs/design/expenses-model.md` §Row A vs §Row B.

### 4. Surfaces + their roles

| Surface | Purpose | Shows actuals? |
|---|---|---|
| Expenses | Inventory of recurring costs | No |
| Subscriptions | Provider-billed, mixed cadence | No |
| Insurances | Same as Subs | No |
| Overview | Current-month summary | Yes |
| Review (per-month) | Reconcile actuals vs plan | Yes |
| Forecast *(future)* | Year-ahead planning | No |

Never show actuals on Expenses — it turns the app into a transaction tracker, which is explicitly out of scope.

### 5. Settings primitive — SettingsCard
For new Settings tab sections, use [`<SettingsCard eyebrow="..." />`](../../frontend/src/components/settings/SettingsCard.tsx). It enforces the eyebrow + divider + content shape with consistent padding:
- `eyebrow` (string) and optional `eyebrowRight` (count or right-aligned action)
- `contentClassName="p-0"` when children is a `<SettingsList>` of rows
- `tone="danger"` for destructive sections (Danger Zone reset)
- `dim` for not-yet-shipped sections with a Coming Soon badge

Use `<SettingsList>` + `<SettingsListItem icon title value onClick control badge>` for list-style content. Click-to-edit rows render a chevron automatically; rows with a `control` (Switch/etc.) suppress the chevron.

### 6. No shadows, no gradients, no emoji
- Cards are defined by a 1px `--line` hairline + `--surface` fill — never drop shadows.
- The only place `--shadow` appears: subtle press feedback (active segmented-tab pill, toggle thumbs).
- No gradients anywhere. No emoji as UI iconography.
- Iconography is exclusively `lucide-react`, default stroke width 2 (2.25 for active states).

### 7. Numbers in copy
- Swedish convention: non-breaking-space thousand separator (`14 500 kr`).
- Real minus, not hyphen (`−199 kr`).
- No decimals on display (the app rounds at format time).
- Lowercased Swedish month names in dates (`1 maj`, not `May 1`).

### 8. Voice
- Calm, functional, domestic. Closer to IKEA assembly instructions than to a fintech product page.
- Use `du` (informal "you"). Refer to household members by name (Daniel, Sarah) — never "partner" or "spouse."
- Greetings exist but are minimal. The dashboard header is just the page title — no "Hej Anna" filler.
- No exclamation marks, no "Let's…", no "Pro tip:", no emoji.

## Component patterns (composition over invention)

Before inventing a new component, check whether one exists:
- `<Money v={...} estimate={isBudgeted} />` — currency formatter
- `<SectionFrames frames={[...]} />` — triple-frame section totals
- `<SettingsCard>` + `<SettingsList>` + `<SettingsListItem>` — settings tab cards
- `<MetricTile>` — overview metric tiles
- `<RowItem>` — generic flush row inside a list-style card
- `<MonthChip>` — month picker pill
- `<CatIcon>` — category icon with hue-tinted background
- `<UserMenu>` + `<AvatarTrigger>` — account menu (used in nav)

## Flows compose patterns

Five canonical patterns documented in `docs/design/design-system-tiers.md`:
- **Step indicator** — Setup, Leave, Join wizards
- **Picker list w/ checkboxes** — Leave/Join "bring with you"
- **Reconciliation summary card** — Monthly Review
- **Tab pair on a page** — Monthly Review (Översikt / Avräkning)
- **Confirm-with-stakes dialog** — destructive ops with countable consequences

Flows themselves (Monthly Review, Setup, Leave, Join) live as product code that composes these patterns. They are NOT canonicalized in the design system — never promote a flow to a primitive.

## When unsure

1. Read the canonical doc cited above. Don't guess.
2. Check the live code for an existing component before building a new one.
3. If you genuinely need a new pattern, propose it explicitly — don't add ad-hoc abstractions that fork the system.
4. When live drifts from the docs, fix the live code; don't update the docs unless we've decided to change the rule.
