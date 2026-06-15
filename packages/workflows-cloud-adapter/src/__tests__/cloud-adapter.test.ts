import { __resetRegistry, workflow } from "@voyant-travel/workflows"
import type { DurableObjectStorageLike } from "@voyant-travel/workflows-orchestrator-cloudflare"
import { beforeEach, describe, expect, it } from "vitest"
import {
  type CloudWorkflowsEnv,
  createCloudOrchestrator,
  mountWorkflows,
  WorkflowRunDO,
  type WorkflowRunDOClass,
} from "../index.js"

interface AlarmTrackingStorage extends DurableObjectStorageLike {
  _alarm: number | null
}

function makeStorage(): AlarmTrackingStorage {
  const map = new Map<string, unknown>()
  return {
    _alarm: null,
    async get<T>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined
    },
    async put<T>(key: string, value: T): Promise<void> {
      map.set(key, value)
    },
    async delete(key: string): Promise<boolean> {
      return map.delete(key)
    },
    async list<T>(options = {}): Promise<Map<string, T>> {
      const out = new Map<string, T>()
      for (const [key, value] of map) {
        if (options.prefix && !key.startsWith(options.prefix)) continue
        out.set(key, value as T)
        if (options.limit && out.size >= options.limit) break
      }
      return out
    },
    async getAlarm() {
      return this._alarm
    },
    async setAlarm(wakeAt) {
      this._alarm = wakeAt
    },
    async deleteAlarm() {
      this._alarm = null
    },
  }
}

function makeRunNamespace(envRef: {
  env?: CloudWorkflowsEnv
  WorkflowRunDO?: WorkflowRunDOClass<CloudWorkflowsEnv>
}) {
  const storages = new Map<string, DurableObjectStorageLike>()
  return {
    idFromName(name: string) {
      return name
    },
    get(id: string) {
      let storage = storages.get(id)
      if (!storage) {
        storage = makeStorage()
        storages.set(id, storage)
      }
      return {
        fetch(request: Request) {
          if (!envRef.env) throw new Error("test env not initialized")
          const RunDO = envRef.WorkflowRunDO ?? WorkflowRunDO
          const instance = new RunDO({ storage }, envRef.env)
          return instance.fetch(request)
        },
      }
    },
  }
}

function triggerRequest(workflowId: string, runId: string): Request {
  return new Request("https://tenant.example/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workflowId,
      workflowVersion: "v1",
      input: { n: 2 },
      environment: "development",
      tenantMeta: {
        tenantId: "tnt_test",
        projectId: "prj_test",
        organizationId: "org_test",
      },
      runId,
    }),
  })
}

beforeEach(() => {
  __resetRegistry()
})

describe("createCloudOrchestrator", () => {
  it("executes runtime=node steps through the single SDK runner path", async () => {
    workflow<{ n: number }, number>({
      id: "inline-node",
      async run(input, ctx) {
        return ctx.step("compute", { runtime: "node" }, async () => input.n + 1)
      },
    })

    const envRef: { env?: CloudWorkflowsEnv } = {}
    const env: CloudWorkflowsEnv = {
      WORKFLOW_RUN_DO: makeRunNamespace(envRef),
    }
    envRef.env = env

    const { fetch } = createCloudOrchestrator()
    const response = await fetch(triggerRequest("inline-node", "run_inline"), env)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string; output: unknown }
    expect(body.status).toBe("completed")
    expect(body.output).toBe(3)
  })

  it("passes orchestrator services into the returned WorkflowRunDO class", async () => {
    workflow<{ n: number }, string>({
      id: "services-node",
      async run(_input, ctx) {
        return ctx.step("read-service", { runtime: "node" }, async () => {
          return ctx.services.resolve<{ value: string }>("thing").value
        })
      },
    })

    const services = {
      resolve<T>(name: string): T {
        if (name !== "thing") throw new Error(`unexpected service ${name}`)
        return { value: "from-services" } as T
      },
      has(name: string): boolean {
        return name === "thing"
      },
    }
    const orchestrator = createCloudOrchestrator(undefined, undefined, { services })
    const envRef: {
      env?: CloudWorkflowsEnv
      WorkflowRunDO?: WorkflowRunDOClass<CloudWorkflowsEnv>
    } = {
      WorkflowRunDO: orchestrator.WorkflowRunDO,
    }
    const env: CloudWorkflowsEnv = {
      WORKFLOW_RUN_DO: makeRunNamespace(envRef),
    }
    envRef.env = env

    const response = await orchestrator.fetch(triggerRequest("services-node", "run_services"), env)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string; output: unknown }
    expect(body.status).toBe("completed")
    expect(body.output).toBe("from-services")
  })
})

describe("mountWorkflows", () => {
  it("registers a workflows route on Hono-style apps and returns the same app", async () => {
    let route:
      | {
          path: string
          handler: (...args: unknown[]) => Promise<Response> | Response
        }
      | undefined
    const app = {
      all(path: string, handler: (...args: unknown[]) => Promise<Response> | Response) {
        route = { path, handler }
      },
    }

    const mounted = mountWorkflows(app)
    expect(mounted).toBe(app)
    expect(route?.path).toBe("/api/*")

    const env: CloudWorkflowsEnv = {
      WORKFLOW_RUN_DO: {
        idFromName(name: string) {
          return name
        },
        get() {
          return {
            fetch: async () => new Response(JSON.stringify({ routed: true }), { status: 200 }),
          }
        },
      },
    }
    const response = await route?.handler({
      req: { raw: triggerRequest("wf", "run_mount") },
      env,
    })
    expect(response?.status).toBe(200)
  })
})
