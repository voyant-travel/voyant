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
| `./mock` | `createSmartbillMockServer` — stateful local SmartBill-compatible mock for tests |
| `./types` | SmartBill adapter and bundle types |

## Local SmartBill Mock

SmartBill does not provide a practical sandbox, and invoice/proforma calls can
create real accounting documents. Use the packaged mock for local workflows and
end-to-end tests instead of pointing development credentials at the live API.

For in-process tests, pass the mock `fetch` implementation and any local
`apiUrl`:

```typescript
import { createSmartbillClient } from "@voyantjs/plugin-smartbill/client"
import { createSmartbillMockServer } from "@voyantjs/plugin-smartbill/mock"

const smartbill = createSmartbillMockServer()
const client = createSmartbillClient({
  username: "local",
  apiToken: "local",
  apiUrl: "http://smartbill.local/SBORO/api",
  fetch: smartbill.fetch,
})
```

For full app tests, start the local HTTP listener and wire the plugin/client to
the returned base URL:

```typescript
const smartbill = createSmartbillMockServer()
const server = await smartbill.listen({ port: 4555 })

const plugin = smartbillPlugin({
  username: "local",
  apiToken: "local",
  apiUrl: server.apiUrl,
  companyVatCode: "RO12345678",
  seriesName: "SB-TEST",
})

await server.close()
```

The mock supports the SmartBill endpoints used by the plugin and common local
billing flows:

- `GET /tax`
- `GET /series`
- `POST /invoice`
- `GET /invoice/pdf`
- `GET /invoice/paymentstatus`
- `PUT /invoice/cancel`
- `PUT /invoice/reverse`
- `PUT /invoice/restore`
- `DELETE /invoice`
- `POST /estimate`
- `GET /estimate/pdf`
- `GET /estimate/invoices`

Documents are stateful and deterministic per series. Generated PDF URLs use the
`smartbill-mock://test-document/...` scheme, and stored document mentions are
marked with `TEST DOCUMENT - SmartBill local mock`.

## License

Apache-2.0
