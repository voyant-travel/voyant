import { defineExtension, defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the accommodations package. */
export const accommodationsVoyantModule = defineModule({
  id: "@voyant-travel/accommodations",
  packageName: "@voyant-travel/accommodations",
  localId: "accommodations",
  api: [
    {
      id: "@voyant-travel/accommodations#api",
      surface: "admin",
      mount: "accommodations",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/accommodations",
        export: "accommodationsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/accommodations#schema",
      source: "@voyant-travel/accommodations/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/accommodations#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/accommodations#linkable.roomBlock",
      source: "@voyant-travel/accommodations/linkables",
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const accommodationsContentVoyantPlugin = defineExtension({
  id: "@voyant-travel/accommodations#content-extension",
  packageName: "@voyant-travel/accommodations",
  localId: "accommodations.content-extension",
  api: [
    {
      id: "@voyant-travel/accommodations#content-extension.api.admin",
      surface: "admin",
      mount: "accommodations",
      runtime: {
        entry: "@voyant-travel/accommodations/routes-content",
        export: "createAccommodationContentHonoExtension",
      },
    },
    {
      id: "@voyant-travel/accommodations#content-extension.api.public",
      surface: "public",
      mount: "accommodations",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/accommodations/routes-content",
        export: "createAccommodationContentHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default accommodationsVoyantModule
