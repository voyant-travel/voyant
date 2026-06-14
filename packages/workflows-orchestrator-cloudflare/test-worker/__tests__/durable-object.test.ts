import { env, runInDurableObject, SELF } from "cloudflare:test"
import type { RunRecord } from "@voyant-travel/workflows-orchestrator"
import { describe, expect, it } from "vitest"

// These tests exercise the real workerd Durable Object runtime. They
// validate that the adapter's structural types (DurableObjectStorageLike,
// DurableObjectNamespaceLike, alarm methods) actually line up with CF's
// concrete runtime — catches mismatches our plain-node tests can't.

const tenantMeta = {
  tenantId: "tnt_test",
  projectId: "prj_test",
  organizationId: "org_test",
  tenantScript: "test-tenant",
}

async function triggerRun(runId: string, workflowId: string, input: unknown): Promise<RunRecord> {
  const res = await SELF.fetch("https://orch/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workflowId,
      workflowVersion: "v1",
      input,
      tenantMeta,
      runId,
    }),
  })
  expect(res.status).toBe(200)
  return (await res.json()) as RunRecord
}

describe("handleWorkerRequest on real workerd", () => {
  it("triggers a run that completes in one invocation", async () => {
    const rec = await triggerRun("run_double_1", "double", { n: 21 })
    expect(rec.status).toBe("completed")
    expect(rec.output).toEqual({ doubled: 42 })
  })

  it("persists the run in real DO storage across reads", async () => {
    await triggerRun("run_persist_1", "double", { n: 3 })
    const getRes = await SELF.fetch("https://orch/api/runs/run_persist_1")
    expect(getRes.status).toBe(200)
    const rec = (await getRes.json()) as RunRecord
    expect(rec.status).toBe("completed")
    expect(rec.output).toEqual({ doubled: 6 })
  })

  it("schedules and fires a DO alarm for ctx.sleep across the real runtime", async () => {
    // Trigger a workflow that sleeps 200ms. It will park on a
    // DATETIME waitpoint and the adapter should call setAlarm.
    const parked = await triggerRun("run_sleep_1", "sleep-then-done", null)
    expect(parked.status).toBe("waiting")
    const pendingKind = parked.pendingWaitpoints[0]?.kind
    expect(pendingKind).toBe("DATETIME")

    // Fire the alarm by forcing it on the DO (rather than waiting on
    // wall-clock). runInDurableObject lets us poke at state directly.
    const id = env.TEST_WORKFLOW_RUN_DO.idFromName("run_sleep_1")
    const stub = env.TEST_WORKFLOW_RUN_DO.get(id)

    await runInDurableObject(stub, async (_instance, state) => {
      // Force the alarm to fire immediately.
      const scheduled = await state.storage.getAlarm()
      expect(scheduled).toBeTypeOf("number")
      await state.storage.setAlarm(Date.now() - 1)
    })

    // Wait a tick for the alarm scheduler to call alarm().
    await new Promise((r) => setTimeout(r, 500))

    const getRes = await SELF.fetch("https://orch/api/runs/run_sleep_1")
    const final = (await getRes.json()) as RunRecord
    expect(final.status).toBe("completed")
    expect(final.output).toEqual({ done: true })
  })
})
