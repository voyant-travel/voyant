---
"@voyant-travel/action-ledger-react": patch
"@voyant-travel/apps-react": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/flights-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/trips-react": patch
---

Make form and dialog select triggers full-width. The shared `SelectTrigger`
defaults to `w-fit`, so selects that sit in a form or dialog next to full-width
inputs rendered noticeably narrower. Add `w-full` at those call sites (filter
popovers, dialogs, and stacked form fields). Toolbar and inline selects that
carry an intentional fixed width are left unchanged.
