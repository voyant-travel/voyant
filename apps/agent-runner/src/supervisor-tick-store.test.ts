import { describe, expect, it } from "vitest"

import {
  createR2SupervisorTickStore,
  type SupervisorTickBucket,
  type SupervisorTickRecord,
} from "./supervisor-tick-store.js"

describe("supervisor tick storage", () => {
  it("stores latest and recent supervisor ticks in R2-compatible object storage", async () => {
    const objects = new Map<string, string>()
    const store = createR2SupervisorTickStore({
      bucket: {
        async get(key: string) {
          const text = objects.get(key)
          return text ? { text: async () => text } : null
        },
        async list({ prefix }: { prefix?: string } = {}) {
          return {
            objects: Array.from(objects.keys())
              .filter((key) => !prefix || key.startsWith(prefix))
              .sort()
              .map((key) => ({ key })),
          }
        },
        async put(key: string, value: string) {
          objects.set(key, String(value))
          return null
        },
      } satisfies SupervisorTickBucket,
      keyPrefix: "/runner/",
    })
    const record: SupervisorTickRecord = {
      recordedAt: "2026-05-12T12:00:00.000Z",
      repository: "voyantjs/voyant",
      result: {
        leased: false,
        reason: "dry_run",
      },
    }

    await expect(store.putLatest(record)).resolves.toMatchObject({
      historyKey:
        "runner/supervisor-ticks/history/voyantjs%2Fvoyant/9005420667540991-2026-05-12T12%3A00%3A00.000Z.json",
      key: "runner/supervisor-ticks/latest/voyantjs%2Fvoyant.json",
    })
    await expect(store.getLatest("VoyantJS/Voyant")).resolves.toEqual(record)
    await expect(store.listRecent("VoyantJS/Voyant")).resolves.toEqual([record])
  })
})
