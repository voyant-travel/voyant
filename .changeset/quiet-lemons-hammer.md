---
"@voyant-travel/legal-contracts": patch
"@voyant-travel/legal": patch
---

Preserve omitted contract number series fields during PATCH validation so partial
updates no longer apply create-time defaults such as `scope: "customer"`.
