import { defineToolContextContribution } from "@voyant-travel/tools"

import { identityService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["identity"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof identityService.listContactPoints>[0]
    return {
      identity: {
        listContactPoints: (query: Parameters<typeof identityService.listContactPoints>[1]) =>
          identityService.listContactPoints(db, query),
        getContactPointById: (id: string) => identityService.getContactPointById(db, id),
        createContactPoint: (input: Parameters<typeof identityService.createContactPoint>[1]) =>
          identityService.createContactPoint(db, input),
        updateContactPoint: ({
          id,
          ...input
        }: Parameters<import("./tools.js").IdentityToolServices["updateContactPoint"]>[0]) =>
          identityService.updateContactPoint(db, id, input),
        listAddresses: (query: Parameters<typeof identityService.listAddresses>[1]) =>
          identityService.listAddresses(db, query),
        getAddressById: (id: string) => identityService.getAddressById(db, id),
        createAddress: (input: Parameters<typeof identityService.createAddress>[1]) =>
          identityService.createAddress(db, input),
        updateAddress: ({
          id,
          ...input
        }: Parameters<import("./tools.js").IdentityToolServices["updateAddress"]>[0]) =>
          identityService.updateAddress(db, id, input),
        listNamedContacts: (query: Parameters<typeof identityService.listNamedContacts>[1]) =>
          identityService.listNamedContacts(db, query),
        getNamedContactById: (id: string) => identityService.getNamedContactById(db, id),
        createNamedContact: (input: Parameters<typeof identityService.createNamedContact>[1]) =>
          identityService.createNamedContact(db, input),
        updateNamedContact: ({
          id,
          ...input
        }: Parameters<import("./tools.js").IdentityToolServices["updateNamedContact"]>[0]) =>
          identityService.updateNamedContact(db, id, input),
      },
    }
  },
})
