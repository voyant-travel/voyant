# @voyantjs/extras

Temporary compatibility shim for the v1 extras ownership migration.

New first-party code should import operated add-on authoring/configuration from
`@voyantjs/inventory/extras`, and booking extra lines, participant selections,
and slot manifests from `@voyantjs/bookings/extras`.

The physical Drizzle schema still lives here while `product_extras`,
`option_extra_configs`, `booking_extras`, and `extra_participant_selections`
share one FK graph. Templates may keep this package as a schema-only migration
entry until that table graph is split safely.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Legacy module export; prefer `@voyantjs/bookings/extras` for runtime wiring |
| `./schema` | Legacy Drizzle table location used by the migration shim |
| `./validation` | Legacy Zod schema location |
| `./routes` | Legacy `/v1/extras` routes re-exported by Bookings extras |

## License

Apache-2.0
