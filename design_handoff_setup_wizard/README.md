# Handoff: Setup Wizard

## Overview

A **6-step modal/full-screen wizard** that runs once after vault setup. It
walks a new user through entering their first month: which features to
enable, their income sources, fixed expenses, subscriptions, insurances,
and a final review of the projected monthly balance.

Steps, in order:

| # | Step       | Purpose                                          |
|---|------------|--------------------------------------------------|
| 1 | Welcome    | Brief intro + 2 feature toggles (credit cards, sambo/sharing) |
| 2 | Income     | Add monthly income sources                       |
| 3 | Expenses   | Add fixed monthly expenses (with Fixed / Budget split) |
| 4 | Subs       | Add subscriptions with cadence                   |
| 5 | Insurance  | Add insurances with cadence                      |
| 6 | Review     | Resolved monthly math + per-section summaries    |

Out of scope: the form dialogs for adding individual items
(income/expense/subscription/insurance). Those are already designed and
implemented elsewhere — the wizard opens them in edit mode when a row is
tapped, and in create mode when "Lägg till" is tapped.

## About the design files

The HTML/JSX files in `references/` are **design references**, not
production code. They were authored in a sandboxed prototype environment
(pinned React 18 via Babel, in-line styles, no build step) so the
interactions could be explored and the decisions verified live.

**The task is to recreate this design in the existing Household Harmony
codebase using its own React/TypeScript/Tailwind/shadcn-ui environment and
existing primitives** — not to copy the prototype files in. Specifically:

- The wizard **composes existing primitives that already exist in the live
  app**: `Btn` (`primary` / `secondary` / `ghost` / `accentSoft` /
  `destructive`), `Card` (variant `flush`), `RowItem`, `Money` (with the
  `estimate` prop for `~` rendering), `CatIcon`, `Toggle`, `Icon`,
  `ConfirmDialog`.
- The wizard **composes two existing design-system patterns**:
  `StepIndicator` and the Confirm-with-stakes dialog shape.
- All color, type, spacing, and radius tokens already exist as CSS
  variables (`--accent`, `--ink`, `--surface`, `--line`, etc.) and as
  Tailwind utilities. **Do not re-import or re-declare them.**

If a primitive doesn't exist yet (e.g. the StepIndicator's wizard variant —
no "Step N of M" eyebrow, no percentage), build it once into the shared
primitives and have the wizard consume it. Don't inline it as a one-off
inside the wizard module.

## Fidelity

**High-fidelity.** The prototype is pixel-accurate to intent. Exact
measurements, weights, colors, copy, animation durations, and behaviors
are all documented below. Recreate it exactly, but **use the live app's
existing primitives** to render the visuals — don't reach back into the
prototype's inline styles.

---

## Screens / views

### 0 · Wizard shell (frames every step)

**Desktop**

- Centered modal dialog. **840px wide** (the recommended commit; see
  `Decisions › Q1`), `max-width: calc(100% - 40px)`, `max-height:
  calc(100% - 40px)`.
- Border: `1px solid var(--line)`. Radius: `20px`.
- Shadow: `0 12px 40px rgba(20, 15, 10, 0.18)` (override of `--shadow`
  because the dialog needs more lift than card-level elevation).
- Scrim behind: `rgba(20, 15, 10, 0.32)` — same as `--overlay`.
- A subtle radial gradient (`radial-gradient(circle at 50% 30%,
  oklch(0.94 0.01 75) 0%, var(--bg) 70%)`) sits behind the scrim to
  suggest "modal over app" without rendering the actual app underneath.
  Optional — drop if it looks busy in production where the actual app
  shows through.

**Mobile**

- **Full-screen sheet**, not bottom sheet. Fills the viewport.
- Same internal layout as desktop, no border-radius or shadow.

**Shared internal layout** (vertical flex):

1. **Header strip** (`padding: 14px 18px 0` desktop, `12px 16px 0` mobile)
   - Eyebrow text "Sätt upp · Maj 2026" — uppercase 0.08em letter-spacing,
     `font-size: 10.5px`, `font-weight: 600`, `color: var(--muted)`.
   - Close (×) button on the right: 32×32 round, `background:
     var(--surface-2)`, no border, X icon `var(--ink-2)`.
2. **StepIndicator** (see below)
3. **Content** — `flex: 1`, `overflow: auto`, `padding-bottom: 10px`.
4. **Footer** — `padding: 14px 20px 18px`, `border-top: 1px solid
   var(--line-2)`, button row.

### 0a · StepIndicator (wizard variant)

A horizontal row of 6 nodes, evenly spaced, with thin connector lines
between them. Lives in `padding: 6px 24px 22px` inside the dialog (between
header and content).

Each node:

- A 26×26 round dot. Below the dot, a label.
- Dot states:
  - **Done** (any step before current): background `var(--accent)`, text
    `var(--accent-ink)`, border `1px solid var(--line)`. Renders a check
    glyph (`stroke-width: 2.6`, 13×13).
  - **Current**: background `var(--surface)`, text `var(--accent-dk)`,
    border `2px solid var(--accent)`. Renders the step number (1–6).
  - **Future**: background `var(--surface)`, text `var(--muted)`, border
    `1px solid var(--line)`. Renders the step number.
- Step number rendered in `DM Mono` with `font-variant-numeric:
  tabular-nums`, `font-size: 12px`, `font-weight: 600`.
- Label below: `DM Sans 10.5px`, `font-weight: 600` if current / `500`
  otherwise, `color: var(--ink)` if current / `var(--ink-2)` if done /
  `var(--muted)` if future.
- Done + current nodes are clickable (allow jumping back). Future nodes
  are not clickable.

Labels (Swedish, fixed): `Välkommen`, `Inkomst`, `Utgifter`, `Prenum.`,
`Försäkring`, `Klart`.

Connector lines between nodes: `flex: 1`, `height: 2px`, `border-radius:
1px`, `margin: 12px 4px 0`. Color is `var(--accent)` if the *preceding*
node is done, else `var(--line-2)`. Transition `background 200ms ease` so
it animates as steps complete.

**Important — no "Step N of M" text, no percentage**. Just the indicator.
The previous design experimented with eyebrow text + a percent figure;
both were removed.

### 1 · Welcome

- Title (`h2`): "Sätt upp din första månad", `DM Sans 24px / 700 /
  -0.02em letter-spacing`, `color: var(--ink)`.
- Subtitle: "Tar ungefär 4 minuter. Du kan ändra allt senare.", `DM Sans
  14px / 400 / 1.55 line-height`, `color: var(--ink-2)`, `max-width:
  580px`.
- Two feature rows inside a flush card (`background: var(--surface)`,
  `border: 1px solid var(--line)`, `border-radius: 14px`, `overflow:
  hidden`):
  - **Kreditkort** — `CatIcon cat="card"` 36×36, title "Kreditkort",
    sub "Spåra köp och gräns per kort", `Toggle` on the right.
  - **Sambo & delning** — `CatIcon cat="family"` 36×36, title
    "Sambo & delning", sub "Dela utvalda utgifter med en medlem",
    `Toggle`.
  - Divider between rows: `1px solid var(--line-2)`.
- Helper text below the card: "Du kan slå på dessa senare i
  **Inställningar → Hushåll → Tilläggsmoduler**." — `12px`,
  `color: var(--muted)`, `line-height: 1.5`. The path "Inställningar →
  Hushåll → Tilläggsmoduler" is in `var(--ink-2)`, `font-weight: 600`
  (calls out the destination without shouting).
- Footer buttons:
  - **Left:** "Hoppa över — jag lägger till manuellt" (`Btn kind="ghost"`).
    On mobile the label shortens to just "Hoppa över" to fit the row.
  - **Right:** "Fortsätt →" (`Btn kind="primary"`).

### 2–5 · Item list step (Income / Expenses / Subs / Insurance)

The same component, parameterized by `kind`. Title and copy change per
kind. **No category icon next to the title** (the StepIndicator carries
position; rows carry categorical signal).

Step-specific copy:

| kind        | title              | subtitle                                                  | empty-state                                                       | add-button         |
|-------------|--------------------|-----------------------------------------------------------|--------------------------------------------------------------------|---------------------|
| `income`    | Inkomstkällor      | Lön, frilans, hyresintäkter, ersättningar.                | Inga inkomstkällor ännu — börja med din huvudsakliga lön.          | Lägg till inkomst   |
| `expenses`  | Fasta utgifter     | Hyra, el, bredband, mat, drivmedel. Lägg till en åt gången. | Inga utgifter ännu — börja med hyra eller bostadslån.              | Lägg till utgift    |
| `subs`      | Prenumerationer    | Streaming, mjukvara, gym, tidningar.                      | Inga prenumerationer ännu — Spotify, Netflix, Storytel…            | Lägg till prenumeration |
| `insurance` | Försäkringar       | Hem, bil, hälsa, liv. Lägg till per försäkringsbolag.    | Inga försäkringar ännu — börja med hemförsäkring.                  | Lägg till försäkring |

#### 2a · Empty state

When the list is empty:

- Dashed card: `background: var(--surface)`, `border: 1px dashed
  var(--line)`, `border-radius: 14px`, `padding: 28px`, `text-align: center`.
- Step-specific empty copy (see table above), `DM Sans 13.5px / 400 /
  1.55 line-height`, `color: var(--muted)`, `max-width: 360px`, centered.
- A `Btn kind="accentSoft" size="md"` below with a `+` Lucide icon and the
  add-button label.

#### 2b · With items

When the list has items:

- A flush card with rows inside (`background: var(--surface)`, `border:
  1px solid var(--line)`, `border-radius: 14px`, `overflow: hidden`).
- Each row is a clickable button (tap-to-edit, opens the existing form
  dialog in edit mode):
  - `padding: 11px 16px`, hover background `var(--surface-2)` with
    `transition: background 100ms ease`.
  - Divider between rows: `1px solid var(--line-2)`.
  - Leading `CatIcon` 36×36 keyed to `item.cat`.
  - Title in the middle: `DM Sans 14.5px / 500 / -0.01em`, ellipsis on overflow.
  - Trailing amount: `DM Mono`, `font-variant-numeric: tabular-nums`,
    `14.5px`. Color and weight depend on `isBudgeted`:
    - **Fixed** (`isBudgeted: false`, or any subscription/insurance row):
      `font-weight: 600`, `color: var(--ink)`. No prefix.
    - **Budget** (`isBudgeted: true` on Expenses): `font-weight: 500`,
      `color: var(--ink-2)`, with a leading `~` rendered as `DM Sans 16px
      / 500`, `color: var(--accent-dk)`, `margin-right: 3px`, `transform:
      translateY(1px)`, `line-height: 1`.
  - Unit suffix in `DM Sans 12.5px / 400`, `color: var(--muted)`,
    `margin-left: 2px`. Default `kr`; subs/insurance with `freq === 'yearly'`
    use `kr/år`; with `freq === 'quarterly'` use `kr/kv`.
- "Lägg till till" button below the card: `Btn kind="secondary" size="md"`
  full-width with a `+` icon.

- Footer buttons (steps 2–5):
  - **Left:** "← Tillbaka" (`Btn kind="ghost"`).
  - **Right:** "Fortsätt →" (`Btn kind="primary"`).

### 6 · Review

The "you did it" moment — but resolved through math, not celebration.

- Title: "Allt på plats".
- Subtitle: "Din första månad projiceras nedan. Du kan justera när som
  helst."
- **Hero math card** (mirrors the Dashboard's `Kvar att spara` summary
  card):
  - Outer: `Card` with `padding: 0`, `overflow: hidden`, `margin-bottom: 14px`.
  - Upper section, `padding: 18px 20px 16px`, `border-bottom: 1px solid
    var(--line-2)`:
    - Eyebrow "Kvar att spara i maj": `DM Sans 12px / 500 / 0.04em`,
      `color: var(--muted)`.
    - Amount line, baseline-aligned, marginTop 4:
      - If any expense has `isBudgeted: true`, prepend a leading `~`:
        `DM Sans 28px / 500`, `color: var(--accent-dk)`, `transform:
        translateY(2px)`, `line-height: 1`. (Indicates the projection
        carries estimate-error.)
      - The number: `DM Mono`, `tabular-nums`, `font-size: 40px /
        weight 600 / letter-spacing -0.03em`. Color is `var(--accent)`
        if `balance >= 0`, `var(--danger)` otherwise.
      - Sign prefix: `+` when positive, real minus `−` (U+2212) when
        negative — never a hyphen.
      - Trailing unit: `DM Sans 18px / 500`, `color: var(--muted)`,
        `margin-left: 4px`.
    - In/out line, marginTop 8: "X kr in · X kr ut" — digits in mono
      tabular, words in `DM Sans 12.5px / 400`, `color: var(--muted)`.
  - Lower section, `padding: 12px 20px`, `background: var(--accent-tint)`:
    - "Klart att börja maj — tryck **Klar** för att stänga uppsättningen."
    - `DM Sans 12.5px / 500`, `color: var(--accent-dk)`. Word `Klar` in
      `font-weight: 700`.
- **Four section summary rows** (one per kind), each:
  - `padding: 12px 12px 12px 18px`, `border: 1px solid var(--line)`,
    `border-radius: 14px`, `margin-bottom: 8px` (last has 0).
  - Title left: `DM Sans 14px / 600 / -0.01em`.
  - Sub line under title: `<count> post(er)` — `11.5px`, `color:
    var(--muted)`. Count in mono tabular.
  - Mid-right: monthly total in `DM Mono 15 / 600`, suffix `kr/mån` in
    `DM Sans 12 / 400`, `color: var(--muted)`.
  - Far right: a small "Lägg till fler" button — `height: 30px`, `padding:
    0 10px`, `border-radius: 8px`, `border: 1px solid var(--line)`,
    `background: var(--surface)`, `font-size: 12 / 600`, `color:
    var(--ink-2)`. Clicking it jumps back to that step (steps 1–4 by
    index).

- Footer buttons:
  - **Left:** "← Tillbaka" (`Btn kind="ghost"`).
  - **Right:** "Klar — börja maj" (`Btn kind="primary"`).

### 7 · Discard dialog (X exit with items added)

When the user taps X *and* has added items in this session, intercept with
this dialog. Tapping × with no items added closes silently.

- Composes the Confirm-with-stakes pattern (`references/_pattern-confirm-stakes.html`).
- Scrim: `rgba(20, 15, 10, 0.32)`, full inset, animates with `hh-fade
  180ms ease`.
- Dialog: `width: 420px`, `background: var(--surface)`, `border: 1px solid
  var(--line)`, `border-radius: 20px`, `overflow: hidden`. Animates in
  with `hh-pop 220ms ease`.
- Title (h3): "Avsluta uppsättningen?", `DM Sans 17 / 600 / -0.01em`.
- Description: "Det du har lagt till sparas inte. Du kan börja om när som
  helst från Inställningar." — `13 / 400 / 1.5`, `color: var(--ink-2)`.
- **Stakes panel** — the new pattern element:
  - `margin: 0 20px`, `padding: 12px 14px`, `background: var(--surface-2)`,
    `border: 1px solid var(--line)`, `border-radius: 10px`.
  - Eyebrow "Detta kastas": uppercase 0.08em, `10.5 / 600`, `color:
    var(--muted)`.
  - List of `label : count` pairs, one row per category, only rendered if
    count > 0. `DM Sans 13`, label in `var(--ink-2)`, count in mono
    tabular, `font-weight: 600`, `color: var(--ink)`. Right-aligned
    counts.
- Footer: `padding: 16px 20px 18px`, buttons right-aligned with `gap: 8`.
  - **Left:** "Avbryt" (`Btn kind="secondary"`). The visually safer default.
  - **Right:** "Avsluta" (`Btn kind="destructive"`).

---

## Interactions & behavior

### Navigation

- StepIndicator: clicking a *done* or *current* node sets `step` to that
  index. Future nodes are not clickable.
- Footer buttons drive `step` forward/backward.
- Review's per-section "Lägg till fler" jumps directly to that step
  (Income=1, Expenses=2, Subs=3, Insurance=4).

### Adding items

- "Lägg till …" inside a step opens the existing form dialog for that
  kind in **create mode**. The wizard listens for the form's "saved"
  event and appends the item to the in-session list.
- Clicking a row inside a step opens the existing form dialog in **edit
  mode** with that item's id.

### Closing

| Trigger                                        | Behavior                                                                 |
|------------------------------------------------|--------------------------------------------------------------------------|
| **Skip** on Step 1                             | Closes wizard immediately. Mark setup as done so it doesn't re-open.     |
| **X** with no items added                      | Closes silently. Wizard not marked done — re-opens on next session.       |
| **X** with any items added                     | Opens the Discard dialog. "Avsluta" discards in-session state and closes. |
| **Klar — börja maj** on Step 6                 | Persists all in-session items to the user's vault, marks setup done.     |

### Animations

- `hh-fade` (180ms ease): scrim fade-in.
- `hh-pop` (220ms ease, scale 0.96 → 1 + opacity 0 → 1): dialog enter.
- `hh-rise` (240ms cubic-bezier(0.2, 0.8, 0.2, 1)): mobile sheet rise — only used if you implement a bottom-sheet on the form sub-dialogs; the wizard itself is full-screen on mobile and slides in as a route, not a sheet.
- StepIndicator dot transitions: `transition: all 160ms ease`.
- StepIndicator connector lines: `transition: background 200ms ease`.
- Row hover: `transition: background 100ms ease`.

### Responsive

- < 640px: full-screen sheet, no border-radius, no max-width constraint.
- ≥ 640px: centered modal at the configured dialog width.

---

## State management

```ts
type WizardState = {
  step: 0 | 1 | 2 | 3 | 4 | 5;
  features: { creditCards: boolean; sharedExpenses: boolean };
  income:     IncomeItem[];     // pulled from the form sub-dialog on save
  expenses:   ExpenseItem[];
  subs:       SubscriptionItem[];
  insurance:  InsuranceItem[];
  confirmCloseOpen: boolean;
};
```

In-session list state is **not persisted** until the user hits "Klar —
börja maj" on Step 6. Each list state mirrors what's already on the
corresponding page in the live app — same shape, same primitives.

Persisting in-flight progress between sessions is *out of scope* for this
handoff (the assumption is that users complete the wizard in one sitting;
if they bail, the wizard re-opens fresh next time). If that assumption
breaks during user testing, the wizard can wire to `localStorage` with
trivial diff.

---

## Design tokens

**All tokens already exist** in the live app. Do not re-import them. For
reference, the values consumed:

```css
/* Colors */
--accent:       oklch(0.56 0.13 152);   /* primary CTAs, +balance, brand */
--accent-dk:    oklch(0.42 0.13 152);   /* accent text on tinted bg, ~ tilde */
--accent-tint:  oklch(0.95 0.05 152);   /* Review accent strip, soft buttons */
--accent-ink:   #FFFFFF;                /* text on solid accent */
--ink:          oklch(0.20 0.012 60);   /* primary text */
--ink-2:        oklch(0.34 0.010 60);   /* body / secondary */
--muted:        oklch(0.54 0.012 60);   /* captions, eyebrows */
--surface:      #FFFFFF;                /* card, dialog */
--surface-2:    oklch(0.96 0.006 75);   /* hover, stakes panel, close btn bg */
--line:         oklch(0.91 0.008 70);   /* outer borders */
--line-2:       oklch(0.94 0.006 75);   /* internal dividers */
--danger:       oklch(0.55 0.18 28);    /* destructive btn, -balance */
--overlay:      rgba(20, 15, 10, 0.32); /* scrim */

/* Spacing — the values used in this design */
2 / 4 / 6 / 8 / 10 / 11 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 38 / 40

/* Radii */
6  → stakes panel
8  → small inline buttons ("Lägg till fler", item delete buttons)
10 → stakes panel inner block
12 → card inputs, sm/md buttons
14 → standard card (DEFAULT)
20 → dialog & modal

/* Typography (DM Sans + DM Mono, tabular-nums on all numerics) */
H2 step title   24 / 700 / -0.02em
Body            14 / 400 / 1.55 line-height
Row title       14.5 / 500 / -0.01em
Eyebrow         10.5–11 / 600 / 0.08em upper-cased
Mono amount     14.5 / 600 (Fixed) or 14.5 / 500 (Budget)
Mono hero       40 / 600 / -0.03em
```

---

## Assets

- **Icons**: all from existing icon set (Lucide via `lucide-react`).
  Specific icons used: `plus`, `close`, `chevron-down`, and the check
  glyph (custom inline SVG, `stroke-width: 2.6`). Category icons resolve
  via existing `CatIcon` (no new icons needed).
- **No raster assets** — pure CSS + SVG.
- **Logo**: not used inside the wizard (the surrounding app shell already
  carries it).

---

## Files in this bundle

```
design_handoff_setup_wizard/
├── README.md                                 ← you are here
└── references/
    ├── setup-wizard.html                     ← the prototype entry; loads
    │                                            wizard + canvas + Tweaks
    ├── wizard.jsx                            ← all wizard components
    │                                            (SetupWizard, WizardStepIndicator,
    │                                             WelcomeStep, ItemListStep,
    │                                             ItemRow, ReviewStep,
    │                                             ReviewSection, DiscardDialog,
    │                                             STEP_KIND, WIZARD_STEPS)
    ├── _primitives-reference.jsx             ← read-only — shows the design-
    │                                            system primitives the wizard
    │                                            assumes (Btn, Card, Toggle,
    │                                            CatIcon, Icon, T tokens,
    │                                            sansStack, monoStack, fmtKr)
    ├── _pattern-step-indicator.html          ← the StepIndicator pattern card
    │                                            (the wizard variant drops the
    │                                            eyebrow + percentage)
    └── _pattern-confirm-stakes.html          ← the Confirm-with-stakes pattern
                                                 card (DiscardDialog implements)
```

**Open `setup-wizard.html` in a browser to interact with the prototype.**
The Tweaks panel in the bottom-right toggles dialog width (672 / 840 /
1024), welcome tone (pragmatic / warm), skip button weight (ghost /
secondary), and empty-state copy (nudge / generic).

---

## The 7 design decisions, committed

The original brief had 7 open questions. Each was resolved during the
design pass — rationale below so you don't re-litigate during implementation.

1. **Dialog width: 840px desktop.** Tweakable to 672 and 1024 in the
   prototype for A/B; the live commit is 840. Rationale: 672 reads as a
   settings dialog; this is the user's first 5 minutes — give it room.
2. **Category icon: drop from the title, keep StepIndicator nodes
   uniform.** Dots stay numbered. Categorical signal lives on the item
   rows (which already have CatIcon).
3. **Mobile: full-screen sheet, not bottom sheet.** Six steps is a flow,
   not a glance. Pinned StepIndicator + close top, pinned footer bottom,
   scrollable middle.
4. **Empty state: step-specific nudge.** Dashed card stays generic, copy
   inside tells the user the first concrete thing.
5. **Review: no confetti.** Resolved math + forward-pointing accent
   strip. The satisfaction is the number being concrete.
6. **Welcome tone: pragmatic, brief.** Brand voice is calm. "Sätt upp
   din första månad. Tar ungefär 4 minuter." Domestic warmth comes from
   the product, not the setup copy.
7. **Skip button: ghost.** Equal semantically to Continue; visually
   quieter. Reads as a real choice without competing with primary green.

---

## Implementation tips for Claude Code

- **Reuse, don't re-import.** Reach for the existing `Btn`, `Card`,
  `Toggle`, `CatIcon`, `Icon`, `Money` (with `estimate` prop),
  `RowItem`, and `ConfirmDialog` primitives. The wizard module should be
  ~5–6 small files, not a self-contained subsystem.
- **Build `StepIndicator` as a real primitive.** The pattern card in
  `references/` has the full state machine (done / current / next /
  optional). The wizard uses a slimmer variant (no eyebrow, no
  percentage, no optional state). Build the base primitive with all four
  states + variant props; the wizard configures it.
- **Reuse `Money` with `estimate` prop.** The team has already
  implemented `Money` with an `estimate` boolean that drives the `~`
  prefix + muted treatment. Pass `estimate={item.isBudgeted}` to it for
  Expenses rows; subs/insurance never set it.
- **`SectionFrames` is already built** for the existing Expenses page.
  Review's per-section summary cards use a simpler shape (title + count +
  monthly total + jump button); don't reach for `SectionFrames` here.
- **Route, don't mount-in-app.** On desktop the wizard is a modal route
  (`/setup`) over the dashboard. On mobile it's a full-screen route. Use
  React Router and the existing route-level animation primitives.
- **Use the existing `ConfirmDialog`** for the Discard dialog. The stakes
  panel inside is a new compositional element — add it as an optional
  `stakes` prop on `ConfirmDialog` that takes `{label, count}[]` and
  renders the surface-2 block. Or just inline the panel in this one
  caller if you'd rather not extend the primitive yet.

If anything in this document is ambiguous, open `references/setup-wizard.html`
in a browser and walk through the prototype — every decision is reflected
visually there.
