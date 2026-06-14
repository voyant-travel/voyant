# @voyantjs/extras

Temporary compatibility shim for the v1 extras ownership migration.

New first-party code should import operated add-on authoring/configuration from
`@voyantjs/inventory/extras`, and booking extra lines, participant selections,
and slot manifests from `@voyantjs/bookings/extras`.

The physical Drizzle schema no longer lives here. Inventory owns
`product_extras`, `option_extra_configs`, and extras content/projection helpers.
Bookings owns `booking_extras`, `extra_participant_selections`, and slot
manifest behavior. Templates should not keep this package as a schema entry.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Legacy module export; prefer owner paths for runtime wiring |
| `./schema` | Legacy compatibility export over Inventory and Bookings extras schemas |
| `./validation` | Legacy Zod schema location |
| `./routes` | Legacy `/v1/extras` routes composed from Inventory and Bookings extras |

## License

Apache-2.0
