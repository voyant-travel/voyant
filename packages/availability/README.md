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

## Agent Tool Boundary

This foundational package's executable Tool posture is **not applicable**. It owns schema only;
there is no public availability service or route to bind without querying tables directly. The
provider-neutral availability services are owned by `@voyant-travel/operations`, whose selected
Tools cover overview, aggregates, rules, start times, departures, and closeouts.

Adding Tools here would first require moving that service ownership out of Operations, including
its catalog and runtime dependencies. No such migration is selected: duplicate MCP wrappers over
the same tables would create competing capability ownership rather than fill a coverage gap.
