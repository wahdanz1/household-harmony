# Household Harmony — Design Language

This is the contract. If a component drifts from these rules, that's a bug — file
it like any other.

---

## 1. Color discipline (non-negotiable)

**Chlorophyll green is the only saturated accent.** Use it for:
- Primary CTAs (`Button variant="primary"`)
- The "saved this month" total on Overview
- Active tab indicator and active sidebar item
- Progress bars under threshold
- Positive deltas, positive money values
- The soft-accent variant (`Button variant="accentSoft"`, `Card variant="cta"`)

**Red and amber are NEVER decorative.**
- `--danger` only for: destructive actions, over-limit warnings, "förfallen" / overdue states, negative money values
- `--warn` only for: yearly billing badges, "approaching limit" progress

**No raw palette colors in feature code.** No `bg-blue-500`, no `#EF4444`. Always
use a token. The tailwind config exposes:
- `bg-bg`, `bg-surface`, `bg-surface-2` for surfaces
- `text-ink`, `text-ink-2`, `text-muted-foreground` for text
- `border-line`, `border-line-2` for hairlines
- `bg-accent`, `bg-accent-tint`, `text-accent`, `text-accent-dk`, `text-accent-ink`
- `bg-danger`, `text-danger`, `bg-warn`, `text-warn`

Old tokens (`bg-primary`, `bg-card`, `text-foreground`, etc.) are aliased to the
new tokens during migration. Prefer the new names in new code.

**Money values** always use `<Money>`. It enforces DM Mono + tabular-nums + sv-SE
formatting (non-breaking space thousand separator + `kr` suffix).

---

## 2. Token contract

Tokens live in [src/index.css](src/index.css) as raw OKLCH triplets:

```css
:root, [data-theme="light"] {
  --accent:   0.56 0.13 152;   /* L C H */
  --bg:       0.985 0.005 75;
  /* ... */
}
[data-theme="dark"] {
  --accent:   0.74 0.16 150;
  --bg:       0.17 0.008 60;
  /* ... */
}
```

Tailwind wraps them with `oklch(var(--name) / <alpha-value>)` so opacity
modifiers work natively (`bg-accent/80`, `border-line/50`). See
[tailwind.config.ts](tailwind.config.ts).

**Theme switching:** `data-theme="dark"` on `<html>`. Default is dark. Persisted
to `localStorage` under key `hh-theme`. Applied before paint via inline script
in [index.html](index.html) to avoid FOUC. The toggle UI lives in
[ThemeToggle.tsx](src/components/shared/ThemeToggle.tsx) on Settings → Personal.

### Full token list

| Token | Role |
|---|---|
| `--bg` | App canvas |
| `--bg-trans` | Translucent canvas (mobile nav blur) |
| `--surface` | Card / sheet surface |
| `--surface-2` | Inset / hover row / muted bg |
| `--ink` | Primary text |
| `--ink-2` | Body / secondary text |
| `--muted` | Captions, labels, hints |
| `--line` | Hairline border |
| `--line-2` | Inner divider |
| `--accent` | Chlorophyll — CTAs, totals, focal moments |
| `--accent-dk` | Pressed / accent text on tinted bg |
| `--accent-tint` | Soft accent surface |
| `--accent-ink` | Text on solid accent fill |
| `--danger` | Destructive only — never decorative |
| `--warn` | Caution — yearly billing, approaching limit |
| `--toggle-off`, `--toggle-thumb` | Switch component |
| `--overlay` | Sheet backdrop |
| `--radius` | 14px — default card/dialog radius |

---

## 3. Typography

- **UI sans:** DM Sans (400/500/600/700) — loaded from Google Fonts in
  [index.html](index.html)
- **Mono (numbers):** DM Mono (400/500). Always paired with
  `font-variant-numeric: tabular-nums`. Use `<Money>` to get this for free.
- **Scale:**
  - display: 32/40 700 (page hero amounts)
  - title: 22/28 600 (section titles)
  - heading: 15/22 600
  - body: 14/22 400
  - label: 11.5/16 600 0.08em uc (section labels above blocks)
  - mono lg: 28/32 600 (hero amounts)
  - mono md: 16/22 600 (inline amounts)

Headings (`<h1>`–`<h4>`) have built-in styles in `index.css` — don't override
unless you have a reason.

---

## 4. Spacing & shape

- **Spacing scale:** 4 8 12 16 20 24 32 40 48 64 (Tailwind defaults)
- **Radii:** 6 / 10 / 14 / 20 / 999 (pill)
  - Default card: 14
  - Default button: 12
  - Pill / toggle: 999
- **Borders over shadows.** 1px hairlines using `--line`. Shadow only for sheets
  and popovers.
- **Hit targets ≥ 44px on mobile.** Buttons default to `h-11` (44px). Icon
  buttons default to `h-11 w-11`.

---

## 5. Components

### `<Button>`

Variants × sizes:
- `primary` (accent fill, accent-ink text, accent-dk border)
- `secondary` (surface fill, line border)
- `ghost` (transparent, surface-2 hover)
- `destructive` (surface fill, danger text)
- `accentSoft` (accent-tint fill, accent-dk text — for empty-state CTAs)
- `link` (text-only)

Sizes: `sm` (36h, rounded-10), `default`/`md` (44h, rounded-12), `lg` (52h,
rounded-14), `icon` (44×44).

Legacy aliases `default`/`outline` keep older call sites working — prefer the
new names for new code.

### `<Card>`

- `default`: surface bg, line border, padding p-4 md:p-5, rounded-14
- `muted`: surface-2 bg
- `cta`: accent-tint bg, hover-darken — for clickable highlight panels
- `flush`: no padding, overflow-hidden — for cards containing rows that own
  their own padding

### `<Tabs>`

Segmented control. Triggers auto-distribute via `flex-1` — **do not override
with `grid grid-cols-N`.** That was the cause of the Monthly Review tab drift.

Active trigger lifts onto a surface-elevated pill with a hairline border.

### `<Money>`

The only way to render financial figures.

```tsx
<Money v={amount} currency="SEK" size="2xl" weight={600} color="auto" />
```

`color="auto"` resolves to `accent` for positive, `danger` for negative, `ink`
for zero. Other options: `ink`, `accent`, `danger`, `muted`.

### `<MonthChip>`

Pill-shaped month picker trigger. Renders calendar + label + chevron. Used in
all page headers next to the title.

### `<MetricTile>`

Overview's 2x2/4-col tile. Icon + label + mono primary + secondary line +
optional progress bar. `tone="accent"` for the soft-accent variant (used for
the co-parent settlement tile).

### `<CatIcon>`

Tinted square with category icon. Background uses `color-mix` against a hue:

```tsx
<CatIcon icon={Home} hue={50} size={36} />
```

The recipe is `color-mix(in oklab, oklch(var(--surface-2)) 60%, oklch(0.65 0.16
<hue>) 40%)`. This adapts to theme — pastel in light mode, muted-deep in dark
mode — while preserving each category's hue identity.

#### Category hue palette

| Category bucket | Hue |
|---|---|
| Housing | 50 |
| Food | 80 |
| Transport | 200 |
| Energy | 30 |
| Health | 150 |
| Phone | 260 |
| Media / Entertainment | 320 |
| Card / Tech / Software | 240 |
| Insurance | 100 |
| Work / Education | 60 |
| Family / Gift | 20 |

Each constants file in `src/constants/` (`expenseCategories.ts`,
`creditCategories.ts`, `insuranceTypes.ts`, `subscriptionCategories.ts`,
`incomeCategories.ts`) maps its own categories to one of these hues.

### `<Dialog>` / `<DialogContent>`

**Responsive — bottom sheet on mobile, centered modal on desktop.**

- Mobile (<sm): slides up from bottom, drag-handle pill on top, max-h 88vh, rounded only on top corners
- Desktop (≥sm): centered, fades + zooms, max-w-lg, rounded all corners

Uses `--overlay` for the backdrop color.

### `<ThemeToggle>`

Drop-in toggle. Reads/writes `hh-theme` in localStorage, sets `data-theme` on
`<html>`. `showLabel` prop displays a text label next to the icon.

---

## 6. Patterns to avoid

- ❌ `<TabsList className="grid grid-cols-N">` — fights the primitive's flex layout. Just use `<TabsList>`.
- ❌ Inline color hex: `style={{ color: "#EF4444" }}`. Use a token or `hueToOklch(hue)`.
- ❌ Raw amount rendering: `{amount.toFixed(0)} SEK`. Use `<Money v={amount} />`.
- ❌ `bg-card` / `bg-primary` in NEW code. Prefer the new token names (`bg-surface`, `bg-accent`). The old names still work via aliases but are deprecated.
- ❌ Emoji glyphs in UI text. Use lucide-react icons.
- ❌ Pure white-on-black or black-on-white. Always the warm-toned `--ink` / `--bg` values.

---

## 7. Status

All design and UX phases shipped May 2026:
- Token foundation (OKLCH, light + dark, theme toggle)
- Primitives (Money, MonthChip, MetricTile, CatIcon, Tabs, Card, Button, Dialog/Sheet)
- Pages (Overview with hero + tiles + recent activity, Expenses, Income)
- Category color recipe via `color-mix(in oklab, ...)`
- Mobile bottom-sheet pattern in Dialog
- Tax Prognosis modal re-wired on Income page
- Shared Expense add form re-wired on SharedExpensesTab
- Smart Defaults rewritten as frontend computation (services/smartDefaults.ts)

Remaining engineering gaps tracked in project memory: tests, CI/CD, three
orphaned Settings cards (`CoParentsCard`, `CreditCardsSettingsCard`,
`IncomeSourcesCard`) — feature management moved to feature pages, open whether
to delete them or re-integrate.
