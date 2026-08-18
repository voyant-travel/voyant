import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"

export interface RelationshipsMiceRuntime {
  personExists(db: unknown, personId: string): Promise<boolean>
}

/** Database access for the CRM enrichment subscriber, which runs off-request. */
export interface RelationshipsBookingEnrichmentDatabaseRuntime {
  withDb<T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
}

/** One message a deployment actually delivered to a person. */
export type PersonCommunicationChannel = "email" | "sms"
export type PersonCommunicationDirection = "inbound" | "outbound"
export type PersonCommunicationDeliveryStatus =
  | "received"
  | "pending"
  | "accepted"
  | "delivered"
  | "failed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "cancelled"

export interface PersonTimelineBoundary {
  occurredAt: string
  source: "logged" | "conversation" | "notification"
  id: string
}

export interface PersonNotificationDelivery {
  id: string
  channel: PersonCommunicationChannel
  subject: string | null
  body: string | null
  status: PersonCommunicationDeliveryStatus
  occurredAt: string
  createdAt: string
}

export interface PersonNotificationDeliveryQuery {
  limit: number
  actorUserId: string
  boundary?: PersonTimelineBoundary
  dateFrom?: string
  dateTo?: string
  channel?: string
  direction?: PersonCommunicationDirection
  includeAllStatuses?: boolean
}

/**
 * Lets the Communications tab show what was actually sent.
 *
 * The delivery record is the authority on a sent message, so CRM reads it
 * rather than keeping a second copy in `communication_log` that would go stale
 * the moment a delivery bounced. Declared here because notifications already
 * depends on relationships; the reverse import would close a package cycle.
 */
export interface RelationshipsPersonNotificationsRuntime {
  listPersonDeliveries(
    db: unknown,
    personId: string,
    query: PersonNotificationDeliveryQuery,
  ): Promise<readonly PersonNotificationDelivery[]>
  getDeliveryTruth(
    db: unknown,
    deliveryIds: readonly string[],
  ): Promise<Readonly<Record<string, PersonCommunicationDeliveryStatus>>>
}

/** A customer-visible part, projected without exposing message transport internals. */
export interface PersonConversationPart {
  id: string
  conversationId: string
  channel: PersonCommunicationChannel
  direction: PersonCommunicationDirection
  subject: string | null
  body: string | null
  deliveryStatus: PersonCommunicationDeliveryStatus | null
  notificationDeliveryId: string | null
  occurredAt: string
  createdAt: string
}

export interface RelationshipsPersonConversationsRuntime {
  listPersonParts(
    db: unknown,
    personId: string,
    query: PersonNotificationDeliveryQuery,
  ): Promise<readonly PersonConversationPart[]>
  findLinkedDeliveryIds(
    db: unknown,
    personId: string,
    deliveryIds: readonly string[],
    actorUserId: string,
  ): Promise<readonly string[]>
  mergePersonHistory(db: unknown, survivorPersonId: string, mergedPersonId: string): Promise<void>
}

/** Deployment contract consumed by the package-owned Relationships graph runtime. */
export const relationshipsRouteRuntimePort = definePort<RelationshipsRouteRuntimeOptions>({
  id: "relationships.route-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("relationships.route-runtime provider must be an options object.")
    }
    if (provider.customFields && typeof provider.customFields !== "function") {
      throw new Error("relationships.route-runtime provider customFields must be a function.")
    }
    if (provider.customFieldsForWrite && typeof provider.customFieldsForWrite !== "function") {
      throw new Error(
        "relationships.route-runtime provider customFieldsForWrite must be a function.",
      )
    }
    if (provider.resolveKmsProvider && typeof provider.resolveKmsProvider !== "function") {
      throw new Error("relationships.route-runtime provider resolveKmsProvider must be a function.")
    }
  },
})

export const relationshipsBookingEnrichmentDatabaseRuntimePort =
  definePort<RelationshipsBookingEnrichmentDatabaseRuntime>({
    id: "relationships.booking-enrichment-database",
    test(provider) {
      if (
        provider === null ||
        typeof provider !== "object" ||
        typeof provider.withDb !== "function"
      ) {
        throw new Error(
          "relationships.booking-enrichment-database provider must implement withDb().",
        )
      }
    },
  })

export const relationshipsPersonNotificationsRuntimePort =
  definePort<RelationshipsPersonNotificationsRuntime>({
    id: "relationships.person-notifications",
    test(provider) {
      if (
        provider === null ||
        typeof provider !== "object" ||
        typeof provider.listPersonDeliveries !== "function"
      ) {
        throw new Error(
          "relationships.person-notifications provider must implement listPersonDeliveries().",
        )
      }
    },
  })

export const relationshipsPersonConversationsRuntimePort =
  definePort<RelationshipsPersonConversationsRuntime>({
    id: "relationships.person-conversations",
    test(provider) {
      if (
        provider === null ||
        typeof provider !== "object" ||
        typeof provider.listPersonParts !== "function" ||
        typeof provider.findLinkedDeliveryIds !== "function" ||
        typeof provider.mergePersonHistory !== "function"
      ) {
        throw new Error(
          "relationships.person-conversations provider must implement timeline methods.",
        )
      }
    },
  })

/** Narrow Relationships behavior consumed by MICE without deployment wiring. */
export const relationshipsMiceRuntimePort = definePort<RelationshipsMiceRuntime>({
  id: "relationships.mice.runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.personExists !== "function"
    ) {
      throw new Error("relationships.mice.runtime provider must implement personExists().")
    }
  },
})
