---
"@voyantjs/finance": patch
"@voyantjs/plugin-netopia": patch
---

`financeService.completePaymentSession` now accepts a 4th `runtime: { eventBus? }` parameter and emits `invoice.settled` after the transaction commits when a payment is applied to an invoice. Closes a fan-out gap where plugin callbacks (Netopia and friends) had to either run a separate poller or wrap each provider callback to manually trigger `pollInvoiceSettlement`. The Netopia plugin's callback route now resolves the finance runtime from the container and threads the eventBus through `handleCallback`.

Default callers (no runtime) remain unchanged. `pollInvoiceSettlement` continues to emit independently — no double-emit, since it goes through `createPayment`, not `completePaymentSession`.
