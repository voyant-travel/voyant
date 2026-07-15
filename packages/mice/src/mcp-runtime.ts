import { defineToolContextContribution } from "@voyant-travel/tools"

import { miceService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["mice"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof miceService.listPrograms>[0]
    return {
      mice: {
        listPrograms: (query: Parameters<typeof miceService.listPrograms>[1]) =>
          miceService.listPrograms(db, query),
        getProgram: (id: string) => miceService.getProgram(db, id),
        createProgram: (input: Parameters<typeof miceService.createProgram>[1]) =>
          miceService.createProgram(db, input),
        updateProgram: ({
          id,
          ...input
        }: Parameters<import("./tools.js").MiceToolServices["updateProgram"]>[0]) =>
          miceService.updateProgram(db, id, input),
      },
    }
  },
})
