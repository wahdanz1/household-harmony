# Design system tiers — primitives, patterns, pages

How the Claude Design system is structured for HH, and where multi-step flows live. Settled 2026-05-13 after the flows-question round.

---

## Three tiers

```
┌──────────────┐
│  Primitives  │  Button, Money, Row, Tabs, MetricTile, MonthChip, …
└──────┬───────┘
       │
┌──────▼───────┐
│   Patterns   │  Step indicator, Picker list, Confirm-with-stakes, …
└──────┬───────┘
       │
┌──────▼───────┐
│    Pages     │  Översikt, Utgifter, Inkomst, Inställningar
└──────────────┘
```

**Flows** (Monthly Review, Setup, Leave, Join) live as **product code that composes patterns**. They are NOT canonicalized in the design system — they're too app-specific. If a flow stabilizes and starts being copied around, it can be promoted to a documented *exemplar* with screenshots, but never as a primitive.

---

## Why three tiers (not two)

The default split — primitives + pages — hits a wall the moment a product has multi-step flows. Material, Polaris, and Atlassian all eventually added this middle tier under different names ("patterns," "best practices," "experiences"). HH has four real flows and benefits from the same structure.

---

## The five HH patterns

| Pattern | Used by | Adjacent system citizens |
|---|---|---|
| **Step indicator** | Setup, Leave, Join | New — uses progress-bar tokens |
| **Picker list w/ checkboxes** | Leave, Join | Extends `Components · Row` with leading checkbox + selection state + footer summary ("3 of 8 selected · 4 200 kr/mån") |
| **Reconciliation summary card** | Monthly Review | New — plan vs. actual variance, uses Money tokens + the `~`-vs-exact treatment |
| **Tab pair on a page** | Monthly Review | Already exists — `Components · Tabs & chips`. Pattern entry is a usage doc/exemplar, not a new component. |
| **Confirm-with-stakes dialog** | Leave, Join, Delete account | New — destructive-action modal with stakes preview ("Detta tar bort 4 utgifter") |

So: **4 new components + 1 usage exemplar**.

---

## HH flows (composed from patterns, not canonical)

| Flow | Where in app | Patterns it composes |
|---|---|---|
| **Monthly Review** | Overview page → 2 tabs + 1 dialog | Tab pair on a page, Reconciliation summary card, Confirm-with-stakes dialog |
| **Household Setup** | First-run wizard, also re-runnable from Settings | Step indicator, plus form primitives |
| **Leave Household** | "Bring things with you" picker (which items carry forward to your new solo household) | Step indicator, Picker list w/ checkboxes, Confirm-with-stakes dialog |
| **Join Household** | "Bring things into the household" picker (mirror of Leave) | Step indicator, Picker list w/ checkboxes, Confirm-with-stakes dialog |

---

## Principles

1. **Flow code references patterns by token.** If a flow imports `<StepIndicator/>` from the system, every system update propagates automatically.
2. **Patterns extend primitives where possible.** The Picker list extends the existing Row component (leading checkbox + selection state); it's NOT a parallel row variant. Same anatomy, additional decoration.
3. **Periodic flow audits.** Open each flow, screenshot every step, paste them into the design-system project, call out drift. Don't do this preemptively — only when flows exist in code.
4. **Don't promote flows to primitives.** Even if Monthly Review is heavily used, its visual shape stays product code. The patterns it composes are canonicalized; the assembly is not.

---

## When to revisit

- A flow stabilizes and other flows start copying parts of it → promote those parts to patterns.
- A pattern accumulates real-world variations → split into sub-patterns or document the variant.
- A flow appears across surfaces (e.g., a "bulk select" pattern bleeds out of Leave/Join into Expenses bulk-edit) → that's a signal to broaden the pattern's scope.
