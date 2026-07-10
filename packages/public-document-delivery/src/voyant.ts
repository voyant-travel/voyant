import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap declaration for the anonymous public document delivery surface. */
export const publicDocumentDeliveryVoyantModule = defineModule({
  id: "@voyant-travel/public-document-delivery",
  packageName: "@voyant-travel/public-document-delivery",
  localId: "public-document-delivery",
  requires: {
    ports: [{ id: "database.client" }, { id: "storage.object" }],
  },
  api: [
    {
      id: "@voyant-travel/public-document-delivery#api.public",
      surface: "public",
      mount: "documents",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/public-document-delivery",
        export: "createPublicDocumentDeliveryHonoModule",
      },
    },
  ],
  resources: [
    {
      id: "@voyant-travel/public-document-delivery#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
    {
      id: "@voyant-travel/public-document-delivery#resource.documents",
      kind: "object-storage",
      required: true,
      config: { access: "private" },
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default publicDocumentDeliveryVoyantModule
