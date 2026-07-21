---
"@voyant-travel/payments": patch
---

Simplify the Netopia connect form. Drop the confusing "Merchant ID" field —
Netopia API v2 has no separate merchant number; the POS signature (Semnătura) is
the point-of-sale identifier, and the adapter already ignores `merchantId` when a
POS signature is present. Clarify the "API key" help text to point operators at
the account API key (Security → API key) used as the Authorization header.
