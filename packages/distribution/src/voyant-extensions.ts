import { defineExtension } from "@voyant-travel/core/project"

export const distributionBookingVoyantPlugin = defineExtension({
  id: "@voyant-travel/distribution#extension",
  packageName: "@voyant-travel/distribution",
  localId: "distribution",
  api: [
    {
      id: "@voyant-travel/distribution#extension.api",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "distribution-booking" },
      runtime: {
        entry: "@voyant-travel/distribution",
        export: "distributionBookingExtension",
      },
    },
  ],
  meta: { ownership: "package" },
})
