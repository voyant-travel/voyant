import { Hono } from "hono"

import {
  acceptTickSnapshot,
  buildCapabilities,
  buildTickSnapshotRecord,
  dispatchPlanRequestSchema,
  latestDispatchPlanRequestSchema,
  selectDispatchPlan,
  selectDispatchPlanFromTickSnapshotRecord,
  tickSnapshotRequestSchema,
} from "./control-plane.js"
import type { TickSnapshotStore } from "./tick-snapshot-store.js"

interface AppOptions {
  authTokens?: string[]
  tickSnapshotStore?: TickSnapshotStore
}

export function createApp({ authTokens = [], tickSnapshotStore }: AppOptions = {}): Hono {
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
