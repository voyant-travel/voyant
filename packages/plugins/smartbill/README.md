# @voyantjs/plugin-smartbill

SmartBill e-invoicing sync adapter bundle for Voyant.

Architecturally, this package is primarily:

- a SmartBill e-invoicing adapter
- a subscriber bundle for finance invoice events
- an optional packaged bundle when an app wants one installable entrypoint

It subscribes to invoice events and creates, cancels, or syncs invoices via the
SmartBill REST API for Romanian tax compliance.

## Install

```bash
pnpm add @voyantjs/plugin-smartbill
```

## Usage

```typescript
import { smartbillPlugin } from "@voyantjs/plugin-smartbill"
import { createApp } from "@voyantjs/hono"

const smartbillSync = smartbillPlugin({
  username: env.SMARTBILL_USERNAME,
  apiToken: env.SMARTBILL_API_TOKEN,
  companyVatCode: "RO12345678",
  seriesName: "A",
  // optional: language, art311SpecialRegime, events, mapEvent, logger
})

const app = createApp({
  plugins: [smartbillSync],
})
```

`smartbillPlugin(...)` is the packaged distribution helper. At runtime, the
package behaves primarily as a subscriber-driven SmartBill sync adapter. By
default it wires up 3 subscribers (`invoice.issued`, `invoice.voided`,
`invoice.external.sync.requested`) that create, cancel, and check payment
status on SmartBill. All error handling is fire-and-forget per the EventBus
contract.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./plugin` | `smartbillPlugin(options)` — packaged adapter/subscriber bundle |
| `./client` | `createSmartbillClient` — `createInvoice`, `cancelInvoice`, `viewPdf`, `getPaymentStatus`, etc. |
| `./types` | SmartBill adapter and bundle types |

## License

Apache-2.0
