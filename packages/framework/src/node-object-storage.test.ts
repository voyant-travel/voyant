import type { StorageProviderResolver } from "@voyant-travel/storage/types"
import { describe, expect, it } from "vitest"

import { createVoyantNodeStorageResolver } from "./node-object-storage.js"

describe("createVoyantNodeStorageResolver", () => {
  it("creates isolated logical memory stores", async () => {
    const resolver = createVoyantNodeStorageResolver({
      plan: { storage: "memory" },
      env: {
        S3_ACCESS_KEY_ID: "ignored",
        S3_SECRET_ACCESS_KEY: "ignored",
      },
    })
    const media = resolver.resolve("media")
    const documents = resolver.resolve("documents")
    expect(media?.name).toBe("memory:media")
    expect(documents?.name).toBe("memory:documents")

    await media?.upload(new Uint8Array([1]), { key: "same-key" })
    expect(await documents?.get("same-key")).toBeNull()
    await expect(media?.upload(new Uint8Array([2]), { key: "folder/image.png" })).resolves.toEqual({
      key: "folder/image.png",
      url: "http://localhost:3300/api/v1/admin/media/folder/image.png",
    })
  })

  it("uses only an explicitly selected custom resolver", () => {
    const custom: StorageProviderResolver = { resolve: () => null }
    expect(
      createVoyantNodeStorageResolver({
        plan: { storage: "custom" },
        env: {},
        custom,
      }),
    ).toBe(custom)
  })

  it("fails when custom storage is selected but not supplied", () => {
    expect(() => createVoyantNodeStorageResolver({ plan: { storage: "custom" }, env: {} })).toThrow(
      /requires a selected storage.object provider/,
    )
  })

  it("validates selected S3-compatible configuration", () => {
    expect(() =>
      createVoyantNodeStorageResolver({ plan: { storage: "s3-compatible" }, env: {} }),
    ).toThrow(/S3_REGION/)
  })
})
