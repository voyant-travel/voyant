---
"@voyant-travel/framework": minor
---

Relocate the **inventory/extras** and **bookings/requirements** module factories into `frameworkComposition` (Workstream B, Tier 2b).

- `inventory/extras` — the combined inventory+bookings extras surface (`new Hono().route(inventoryExtrasRoutes).route(bookingsExtrasRoutes)`) is now built in the framework. This adds `hono` as a **dev + peer** dependency (the framework's first plain-`hono` value usage; kept out of the BOM-locked `dependencies`).
- `bookings/requirements` — `FrameworkProviders` gains `resolveBookingRequirementsProductSnapshot`, typed via `BookingRequirementsHonoModuleOptions` indexed access.
