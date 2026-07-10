import { describe, expect, it } from "vitest"

import { createMediaHonoModule, STORAGE_MEDIA_ROUTE_PATHS } from "./routes.js"
import { storageVoyantModule } from "./voyant.js"

describe("storage deployment manifest", () => {
  it("owns only upload, serve, and video-ticket media routes", () => {
    expect(storageVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/storage",
      packageName: "@voyant-travel/storage",
      provides: { ports: [{ id: "storage.object" }] },
      resources: [
        {
          id: "@voyant-travel/storage#resource.object-storage",
          kind: "object-storage",
          required: false,
        },
      ],
      lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
    })
    expect(storageVoyantModule.api).toEqual(
      ["uploads", "uploads/video", "media"].map((mount) =>
        expect.objectContaining({
          surface: "admin",
          mount,
          runtime: {
            entry: "@voyant-travel/storage/routes",
            export: "createMediaHonoModule",
          },
        }),
      ),
    )

    const module = createMediaHonoModule({
      resolveStorage: () => null,
      signVideoUploadTicket: async () => null,
    })
    expect(module.module.name).toBe("media")
    expect(module.lazyRoutes.paths).toEqual(STORAGE_MEDIA_ROUTE_PATHS)
    expect(module.lazyRoutes.paths).not.toContain("/v1/admin/products/:id/brochure/generate")
  })

  it("declares only Node-usable local and S3 provider factories", () => {
    expect(storageVoyantModule.providers).toEqual([
      {
        id: "@voyant-travel/storage#provider.local",
        port: "storage.object",
        runtime: {
          entry: "@voyant-travel/storage/providers/local",
          export: "createLocalStorageProvider",
        },
      },
      {
        id: "@voyant-travel/storage#provider.s3",
        port: "storage.object",
        runtime: {
          entry: "@voyant-travel/storage/providers/s3",
          export: "createS3Provider",
        },
      },
    ])
  })
})
