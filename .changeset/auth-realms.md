---
"@voyant-travel/auth": patch
"@voyant-travel/auth-react": patch
"@voyant-travel/core": patch
"@voyant-travel/db": patch
"@voyant-travel/framework": patch
"@voyant-travel/hono": patch
"@voyant-travel/runtime": patch
"@voyant-travel/storefront-react": patch
"@voyant-travel/operator-standard": patch
"@voyant-travel/storefront": patch
---

Split operator and storefront authentication into isolated Better Auth realms,
add provider-neutral identity adapters, and support managed WorkOS-backed admin
sessions alongside merchant-configurable customer email and social login.
