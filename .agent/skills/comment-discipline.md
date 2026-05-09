---
name: comment-discipline
description: Use whenever writing or editing code in this repo. Bans "I did X because of Y" narrative comments and post-hoc justifications; keeps only short declarative comments where the WHY is non-obvious to a future reader.
---

# Comment discipline

**Default: write no comment.** Only add one when removing it would actually confuse a future reader or cause them to do something unsafe.

## Delete on sight

These belong in the **commit message** or **PR description**, never in the code. The code outlives the conversation that produced it; comments like these rot fast and add noise.

- "Previously this did X, now it does Y"
- "Replaces the old direct-insert + manual-update pair"
- "X is no longer publicly readable / queryable / etc."
- "The reason this is now an RPC is…"
- "Single atomic RPC: validates the invite, inserts the membership…" ← describes **WHAT**, the code already says it
- "Per-user key — two users uploading the same PDF must not share parsed results" ← narrative
- "user_id is derived from the JWT, never trusted from the body" ← justifies a security stance, doesn't help the next reader use the code
- Any comment that references the current task, PR, recent change, or which file the matching change lives in.

## Sometimes acceptable

- One short line explaining a non-obvious **WHY**: a hidden constraint, a subtle invariant, a workaround for a specific upstream bug, or behavior that would surprise a reader looking only at the code.
- A maintenance instruction tied to a fragile coupling (e.g. *"regenerate this hash if you edit the inline script"*).
- A docstring that says what a function does, **only when the name doesn't already make it obvious**. No multi-paragraph docstrings.

## The single test before writing any comment

Ask yourself, in this exact order:

1. **Does the well-named code already say this?** → don't write it.
2. **Is this a story about how the code got here?** → don't write it. Put it in the commit message.
3. **If a competent reader read only the code, would they be confused or do something unsafe?** → write the shortest possible declarative version.

If you find yourself reaching for words like *"now"*, *"replaces"*, *"used to"*, *"the reason"*, *"so that"*, *"because we"*, *"this means"* — stop. That's a commit message, not a comment.
