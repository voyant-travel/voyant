# @voyantjs/booking-requirements

Compatibility shim for the booking requirements backend surfaces now owned by
`@voyantjs/bookings`.

Use the new package subpaths:

```ts
import { bookingRequirementsService } from "@voyantjs/bookings/requirements"
import { productContactRequirements } from "@voyantjs/bookings/requirements/schema"
```

This package re-exports those surfaces for one release train so existing
imports keep working. The operator template still mounts the existing
`/v1/booking-requirements/*` and `/v1/public/booking-requirements/*` route paths.

