---
"@voyant-travel/payments": minor
"@voyant-travel/finance": patch
"@voyant-travel/finance-contracts": patch
"@voyant-travel/storefront": patch
---

Add processor identity to payment adapter contracts and persist managed payment
connection ids on finance payment sessions. Payment callbacks now reject
verified provider/connection mismatches, payment-session provider payload and
metadata updates merge instead of overwrite, duplicate paid callbacks serialize
under a row lock, and the public payment-link callback/start-card routes accept
managed connection forwarding and non-redirect processor outcomes.
