import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap declaration for the anonymous public document delivery surface. */
export const publicDocumentDeliveryVoyantModule = defineModule({
  id: "@voyant-travel/public-document-delivery",
  packageName: "@voyant-travel/public-document-delivery",
  localId: "public-document-delivery",
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
  meta: {
    ownership: "package",
  },
})

export default publicDocumentDeliveryVoyantModule
