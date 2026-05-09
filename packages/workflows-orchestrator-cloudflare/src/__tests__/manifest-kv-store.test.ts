import { describe, expect, test } from "vitest"

import { createInMemoryKv, createKvManifestStore } from "../manifest-kv-store.js"

function makeManifest(versionId: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    versionId,
    workflows: [],
    eventFilters: [],
  }
}

describe("createKvManifestStore", () => {
  test("registerManifest then getCurrent round-trips", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    await store.registerManifest({
      environment: "production",
      versionId: "v_abc",
      manifest: makeManifest("v_abc"),
    })
    const got = await store.getCurrent("production")
    expect(got).toEqual({
      environment: "production",
      versionId: "v_abc",
      manifest: makeManifest("v_abc"),
    })
  })

  test("getCurrent returns null when no manifest registered", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    expect(await store.getCurrent("preview")).toBeNull()
  })

  test("registering a new versionId switches the current pointer", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    await store.registerManifest({
      environment: "production",
      versionId: "v_1",
      manifest: makeManifest("v_1"),
    })
    await store.registerManifest({
      environment: "production",
      versionId: "v_2",
      manifest: makeManifest("v_2"),
    })

    const current = await store.getCurrent("production")
    expect(current?.versionId).toBe("v_2")
  })

  test("environments are isolated", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    await store.registerManifest({
      environment: "production",
      versionId: "v_prod",
      manifest: makeManifest("v_prod"),
    })
    await store.registerManifest({
      environment: "preview",
      versionId: "v_prev",
      manifest: makeManifest("v_prev"),
    })

    expect((await store.getCurrent("production"))?.versionId).toBe("v_prod")
    expect((await store.getCurrent("preview"))?.versionId).toBe("v_prev")
  })

  test("registerManifest is idempotent for the same body", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    const a = await store.registerManifest({
      environment: "production",
      versionId: "v_x",
      manifest: makeManifest("v_x"),
    })
    const b = await store.registerManifest({
      environment: "production",
      versionId: "v_x",
      manifest: makeManifest("v_x"),
    })
    expect(b.versionId).toBe(a.versionId)
  })

  test("pruneToVersions retains the current + N-1 most-recent", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    // Note KV list is lexicographic, so use sortable versionIds.
    const ids = ["v_001", "v_002", "v_003", "v_004", "v_005"]
    for (const id of ids) {
      await store.registerManifest({
        environment: "production",
        versionId: id,
        manifest: makeManifest(id),
      })
    }
    // After all registers, current is v_005.
    const before = await store.getCurrent("production")
    expect(before?.versionId).toBe("v_005")

    const result = await store.pruneToVersions("production", 3)
    // Kept: current (v_005) + 2 more newest (v_004, v_003) = 3 versions; deleted v_001, v_002.
    expect(result.deleted).toBe(2)

    // Verify retained versions still exist via direct fetch.
    const v3 = await kv.get("manifest:production:v_003")
    const v4 = await kv.get("manifest:production:v_004")
    const v5 = await kv.get("manifest:production:v_005")
    const v1 = await kv.get("manifest:production:v_001")
    const v2 = await kv.get("manifest:production:v_002")
    expect(v3).toBeTruthy()
    expect(v4).toBeTruthy()
    expect(v5).toBeTruthy()
    expect(v1).toBeNull()
    expect(v2).toBeNull()
  })

  test("pruneToVersions with keep=1 retains only current", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    await store.registerManifest({
      environment: "production",
      versionId: "v_a",
      manifest: makeManifest("v_a"),
    })
    await store.registerManifest({
      environment: "production",
      versionId: "v_b",
      manifest: makeManifest("v_b"),
    })

    const result = await store.pruneToVersions("production", 1)
    expect(result.deleted).toBe(1) // v_a deleted, v_b retained as current
    const remaining = await store.getCurrent("production")
    expect(remaining?.versionId).toBe("v_b")
  })

  test("pruneToVersions throws on keep < 1", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    await expect(store.pruneToVersions("production", 0)).rejects.toThrow()
  })

  test("getCurrent tolerates a missing version body (current pointer dangles)", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    await kv.put("manifest:production:current", "v_dangling")
    expect(await store.getCurrent("production")).toBeNull()
  })

  test("getCurrent tolerates corrupt JSON", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    await kv.put("manifest:production:current", "v_bad")
    await kv.put("manifest:production:v_bad", "{ not: json")
    expect(await store.getCurrent("production")).toBeNull()
  })
})
