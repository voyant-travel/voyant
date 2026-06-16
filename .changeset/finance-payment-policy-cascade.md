---
"@voyant-travel/finance": minor
"@voyant-travel/operator": patch
---

`@voyant-travel/finance` now owns the payment-policy cascade orchestration: new `createPaymentPolicyCascade(options)` (from `@voyant-travel/finance` and `./payment-policy-cascade`) composes the supplier → category → listing → operator-default precedence, with the vertical schema-walk readers injected (finance must not import the verticals per the retail-spine gate). The bookings-only `__payment_policy_source__` marker protocol (`stampPolicySourceOnBooking` / `readPolicySourceFromInternalNotes`) and the canonical `PaymentPolicyEntityContext` type also move to finance, de-duplicating the prior definition in `payment-schedule/routes.ts`.
