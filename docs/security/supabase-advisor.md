# Supabase advisor — residual warnings deliberately kept

Audit date: May 2026 (cleared 86% of advisor noise, 98 → 14 warnings). This doc
records what the remaining warnings are and the reasoning for keeping them.

If the Supabase advisor flags something on this list, it's known and intentional —
not a bug to fix.

---

## Kept as-is (semantic trade-off)

- **`household_members` INSERT — 3 permissive policies**
  (`Allow returning users to owned household`, `New users can join via invite during signup`, `Owners can insert household members`)
  These are three distinct authorisation paths. Merging into one OR'd policy
  gives the same security guarantee but kills readability; the table is small
  so the perf gain is negligible.

- **`household_invites` UPDATE — 2 permissive policies**
  (`Users can update invites they created`, `Users can update invites when joining`)
  Creator vs. invitee paths have different WITH CHECK shapes; merging them is
  error-prone.

## Unavoidable false positives

- **`is_email_whitelisted`, `lookup_active_invite`, `redeem_invite`** —
  intentional anon-callable RPCs used by the signup flow. The advisor flags
  every `SECURITY DEFINER + anon` combo regardless of intent. No way to
  suppress.

## Real follow-up (separate task, when prioritised)

- **Move RLS helpers to a `private` schema** —
  `is_household_member`, `is_household_owner`, `get_user_household_id` are only
  called by RLS policies, not by app code. Moving them out of the API-exposed
  `public` schema clears 6 warnings. Requires creating the schema, recreating
  the functions, and updating every RLS policy that references them.

## Pro-tier only

- **Leaked password protection** — HaveIBeenPwned integration requires Supabase
  Pro plan. Re-enable if/when upgraded.
