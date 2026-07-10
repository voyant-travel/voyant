import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap declaration for storage-owned upload, serve, and video-ticket routes. */
export const storageVoyantModule = defineModule({
  id: "@voyant-travel/storage",
  packageName: "@voyant-travel/storage",
  localId: "storage",
  provides: {
    ports: [{ id: "storage.object" }],
  },
  api: [
    {
      id: "@voyant-travel/storage#api.admin.uploads",
      surface: "admin",
      mount: "uploads",
      runtime: {
        entry: "@voyant-travel/storage/routes",
        export: "createMediaHonoModule",
      },
    },
    {
      id: "@voyant-travel/storage#api.admin.video-upload-ticket",
      surface: "admin",
      mount: "uploads/video",
      runtime: {
        entry: "@voyant-travel/storage/routes",
        export: "createMediaHonoModule",
      },
    },
    {
      id: "@voyant-travel/storage#api.admin.media",
      surface: "admin",
      mount: "media",
      runtime: {
        entry: "@voyant-travel/storage/routes",
        export: "createMediaHonoModule",
      },
    },
  ],
  resources: [
    {
      id: "@voyant-travel/storage#resource.object-storage",
      kind: "object-storage",
      required: false,
    },
  ],
  providers: [
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
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default storageVoyantModule
