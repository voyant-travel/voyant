---
"@voyant-travel/payments": minor
"@voyant-travel/operator-settings": minor
"@voyant-travel/operator-settings-react": minor
"@voyant-travel/storefront": minor
"@voyant-travel/hono": minor
"@voyant-travel/admin-host": patch
"@voyant-travel/i18n": patch
"@voyant-travel/trips": patch
---

Add the managed Voyant Payments transport and honest capability contract, hosted
Stripe Connect onboarding for operators, and scheduled storefront reconciliation.

Expose typed fail-closed adapter errors and onboarding state, render embedded
onboarding with the required narrowly scoped security headers, and keep payment
authorization distinct from completed settlement.
