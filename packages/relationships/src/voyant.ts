import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the relationships package. */
export const relationshipsVoyantModule = defineModule({
  id: "@voyant-travel/relationships",
  packageName: "@voyant-travel/relationships",
  localId: "relationships",
  api: [
    {
      id: "@voyant-travel/relationships#api.admin",
      surface: "admin",
      mount: "relationships",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/relationships",
        export: "createRelationshipsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/relationships#schema",
      source: "@voyant-travel/relationships/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/relationships#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/relationships#linkable.organization",
      source: "@voyant-travel/relationships/linkables",
    },
    {
      id: "@voyant-travel/relationships#linkable.person",
      source: "@voyant-travel/relationships/linkables",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default relationshipsVoyantModule
