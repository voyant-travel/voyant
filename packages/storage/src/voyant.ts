import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap declaration for storage-owned upload, serve, and video-ticket routes. */
export const storageVoyantModule = defineModule({
  id: "@voyant-travel/storage",
  packageName: "@voyant-travel/storage",
  localId: "storage",
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
  meta: {
    ownership: "package",
  },
})

export default storageVoyantModule
