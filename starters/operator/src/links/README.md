# Deployment links

Declare deployment-owned cross-module associations in `src/links/**/*.ts`.
Use package-exported linkables rather than cross-package database foreign keys.

```ts
// src/links/booking-people.ts
import { bookingLinkable } from "@voyant-travel/bookings/linkables"
import { defineLink } from "@voyant-travel/core"
import { personLinkable } from "@voyant-travel/relationships/linkables"

export default defineLink(
  { linkable: bookingLinkable, isList: true },
  { linkable: personLinkable, isList: true },
)
```

Each runtime `.ts` file must default-export one `defineLink(...)` result;
type-only exports are allowed, but named runtime exports are rejected. Import
`defineLink` from `@voyant-travel/core` or `@voyant-travel/core/links`.

The compiler emits `.voyant/runtime/project-links.generated.ts`. Link pivots
are starter-owned and materialized with `voyant db sync-links`; do not copy
package schemas or migrations into the starter.
