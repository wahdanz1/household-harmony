# Design system follow-ups

Implementation questions raised during Claude Design review blocks. These are for the project (Claude Code), not the design system itself.

See [`expenses-model.md`](./expenses-model.md) for the canonical Expenses domain model.

---

## Open

### Date formatter helper for digit/word isolation
**From:** Brand · Number formatting block
**Context:** Design system established that in-row dates use `<span class="digit">1</span> <span class="word">maj</span>` to get DM Mono + tabular-nums on the digit and DM Sans on the month word.
**Question:** Do we have a `formatDate()` utility that emits this wrapping, or are we expected to apply it manually at every date callsite? If manual, we'll get drift from forgotten spans — especially in lists generated from data. Likely want a helper before adopting the pattern widely.

### "Last month's amount" (förra X kr) display on Subs/Insurances rows
**From:** Components · Row block (Variabel state, since killed)
**Context:** Claude Design's killed `Variabel` row showed "förra 379 kr" — last month's amount — as a sub-line for variable bills like phone plans.
**Question:** There's real value in surfacing "you paid 379 kr last month" at a glance, but it can become bloat. Worth revisiting once actuals start flowing in (CSV / bank API). Park for now.

### Multi-frame totals on section headers
**From:** Current Expenses page (Insurances section)
**Context:** Insurances total currently shows `222 SEK/month · 2664 SEK/year · 111 SEK avg`. Pattern is good but inconsistent across sections.
**Question:** Extend the same pattern to Expenses and Subscriptions section headers. Tighten "avg" to be unambiguous (e.g. `snitt 111 kr/post`). Pairs naturally with the eventual Forecast page.

---

## Answered

_(none yet)_
