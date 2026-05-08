---
trigger: always_on
---

# Tailwind & styling conventions

## Core principle
**Styling lives in base components, not at call sites.**

Inline `className` should only carry **layout, spacing, sizing, and responsive utilities** — the things that genuinely vary per usage. Visual styling (colors, borders, hover states, semantic intent) belongs in the component itself, surfaced as a `variant` prop.

If you find yourself writing color or hover utilities at the call site, that's a signal to either:
- Use an existing variant (`variant="soft"`, `variant="warning"`, etc.), or
- Add a new variant to the base component if the pattern is reusable.

The only legitimate inline-styling case is a **necessary one-off override** — and even then, prefer extending the variant system if the override might recur.

## What goes in `className`
- Spacing: `mt-4`, `mb-6`, `gap-3`, `p-4`
- Sizing: `w-full`, `flex-1`, `h-10`
- Layout: `col-span-2`, `grid-cols-3`, `flex`, `items-center`
- Responsive: `sm:hidden`, `md:block`

## What should be a variant
Any combination of:
- `bg-*` + `border-*` (color themes)
- `hover:bg-*` (interactive states)
- `text-*` with semantic meaning (warning, success, etc.)

## When to create a variant
1. Same color/state pattern appears 2+ times
2. Pattern has semantic meaning (warning, success, soft)
3. Pattern applies to an interactive component (Button, Alert, Badge, Card)

## How to add a variant
```tsx
// In component file (e.g., badge.tsx)
const badgeVariants = cva("...", {
  variants: {
    variant: {
      existing: "...",
      newVariant: "bg-color/10 text-color border-color/30",
    },
  },
});
```

## Anti-patterns
```tsx
// BAD: visual styling spammed at call site
<Button className="bg-primary/5 border-primary/20 hover:bg-primary/10">

// GOOD: use a variant
<Button variant="soft">
```

```tsx
// BAD: ad-hoc one-off color override that should be a semantic variant
<Card className="bg-yellow-500/10 border-yellow-500/30 text-yellow-200">

// GOOD: lift to a variant if it recurs, otherwise use existing semantic variants
<Card variant="warning">
```

## Quick reference: available variants

### Button
`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`

### Alert
`default`, `destructive`, `warning`, `success`

### Badge
`default`, `secondary`, `destructive`, `outline`, `soft`, `success`, `warning`

### Card
`default`, `muted`
