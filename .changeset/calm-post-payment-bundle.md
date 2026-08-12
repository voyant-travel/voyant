---
"@voyant-travel/commerce": patch
"@voyant-travel/finance": patch
"@voyant-travel/notifications": patch
"@voyant-travel/storage": patch
---

Deliver post-payment booking document bundles only after every template-required attachment is ready, including final provider invoices, contracts, and product brochures. Emit a booking-keyed checkout-finalized event after Booking Session settlement, retry pending bundles on document and brochure readiness events, and encode storage metadata safely for Unicode values.
