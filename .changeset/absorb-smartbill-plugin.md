---
"@voyant-travel/plugin-smartbill": patch
---

Move the SmartBill plugin into the Voyant monorepo at
`packages/plugins/smartbill` and build it against workspace packages instead of
published ranges.

No behaviour change. The move realigns test fixtures with APIs that had drifted
since the plugin's pins: `HonoModule` is now `ApiModule`, the settlement poller
context no longer carries `db`/`bindings`, sync events include
`proformaConverted`, `mapLineItems` takes only line-shaped options, invoice
status `sent` is gone, and `invoice_external_refs` carries six sync-tracking
columns.
