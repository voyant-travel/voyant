---
"@voyant-travel/suppliers-contracts": patch
"@voyant-travel/distribution": patch
"@voyant-travel/openapi": patch
---

Fix supplier PATCH validation so insert defaults are not applied during partial
updates, and allow explicit nulls to clear nullable supplier contact fields.
