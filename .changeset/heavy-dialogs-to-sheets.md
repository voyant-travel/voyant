---
"@voyant-travel/bookings-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/identity-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/mice-react": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/relationships-react": patch
---

Move heavy multi-field forms from centered dialogs to side sheets. Create/edit
forms with more than a handful of fields (invoices, bookings, travelers,
markets, pricing rules, policies, suppliers, resources, legal templates,
notification templates, and similar) were rendered as centered modals; per the
dialog-vs-sheet guidance, complex multi-field editing belongs in a side sheet
that keeps the parent screen visible. Confirmations, media viewers, and short
one-to-three-field dialogs are unchanged.
