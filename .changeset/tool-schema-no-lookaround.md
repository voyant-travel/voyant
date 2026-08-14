---
"@voyant-travel/relationships-contracts": patch
"@voyant-travel/suppliers-contracts": patch
"@voyant-travel/identity-contracts": patch
"@voyant-travel/bookings-contracts": patch
"@voyant-travel/distribution": patch
"@voyant-travel/storefront": patch
"@voyant-travel/schema-kit": patch
"@voyant-travel/finance": patch
"@voyant-travel/legal": patch
---

Advertise email fields with a regex a strict-schema LLM client can parse.

Zod's default `z.email()` pattern opens with `^(?!\.)(?!.*\.\.)`, and providers
that validate tool schemas with an RE2-style engine reject regex lookaround
outright. A client sends every authorized tool schema in one model call, so the
18 affected fields took down every turn of a conversation, including questions
that never touched the Tools carrying them.

`@voyant-travel/schema-kit/email` now exports `emailAddress()`, which validates
with zod's lookaround-free `rfc5322Email` pattern. It rejects everything the
default rejects and additionally accepts a quoted local part, an IP-literal
domain, and a non-ASCII local part, so nothing that validated before stops
validating.
