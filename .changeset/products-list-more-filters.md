---
"@voyant-travel/products-contracts": patch
"@voyant-travel/inventory": patch
"@voyant-travel/inventory-react": patch
---

Expand the products list Filters with Type, Booking mode, Visibility, Tag, and a
Departure window. Type/Booking mode/Visibility/Tag reuse query params the list
endpoint already supported; the Departure window is a new `departureFrom`/
`departureTo` query param that keeps only products with an upcoming open
departure whose date falls in the chosen range (filtered on availability slots,
independent of the product's own start date).
