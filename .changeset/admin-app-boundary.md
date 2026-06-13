---
"@voyantjs/admin": patch
"@voyantjs/admin-app": patch
---

Move the packaged admin app shell into `@voyantjs/admin/app/*` and keep
`@voyantjs/admin-app` as a compatibility shim over the new exports.
