import {
  type CatalogContentRuntime,
  catalogContentRuntimePort,
} from "@voyant-travel/catalog/runtime-port"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { defineToolContextContribution, ToolError } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { getAccommodationContent } from "./service-content.js"
import { eachStayNight, quoteOwnedStay, searchOwnedStays } from "./service-owned-stays.js"
import {
  createRoomBlock,
  getRoomBlock,
  pickupRoomBlock,
  reverseRoomBlockPickup,
  setRoomBlockNights,
  summarizeRoomBlock,
} from "./service-room-blocks.js"
import type { AccommodationsToolServices } from "./tools.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["accommodations"],
  async contribute({ request, context, resources }) {
    const db = context.db as AnyDrizzleDb
    const transactionalDb = context.db as PostgresJsDatabase
    const contentRuntime = await optionalContentRuntime(resources[catalogContentRuntimePort.id])
    return {
      accommodations: {
        async searchOwned(
          input: Parameters<AccommodationsToolServices["searchOwned"]>[0],
        ) {
          const { currency, limit, cursor, ...criteria } = input
          const nights = eachStayNight(input.checkIn, input.checkOut)
          if (nights.length === 0) {
            throw new ToolError("checkOut must be after checkIn.", "INVALID_INPUT")
          }
          const result = await searchOwnedStays(db, {
            criteria,
            nights: nights.length,
            scope: {
              locale: context.resolverScope.locale,
              audience: context.audience,
              market: context.resolverScope.market,
              currency,
            },
            limit,
            cursor,
          })
          return {
            ...result,
            matches: result.matches.map(({ providerData: _providerData, ...match }) => match),
          }
        },
        async quoteOwned(input: Parameters<typeof quoteOwnedStay>[1]) {
          const result = await quoteOwnedStay(db, input)
          if (result.status !== "ok") return result
          return {
            ...result,
            nightlyRates: result.nightlyRates.map(
              ({ costCurrency: _costCurrency, costAmountCents: _costAmountCents, ...rate }) => rate,
            ),
          }
        },
        async getContent(input: {
          id: string
          preferredLocales?: string[]
          market?: string
          currency?: string
          acceptMachineTranslated: boolean
        }) {
          if (!contentRuntime) {
            throw new ToolError(
              "Accommodation content requires the selected catalog.content-runtime port.",
              "MISSING_SERVICE",
              { service: catalogContentRuntimePort.id },
            )
          }
          const registry = contentRuntime.resolveRegistry(request as Context)
          const result = await getAccommodationContent(
            db,
            input.id,
            {
              preferredLocales: input.preferredLocales ?? [context.resolverScope.locale],
              market: input.market ?? context.resolverScope.market,
              currency: input.currency,
              acceptMachineTranslated: input.acceptMachineTranslated,
            },
            { registry },
          )
          if (!result) return null
          return {
            content: result.content,
            provenance: result.provenance,
            servedLocale: result.resolution.served_locale,
            matchKind: result.resolution.match_kind,
            source: result.source,
            servedStale: result.served_stale,
            synthesized: result.synthesized,
            machineTranslated: result.machine_translated,
          }
        },
        async getRoomBlock(blockId: string) {
          const block = await getRoomBlock(transactionalDb, blockId)
          if (!block) return null
          return { block, summary: await summarizeRoomBlock(transactionalDb, blockId) }
        },
        createRoomBlock: (input: Parameters<typeof createRoomBlock>[1]) =>
          createRoomBlock(transactionalDb, input),
        async setRoomBlockNights(input: {
          blockId: string
          nights: Parameters<typeof setRoomBlockNights>[2]
        }) {
          if (!(await getRoomBlock(transactionalDb, input.blockId))) return null
          await setRoomBlockNights(transactionalDb, input.blockId, input.nights)
          return summarizeRoomBlock(transactionalDb, input.blockId)
        },
        pickupRoomBlock: (input: Parameters<typeof pickupRoomBlock>[1]) =>
          pickupRoomBlock(transactionalDb, input),
        reverseRoomBlockPickup: (input: Parameters<typeof reverseRoomBlockPickup>[1]) =>
          reverseRoomBlockPickup(transactionalDb, input),
      },
    }
  },
})

async function optionalContentRuntime(value: unknown): Promise<CatalogContentRuntime | undefined> {
  const resolved = await Promise.resolve(value)
  if (resolved === undefined) return undefined
  await catalogContentRuntimePort.test(resolved as CatalogContentRuntime)
  return resolved as CatalogContentRuntime
}
