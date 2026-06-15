import { describe, expect, it } from "vitest"
import worker, { type Env, WorkflowRunDO } from "./worker.js"

function testBinding<T>(value: object = {}): T {
  return value as T
}

function unusedDurableObjectNamespace(): DurableObjectNamespace {
  return testBinding<DurableObjectNamespace>()
}

function testFetcher(): Fetcher {
  return testBinding<Fetcher>({
    fetch: async () => new Response(),
  })
}

describe("worker entry", () => {
  it("exports a default with a fetch handler", () => {
    expect(worker).toBeDefined()
    expect(typeof worker.fetch).toBe("function")
  })

  it("exports the WorkflowRunDO class with fetch + alarm", () => {
    expect(WorkflowRunDO).toBeDefined()
    expect(typeof WorkflowRunDO).toBe("function")
    expect(typeof WorkflowRunDO.prototype.fetch).toBe("function")
    expect(typeof WorkflowRunDO.prototype.alarm).toBe("function")
  })

  it("WorkflowRunDO.fetch forwards to the DO request handler and returns a Response", async () => {
    // The real DO runtime provides a fully-typed `state`. For this
    // smoke check we hand in a minimal storage stub — the DO's own
    // handler routes to a 404 for unknown paths, which is enough to
    // prove wiring is intact.
    const storage = {
      _map: new Map<string, unknown>(),
      async get(k: string) {
        return this._map.get(k)
      },
      async put(k: string, v: unknown) {
        this._map.set(k, v)
      },
      async delete(k: string) {
        return this._map.delete(k)
      },
      async list() {
        return new Map(this._map)
      },
    }
    const state = testBinding<DurableObjectState>({ storage })
    // WORKFLOWS service binding is never called for a 404 path; a stub is fine.
    const env = {
      WORKFLOW_RUN_DO: unusedDurableObjectNamespace(),
      WORKFLOWS: testFetcher(),
    } satisfies Env

    const instance = new WorkflowRunDO(state, env)
    const res = await instance.fetch(new Request("https://do-internal/unknown"))
    expect(res.status).toBe(404)
  })

  it("default.fetch routes POST /api/runs through the DO namespace", async () => {
    // Simulate a DO namespace + a DO instance in Node: one fetch
    // handler that just mirrors the request to prove the routing.
    let received: { url: string; method: string } | undefined
    const fakeStub = {
      async fetch(req: Request) {
        received = { url: req.url, method: req.method }
        return new Response(JSON.stringify({ routed: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      },
    }
    const fakeNS = testBinding<DurableObjectNamespace>({
      idFromName: (name: string) => testBinding<DurableObjectId>({ name }),
      get: () => testBinding<DurableObjectStub>(fakeStub),
    })

    const env = {
      WORKFLOW_RUN_DO: fakeNS,
      WORKFLOWS: testFetcher(),
      VOYANT_API_TOKENS: "test-token",
    } satisfies Env

    const res = await worker.fetch(
      new Request("https://orch/api/runs", {
        method: "POST",
        headers: { authorization: "Bearer test-token", "content-type": "application/json" },
        body: JSON.stringify({
          workflowId: "wf",
          workflowVersion: "v1",
          input: null,
          tenantMeta: {
            tenantId: "tnt",
            projectId: "prj",
            organizationId: "org",
          },
          runId: "run_worker_test",
        }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    expect(received?.method).toBe("POST")
    // Request forwarded to the DO's /trigger route.
    expect(received?.url).toMatch(/\/trigger$/)
    const body = await res.json()
    expect(body).toEqual({ routed: true })
  })
})
