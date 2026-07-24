---
"@voyant-travel/commerce-react": patch
"@voyant-travel/finance-react": patch
---

Replace raw-ID and raw-format inputs in the pricing and invoicing dialogs with
usable controls. Facility, pickup-point, and product-extra fields are now
search pickers instead of free-text ID boxes; the price-schedule recurrence
field is a guided "repeats yearly/monthly/weekly" builder (with an advanced
raw-rule fallback so any RRULE can still be entered); and the developer-facing
external provider/config-key fields on the invoice number series dialog are
tucked behind an "Advanced" disclosure.
