# @voyantjs/action-ledger-react

## 0.6.0

### Patch Changes

- @voyantjs/action-ledger@0.104.8
- @voyantjs/crm-react@0.119.0
- @voyantjs/products-react@0.119.0
- @voyantjs/ui@0.106.1
- @voyantjs/bookings-react@0.119.0

## 0.5.0

### Patch Changes

- @voyantjs/products-react@0.118.0
- @voyantjs/bookings-react@0.118.0
- @voyantjs/crm-react@0.118.0

## 0.4.0

### Patch Changes

- @voyantjs/action-ledger@0.104.6
- @voyantjs/bookings-react@0.117.0
- @voyantjs/crm-react@0.117.0
- @voyantjs/products-react@0.117.0

## 0.3.0

### Patch Changes

- @voyantjs/action-ledger@0.104.5
- @voyantjs/products-react@0.116.0
- @voyantjs/bookings-react@0.116.0
- @voyantjs/crm-react@0.116.0

## 0.2.0

### Minor Changes

- 6d496d0: New package: React client + packaged admin surface for `@voyantjs/action-ledger`. `createActionLedgerAdminExtension` (the `./admin` entry) contributes the Logs nav item (order 60, host-supplied icon) and the full cursor-paginated Logs route — list page, filters popover (booking/product/person/organization/workflow-run pickers), and entry detail sheet — previously operator-template components. Data flows through the shared provider context (`VoyantActionLedgerProvider` / `@voyantjs/react`) via a small admin REST module; the contribution's loader seeds the first page through the host runtime, and booking targets link through the `booking.detail` semantic destination.

### Patch Changes

- Updated dependencies [41b08db]
- Updated dependencies [6d496d0]
  - @voyantjs/admin@0.111.0
  - @voyantjs/products-react@0.115.0
  - @voyantjs/bookings-react@0.115.0
  - @voyantjs/crm-react@0.115.0
