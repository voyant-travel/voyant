---
"@voyant-travel/storefront": patch
---

Forward the request event bus when verified payment-adapter callbacks update payment sessions, allowing `payment.completed` checkout finalization to run on managed callbacks.
