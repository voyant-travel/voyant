---
"@voyant-travel/finance": minor
"@voyant-travel/legal": minor
---

Render the auto-generated booking contract's payment clause from settlement.

The post-confirm variable bag carried the booking's list price and nothing
about what had been paid, so a template branching on `booking.isPaidInFull`
took the `else` arm on every contract and printed the missing-value
placeholder for each amount — telling a customer who had paid in full that
they owed "-" by "-".

Finance gains `getBookingSettlement`, the one answer for what a booking has
paid and still owes: completed payments against non-void invoices, the
invoice balance, and the installments that still stand (cancelled, waived and
expired rows excluded). Legal reads it through that service and emits
`booking.paidAmountCents`, `amountDueCents`, `balanceDueCents`,
`isPaidInFull`, the deposit/balance installments, and `payment.method` /
`latestCompleted` / `schedule`, so the auto-generated contract and the agent
path now render the same clause.
