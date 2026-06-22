---
"@voyant-travel/types": minor
"@voyant-travel/auth": minor
"@voyant-travel/hono": minor
"@voyant-travel/admin": minor
"@voyant-travel/i18n": minor
"@voyant-travel/bookings": minor
"@voyant-travel/legal": minor
"@voyant-travel/db": minor
---

Deployment team management + granular member RBAC (voyant#2085).

- `@voyant-travel/types`: `member-roles` (preset bundles reusing the API-key permission catalog) + `settings`/`team` resources.
- `@voyant-travel/auth`: `cloud-broker` member-management client + assertion `scopes`.
- `@voyant-travel/hono`: opt-in staff-session scope enforcement in `requireActor` (`VOYANT_RBAC_ENFORCE`) + `isStaffRbacEnforced`.
- `@voyant-travel/admin`: auth-mode-aware `TeamSettingsPage` with a granular permission editor.
- `@voyant-travel/bookings`/`legal`: PII reveal gated on `bookings-pii:read` under enforcement.
- `@voyant-travel/db`: `user_profiles.permissions` + `cloud_auth_user_links.scopes`.
