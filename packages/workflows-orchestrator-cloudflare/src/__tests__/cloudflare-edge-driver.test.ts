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

import { handleStepRequest } from "@voyantjs/workflows/handler"
import { runDriverComplianceSuite } from "@voyantjs/workflows-orchestrator/testing"

import { createCloudflareEdgeDriver } from "../cloudflare-edge-driver.js"
import {
  createDispatchStepHandler,
  createDurableObjectRunStore,
  type DispatchNamespaceLike,
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

function inProcessDispatcher(): DispatchNamespaceLike {
  return {
    get() {
      return {
        async fetch(req: Request): Promise<Response> {
          const body = await req.json()
          const out = await handleStepRequest(body)
          return new Response(JSON.stringify(out.body), {
            status: out.status,
            headers: { "content-type": "application/json" },
          })
        },
      }
    },
  }
}

function inProcessRunDONamespace(): DurableObjectNamespaceLike<string> {
  const storages = new Map<string, DurableObjectStorageLike>()
  const dispatcher = inProcessDispatcher()
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
      return {
        async fetch(req: Request): Promise<Response> {
          return handleDurableObjectRequest(req, {
            storage: storage!,
            resolveStepHandler: (tenantScript) =>
              createDispatchStepHandler(tenantScript, { dispatcher }),
          })
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
      tenantScript: "tenant-bundle-test",
    }),
  // servicesThreading: orchestrator + tenant are separate Worker isolates.
  // crossRunQueries:   self-host Mode 1 has no native query layer per §8.3.
  { servicesThreading: false, crossRunQueries: false },
)
