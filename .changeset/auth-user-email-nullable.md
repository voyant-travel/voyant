---
"@voyantjs/auth": patch
"@voyantjs/auth-react": patch
"@voyantjs/customer-portal": patch
"@voyantjs/db": patch
---

Make `auth.user.email` nullable and add `phone_number` columns so phone-only signups (Better Auth phone-OTP plugin) no longer need a synthetic `<phone>@phone.protravel.ro` placeholder (closes #441).

Schema: drops the email-only `UNIQUE` on `auth.user.email`, alters the column to nullable, adds `phone_number` (text, nullable) + `phone_number_verified` (boolean, default false), creates partial unique indexes (`user_email_unique WHERE email IS NOT NULL`, `user_phone_unique WHERE phone_number IS NOT NULL`), and a check constraint `user_email_or_phone CHECK (email IS NOT NULL OR phone_number IS NOT NULL)` so a row must carry at least one identifier. Migration ships `templates/operator/migrations/0025_user_email_nullable_phone.sql`.

Consumer cleanup:

- `@voyantjs/auth`'s `CurrentUser` type and `getCurrentUser` / `ensureCurrentUserProfile` now treat email as nullable; phone-only signups fall through provisioning instead of being rejected.
- `@voyantjs/auth-react`'s `currentUserSchema` and `organizationMemberUserSchema` accept null email; `currentUserSchema` also exposes the new `phoneNumber` field.
- `@voyantjs/customer-portal`'s profile read/write paths handle null `authUser.email`: `getAccessibleBookingIds` and `hasBookingAccess` skip the email-match branch for phone-only users (linked-person matching still works), and `bootstrap` skips email-keyed candidate lookup. Existing email-based flows are unchanged.

Out of scope for this PR (deferred):

- Wiring the Better Auth phone-OTP plugin in `@voyantjs/auth/src/server.ts` (needs SMS provider + signup route work). The schema is now ready for it; the plugin wiring lands in a follow-up.
