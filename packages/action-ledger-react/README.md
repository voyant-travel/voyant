# @voyantjs/action-ledger-react

React client utilities for `@voyantjs/action-ledger`.

This package delivers the packaged admin surface for the action ledger
(packaged-admin RFC): the Logs list page with cursor pagination, the
filters popover (booking/product/person/organization/workflow-run pickers),
and the entry detail sheet, plus the `createActionLedgerAdminExtension`
factory that contributes the nav entry and the full route implementation
to an admin host.

## Install

```bash
pnpm add @voyantjs/action-ledger-react @voyantjs/action-ledger
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Provider/context re-exports |
| `./provider` | `VoyantActionLedgerProvider` and context helpers |
| `./admin` | `createActionLedgerAdminExtension` admin contribution |

## License

Apache-2.0
