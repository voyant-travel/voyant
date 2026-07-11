import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"

import {
  CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY,
  catalogProjectionRuntimePort,
  createEnsureCatalogCollectionsSerializer,
  parseCatalogProjectionTarget,
} from "./projection-runtime.js"

describe("Catalog projection subscriber runtime contract", () => {
  it("publishes a stable container key and validates event-derived targets", () => {
    expect(CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY).toBe("runtime.catalog.projection")
    expect(
      parseCatalogProjectionTarget({ entityModule: " products ", entityId: " product_123 " }),
    ).toEqual({ entityModule: "products", entityId: "product_123" })

    expect(() => parseCatalogProjectionTarget({ entityModule: "products", entityId: "" })).toThrow()
    expect(() =>
      parseCatalogProjectionTarget({
        entityModule: "products",
        entityId: "product_123",
        untrusted: true,
      }),
    ).toThrow()
  })

  it("ships a conformance kit for injected projection runtimes", async () => {
    await expect(
      assertPortConforms(catalogProjectionRuntimePort, {
        reindexEntity: async () => undefined,
        deleteEntity: async () => undefined,
      }),
    ).resolves.toBeUndefined()
    await expect(assertPortConforms(catalogProjectionRuntimePort, {} as never)).rejects.toThrow(
      /reindexEntity/,
    )
  })

  it("serializes collection setup and continues after a rejected attempt", async () => {
    const serialize = createEnsureCatalogCollectionsSerializer()
    const order: string[] = []
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = serialize(async () => {
      order.push("first:start")
      await firstGate
      order.push("first:end")
    })
    const second = serialize(async () => {
      order.push("second")
      throw new Error("schema update failed")
    })
    const third = serialize(async () => {
      order.push("third")
    })

    await vi.waitFor(() => expect(order).toEqual(["first:start"]))
    releaseFirst?.()

    await first
    await expect(second).rejects.toThrow("schema update failed")
    await third
    expect(order).toEqual(["first:start", "first:end", "second", "third"])
  })
})
