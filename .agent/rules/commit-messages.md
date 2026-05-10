---
trigger: always_on
---

# Commit message style

- **Never add `Co-Authored-By:` trailers.** Not for Claude, not for anyone, unless the user explicitly asks for it.
- Use the existing repo style: short imperative subject with a type prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `style:`).
- Keep the subject line under ~70 characters.
- Use the body to explain *why*, not *what* — the diff already shows what.
- One logical change per commit. Don't bundle unrelated work.
