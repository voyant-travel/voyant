---
"@voyant-travel/auth": patch
---

Add `customerSignupSurfaces` to `createBetterAuth` so supported OTP customer
self-signups can be stamped with a non-admin surface before the single-tenant
signup guard evaluates the new user.
