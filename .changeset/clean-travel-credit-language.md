---
"@voyant-travel/finance": minor
"@voyant-travel/finance-contracts": minor
"@voyant-travel/finance-react": minor
"@voyant-travel/bookings-react": minor
"@voyant-travel/bookings": minor
"@voyant-travel/bookings-contracts": minor
"@voyant-travel/catalog-contracts": minor
"@voyant-travel/inventory": minor
"@voyant-travel/products-contracts": minor
"@voyant-travel/i18n": minor
"@voyant-travel/trips-react": minor
"@voyant-travel/relationships": minor
"@voyant-travel/schema-kit": minor
"@voyant-travel/storefront": minor
"@voyant-travel/storefront-react": minor
"@voyant-travel/distribution": patch
---

Replace the overloaded Finance voucher domain with Travel Credits across the
database schema, APIs, package exports, booking inputs, storefront settings,
and operator UI. Redemption commands are replay-safe, codes are normalized and
case-insensitively unique, and legacy records migrate in place without silently
skipping invalid balances. Keep Promotion Codes in Commerce and move Bookings
fulfillment to the explicit Service Voucher vocabulary.
