import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the accommodations package. */
export const accommodationsVoyantModule = defineModule({
  id: "@voyant-travel/accommodations",
  packageName: "@voyant-travel/accommodations",
  localId: "accommodations",
  api: [
    {
      id: "@voyant-travel/accommodations#api",
      surface: "admin",
      mount: "@voyant-travel/accommodations",
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
  meta: {
    ownership: "package",
  },
})

export default accommodationsVoyantModule
