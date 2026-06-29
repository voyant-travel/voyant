---
"@voyant-travel/auth": patch
---

Add a stable `/auth/organization/list-members` facade backed by Better Auth
member tables so operator quote owner lookups no longer fall through to a 404.
