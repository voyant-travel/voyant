import type { BootstrapContext } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { z } from "zod"

import { catalogBookingSnapshotSubscriberDeclaration } from "./booking-snapshot-subscriber-declaration.js"
import {
  type CaptureSnapshotInput,
  captureSnapshotGraphIdempotent,
} from "./services/snapshot-service.js"

export const CATALOG_BOOKING_SNAPSHOT_RUNTIME_CONTAINER_KEY = "runtime.catalog.booking-snapshot"

export interface CatalogBookingSnapshotScope {
  locale: string
  audience: "staff"
  market: string
  actor: "staff"
}

export interface CatalogBookingSnapshotBuildOptions {
  sellerOperatorId: string
  scope: CatalogBookingSnapshotScope
}

export interface CatalogBookingSnapshotExecutionContext {
  db: AnyDrizzleDb
  sellerOperatorId: string
  findBookingProductIds(bookingId: string): Promise<readonly (string | null | undefined)[]>
  buildSnapshotInput(
    productId: string,
    options: CatalogBookingSnapshotBuildOptions,
  ): Promise<Omit<CaptureSnapshotInput, "bookingId"> | null>
}

export interface CatalogBookingSnapshotRuntime {
  withContext<TResult>(
    operation: (context: CatalogBookingSnapshotExecutionContext) => Promise<TResult>,
  ): Promise<TResult>
}

export const catalogBookingSnapshotRuntimePort = definePort<CatalogBookingSnapshotRuntime>({
  id: "catalog.booking-snapshot-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("catalog.booking-snapshot-runtime provider must be an object.")
    }
    if (typeof provider.withContext !== "function") {
      throw new Error("catalog.booking-snapshot-runtime provider must implement withContext().")
    }
  },
})

export interface CatalogBookingSnapshotSubscriberRuntimeDescriptor {
  readonly id: string
  readonly eventType: string
  readonly register: (context: BootstrapContext) => void | Promise<void>
}

type CaptureSnapshotGraph = typeof captureSnapshotGraphIdempotent

export interface CatalogBookingSnapshotSubscriberDescriptorOptions {
  captureSnapshotGraph?: CaptureSnapshotGraph
}

const bookingConfirmedPayloadSchema = z.object({ bookingId: z.string().min(1) }).passthrough()

const snapshotScope: CatalogBookingSnapshotScope = {
  locale: "en-GB",
  audience: "staff",
  market: "default",
  actor: "staff",
}

export function createCatalogBookingSnapshotSubscriberDescriptor(
  options: CatalogBookingSnapshotSubscriberDescriptorOptions = {},
): CatalogBookingSnapshotSubscriberRuntimeDescriptor {
  const captureSnapshotGraph = options.captureSnapshotGraph ?? captureSnapshotGraphIdempotent

  return {
    id: catalogBookingSnapshotSubscriberDeclaration.id,
    eventType: catalogBookingSnapshotSubscriberDeclaration.eventType,
    register(context) {
      context.eventBus.subscribe(
        catalogBookingSnapshotSubscriberDeclaration.eventType,
        async ({ data }) => {
          const { bookingId } = bookingConfirmedPayloadSchema.parse(data)
          const runtime = context.container.resolve<CatalogBookingSnapshotRuntime>(
            CATALOG_BOOKING_SNAPSHOT_RUNTIME_CONTAINER_KEY,
          )

          await runtime.withContext(async (snapshotContext) => {
            const productIds = Array.from(
              new Set(
                (await snapshotContext.findBookingProductIds(bookingId)).filter(
                  (productId): productId is string => Boolean(productId),
                ),
              ),
            )
            if (productIds.length === 0) return

            const inputs: Array<Omit<CaptureSnapshotInput, "bookingId">> = []
            for (const productId of productIds) {
              const input = await snapshotContext.buildSnapshotInput(productId, {
                sellerOperatorId: snapshotContext.sellerOperatorId,
                scope: snapshotScope,
              })
              if (input) inputs.push(input)
            }

            if (inputs.length > 0) {
              await captureSnapshotGraph(snapshotContext.db, bookingId, inputs)
            }
          })
        },
        { inline: false },
      )
    },
  }
}

export const catalogBookingConfirmedSnapshotSubscriber =
  createCatalogBookingSnapshotSubscriberDescriptor()
