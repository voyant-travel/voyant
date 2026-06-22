# @voyant-travel/availability

The availability domain schema — bookable **slots**, **rules**, **start times**,
**holds**, **pickups** and capacity. This is the single owner of the
`availability_*` tables.

It was extracted from `@voyant-travel/operations` so that, under per-package
migrations (D.2), availability owns its own schema and the module graph flows in
the intended direction: `bookings`, `operations` and `accommodations` all consume
availability (a foundational package), rather than reaching into operations for an
inventory primitive. `operations` keeps its availability **services and routes**,
importing the schema from here.

## Exports

- `.` / `./schema` — the `availability_*` Drizzle tables, enums, relations and
  inferred types.
