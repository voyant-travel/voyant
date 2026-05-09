// Mode 1 (CF edge) driver compliance — runs the parameterized suite from
// `@voyantjs/workflows-orchestrator/testing` against `createCloudflareEdgeDriver`,
// wired to an in-process fake DO namespace that delegates back to the same
// orchestrator state machine production uses.
//
// The fake stack mirrors `__tests__/adapter.test.ts`'s pattern: an
// in-memory `DurableObjectStorageLike` per run, an in-process step
// dispatcher backed by `handleStepRequest` from
// `@voyantjs/workflows/handler`. End-to-end exercises the manifest KV
// store, the event router, and the DO trigger forward path without
// requiring `wrangler dev`.

import { workflow } from "@voyantjs/workflows"
import { handleStepRequest } from "@voyantjs/workflows/handler"
import { runDriverComplianceSuite, testFactoryDeps } from "@voyantjs/workflows-orchestrator/testing"
import { describe, expect, it } from "vitest"

import { createCloudflareEdgeDriver } from "../cloudflare-edge-driver.js"
import {
  createDurableObjectRunStore,
  createInlineDispatcher,
  type DurableObjectNamespaceLike,
  type DurableObjectStorageLike,
  handleDurableObjectRequest,
} from "../index.js"
import { createInMemoryKv } from "../manifest-kv-store.js"

// Use createDurableObjectRunStore to keep the imports referenced for tooling
// even though the helpers below talk to the storage directly.
void createDurableObjectRunStore

// ---- Fakes ----

function makeStorage(): DurableObjectStorageLike {
  const map = new Map<string, unknown>()
  let alarm: number | null = null
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined
    },
    async put<T>(key: string, value: T): Promise<void> {
      map.set(key, value)
    },
    async delete(key) {
      return map.delete(key)
    },
    async list<T>(options = {}) {
      const out = new Map<string, T>()
      for (const [k, v] of map) {
        if (options.prefix && !k.startsWith(options.prefix)) continue
        out.set(k, v as T)
        if (options.limit && out.size >= options.limit) break
      }
      return out
    },
    async getAlarm() {
      return alarm
    },
    async setAlarm(wakeAt) {
      alarm = wakeAt
    },
    async deleteAlarm() {
      alarm = null
    },
  }
}

function inProcessRunDONamespace(): DurableObjectNamespaceLike<string> {
  const storages = new Map<string, DurableObjectStorageLike>()
  // Per-id request queue — mirrors the production CF guarantee that a
  // Durable Object instance processes requests one at a time. Without
  // this, concurrent fetches to the same id race inside the fake even
  // though they wouldn't in production. Critical for the
  // `tryInsert` idempotency-race compliance test.
  const queues = new Map<string, Promise<unknown>>()
  const dispatcher = createInlineDispatcher(async (req) => handleStepRequest(req))
  return {
    idFromName(name) {
      return name
    },
    get(id: string) {
      let storage = storages.get(id)
      if (!storage) {
        storage = makeStorage()
        storages.set(id, storage)
      }
      const stableStorage = storage
      return {
        async fetch(req: Request): Promise<Response> {
          const prev = queues.get(id) ?? Promise.resolve()
          let release!: () => void
          const next = new Promise<void>((resolve) => {
            release = resolve
          })
          queues.set(id, next)
          await prev
          try {
            return await handleDurableObjectRequest(req, {
              storage: stableStorage,
              dispatcher,
            })
          } finally {
            release()
          }
        },
      }
    },
  }
}

// Run the parameterized compliance suite. Each call to the factory builds
// a fresh driver wired against fresh fakes — same pattern Mode 2 uses.
//
// `servicesThreading: false` opts out of the `ctx.services` contract:
// Mode 1's orchestrator and tenant live in separate Worker isolates
// (Workers-for-Platforms), so the framework's `ModuleContainer` doesn't
// cross the boundary by design. Tenant code wires its own container at
// its own `createApp()` boundary. See architecture doc §8.
runDriverComplianceSuite(
  "CloudflareEdge",
  () =>
    createCloudflareEdgeDriver({
      orchestratorNamespace: inProcessRunDONamespace(),
      manifestKv: createInMemoryKv(),
    }),
  // servicesThreading: orchestrator and step handlers can run in
  //                    separate Worker isolates depending on dispatcher.
  // crossRunQueries:   self-host Mode 1 has no native query layer per §8.3.
  { servicesThreading: false, crossRunQueries: false },
)

// ---- Smoke: end-to-end driver path with no tenantScript ----
//
// The compliance suite above already uses createInlineDispatcher for
// step delivery (see inProcessRunDONamespace). This dedicated case
// proves a run can be triggered + completed via the public
// `createCloudflareEdgeDriver` API without setting `tenantScript`
// anywhere — the shape self-host single-Worker deployments use.

describe("self-host inline-dispatcher path", () => {
  it("triggers + completes a run with no tenantScript", async () => {
    const wf = workflow<{ n: number }, { doubled: number }>({
      id: "inline-double",
      async run(input) {
        return { doubled: input.n * 2 }
      },
    })
    const factory = createCloudflareEdgeDriver({
      orchestratorNamespace: inProcessRunDONamespace(),
      manifestKv: createInMemoryKv(),
      // Note: no tenantScript — built-in dispatchers don't use it.
    })
    const driver = factory(testFactoryDeps())
    const run = await driver.trigger(wf, { n: 21 })
    expect(run.status).toBe("completed")
    const detail = await driver.admin?.getRun?.(run.id)
    expect(detail?.output).toEqual({ doubled: 42 })
  })
})
