import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the operations package. */
export const operationsVoyantModule = defineModule({
  id: "@voyant-travel/operations",
  packageName: "@voyant-travel/operations",
  localId: "operations",
  api: [
    {
      id: "@voyant-travel/operations#api.admin",
      surface: "admin",
      mount: "operations",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/operations",
        export: "operationsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/operations#schema",
      source: "@voyant-travel/operations/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/operations#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/operations#linkable.departure",
      source: "@voyant-travel/operations/availability",
    },
    {
      id: "@voyant-travel/operations#linkable.facility",
      source: "@voyant-travel/operations/places/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.functionSpace",
      source: "@voyant-travel/operations/places/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.property",
      source: "@voyant-travel/operations/places/linkables",
    },
    {
      id: "@voyant-travel/operations#linkable.spaceBlock",
      source: "@voyant-travel/operations/places/linkables",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default operationsVoyantModule
