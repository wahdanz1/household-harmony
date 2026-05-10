---
name: skeleton-fidelity
description: Use when building or fixing loading skeletons. Forces skeletons to mirror live element line-heights and structure so the swap from skeleton → real content causes zero layout shift.
---

# Skeleton fidelity

A skeleton's only job is to be **the same height** as the content that replaces it. Get that right and there is no flash, no jump, no domino-of-drift down the page.

## The rule

Match the **line-height** of the live element, not its font-size.

In Tailwind, every `text-N` utility sets both `font-size` and `line-height`. Skeleton heights must equal that line-height (not the font-size). Use `h-N` mapped from the line-height column:

| `text-N`   | font-size | line-height | Skeleton class |
|------------|-----------|-------------|----------------|
| `text-xs`  | 12px      | 16px        | `h-4`          |
| `text-sm`  | 14px      | 20px        | `h-5`          |
| `text-base`| 16px      | 24px        | `h-6`          |
| `text-lg`  | 18px      | 28px        | `h-7`          |
| `text-xl`  | 20px      | 28px        | `h-7`          |
| `text-2xl` | 24px      | 32px        | `h-8`          |
| `text-3xl` | 30px      | 36px        | `h-9`          |
| `text-4xl` | 36px      | 40px        | `h-10`         |

Custom `leading-N` overrides this. Always check.

## Check the cascade

Base styles in [index.css](frontend/src/index.css) override defaults. Right now:

- `p { @apply leading-7 text-sm; }` — an unsized `<p>` is **28px tall**, not 20px
- `h3 { @apply text-xl ...; }` — h3 is `h-7`
- `h1 { ... leading-none ...; }` — h1 collapses line-height to font-size

If the live element has no explicit `text-N` class, walk back to the base stylesheet and use *that* line-height. A frequent footgun: `<p className="font-medium">` looks unstyled but is `h-7` because of base `p { leading-7 }`.

## Mirror the structure

The skeleton component should reuse the **exact same wrapper components and class strings** as the live component:

- Use the actual `<Card>` / `<Card variant="flush">`, not a hand-rolled div with guessed border + radius
- Use the actual `<Button size="lg" disabled>` with a Skeleton block as its child — the button's height/radius come from its own cva
- For containers Radix forbids standalone (e.g. `<TabsList>`), copy the wrapper's class string verbatim and put `Skeleton` triggers inside

When the live component changes its padding or border, the skeleton follows automatically. No second pixel value to forget about.

## Spacing and margins

Copy `mt-N` / `space-y-N` from the live source verbatim. If the live header uses `mt-0.5` between two `<p>`s, the skeleton uses `mt-0.5` between two Skeleton blocks. Don't substitute `space-y-1.5` because it "looks right" — it adds 6px instead of 2px and that's where drift starts.

## Conditional content

If the live block sometimes shows extra content (a metrics row, a CTA, a chevron), the skeleton must show a placeholder for it whenever that content will appear in the loaded state. Otherwise you get a height delta on swap.

When the loaded layout is unknown (e.g. tabs visible based on settings), prefer the most common case — a small placeholder reserved is better than a layout jump.

## Custom-pixel text sizes (`text-[11.5px]`, etc.)

Arbitrary-value text classes set only `font-size`. Line-height inherits whatever the cascade gives — usually `normal` (~1.2 of font-size) on a `div`/`span`, or whatever a parent rule sets. The lookup table above doesn't help here.

For these, the safest skeleton is to render the **actual element with its actual class** and put a `SkeletonText`-style inline-block inside, so the parent's natural line-height drives the line-box height:

```tsx
<span className="text-[11.5px] font-semibold">
    <SkeletonText className="w-20 h-[1em]" />
</span>
```

`h-[1em]` makes the placeholder fill the parent's font size while the parent's text class controls the surrounding line-box.

## Inline-block placeholders need `align-baseline`, not `align-middle`

When a `SkeletonText` (`inline-block` with zero-width-space content) sits inside an inline text element, `align-middle` shifts it to the parent's x-height middle, which is **~1px off** the natural text baseline of the live content. `align-baseline` aligns to the same baseline real glyphs use, so the line-box height stays identical pixel-for-pixel.

This is the source of the classic "skeleton card is 1px taller than the loaded card" bug.

## Mirror flex/items-baseline wrappers too

If the live `Money` is wrapped in `<div className="mt-1 flex items-baseline gap-2">`, the skeleton's wrapper needs the **same** `flex items-baseline` — not just `<div className="mt-1">`. The flex baseline alignment changes how the inline span sits in its container by a fraction of a pixel; missing it cascades.

## Verifying

The cheap check: load the page, screenshot the skeleton, screenshot the loaded state, layer them in any image tool. Differences should be sub-pixel. If a block is off by 4–8px and that delta cascades downward, the bug is at the **first** mismatched block, not the last.

The expensive check: run dev tools' "Layout Shift" tool. Any CLS > 0 from skeleton → content swap means a height mismatch somewhere.
