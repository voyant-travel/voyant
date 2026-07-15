import { defineToolContextContribution } from "@voyant-travel/tools"

import { externalRefsService } from "./external-refs/service.js"
import { distributionService } from "./service.js"
import { suppliersService } from "./suppliers/service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["distribution"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof suppliersService.listSuppliers>[0]
    return {
      distribution: {
        listSuppliers: (query: Parameters<typeof suppliersService.listSuppliers>[1]) =>
          suppliersService.listSuppliers(db, query),
        getSupplierById: (id: string) => suppliersService.getSupplierById(db, id),
        getSupplierAggregates: (
          query: Parameters<typeof suppliersService.getSupplierAggregates>[1],
        ) => suppliersService.getSupplierAggregates(db, query),
        createSupplier: (input: Parameters<typeof suppliersService.createSupplier>[1]) =>
          suppliersService.createSupplier(db, input),
        updateSupplier: ({
          id,
          ...input
        }: Parameters<import("./tools.js").DistributionToolServices["updateSupplier"]>[0]) =>
          suppliersService.updateSupplier(db, id, input),
        listChannels: (query: Parameters<typeof distributionService.listChannels>[1]) =>
          distributionService.listChannels(db, query),
        getChannelById: (id: string) => distributionService.getChannelById(db, id),
        createChannel: (input: Parameters<typeof distributionService.createChannel>[1]) =>
          distributionService.createChannel(db, input),
        updateChannel: ({
          id,
          ...input
        }: Parameters<import("./tools.js").DistributionToolServices["updateChannel"]>[0]) =>
          distributionService.updateChannel(db, id, input),
        listExternalRefs: (query: Parameters<typeof externalRefsService.listExternalRefs>[1]) =>
          externalRefsService.listExternalRefs(db, query),
        getExternalRefById: (id: string) => externalRefsService.getExternalRefById(db, id),
        createExternalRef: (input: Parameters<typeof externalRefsService.createExternalRef>[1]) =>
          externalRefsService.createExternalRef(db, input),
        updateExternalRef: ({
          id,
          ...input
        }: Parameters<import("./tools.js").DistributionToolServices["updateExternalRef"]>[0]) =>
          externalRefsService.updateExternalRef(db, id, input),
      },
    }
  },
})
