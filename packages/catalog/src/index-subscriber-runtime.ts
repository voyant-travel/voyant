import type { BootstrapContext, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { z } from "zod"

import { catalogIndexSubscriberDeclarations } from "./index-subscriber-declarations.js"
import {
  CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY,
  type CatalogProjectionRuntime,
  type CatalogProjectionTarget,
  catalogProjectionRuntimePort,
  parseCatalogProjectionTarget,
} from "./projection-runtime.js"

const PRODUCTS_ENTITY_MODULE = "products"

const entityIdPayloadSchema = z.object({ id: z.string().min(1) }).passthrough()
const productIdPayloadSchema = z.object({ productId: z.string().optional() }).passthrough()
const promotionPayloadSchema = z
  .object({
    affected: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("all") }).passthrough(),
      z
        .object({
          kind: z.literal("products"),
          productIds: z.array(z.string().min(1)),
        })
        .passthrough(),
    ]),
  })
  .passthrough()

export interface CatalogIndexSubscriberRuntimeDescriptor {
  readonly id: string
  readonly eventType: string
  readonly register: (context: BootstrapContext) => void | Promise<void>
}

export interface CatalogIndexSubscriberDescriptorOptions {
  id: string
  eventType: string
  selectTargets(payload: unknown): readonly CatalogProjectionTarget[]
}

function resolveRuntime(context: BootstrapContext): CatalogProjectionRuntime {
  return context.container.resolve<CatalogProjectionRuntime>(
    CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY,
  )
}

export function createCatalogReindexSubscriberDescriptor(
  options: CatalogIndexSubscriberDescriptorOptions,
): CatalogIndexSubscriberRuntimeDescriptor {
  return {
    id: options.id,
    eventType: options.eventType,
    register(context) {
      context.eventBus.subscribe(
        options.eventType,
        async ({ data }) => {
          const targets = options.selectTargets(data)
          if (targets.length === 0) return
          const runtime = resolveRuntime(context)
          for (const target of targets) {
            await runtime.reindexEntity(target)
          }
        },
        { inline: false },
      )
    },
  }
}

export function createCatalogDeleteSubscriberDescriptor(
  options: CatalogIndexSubscriberDescriptorOptions,
): CatalogIndexSubscriberRuntimeDescriptor {
  return {
    id: options.id,
    eventType: options.eventType,
    register(context) {
      context.eventBus.subscribe(
        options.eventType,
        async ({ data }) => {
          const targets = options.selectTargets(data)
          if (targets.length === 0) return
          const runtime = resolveRuntime(context)
          for (const target of targets) {
            await runtime.deleteEntity(target)
          }
        },
        { inline: false },
      )
    },
  }
}

function productTarget(entityId: string): CatalogProjectionTarget {
  return parseCatalogProjectionTarget({ entityModule: PRODUCTS_ENTITY_MODULE, entityId })
}

function selectEntityId(payload: unknown): readonly CatalogProjectionTarget[] {
  return [productTarget(entityIdPayloadSchema.parse(payload).id)]
}

function selectOptionalProductId(payload: unknown): readonly CatalogProjectionTarget[] {
  const { productId } = productIdPayloadSchema.parse(payload)
  return productId ? [productTarget(productId)] : []
}

function selectPromotionProducts(payload: unknown): readonly CatalogProjectionTarget[] {
  const { affected } = promotionPayloadSchema.parse(payload)
  return affected.kind === "products" ? affected.productIds.map(productTarget) : []
}

const declarationsByEvent = new Map(
  catalogIndexSubscriberDeclarations.map((declaration) => [declaration.eventType, declaration]),
)

type CatalogIndexEventType = (typeof catalogIndexSubscriberDeclarations)[number]["eventType"]

function declaration(eventType: CatalogIndexEventType) {
  const value = declarationsByEvent.get(eventType)
  if (!value) throw new Error(`Catalog index subscriber declaration is missing "${eventType}".`)
  return value
}

function reindexDescriptor(
  eventType: CatalogIndexEventType,
  selectTargets: CatalogIndexSubscriberDescriptorOptions["selectTargets"],
) {
  return createCatalogReindexSubscriberDescriptor({
    ...declaration(eventType),
    selectTargets,
  })
}

export const catalogProductCreatedIndexSubscriber = reindexDescriptor(
  "product.created",
  selectEntityId,
)
export const catalogProductUpdatedIndexSubscriber = reindexDescriptor(
  "product.updated",
  selectEntityId,
)
export const catalogProductDeletedIndexSubscriber = createCatalogDeleteSubscriberDescriptor({
  ...declaration("product.deleted"),
  selectTargets: selectEntityId,
})
export const catalogProductContentChangedIndexSubscriber = reindexDescriptor(
  "product.content.changed",
  selectEntityId,
)
export const catalogAvailabilityChangedIndexSubscriber = reindexDescriptor(
  "availability.slot.changed",
  selectOptionalProductId,
)
export const catalogPricingChangedIndexSubscriber = reindexDescriptor(
  "pricing.rule.changed",
  selectOptionalProductId,
)
export const catalogPublicationChangedIndexSubscriber = reindexDescriptor(
  "product.publication.changed",
  selectOptionalProductId,
)
export const catalogPromotionChangedIndexSubscriber = reindexDescriptor(
  "promotion.changed",
  selectPromotionProducts,
)

export const catalogIndexSubscriberRuntimeDescriptors = [
  catalogProductCreatedIndexSubscriber,
  catalogProductUpdatedIndexSubscriber,
  catalogProductDeletedIndexSubscriber,
  catalogProductContentChangedIndexSubscriber,
  catalogAvailabilityChangedIndexSubscriber,
  catalogPricingChangedIndexSubscriber,
  catalogPublicationChangedIndexSubscriber,
  catalogPromotionChangedIndexSubscriber,
] as const

function createCatalogIndexSubscriberGraphRuntime(descriptor: SubscriberRuntimeDescriptor) {
  return defineGraphRuntimeFactory(async ({ getPort }) => {
    const provider = await getPort(catalogProjectionRuntimePort)
    return {
      ...descriptor,
      register: async (context: BootstrapContext) => {
        context.container.register(
          CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY,
          await provider.createRuntime(context.bindings),
        )
        await descriptor.register(context)
      },
    }
  })
}

export const createCatalogProductCreatedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogProductCreatedIndexSubscriber)
export const createCatalogProductUpdatedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogProductUpdatedIndexSubscriber)
export const createCatalogProductDeletedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogProductDeletedIndexSubscriber)
export const createCatalogProductContentChangedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogProductContentChangedIndexSubscriber)
export const createCatalogAvailabilityChangedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogAvailabilityChangedIndexSubscriber)
export const createCatalogPricingChangedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogPricingChangedIndexSubscriber)
export const createCatalogPublicationChangedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogPublicationChangedIndexSubscriber)
export const createCatalogPromotionChangedIndexSubscriberGraphRuntime =
  createCatalogIndexSubscriberGraphRuntime(catalogPromotionChangedIndexSubscriber)
