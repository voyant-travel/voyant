---
"@voyant-travel/finance": patch
"@voyant-travel/finance-react": patch
---

Reject invalid supplier-invoice payable states: missing supplier ids, negative AP totals or line money values, line totals that do not match quantity times unit amount plus tax, and completed supplier payments above the payable balance. Supplier-invoice UI dialogs now derive line totals and block above-balance payment submissions.
