---
description: Tailwind CSS conventions and component extension patterns
---

# Tailwind Conventions

## Core Principle
**Utilities for spacing, variants for everything else.**

## What Goes in className
- Spacing: `mt-4`, `mb-6`, `gap-3`, `p-4`
- Sizing: `w-full`, `flex-1`, `h-10`
- Layout: `col-span-2`, `grid-cols-3`
- Responsive: `sm:hidden`, `md:block`

## What Should Be Variants
Any combination of:
- `bg-*` + `border-*` (color themes)
- `hover:bg-*` (interactive states)
- `text-*` with semantic meaning (warning, success, etc.)

## When to Create a Variant
1. Same color pattern appears 2+ times
2. Pattern has semantic meaning (warning, success, soft)
3. Pattern applies to interactive component (Button, Alert, Badge, Card)

## How to Add a Variant
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

## Anti-Patterns to Avoid
```tsx
// BAD: Color spam on component
<Button className="bg-primary/5 border-primary/20 hover:bg-primary/10">

// GOOD: Use or create variant
<Button variant="soft">
```

## Quick Reference: Available Variants

### Button
`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`

### Alert  
`default`, `destructive`, `warning`, `success`

### Badge
`default`, `secondary`, `destructive`, `outline`, `soft`, `success`, `warning`

### Card
`default`, `muted`
