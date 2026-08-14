---
"@voyant-travel/bookings-react": patch
"@voyant-travel/db": patch
"@voyant-travel/finance": patch
"@voyant-travel/legal": patch
---

Say when a booking contract could not be generated instead of dropping it in
silence. Retire the unsubscribed `booking.contract_document.requested` event,
record a failed action-ledger entry on the booking whenever confirmation cannot
produce the customer contract, and stop offering "Generate invoice and contract"
on deployments with no customer contract template to render. The outbox drain
now also reports which event types it delivered to zero subscribers, so a
delivered row no longer reads the same whether every subscriber ran or none did.
