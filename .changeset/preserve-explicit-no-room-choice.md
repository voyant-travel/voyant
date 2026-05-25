---
"@voyantjs/bookings-ui": patch
---

Preserve the operator's explicit "No room" choice in `TravelersSection`. The hydration effect added in the previous patch couldn't distinguish "race-null" (units hadn't loaded yet) from "operator picked No room from the Room select" — both produced `roomUnitId: null`, and the next render silently re-assigned a unit, overriding the operator's choice. Now runs exactly one hydration pass per units-load transition and treats subsequent nulls as intentional.
