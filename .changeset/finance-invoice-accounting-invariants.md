---
"@voyant-travel/finance": patch
---

Harden customer invoice accounting invariants in finance routes. Direct invoice creation now handles duplicate invoice numbers and missing booking/person/organization references as structured 4xx responses, invoice and credit-note line totals are validated against quantity and unit amount, completed payments cannot overpay invoices, and credit notes cannot exceed the invoice balance due.
