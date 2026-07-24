---
"@voyant-travel/bookings-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/quotes-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/storefront-react": patch
"@voyant-travel/auth-react": patch
---

Clean up misused Card components. Cards that added their own vertical padding on
top of the Card's built-in padding (double-padded content) now rely on the
card's spacing, and the booking "Internal notes" card uses a proper card header
and title instead of a label buried in the body. Empty-state, edge-to-edge, and
image-tile cards are unchanged.
