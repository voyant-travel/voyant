---
"@voyant-travel/finance": minor
"@voyant-travel/finance-contracts": minor
"@voyant-travel/schema-kit": patch
---

Refunds have a money leg: `refund_settlements` in finance, bound to what the
refund reverses and to how the customer was actually paid back.

Finance modelled refunds well as **accounting** and not at all as **money**.
Credit notes existed, a `finance:refund` capability existed with `risk: critical`
and `approvalPolicy: required`, booking amendments carried `refundAmountCents`,
and none of it recorded that anyone had paid the customer. Issuing a credit note
moves nothing. So a deployment could produce a correct accounting document while
leaving no trace that money had — or had not — gone back.

The record is deliberately not card-shaped. `method` is
`processor_reversal | bank_transfer | cash | cheque | travel_credit | voucher |
counterparty_offset | other`, and a self-hosted deployment with no card processor
at all can record every one of them except the first.

**A refund can be owed and not yet paid.** That state had nowhere to live, and it
is the normal state of a bank-transfer refund for a day or two. `status` is
`pending | settled | failed`, separate from the credit note's status on purpose:
the accounting document is issued once, but the money leg can be owed, retried,
or settled long afterwards. `GET /v1/admin/finance/bookings/{id}/refund-settlements`
answers what a credit note cannot — whether the booking still owes somebody money.

**A pending refund keeps holding its amount.** The refundable remainder subtracts
`pending` alongside `settled`, and only a positive failure gives an amount back.
That is the whole reason the record has its own status: a processor refund can
come back indeterminate — a timeout on a refund the processor accepted — and
freeing its amount would let a retry return the same money twice, which is the
one error here that trying again cannot undo. The bound is re-read inside the
write transaction under `SELECT … FOR UPDATE` on the payment, so two concurrent
refunds cannot both see the same remainder and both pass.

**`finance:refund` now reaches the payment adapter.** The capability, the
approval evaluation and the credit note all existed and nothing connected an
authorized refund to `adapter.refund()`, so even a deployment with a working card
processor could not return money through it.
`POST /v1/admin/finance/refund-settlements/{id}/execute` drives a
`processor_reversal` and records the outcome: `accepted` settles it, `pending`
leaves it owed, a decline fails it and releases the amount, and a thrown error
resolves nothing — the row stays `pending`, its amount stays held, and the note
says the outcome is unknown.

**Authorization is the existing one, not a second path.** Recording a settlement
runs the same `finance:refund` capability, grants and `required` approval policy
that govern issuing the credit note, so a deployment configures who may refund
once. The route preserves the `authorized` / `approval_required` distinction:
`202` with the pending approval when policy demands one, `201` with the
settlement when it does not — one endpoint, so an operator UI needs one button
rather than two flows. The settlement stores the `approvalId` and
`requestedActionId` it executed under.

Two dimensions come from operator practice rather than the schema:

- **Credit and voucher are different instruments.** A travel credit is bound to
  the person refunded; a voucher is transferable, carries its own expiry, and is
  frequently worth more than the cash it replaces — 110% in credit to avoid
  paying out 100% is a standard cancellation tactic. They are two `method` values
  rather than one with a flag, and `instrumentAmountCents` records the uplift,
  because a refund settled by an instrument worth more than the amount refunded
  is not an accounting identity and the credit note and the instrument would
  otherwise disagree with no way to tell which was right.
- **B2B refunds net rather than pay.** Refunding a reseller is usually a credit
  applied against what they owe on other bookings, so the method is
  `counterparty_offset` against a **counterparty balance** — not against another
  booking, which is too narrow to express the case.

`record_refund_settlement` is the agent-facing Tool, on the same
`finance:refund` scope and the same approve-then-retry shape as
`issue_invoice_refund`.
