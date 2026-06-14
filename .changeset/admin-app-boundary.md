---
"@voyant-travel/admin": patch
"@voyant-travel/admin-app": patch
---

Move the packaged admin app shell into `@voyant-travel/admin/app/*` and keep
`@voyant-travel/admin-app` as a compatibility shim over the new exports.
