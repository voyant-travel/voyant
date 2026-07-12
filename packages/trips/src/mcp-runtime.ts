import { defineToolContextContribution, requireService } from "@voyant-travel/tools"
import type { Context } from "hono"
import type { TripsRoutesOptions } from "./routes.js"
import { tripsRoutesRuntimePort } from "./runtime-port.js"
import { tripsService } from "./service.js"
import type { TripsToolServices } from "./tools.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["trips"],
  async contribute({ request, resources }) {
    const c = request as Context
    const provider = await Promise.resolve(
      requireService(
        resources[tripsRoutesRuntimePort.id] as
          | (() => TripsRoutesOptions | Promise<TripsRoutesOptions>)
          | undefined,
        tripsRoutesRuntimePort.id,
      ),
    )
    const options = await provider()
    const trips: TripsToolServices = {
      createTrip: (input) => tripsService.createTrip(c.var.db, input),
      addComponent: (input) => tripsService.addComponent(c.var.db, input),
      removeComponent: (id) => tripsService.removeComponent(c.var.db, id),
      priceTrip: async (input) => {
        const deps = await resolveDeps(c, options.priceTripDeps)
        if (!deps) throw new Error("Trips price dependencies are not configured")
        return tripsService.priceTrip(c.var.db, input, deps)
      },
      reserveTrip: async (input) => {
        const deps = await resolveDeps(c, options.reserveTripDeps)
        if (!deps) throw new Error("Trips reserve dependencies are not configured")
        return tripsService.reserveTrip(c.var.db, input, deps)
      },
    }
    return { trips }
  },
})

function resolveDeps<T>(
  c: Context,
  deps: T | ((c: Context) => T | Promise<T | undefined> | undefined) | undefined,
) {
  if (typeof deps !== "function") return deps
  return (deps as (c: Context) => T | Promise<T | undefined> | undefined)(c)
}
