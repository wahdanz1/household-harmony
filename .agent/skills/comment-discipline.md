---
name: comment-discipline
description: Use whenever writing or editing code in this repo. Bans narrative/post-hoc comments; keeps only short comments where WHY is non-obvious.
---

# Comment discipline

**Default: write no comment.** Only add one when removing it would confuse a future reader or cause them to do something unsafe.

## Delete on sight

These belong in commit messages, never in code:

- "Previously did X, now does Y" / "Replaces the old..."
- Comments referencing the current task, PR, or recent change
- Comments describing WHAT the code does (the code already says it)
- Comments justifying a design decision ("user_id is from JWT, never trusted from body")
- Narrative explanations of why something is structured a certain way

## Acceptable

- One short line for a non-obvious WHY: hidden constraint, subtle invariant, workaround for a specific upstream bug
- Maintenance instructions tied to fragile coupling (e.g. "regenerate this hash if you edit the inline script")
- A one-line docstring when the function name isn't self-explanatory

## Stop words

If you're writing *"now"*, *"replaces"*, *"used to"*, *"the reason"*, *"so that"*, *"because we"*, *"this means"* — stop. That's a commit message.