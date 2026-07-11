import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { __resetRegistry } from "@voyant-travel/workflows"
import { describe, expect, it } from "vitest"
import { createSelfHostDeps, handleRequest } from "../dashboard-server.js"
import type { SnapshotRunStore } from "../snapshot-run-store.js"
import { createFsSnapshotRunStore } from "../snapshot-run-store.js"

const emptyStore: SnapshotRunStore = {
  save: async () => {
    throw new Error("not implemented")
  },
  get: async () => undefined,
  list: async () => [],
}

describe("handleRequest health endpoints", () => {
  it("serves a default liveness response", async () => {
    const response = await handleRequest(
      { method: "GET", url: "http://local/healthz" },
      { store: emptyStore },
    )

    expect(response.status).toBe(200)
    expect(JSON.parse(String(response.body))).toMatchObject({
      ok: true,
      service: "voyant-workflows-selfhost",
    })
  })

  it("returns not ready when no workflow entry is configured", async () => {
    const response = await handleRequest(
      { method: "GET", url: "http://local/readyz" },
      { store: emptyStore },
    )

    expect(response.status).toBe(503)
    expect(JSON.parse(String(response.body))).toMatchObject({
      ok: false,
      checks: {
        workflowEntry: "error",
      },
    })
  })

  it("reports readiness check failures", async () => {
    const response = await handleRequest(
      { method: "GET", url: "http://local/readyz" },
      {
        store: emptyStore,
        triggerRun: async () => ({
          ok: true as const,
          saved: {
            id: "run_1",
            workflowId: "wf",
            status: "waiting",
            startedAt: 0,
            result: { status: "waiting", startedAt: 0, tags: [] },
          },
        }),
        readinessCheck: async () => {
          throw new Error("database unavailable")
        },
      },
    )

    expect(response.status).toBe(503)
    expect(JSON.parse(String(response.body))).toMatchObject({
      ok: false,
      checks: {
        self: "error",
      },
      details: {
        error: "database unavailable",
      },
    })
  })

  it("serves Prometheus-style metrics", async () => {
    const response = await handleRequest(
      { method: "GET", url: "http://local/metrics" },
      {
        store: emptyStore,
        collectMetrics: async () =>
          [
            "# HELP voyant_selfhost_up Self-host server availability.",
            "# TYPE voyant_selfhost_up gauge",
            "voyant_selfhost_up 1",
            "",
          ].join("\n"),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers["content-type"]).toContain("text/plain")
    expect(String(response.body)).toContain("voyant_selfhost_up 1")
  })
})

describe("handleRequest resume endpoints", () => {
  it("rejects invalid seeded step ids before resuming", async () => {
    let resumeCalled = false
    const response = await handleRequest(
      {
        method: "POST",
        url: "http://local/api/runs/run_1/resume",
        body: JSON.stringify({ seedResults: { "bad\nstep": 1 } }),
      },
      {
        store: emptyStore,
        resumeRun: async () => {
          resumeCalled = true
          throw new Error("resumeRun should not be called")
        },
      },
    )

    expect(response.status).toBe(400)
    expect(JSON.parse(String(response.body))).toMatchObject({
      error: "invalid_body",
      message: "seedResults step ids must not contain control characters",
    })
    expect(resumeCalled).toBe(false)
  })
})

describe("createSelfHostDeps validation", () => {
  it("fails clearly when the workflow entry file does not exist", async () => {
    await expect(
      createSelfHostDeps({
        entryFile: "./definitely-missing-workflows.mjs",
      }),
    ).rejects.toThrow(/workflow entry not found/i)
  })

  it("fails clearly when the workflow entry registers no workflows", async () => {
    const root = await mkdtemp(join(process.cwd(), ".tmp-empty-workflow-entry-"))
    try {
      const entryFile = join(root, "empty-workflows.mjs")
      const staticDir = join(root, "static")
      await mkdir(staticDir, { recursive: true })
      await writeFile(entryFile, "export const nothing = true;\n", "utf8")

      await expect(
        createSelfHostDeps({
          entryFile,
          staticDir,
          cacheBustEntry: true,
        }),
      ).rejects.toThrow(/registered no workflows/i)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("surfaces configured services to self-host workflow bodies", async () => {
    const root = await mkdtemp(join(process.cwd(), ".tmp-services-workflow-entry-"))
    let deps: Awaited<ReturnType<typeof createSelfHostDeps>> | undefined
    try {
      const entryFile = join(root, "services-workflows.mjs")
      const staticDir = join(root, "static")
      await mkdir(staticDir, { recursive: true })
      await writeFile(
        entryFile,
        [
          'import { workflow } from "@voyant-travel/workflows";',
          'workflow({ id: "service_probe", async run(_input, ctx) {',
          '  const catalog = ctx.services.resolve("catalog:indexer");',
          "  return { serviceName: catalog.name, optional: ctx.services.has('missing') };",
          "}});",
        ].join("\n"),
        "utf8",
      )

      deps = await createSelfHostDeps({
        entryFile,
        staticDir,
        cacheBustEntry: true,
        services: {
          resolve<T>(name: string): T {
            if (name === "catalog:indexer") return { name: "test-indexer" } as T
            throw new Error(`missing service ${name}`)
          },
          has(name) {
            return name === "catalog:indexer"
          },
        },
        store: createFsSnapshotRunStore({ rootDir: join(root, "runs") }),
      })

      const response = await handleRequest(
        {
          method: "POST",
          url: "http://local/api/runs",
          body: JSON.stringify({ workflowId: "service_probe", input: {} }),
        },
        deps,
      )

      expect(response.status).toBe(200)
      const triggered = JSON.parse(String(response.body)) as {
        saved: {
          status: string
          result: { output: { serviceName: string; optional: boolean } }
        }
      }
      expect(triggered.saved.status).toBe("completed")
      expect(triggered.saved.result.output).toEqual({
        serviceName: "test-indexer",
        optional: false,
      })
    } finally {
      await deps?.shutdown?.()
      await rm(root, { recursive: true, force: true })
    }
  })

  it("executes from the entry snapshot after the global registry is cleared", async () => {
    const root = await mkdtemp(join(process.cwd(), ".tmp-resolver-workflow-entry-"))
    let deps: Awaited<ReturnType<typeof createSelfHostDeps>> | undefined
    try {
      const entryFile = join(root, "resolver-workflows.mjs")
      const staticDir = join(root, "static")
      await mkdir(staticDir, { recursive: true })
      await writeFile(
        entryFile,
        [
          'import { workflow } from "@voyant-travel/workflows";',
          'workflow({ id: "resolver_probe", async run() {',
          '  return { source: "entry snapshot" };',
          "}});",
        ].join("\n"),
        "utf8",
      )

      deps = await createSelfHostDeps({
        entryFile,
        staticDir,
        cacheBustEntry: true,
        store: createFsSnapshotRunStore({ rootDir: join(root, "runs") }),
      })
      __resetRegistry()

      const response = await handleRequest(
        {
          method: "POST",
          url: "http://local/api/runs",
          body: JSON.stringify({ workflowId: "resolver_probe", input: {} }),
        },
        deps,
      )

      expect(response.status).toBe(200)
      expect(JSON.parse(String(response.body))).toMatchObject({
        saved: {
          status: "completed",
          result: { output: { source: "entry snapshot" } },
        },
      })
    } finally {
      await deps?.shutdown?.()
      __resetRegistry()
      await rm(root, { recursive: true, force: true })
    }
  })

  it("resumes a failed self-host run from its seeded successful steps", async () => {
    const root = await mkdtemp(join(process.cwd(), ".tmp-resume-workflow-entry-"))
    const previousProbe = (globalThis as { __voyantResumeProbeA?: number }).__voyantResumeProbeA
    let deps: Awaited<ReturnType<typeof createSelfHostDeps>> | undefined
    try {
      ;(globalThis as { __voyantResumeProbeA?: number }).__voyantResumeProbeA = 0
      const entryFile = join(root, "resume-workflows.mjs")
      const staticDir = join(root, "static")
      await mkdir(staticDir, { recursive: true })
      await writeFile(
        entryFile,
        [
          'import { workflow } from "@voyant-travel/workflows";',
          'workflow({ id: "resume_probe", async run(input, ctx) {',
          '  const a = await ctx.step("a", () => {',
          "    globalThis.__voyantResumeProbeA = (globalThis.__voyantResumeProbeA ?? 0) + 1;",
          "    return input.value;",
          "  });",
          '  const b = await ctx.step("b", () => {',
          '    if (input.fail) throw new Error("boom");',
          "    return a + 5;",
          "  });",
          "  return { total: b };",
          "}});",
        ].join("\n"),
        "utf8",
      )

      deps = await createSelfHostDeps({
        entryFile,
        staticDir,
        cacheBustEntry: true,
        store: createFsSnapshotRunStore({ rootDir: join(root, "runs") }),
      })

      const failedResponse = await handleRequest(
        {
          method: "POST",
          url: "http://local/api/runs",
          body: JSON.stringify({
            workflowId: "resume_probe",
            input: { value: 10, fail: true },
          }),
        },
        deps,
      )
      expect(failedResponse.status).toBe(200)
      const failed = JSON.parse(String(failedResponse.body)) as {
        saved: { id: string; status: string; result: { steps: Array<{ id: string }> } }
      }
      expect(failed.saved.status).toBe("failed")
      expect(failed.saved.result.steps.map((step) => step.id)).toEqual(["a", "b"])
      expect((globalThis as { __voyantResumeProbeA?: number }).__voyantResumeProbeA).toBe(1)

      const resumedResponse = await handleRequest(
        {
          method: "POST",
          url: `http://local/api/runs/${failed.saved.id}/resume`,
          body: JSON.stringify({
            input: { value: 10, fail: false },
          }),
        },
        deps,
      )
      expect(resumedResponse.status).toBe(200)
      const resumed = JSON.parse(String(resumedResponse.body)) as {
        saved: {
          id: string
          status: string
          replayOf?: string
          result: { output: { total: number }; steps: Array<{ id: string }> }
        }
        parentRunId: string
        resumeFromStep: string
      }
      expect(resumed.parentRunId).toBe(failed.saved.id)
      expect(resumed.resumeFromStep).toBe("b")
      expect(resumed.saved.status).toBe("completed")
      expect(resumed.saved.replayOf).toBe(failed.saved.id)
      expect(resumed.saved.result.output).toEqual({ total: 15 })
      expect(resumed.saved.result.steps.map((step) => step.id)).toEqual(["a", "b"])
      expect((globalThis as { __voyantResumeProbeA?: number }).__voyantResumeProbeA).toBe(1)

      const externalParentResponse = await handleRequest(
        {
          method: "POST",
          url: "http://local/api/runs/admin_workflow_run_1/resume",
          body: JSON.stringify({
            workflowId: "resume_probe",
            input: { value: 20, fail: false },
            resumeFromStep: "b",
            seedResults: { a: 20 },
          }),
        },
        deps,
      )
      expect(externalParentResponse.status).toBe(200)
      const externalParentResume = JSON.parse(String(externalParentResponse.body)) as {
        saved: {
          status: string
          replayOf?: string
          result: { output: { total: number }; steps: Array<{ id: string }> }
        }
        parentRunId: string
        resumeFromStep: string
      }
      expect(externalParentResume.parentRunId).toBe("admin_workflow_run_1")
      expect(externalParentResume.resumeFromStep).toBe("b")
      expect(externalParentResume.saved.status).toBe("completed")
      expect(externalParentResume.saved.replayOf).toBe("admin_workflow_run_1")
      expect(externalParentResume.saved.result.output).toEqual({ total: 25 })
      expect(externalParentResume.saved.result.steps.map((step) => step.id)).toEqual(["a", "b"])
      expect((globalThis as { __voyantResumeProbeA?: number }).__voyantResumeProbeA).toBe(1)
    } finally {
      await deps?.shutdown?.()
      if (previousProbe === undefined) {
        delete (globalThis as { __voyantResumeProbeA?: number }).__voyantResumeProbeA
      } else {
        ;(globalThis as { __voyantResumeProbeA?: number }).__voyantResumeProbeA = previousProbe
      }
      await rm(root, { recursive: true, force: true })
    }
  })
})
