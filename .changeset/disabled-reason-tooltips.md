---
"@voyant-travel/finance-react": patch
"@voyant-travel/legal-react": patch
---

Replace persistent "why this action is disabled" banners with hover tooltips on
the disabled action. On the invoice detail, the "Only draft invoices can be
deleted" banner is gone — hovering the disabled Delete button shows that reason
instead. Same treatment for the contract send dialog's missing-recipient banner
on the disabled Send button.
