---
"@voyantjs/allocation-ui": minor
"@voyantjs/availability": minor
"@voyantjs/availability-react": minor
---

Add a visual seat-map builder for vehicle_seat resource templates. Operators can now draw the bus layout cell-by-cell with explicit `seat`, `aisle`, `door`, and `void` kinds — supporting odd bus shapes (mid-coach doors, wheelchair voids, asymmetric back rows) the legacy `layout` string couldn't express. A new `<SeatMapBuilder />` ships from `@voyantjs/allocation-ui`; the backend materializer walks the saved `layoutSpec` to create exactly the seats drawn, with positions derived from neighbouring cells; and `VehicleSeatsView` renders the map with visible aisle gaps and a striped door row when a spec is present. The legacy `layout` string path stays as the fallback when no spec is configured.
