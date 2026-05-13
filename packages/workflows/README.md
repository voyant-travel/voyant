# @voyantjs/workflows

Authoring SDK for [Voyant Workflows](https://voyant.cloud/workflows) —
durable, step-based orchestrations for Voyant Cloud.

```ts
import { workflow } from "@voyantjs/workflows";
import { z } from "zod";

export const sendBookingReminders = workflow({
  id: "send-booking-reminders",
  input: z.object({ bookingId: z.string() }),

  async run(input, ctx) {
    const booking = await ctx.step("fetch", () => db.bookings.findById(input.bookingId));

    await ctx.sleep("24h");

    await ctx.step("send-reminder", async () => {
      await email.send(booking.customerEmail, "Reminder...");
    });
  },
});
```

## Subpaths

- `@voyantjs/workflows` — authoring API (`workflow`, `workflows`, `trigger`, conditions, errors).
- `@voyantjs/workflows/testing` — in-process test harness
  (`runWorkflowForTest`, `resumeWorkflowForTest`).
- `@voyantjs/workflows/handler` — tenant-side step handler for the
  v1 wire protocol. Mount at `POST /__voyant/workflow-step` in your
  Worker: `export default { fetch: createStepHandler() }`.
- `@voyantjs/workflows/auth` — paired HMAC signer + verifier for the
  `X-Voyant-Dispatch-Auth` header. Wires into the orchestrator's
  `sign` hook and the handler's `verifyRequest` hook with a shared
  secret.
- `@voyantjs/workflows/bindings` — runtime binding types and `env`
  shim for workflow code that reads platform bindings.
- `@voyantjs/workflows/config` — `defineConfig` and `voyant.config.ts`
  types.
- `@voyantjs/workflows/errors` — typed user/runtime errors
  (`FatalError`, `RetryableError`, `TimeoutError`, and related classes).
- `@voyantjs/workflows/protocol` — wire-protocol types shared with the
  orchestrator.

## Full contract

- [`docs/sdk-surface.md`](../../docs/sdk-surface.md) — locked API surface.
- [`docs/design.md`](../../docs/design.md) — architecture and rationale.
- [`docs/runtime-protocol.md`](../../docs/runtime-protocol.md) — wire protocol.
