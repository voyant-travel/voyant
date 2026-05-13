export interface RemoteWorkspacePoolSlot {
  id: string
  lockKey: string
  provider: "sprite"
  slot: number
  sprite: string
  workspaceReference: string
}

export interface RemoteWorkspacePool {
  configured: boolean
  provider: "sprite"
  slots: RemoteWorkspacePoolSlot[]
}

export interface RemoteWorkspaceSlotLease {
  acquiredAt: string
  expiresAt: string
  holder: string
  key: string
  slot: RemoteWorkspacePoolSlot
}

type CoordinatorService = Pick<Fetcher, "fetch">

export function parseSpritePoolConfig(value: string | undefined): RemoteWorkspacePool {
  const slots: RemoteWorkspacePoolSlot[] = []
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  for (const entry of entries) {
    const [spriteName, rawCapacity] = entry.split(":")
    const sprite = spriteName?.trim()
    const capacity = parseCapacity(rawCapacity)
    if (!sprite || !isValidSpriteName(sprite)) continue

    for (let index = 1; index <= capacity; index += 1) {
      const id = capacity === 1 ? sprite : `${sprite}-slot-${index}`
      slots.push({
        id,
        lockKey: `remote-workspace:sprite:${id}`,
        provider: "sprite",
        slot: index,
        sprite,
        workspaceReference: `sandbox:sprite:${id}`,
      })
    }
  }

  return {
    configured: slots.length > 0,
    provider: "sprite",
    slots,
  }
}

export async function acquireRemoteWorkspaceSlot({
  coordinator,
  holder,
  pool,
  ttlSeconds,
}: {
  coordinator?: CoordinatorService
  holder: string
  pool?: RemoteWorkspacePool
  ttlSeconds: number
}): Promise<
  | { acquired: true; lease: RemoteWorkspaceSlotLease }
  | { acquired: false; reason: "coordinator_not_configured" | "pool_not_configured" | "pool_full" }
> {
  if (!pool?.configured || pool.slots.length === 0) {
    return { acquired: false, reason: "pool_not_configured" }
  }

  if (!coordinator) {
    return { acquired: false, reason: "coordinator_not_configured" }
  }

  for (const slot of pool.slots) {
    const response = await coordinator.fetch(
      jsonRequest("https://agent-runner-coordinator.internal/locks/acquire", {
        holder,
        key: slot.lockKey,
        ttlSeconds,
      }),
    )
    const body = await response.json().catch(() => null)

    if (response.status === 201 && body && typeof body === "object" && "lock" in body) {
      const lock = body.lock as Omit<RemoteWorkspaceSlotLease, "slot">
      return {
        acquired: true,
        lease: {
          acquiredAt: lock.acquiredAt,
          expiresAt: lock.expiresAt,
          holder: lock.holder,
          key: lock.key,
          slot,
        },
      }
    }
  }

  return { acquired: false, reason: "pool_full" }
}

export async function releaseRemoteWorkspaceSlot({
  coordinator,
  holder,
  lease,
}: {
  coordinator?: CoordinatorService
  holder: string
  lease?: RemoteWorkspaceSlotLease
}) {
  if (!coordinator || !lease) return { released: false, reason: "not_configured" as const }

  const response = await coordinator.fetch(
    jsonRequest("https://agent-runner-coordinator.internal/locks/release", {
      holder,
      key: lease.key,
    }),
  )
  const body = await response.json().catch(() => null)
  return {
    released: response.ok,
    response: body,
    status: response.status,
  }
}

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  })
}

function parseCapacity(value: string | undefined) {
  if (!value) return 1
  const capacity = Number(value.trim())
  return Number.isInteger(capacity) && capacity > 0 ? Math.min(capacity, 10) : 1
}

function isValidSpriteName(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
}
