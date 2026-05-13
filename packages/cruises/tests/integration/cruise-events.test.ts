import { createEventBus } from "@voyantjs/core"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  CRUISE_CREATED_EVENT,
  CRUISE_DELETED_EVENT,
  CRUISE_UPDATED_EVENT,
  type CruiseLifecycleEvent,
} from "../../src/events.js"
import { cruisesService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("cruise lifecycle events", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle test client
  let db: any

  beforeAll(() => {
    db = createTestDb()
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  function recordingBus() {
    const bus = createEventBus()
    const events: Array<{ event: string; data: CruiseLifecycleEvent }> = []
    for (const event of [CRUISE_CREATED_EVENT, CRUISE_UPDATED_EVENT, CRUISE_DELETED_EVENT]) {
      bus.subscribe<CruiseLifecycleEvent>(event, ({ name, data }) => {
        events.push({ event: name, data })
      })
    }
    return { bus, events }
  }

  async function createCruise(slug = "event-test-cruise") {
    return cruisesService.createCruise(db, {
      slug,
      name: "Event Test Cruise",
      cruiseType: "ocean",
      nights: 7,
      status: "draft",
      highlights: [],
      regions: [],
      themes: [],
      externalRefs: {},
    })
  }

  it("createCruise emits cruise.created with the cruise id", async () => {
    const { bus, events } = recordingBus()

    const created = await cruisesService.createCruise(
      db,
      {
        slug: "created-event-cruise",
        name: "Created Event Cruise",
        cruiseType: "ocean",
        nights: 7,
        status: "draft",
        highlights: [],
        regions: [],
        themes: [],
        externalRefs: {},
      },
      { eventBus: bus },
    )

    expect(events).toEqual([{ event: CRUISE_CREATED_EVENT, data: { id: created.id } }])
  })

  it("updateCruise emits cruise.updated after a successful update", async () => {
    const cruise = await createCruise("updated-event-cruise")
    const { bus, events } = recordingBus()

    const updated = await cruisesService.updateCruise(
      db,
      cruise.id,
      { name: "Updated Event Cruise" },
      { eventBus: bus },
    )

    expect(updated?.name).toBe("Updated Event Cruise")
    expect(events).toEqual([{ event: CRUISE_UPDATED_EVENT, data: { id: cruise.id } }])
  })

  it("archiveCruise emits cruise.deleted with the cruise id", async () => {
    const cruise = await createCruise("deleted-event-cruise")
    const { bus, events } = recordingBus()

    const archived = await cruisesService.archiveCruise(db, cruise.id, { eventBus: bus })

    expect(archived?.status).toBe("archived")
    expect(events).toEqual([{ event: CRUISE_DELETED_EVENT, data: { id: cruise.id } }])
  })

  it("does not emit when an update/delete mutation finds no row", async () => {
    const { bus, events } = recordingBus()

    const updated = await cruisesService.updateCruise(
      db,
      "cru_missing",
      { name: "Missing" },
      { eventBus: bus },
    )
    const archived = await cruisesService.archiveCruise(db, "cru_missing", { eventBus: bus })

    expect(updated).toBeNull()
    expect(archived).toBeNull()
    expect(events).toHaveLength(0)
  })
})
