---
"@voyant-travel/bookings-react": patch
---

Handle live-quote failures in the storefront booking journey. When a connected supplier product's quote request errors (e.g. the connector adapter returns 500), the journey previously let the shopper reach Review with a stale/absent price, and `Confirm booking` became a silent no-op. It now surfaces a recoverable inline error with a retry action, blocks Next/Confirm while the quote is failing, and shows an explicit message instead of silently swallowing the Confirm click. Also fixes a render-phase `setDraft` in `PaymentStep` that triggered React's "Cannot update a component while rendering a different component" warning by moving the intent-snap into an effect.
