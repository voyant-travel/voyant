import type { Module } from "@voyantjs/core"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { HonoModule } from "@voyantjs/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { contractsLinkable } from "./contracts/index.js"
import {
  buildContractsRouteRuntime,
  CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY,
} from "./contracts/route-runtime.js"
import {
  type ContractsRouteOptions,
  createContractsAdminRoutes,
  createContractsPublicRoutes,
} from "./contracts/routes.js"
import {
  type AutoGenerateContractOptions,
  autoGenerateContractForBooking,
} from "./contracts/service-auto-generate.js"
import { policiesLinkable } from "./policies/index.js"
import { policiesAdminRoutes, policiesPublicRoutes } from "./policies/routes.js"

export const legalLinkable = {
  ...contractsLinkable,
  ...policiesLinkable,
}

export const legalModule: Module = {
  name: "legal",
  linkable: legalLinkable,
}

export interface CreateLegalHonoModuleOptions extends ContractsRouteOptions {
  /**
   * Required when `autoGenerateContractOnConfirmed.enabled` is true. The
   * `booking.confirmed` subscriber fires outside request scope, so it
   * needs its own db handle from runtime bindings. Returns `AnyDrizzleDb`
   * (the `PostgresJsDatabase | NeonHttpDatabase` union from
   * `@voyantjs/db`) so consumers don't need to cast through `unknown` when
   * wiring a Hyperdrive/Neon client.
   */
  resolveDb?: (bindings: Record<string, unknown>) => AnyDrizzleDb
  /**
   * Opt-in auto-generate on `booking.confirmed`. When enabled + a
   * `templateSlug` is supplied + a `documentGenerator` is resolvable, every
   * booking.confirmed event creates a contract against the template's
   * current version and generates its attachment via the configured
   * generator (R2-backed PDF, etc.).
   */
  autoGenerateContractOnConfirmed?: AutoGenerateContractOptions
}

export function createLegalHonoModule(options: CreateLegalHonoModuleOptions = {}): HonoModule {
  const legalAdminRoutes = new Hono()
    .route("/contracts", createContractsAdminRoutes(options))
    .route("/policies", policiesAdminRoutes)

  const legalPublicRoutes = new Hono()
    .route("/contracts", createContractsPublicRoutes(options))
    .route("/policies", policiesPublicRoutes)

  const module: Module = {
    ...legalModule,
    bootstrap: ({ bindings, container, eventBus }) => {
      const bindingsRecord = bindings as Record<string, unknown>
      const contractsRuntime = buildContractsRouteRuntime(bindingsRecord, options)
      contractsRuntime.eventBus ??= eventBus
      container.register(CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY, contractsRuntime)

      // Auto-generate wiring — opt-in. Mirrors the notifications
      // autoConfirmAndDispatch subscriber pattern. Both fire on the same
      // booking.confirmed event; legal's handler just needs to run first
      // so the contract attachment exists before notifications looks it
      // up via listLegalBookingDocuments. Module-registration order in the
      // template controls this.
      const auto = options.autoGenerateContractOnConfirmed
      if (auto?.enabled && options.resolveDb) {
        const resolveDb = options.resolveDb
        if (!contractsRuntime.documentGenerator) {
          // Mis-configuration — don't silently drop contracts. Log and
          // skip; the template operator will notice on the first confirm.
          console.error(
            "[legal] autoGenerateContractOnConfirmed.enabled=true but no documentGenerator resolved; skipping subscriber.",
          )
          return
        }
        const generator = contractsRuntime.documentGenerator

        eventBus.subscribe(
          "booking.confirmed",
          async (event: {
            data: { bookingId: string; bookingNumber: string; actorId: string | null }
          }) => {
            try {
              // The resolver may return either drizzle flavor; the queries
              // autoGenerateContractForBooking runs are compatible with both
              // at runtime, so we narrow at this internal boundary.
              const db = resolveDb(bindings as Record<string, unknown>) as PostgresJsDatabase
              const result = await autoGenerateContractForBooking(db, event.data, auto, {
                generator,
                eventBus,
                lifecycleHooks: contractsRuntime.lifecycleHooks,
                bindings: bindingsRecord,
              })
              if (result.status !== "ok") {
                console.error(
                  `[legal] auto-generate contract skipped for booking ${event.data.bookingId}: ${result.status}`,
                )
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(
                `[legal] auto-generate contract failed for booking ${event.data.bookingId}: ${message}`,
              )
            }
          },
        )
      }
    },
  }

  return {
    module,
    adminRoutes: legalAdminRoutes,
    publicRoutes: legalPublicRoutes,
  }
}

export const legalHonoModule: HonoModule = createLegalHonoModule()

export * from "./contracts/index.js"
export {
  buildContractsRouteRuntime,
  CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY,
  type ContractsRouteRuntime,
} from "./contracts/route-runtime.js"
export type { ContractsRouteOptions } from "./contracts/routes.js"
export {
  type AutoGenerateContractOptions,
  type AutoGenerateContractRuntime,
  autoGenerateContractForBooking,
  type BookingConfirmedLikeEvent,
  type DefaultContractVariables,
  type ResolveContractVariablesFn,
} from "./contracts/service-auto-generate.js"
export * from "./policies/index.js"
