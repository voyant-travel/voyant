# @voyantjs/booking-requirements

Booking requirements module for Voyant. Intake requirements, questions, and answers — the declarative layer that captures what data a product needs at booking time (dietary, passport, pickup, etc.).

## Install

```bash
pnpm add @voyantjs/booking-requirements
```

## Usage

```typescript
import { bookingRequirementsModule } from "@voyantjs/booking-requirements"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [bookingRequirementsModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0
