---
trigger: always_on
---

# No commits before user verification

**After doing work, do NOT commit. Wait for the user to inspect first.**

The user wants to manually review changes before they land in git. The flow is:
1. You complete the work and report what changed.
2. The user reviews (in their IDE / via diffs).
3. The user explicitly tells you to commit.
4. Only then do you run `git add` and `git commit`.

**When the user has given the go-ahead**, commit. Don't ask again — they already approved.

## Logical bundles

When committing multi-change work, **split into logical bundles**: one feature/concern per commit. Don't bundle unrelated changes together.

`git add -A` is **only acceptable when every modified/untracked file belongs to the same logical commit**. If files span multiple concerns, stage them explicitly per commit.
