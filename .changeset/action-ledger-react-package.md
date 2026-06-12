---
"@voyantjs/action-ledger-react": minor
---

New package: React client + packaged admin surface for `@voyantjs/action-ledger`. `createActionLedgerAdminExtension` (the `./admin` entry) contributes the Logs nav item (order 60, host-supplied icon) and the full cursor-paginated Logs route — list page, filters popover (booking/product/person/organization/workflow-run pickers), and entry detail sheet — previously operator-template components. Data flows through the shared provider context (`VoyantActionLedgerProvider` / `@voyantjs/react`) via a small admin REST module; the contribution's loader seeds the first page through the host runtime, and booking targets link through the `booking.detail` semantic destination.
