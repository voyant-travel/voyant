---
"@voyant-travel/payments": minor
"@voyant-travel/finance": patch
"@voyant-travel/finance-contracts": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/storefront": patch
"@voyant-travel/trips": patch
"@voyant-travel/framework": patch
"@voyant-travel/operator-settings": patch
"@voyant-travel/operator-settings-react": patch
---

Add processor identity to payment adapter contracts and persist managed payment
connection ids on finance payment sessions. Payment callbacks now reject
verified provider/connection mismatches, payment-session provider payload and
metadata updates merge instead of overwrite, duplicate paid callbacks serialize
under a row lock, and the public payment-link callback/start-card routes accept
managed `connectionId` callback forwarding, additive refreshed session
responses, and non-redirect processor continuations.
Processor callbacks now compare and adopt identities under the payment-session
row lock, preserve monotonic session states during concurrent delivery, and
reject callback-routing metadata and return URLs supplied by public clients.
Provider-neutral cancel and shipping fields flow through the selected adapter
contract, with processor return and cancel URLs derived from server-owned
session and deployment configuration.
Public payment-session reads can refresh provider status through the selected
adapter while resending the session's pinned processor identity and preserving
the same locked monotonic transition rules as callbacks. Persisted, uniquely
fenced leases bound anonymous status polling, and processor session/payment
references cannot change after they are first pinned. Card initiation now uses
a single atomic claim so active or ambiguous attempts cannot create duplicate
processor payments.
