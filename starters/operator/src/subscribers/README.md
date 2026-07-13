# Event subscribers

Put application-local event filters in `src/subscribers/**/*.ts`. These files
contain durable descriptor data only; executable behavior belongs in the
target workflow.

```ts
// src/subscribers/credit-booking-points.ts
import type { EventFilterDescriptor } from "@voyant-travel/core"

export default {
  id: "loyalty.credit-booking-points",
  eventType: "booking.confirmed",
  manifest: {
    id: "loyalty.credit-booking-points",
    eventType: "booking.confirmed",
    payloadHash: "7dd9b0cbfd8c5e30",
    targetWorkflowId: "loyalty.credit-points",
  },
} satisfies EventFilterDescriptor
```

`id` and `eventType` must be non-empty literals. The complete `manifest` must
repeat both values and provide non-empty `payloadHash` and `targetWorkflowId`
values. Its event and target workflow must exist in the selected graph. Named
runtime exports and non-serializable values are rejected; type-only exports are
allowed.

The compiler emits `.voyant/runtime/project-subscribers.generated.ts`; do not
register descriptors by side effect at startup.
