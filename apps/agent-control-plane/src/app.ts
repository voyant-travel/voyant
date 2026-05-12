import { Hono } from "hono"

import {
  acceptTickSnapshot,
  buildCapabilities,
  buildDispatchIntentFromStoredPlan,
  buildTickSnapshotRecord,
  dispatchIntentFinishRequestSchema,
  dispatchPlanRequestSchema,
  latestDispatchIntentRequestSchema,
  latestDispatchPlanRequestSchema,
  selectDispatchPlan,
  selectDispatchPlanFromTickSnapshotRecord,
  tickSnapshotRequestSchema,
} from "./control-plane.js"
import type { DispatchIntentStore } from "./dispatch-intent-store.js"
import type { TickSnapshotStore } from "./tick-snapshot-store.js"

interface AppOptions {
  authTokens?: string[]
  createDispatchIntentId?: () => string
  dispatchIntentStore?: DispatchIntentStore
  now?: () => Date
  tickSnapshotStore?: TickSnapshotStore
}

export function createApp({
  authTokens = [],
  createDispatchIntentId = () => crypto.randomUUID(),
  dispatchIntentStore,
  now = () => new Date(),
  tickSnapshotStore,
}: AppOptions = {}): Hono {
  const app = new Hono()

  app.onError((error, c) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[agent-control-plane] ${c.req.method} ${c.req.path}: ${message}`)
    return c.json({ error: "internal_error" }, 500)
  })

  app.get("/health", (c) => c.json({ ok: true, service: "agent-control-plane" }))

  app.use("/api/*", async (c, next) => {
    if (authTokens.length === 0) {
      return c.json({ error: "control_plane_auth_not_configured" }, 503)
    }

    const token = bearerToken(c.req.header("authorization"))
    if (!token || !authTokens.includes(token)) {
      return c.json({ error: "unauthorized" }, 401)
    }

    await next()
  })

  app.get("/api/capabilities", (c) =>
    c.json(
      buildCapabilities({
        dispatchIntentPersistence: dispatchIntentStore ? "leased" : "none",
        tickSnapshotPersistence: tickSnapshotStore ? "latest" : "none",
      }),
    ),
  )

  app.post("/api/dispatch-plans", async (c) => {
    const parsed = dispatchPlanRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_dispatch_plan_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    return c.json(selectDispatchPlan(parsed.data))
  })

  app.post("/api/dispatch-plans/latest", async (c) => {
    const parsed = latestDispatchPlanRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_latest_dispatch_plan_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    if (!tickSnapshotStore) {
      return c.json({ error: "tick_snapshot_storage_not_configured" }, 503)
    }

    const record = await tickSnapshotStore.getLatest(parsed.data.repository)
    if (!record) {
      return c.json({ error: "tick_snapshot_not_found" }, 404)
    }

    return c.json(
      selectDispatchPlanFromTickSnapshotRecord({
        record,
        request: parsed.data,
      }),
    )
  })

  app.post("/api/dispatch-intents/latest", async (c) => {
    const parsed = latestDispatchIntentRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_latest_dispatch_intent_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    if (!tickSnapshotStore) {
      return c.json({ error: "tick_snapshot_storage_not_configured" }, 503)
    }

    if (!dispatchIntentStore) {
      return c.json({ error: "dispatch_intent_storage_not_configured" }, 503)
    }

    const snapshot = await tickSnapshotStore.getLatest(parsed.data.repository)
    if (!snapshot) {
      return c.json({ error: "tick_snapshot_not_found" }, 404)
    }

    const planResult = selectDispatchPlanFromTickSnapshotRecord({
      record: snapshot,
      request: parsed.data,
    })
    const requestedAt = now()
    const intentResult = buildDispatchIntentFromStoredPlan({
      id: createDispatchIntentId(),
      now: requestedAt,
      request: parsed.data,
      result: planResult,
    })
    if (!intentResult.intent) {
      return c.json(intentResult)
    }

    const acquire = await dispatchIntentStore.acquireIntent(intentResult.intent, {
      now: requestedAt,
    })
    if (!acquire.acquired) {
      return c.json(
        {
          error: "dispatch_intent_already_active",
          intent: acquire.activeIntent,
        },
        409,
      )
    }

    return c.json(
      {
        ...intentResult,
        storage: { activeKey: acquire.write.activeKey, key: acquire.write.key, persisted: true },
      },
      201,
    )
  })

  app.post("/api/dispatch-intents/:id/finish", async (c) => {
    const id = c.req.param("id")?.trim()
    if (!id) {
      return c.json({ error: "missing_dispatch_intent_id" }, 400)
    }

    const parsed = dispatchIntentFinishRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_dispatch_intent_finish_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    if (!dispatchIntentStore) {
      return c.json({ error: "dispatch_intent_storage_not_configured" }, 503)
    }

    const result = await dispatchIntentStore.finishIntent({
      id,
      now: now(),
      request: parsed.data,
    })
    if (!result.finished) {
      if (result.reason === "not_found") {
        return c.json({ error: "dispatch_intent_not_found" }, 404)
      }

      return c.json(
        {
          error:
            result.reason === "holder_mismatch"
              ? "dispatch_intent_holder_mismatch"
              : result.reason === "finish_contention"
                ? "dispatch_intent_finish_contention"
                : "dispatch_intent_not_active",
          ...(result.intent ? { intent: result.intent } : {}),
        },
        409,
      )
    }

    return c.json({
      intent: result.intent,
      storage: {
        activeKey: result.write.activeKey,
        activeUpdated: result.write.activeUpdated,
        key: result.write.key,
        persisted: true,
      },
    })
  })

  app.post("/api/tick-snapshots", async (c) => {
    const parsed = tickSnapshotRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_tick_snapshot_request",
          issues: validationIssues(parsed.error),
        },
        400,
      )
    }

    const accepted = acceptTickSnapshot(parsed.data)
    if (!tickSnapshotStore) {
      return c.json({
        ...accepted,
        storage: { persisted: false, reason: "tick_snapshot_storage_not_configured" },
      })
    }

    const write = await tickSnapshotStore.putLatest(buildTickSnapshotRecord(parsed.data))
    return c.json({
      ...accepted,
      storage: { key: write.key, persisted: true },
    })
  })

  app.get("/api/tick-snapshots/latest", async (c) => {
    if (!tickSnapshotStore) {
      return c.json({ error: "tick_snapshot_storage_not_configured" }, 503)
    }

    const repository = c.req.query("repository")?.trim()
    if (!repository) {
      return c.json({ error: "missing_repository" }, 400)
    }

    const record = await tickSnapshotStore.getLatest(repository)
    if (!record) {
      return c.json({ error: "tick_snapshot_not_found" }, 404)
    }

    return c.json(record)
  })

  return app
}

function bearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim()
}

function validationIssues(error: { issues: Array<{ path: Array<PropertyKey>; message: string }> }) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))
}
