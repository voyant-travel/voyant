import { __resetRegistry, workflow } from "@voyantjs/workflows"
import type { DurableObjectStorageLike } from "@voyantjs/workflows-orchestrator-cloudflare"
import { beforeEach, describe, expect, it } from "vitest"
import {
  type CloudWorkflowsEnv,
  createCloudOrchestrator,
  handleCloudFetch,
  mountWorkflows,
  WorkflowRunDO,
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

function makeRunNamespace(envRef: { env?: CloudWorkflowsEnv }) {
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
          const instance = new WorkflowRunDO({ storage }, envRef.env)
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
  it("falls back to inline execution for runtime=node steps when STEP_RUNNER is absent", async () => {
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

  it("dispatches runtime=node steps to STEP_RUNNER with a signed R2 bundle", async () => {
    workflow<{ n: number }, unknown>({
      id: "platform-node",
      async run(input, ctx) {
        return ctx.step("compute", { runtime: "node" }, async () => input.n + 1)
      },
    })

    let capturedBody: {
      bundle?: { url: string; hash: string }
      workflowId?: string
      stepId?: string
    } = {}
    let capturedAuth: string | null = null
    const stepRunner = {
      idFromName(name: string) {
        return name
      },
      get() {
        return {
          async fetch(request: Request): Promise<Response> {
            capturedAuth = request.headers.get("x-voyant-step-auth")
            capturedBody = (await request.json()) as typeof capturedBody
            return new Response(
              JSON.stringify({
                attempt: 1,
                status: "ok",
                output: "from-container",
                startedAt: 10,
                finishedAt: 20,
                runtime: "node",
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            )
          },
        }
      },
    }

    const envRef: { env?: CloudWorkflowsEnv } = {}
    const env: CloudWorkflowsEnv = {
      WORKFLOW_RUN_DO: makeRunNamespace(envRef),
      STEP_RUNNER: stepRunner,
      VOYANT_WORKFLOW_BUNDLE_URL_PREFIX: "https://abc123.r2.cloudflarestorage.com/voyant-bundles",
      VOYANT_WORKFLOW_BUNDLE_KEY: "prj_test/v1/container.mjs",
      VOYANT_WORKFLOW_BUNDLE_HASH: "sha256:abcd",
      VOYANT_WORKFLOW_BUNDLE_R2_ACCESS_KEY_ID: "access-key-id",
      VOYANT_WORKFLOW_BUNDLE_R2_SECRET_ACCESS_KEY: "secret-access-key",
      VOYANT_WORKFLOW_STEP_AUTH_SECRET: "step-secret",
    }
    envRef.env = env

    const response = await handleCloudFetch(triggerRequest("platform-node", "run_platform"), env)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string; output: unknown }
    expect(body.status).toBe("completed")
    expect(body.output).toBe("from-container")
    expect(capturedAuth).toEqual(expect.any(String))
    expect(capturedBody.workflowId).toBe("platform-node")
    expect(capturedBody.stepId).toBe("compute")
    expect(capturedBody.bundle?.hash).toBe("sha256:abcd")
    expect(capturedBody.bundle?.url).toContain("abc123.r2.cloudflarestorage.com")
    expect(capturedBody.bundle?.url).toContain("/voyant-bundles/prj_test/v1/container.mjs")
    expect(capturedBody.bundle?.url).toContain("X-Amz-Signature=")
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
