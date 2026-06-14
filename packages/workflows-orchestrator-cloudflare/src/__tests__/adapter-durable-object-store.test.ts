import type { RunRecord } from "@voyant-travel/workflows-orchestrator"
import { describe, expect, it } from "vitest"
import { createDurableObjectRunStore } from "../index.js"
import { makeStorage, tenantMeta } from "./adapter-test-support.js"

describe("createDurableObjectRunStore", () => {
  it("round-trips a RunRecord via DO storage", async () => {
    const storage = makeStorage()
    const store = createDurableObjectRunStore(storage)
    const rec: RunRecord = {
      id: "run_1",
      workflowId: "wf",
      workflowVersion: "v1",
      status: "completed",
      input: { n: 1 },
      output: { ok: true },
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      invocationCount: 1,
      metadataAppliedCount: 0,
      computeTimeMs: 0,
      pendingWaitpoints: [],
      streams: {},
      startedAt: 100,
      completedAt: 200,
      triggeredBy: { kind: "api" },
      tags: [],
      environment: "development",
      tenantMeta,
      runMeta: { number: 1, attempt: 1 },
    }
    await store.save(rec)
    expect(await store.get("run_1")).toEqual(rec)
    expect(await store.get("run_other")).toBeUndefined()
    const list = await store.list()
    expect(list).toHaveLength(1)
    const filtered = await store.list({ status: "failed" })
    expect(filtered).toHaveLength(0)
  })
})

// ---- createServiceBindingDispatcher ----
