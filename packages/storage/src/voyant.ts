import { defineModule, requirePort } from "@voyant-travel/core/project"
import { storageMediaRuntimePort } from "./runtime-port.js"

/** Import-cheap declaration for storage-owned upload, serve, and video-ticket routes. */
export const storageVoyantModule = defineModule({
  id: "@voyant-travel/storage",
  packageName: "@voyant-travel/storage",
  localId: "storage",
  provides: {
    ports: [{ id: "storage.object" }],
  },
  runtimePorts: [requirePort(storageMediaRuntimePort)],
  api: [
    {
      id: "@voyant-travel/storage#api.admin.uploads",
      surface: "admin",
      mount: "uploads",
      openapi: { document: "storage-uploads" },
      runtime: {
        entry: "@voyant-travel/storage/routes",
        export: "createStorageVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/storage#api.admin.video-upload-ticket",
      surface: "admin",
      mount: "uploads/video",
      openapi: { document: "storage-video-upload-ticket" },
      runtime: {
        entry: "@voyant-travel/storage/routes",
        export: "createStorageVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/storage#api.admin.media",
      surface: "admin",
      mount: "media",
      openapi: { document: "storage-media" },
      runtime: {
        entry: "@voyant-travel/storage/routes",
        export: "createStorageVoyantRuntime",
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
  access: {
    resources: [
      {
        id: "@voyant-travel/storage#access.media",
        resource: "media",
        actions: ["read", "write"],
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default storageVoyantModule
