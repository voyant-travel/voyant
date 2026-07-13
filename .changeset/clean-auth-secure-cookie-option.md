---
"@voyant-travel/auth": minor
---

Remove the top-level `useSecureCookies` compatibility option from
`createBetterAuth`. Configure this Better Auth setting through
`advanced.useSecureCookies` instead. See [Migrating Auth to
0.128](../../docs/migrations/migrating-to-0.128.md) for the caller rewrite.
