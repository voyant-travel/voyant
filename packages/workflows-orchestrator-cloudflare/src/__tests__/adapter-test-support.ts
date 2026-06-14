import { __resetRegistry } from "@voyant-travel/workflows"
import { handleStepRequest } from "@voyant-travel/workflows/handler"
import { beforeEach } from "vitest"
import {
  createServiceBindingDispatcher,
  type DurableObjectNamespaceLike,
  type DurableObjectStorageLike,
  handleDurableObjectRequest,
  type ServiceBindingLike,
} from "../index.js"

export interface AlarmTrackingStorage extends DurableObjectStorageLike {
  _alarm: number | null
  _alarmCalls: number
  _deleteAlarmCalls: number
}

export function makeStorage(): AlarmTrackingStorage {
  const map = new Map<string, unknown>()
  const s: AlarmTrackingStorage = {
    _alarm: null,
    _alarmCalls: 0,
    _deleteAlarmCalls: 0,
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
      return s._alarm
    },
    async setAlarm(wakeAt) {
      s._alarm = wakeAt
      s._alarmCalls += 1
    },
    async deleteAlarm() {
      s._alarm = null
      s._deleteAlarmCalls += 1
    },
  }
  return s
}

export function inProcessBinding(): ServiceBindingLike {
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
}

export function inProcessRunDONamespace(): DurableObjectNamespaceLike<string> & {
  _storages: Map<string, DurableObjectStorageLike>
} {
  const storages = new Map<string, DurableObjectStorageLike>()
  const binding = inProcessBinding()
  return {
    _storages: storages,
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
            dispatcher: createServiceBindingDispatcher({ binding }),
          })
        },
      }
    },
  }
}

export const tenantMeta = {
  tenantId: "tnt_t",
  projectId: "prj_t",
  organizationId: "org_t",
  tenantScript: "tenant-worker-a",
}

beforeEach(() => {
  __resetRegistry()
})
