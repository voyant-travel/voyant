---
"@voyant-travel/admin": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/relationships-react": patch
---

Polish pass on flagged UI issues. The product activity feed no longer shows raw
principal IDs or camelCase field names (it now shows a readable actor type and
plain field names). The product "Extras" section header now matches the sibling
"Rooms & prices" header style. Empty dashboard metrics render a lighter,
less-prominent placeholder instead of a full-weight dash. And the person and
organization create/edit forms now open as right-side sheets with a sticky
footer (matching the convention for larger forms) instead of tall centered
dialogs.
