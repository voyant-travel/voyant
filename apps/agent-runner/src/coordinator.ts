import { z } from "zod"

const acquireLockSchema = z
  .object({
    holder: z.string().trim().min(1),
    key: z.string().trim().min(1),
    ttlSeconds: z.number().int().min(1).max(3600).default(900),
  })
  .strict()

const releaseLockSchema = z
  .object({
    holder: z.string().trim().min(1),
    key: z.string().trim().min(1),
  })
  .strict()

interface StoredLock {
  acquiredAt: string
  expiresAt: string
  holder: string
  key: string
}

interface CoordinatorState {
  storage: {
    delete(key: string): Promise<void>
    get<T>(key: string): Promise<T | undefined>
    put(key: string, value: unknown): Promise<void>
  }
}

export class AgentRunnerCoordinator {
  constructor(private readonly state: CoordinatorState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "agent-runner-coordinator" })
    }

    if (request.method === "POST" && url.pathname === "/locks/acquire") {
      return await this.acquire(request)
    }

    if (request.method === "POST" && url.pathname === "/locks/release") {
      return await this.release(request)
    }

    const lockKey = url.pathname.match(/^\/locks\/(.+)$/)?.[1]
    if (request.method === "GET" && lockKey) {
      return await this.inspect(decodeURIComponent(lockKey))
    }

    return json({ error: "not_found" }, 404)
  }

  private async acquire(request: Request) {
    const parsed = acquireLockSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return json({ error: "invalid_lock_request", issues: validationIssues(parsed.error) }, 400)
    }

    const now = new Date()
    const existing = await this.state.storage.get<StoredLock>(lockStorageKey(parsed.data.key))
    if (existing && new Date(existing.expiresAt).getTime() > now.getTime()) {
      return json({ acquired: false, lock: existing, reason: "lock_held" }, 409)
    }

    const lock: StoredLock = {
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + parsed.data.ttlSeconds * 1000).toISOString(),
      holder: parsed.data.holder,
      key: parsed.data.key,
    }
    await this.state.storage.put(lockStorageKey(lock.key), lock)

    return json({ acquired: true, lock }, 201)
  }

  private async release(request: Request) {
    const parsed = releaseLockSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return json({ error: "invalid_lock_request", issues: validationIssues(parsed.error) }, 400)
    }

    const storageKey = lockStorageKey(parsed.data.key)
    const existing = await this.state.storage.get<StoredLock>(storageKey)
    if (!existing) {
      return json({ released: false, reason: "lock_not_found" }, 404)
    }

    if (existing.holder !== parsed.data.holder) {
      return json({ released: false, lock: existing, reason: "holder_mismatch" }, 409)
    }

    await this.state.storage.delete(storageKey)
    return json({ released: true })
  }

  private async inspect(key: string) {
    const lock = await this.state.storage.get<StoredLock>(lockStorageKey(key))
    if (!lock) {
      return json({ lock: null })
    }

    const expired = new Date(lock.expiresAt).getTime() <= Date.now()
    return json({ expired, lock })
  }
}

function lockStorageKey(key: string) {
  return `lock:${key.trim().toLowerCase()}`
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json",
    },
    status,
  })
}

function validationIssues(error: { issues: Array<{ path: Array<PropertyKey>; message: string }> }) {
  return error.issues.map((issue) => ({
    message: issue.message,
    path: issue.path.join("."),
  }))
}
