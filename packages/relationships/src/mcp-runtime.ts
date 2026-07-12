import { defineToolContextContribution } from "@voyant-travel/tools"
import { relationshipsService } from "./service/index.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["relationships"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof relationshipsService.listPeople>[0]
    return {
      relationships: {
        listPeople: (query: Parameters<typeof relationshipsService.listPeople>[1]) =>
          relationshipsService.listPeople(db, query),
        getPersonById: (id: string) => relationshipsService.getPersonById(db, id),
        listOrganizations: (query: Parameters<typeof relationshipsService.listOrganizations>[1]) =>
          relationshipsService.listOrganizations(db, query),
        getOrganizationById: (id: string) => relationshipsService.getOrganizationById(db, id),
      },
    }
  },
})
