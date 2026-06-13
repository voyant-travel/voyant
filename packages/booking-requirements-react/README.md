# @voyantjs/booking-requirements-react

Compatibility shim for the booking requirements React surfaces now owned by
`@voyantjs/bookings-react`.

Use the new package subpaths:

```tsx
import { useTransportRequirements } from "@voyantjs/bookings-react/requirements"
import { BookingRequirementsContactTab } from "@voyantjs/bookings-react/requirements/ui"
import { bookingRequirementsUiEn } from "@voyantjs/bookings-react/requirements/i18n/en"
```

This package re-exports those surfaces for one release train so existing
imports keep working.

