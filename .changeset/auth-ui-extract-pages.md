---
"@voyantjs/auth-ui": patch
---

Make `@voyantjs/auth-ui` the single source of truth for the operator auth surface so templates stop hand-rolling their own forms.

- Re-shell `SignInPage`, `SignUpPage`, `AcceptInvitationPage`, `VerifyEmailPage`, and the password-reset pages in `Card`/`CardHeader`/`CardContent` so they render consistently and pick up theme tokens out of the box.
- Add `AuthLayout` (exported from the package root) that centers the auth card and renders the Voyant wordmark via `@voyantjs/admin`, replacing the per-template auth shells.
- `templates/operator` now mounts each auth route as a thin wrapper around the corresponding page component instead of duplicating ~200 lines of form code per route.
