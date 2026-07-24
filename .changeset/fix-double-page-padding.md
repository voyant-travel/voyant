---
"@voyant-travel/admin": patch
"@voyant-travel/apps-react": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/media-react": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/reporting-react": patch
"@voyant-travel/trips-react": patch
---

Fix double page padding. The admin shell already applies consistent page
padding around the content area, but a number of page and loading-skeleton
components still added their own `p-6` on top, pushing their content ~24px
further in than the page header and leaving pages inconsistently indented.
Those redundant root paddings are removed so every page's content lines up with
the header and with each other. Dialog, portal, and card paddings are
unchanged.
