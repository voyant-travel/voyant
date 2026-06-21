import type { ChannelPushDeps } from "@voyant-travel/distribution"
import {
  processAvailabilityPushIntents,
  processContentPushIntents,
} from "@voyant-travel/distribution"
import { describe, expect, it, vi } from "vitest"

function createEmptyIntentDb(): { db: ChannelPushDeps["db"]; limit: ReturnType<typeof vi.fn> } {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(async () => []),
  }

  return {
    db: {
      select: vi.fn(() => query),
    } as ChannelPushDeps["db"],
    limit: query.limit,
  }
}

function createDeps(db: ChannelPushDeps["db"]): ChannelPushDeps {
  return {
    db,
    registry: {
      resolveByConnection: vi.fn(),
    } as ChannelPushDeps["registry"],
  }
}

describe("channel-push scheduled input handling", () => {
  it("drains availability push intents with null workflow input", async () => {
    const { db, limit } = createEmptyIntentDb()

    await expect(processAvailabilityPushIntents(null, createDeps(db))).resolves.toEqual({
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    })
    expect(limit).toHaveBeenCalledWith(100)
  })

  it("drains content push intents with null workflow input", async () => {
    const { db, limit } = createEmptyIntentDb()

    await expect(processContentPushIntents(null, createDeps(db))).resolves.toEqual({
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    })
    expect(limit).toHaveBeenCalledWith(100)
  })
})
