# @voyant-travel/workflows

Authoring SDK for [Voyant Workflows](https://voyant.cloud/workflows) —
durable, step-based orchestrations for Voyant Cloud.

```ts
import { workflow } from "@voyant-travel/workflows";
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

Projects and plugins that collect workflow definitions explicitly can use
`defineWorkflow(...)`. It returns the same typed workflow definition without
mutating the process-local legacy registry, so the definition can be exported
directly from its module:

```ts
import { defineWorkflow } from "@voyant-travel/workflows";

export default defineWorkflow({
  id: "send-booking-reminders",
  async run(input: { bookingId: string }, ctx) {
    await ctx.step("send-reminder", async () => sendReminder(input.bookingId));
  },
});
```

## Subpaths

- `@voyant-travel/workflows` — authoring API (`defineWorkflow`, `workflow`,
  `workflows`, `trigger`, conditions, errors).
- `@voyant-travel/workflows/client` — app/server-safe managed Cloud client and
  Cloud-mode driver. Use this from app code that only needs
  `workflows.trigger(...)` or event forwarding; it does not import workflow
  definitions, runner code, or Node-only workflow dependencies.
- `@voyant-travel/workflows/testing` — in-process test harness
  (`runWorkflowForTest`, `resumeWorkflowForTest`).
- `@voyant-travel/workflows/handler` — node-side step handler for the
  v1 wire protocol. Self-host runtimes can call it directly or mount it at
  an internal HTTP boundary.
- `@voyant-travel/workflows/auth` — paired HMAC signer + verifier for the
  `X-Voyant-Dispatch-Auth` header. Wires into the orchestrator's
  `sign` hook and the handler's `verifyRequest` hook with a shared
  secret.
- `@voyant-travel/workflows/bindings` — runtime binding types and `env`
  shim for workflow code that reads platform bindings.
- `@voyant-travel/workflows/config` — `defineConfig` and `voyant.config.ts`
  types.
- `@voyant-travel/workflows/errors` — typed user/runtime errors
  (`FatalError`, `RetryableError`, `TimeoutError`, and related classes).
- `@voyant-travel/workflows/protocol` — wire-protocol types shared with the
  orchestrator.

## Managed Cloud runtime

Managed Voyant Cloud runs workflow bundles in the hosted Node runtime. App
bundles should import only `@voyant-travel/workflows/client` and call
`workflows.trigger(...)`; workflow definition files keep importing
`workflow(...)`, `ctx.step(...)`, `ctx.sleep(...)`, and `trigger.on(...)` from
`@voyant-travel/workflows`.

Cloud deployments inject:

```txt
VOYANT_CLOUD_WORKFLOWS_URL
VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN
VOYANT_CLOUD_APP_SLUG
VOYANT_CLOUD_ENVIRONMENT
```

The client posts trigger calls to the app-scoped Cloud API. The Cloud-mode
driver forwards event ingest to the same boundary, but workflow release
registration is disabled by default: Cloud creates releases from deployments,
artifacts, hashes, and environment snapshots. Self-host deployments should use
the Node/Postgres driver and orchestrator packages directly.

## Full contract

- [`docs/sdk-surface.md`](../../docs/sdk-surface.md) — locked API surface.
- [`docs/design.md`](../../docs/design.md) — architecture and rationale.
- [`docs/runtime-protocol.md`](../../docs/runtime-protocol.md) — wire protocol.
