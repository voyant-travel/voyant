import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

export {
  createTransactionPiiService,
  type TransactionPiiAuditEvent,
  type TransactionPiiServiceOptions,
  type UpsertTransactionTravelerIdentityInput,
} from "./pii.js"

import {
  buildTransactionsRouteRuntime,
  TRANSACTIONS_ROUTE_RUNTIME_CONTAINER_KEY,
} from "./route-runtime.js"
import { transactionsRoutes } from "./routes.js"
import { transactionsService } from "./service.js"

export type { TransactionsRoutes } from "./routes.js"

export const orderLinkable: LinkableDefinition = {
  module: "transactions",
  entity: "order",
  table: "orders",
  idPrefix: "ord",
}

export const offerLinkable: LinkableDefinition = {
  module: "transactions",
  entity: "offer",
  table: "offers",
  idPrefix: "ofr",
}

export const transactionsLinkable = {
  order: orderLinkable,
  offer: offerLinkable,
}

export const transactionsModule: Module = {
  name: "transactions",
  linkable: transactionsLinkable,
  requiresTransactionalDb: true,
}

export function createTransactionsHonoModule(): HonoModule {
  const module: Module = {
    ...transactionsModule,
    bootstrap: ({ bindings, container }) => {
      container.register(
        TRANSACTIONS_ROUTE_RUNTIME_CONTAINER_KEY,
        buildTransactionsRouteRuntime(bindings as Record<string, unknown>),
      )
    },
  }

  return {
    module,
    routes: transactionsRoutes,
  }
}

export const transactionsHonoModule: HonoModule = createTransactionsHonoModule()

export { transactionsBookingExtension } from "./booking-extension.js"
export type { TransactionsRouteRuntime } from "./route-runtime.js"
export {
  buildTransactionsRouteRuntime,
  TRANSACTIONS_ROUTE_RUNTIME_CONTAINER_KEY,
} from "./route-runtime.js"
export type {
  DecryptedTransactionTravelerIdentity,
  TransactionTravelerIdentity,
  TransactionTravelerIdentityEnvelope,
} from "./schema/participant-identity.js"
export {
  decryptedTransactionTravelerIdentitySchema,
  transactionTravelerIdentityEnvelopeSchema,
  transactionTravelerIdentitySchema,
} from "./schema/participant-identity.js"
export type {
  NewOffer,
  NewOfferContactAssignment,
  NewOfferItem,
  NewOfferItemTraveler,
  NewOfferStaffAssignment,
  NewOfferTraveler,
  NewOrder,
  NewOrderContactAssignment,
  NewOrderItem,
  NewOrderItemTraveler,
  NewOrderStaffAssignment,
  NewOrderTerm,
  NewOrderTraveler,
  Offer,
  OfferContactAssignment,
  OfferItem,
  OfferItemTraveler,
  OfferStaffAssignment,
  OfferTraveler,
  Order,
  OrderContactAssignment,
  OrderItem,
  OrderItemTraveler,
  OrderStaffAssignment,
  OrderTerm,
  OrderTraveler,
} from "./schema.js"
export {
  offerContactAssignments,
  offerItemParticipants,
  offerItems,
  offerParticipants,
  offerStaffAssignments,
  offerStatusEnum,
  offers,
  orderContactAssignments,
  orderItemParticipants,
  orderItems,
  orderParticipants,
  orderStaffAssignments,
  orderStatusEnum,
  orders,
  orderTermAcceptanceStatusEnum,
  orderTerms,
  orderTermTypeEnum,
  transactionContactAssignmentRoleEnum,
  transactionItemParticipantRoleEnum,
  transactionItemStatusEnum,
  transactionItemTypeEnum,
  transactionParticipantTypeEnum,
  transactionPiiAccessActionEnum,
  transactionPiiAccessLog,
  transactionPiiAccessOutcomeEnum,
  transactionStaffAssignmentRoleEnum,
  transactionTravelerCategoryEnum,
} from "./schema.js"
export {
  createStorefrontPromotionalOffersResolver,
  getStorefrontPromotionalOfferBySlug,
  listStorefrontPromotionalOffers,
  storefrontOfferEnvelopeSchema,
  storefrontPromotionalOfferSchema,
} from "./storefront-offers.js"
export {
  insertOfferContactAssignmentSchema,
  insertOfferItemSchema,
  insertOfferItemTravelerSchema,
  insertOfferSchema,
  insertOfferStaffAssignmentSchema,
  insertOfferTravelerSchema,
  insertOrderContactAssignmentSchema,
  insertOrderItemSchema,
  insertOrderItemTravelerSchema,
  insertOrderSchema,
  insertOrderStaffAssignmentSchema,
  insertOrderTermSchema,
  insertOrderTravelerSchema,
  offerContactAssignmentListQuerySchema,
  offerItemListQuerySchema,
  offerItemTravelerListQuerySchema,
  offerListQuerySchema,
  offerMetadataSchema,
  offerStaffAssignmentListQuerySchema,
  offerStatusSchema,
  offerTravelerListQuerySchema,
  orderContactAssignmentListQuerySchema,
  orderItemListQuerySchema,
  orderItemTravelerListQuerySchema,
  orderListQuerySchema,
  orderStaffAssignmentListQuerySchema,
  orderStatusSchema,
  orderTermAcceptanceStatusSchema,
  orderTermListQuerySchema,
  orderTermTypeSchema,
  orderTravelerListQuerySchema,
  storefrontOfferDiscountTypeSchema,
  storefrontOfferMetadataSchema,
  transactionContactAssignmentRoleSchema,
  transactionItemParticipantRoleSchema,
  transactionItemStatusSchema,
  transactionItemTypeSchema,
  transactionParticipantTypeSchema,
  transactionStaffAssignmentRoleSchema,
  transactionTravelerCategorySchema,
  updateOfferContactAssignmentSchema,
  updateOfferItemSchema,
  updateOfferItemTravelerSchema,
  updateOfferSchema,
  updateOfferStaffAssignmentSchema,
  updateOfferTravelerSchema,
  updateOrderContactAssignmentSchema,
  updateOrderItemSchema,
  updateOrderItemTravelerSchema,
  updateOrderSchema,
  updateOrderStaffAssignmentSchema,
  updateOrderTermSchema,
  updateOrderTravelerSchema,
} from "./validation.js"
export { transactionsService }
