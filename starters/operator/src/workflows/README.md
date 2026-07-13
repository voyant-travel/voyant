# Deployment workflows

Put application-level durable workflows in `src/workflows/**/*.ts`. Each file
directly default-exports the pure `defineWorkflow(...)` result.

```ts
// src/workflows/booking/send-reminder.ts
import { defineWorkflow } from "@voyant-travel/workflows"

export interface SendReminderInput {
  bookingId: string
}

export default defineWorkflow<SendReminderInput, void>({
  id: "booking.send-reminder",
  run: async (_input, ctx) => {
    await ctx.step("send", async () => {
      // Resolve and call the injected reminder service here.
    })
  },
})
```

The `id` must be a non-empty static string. Use `defineWorkflow`, not the
registering `workflow(...)` helper or an indirect default export. Type-only
exports are allowed; named runtime exports are rejected. Any `schedule` on the
definition must be durable static data.

The compiler emits sorted static imports in
`.voyant/runtime/project-workflows.generated.ts`; no runtime directory scan or
side-effect registration is part of this convention.

Every non-declaration `.ts` file below this directory is a convention entry, so
keep helpers and tests elsewhere unless they also satisfy the workflow contract.
