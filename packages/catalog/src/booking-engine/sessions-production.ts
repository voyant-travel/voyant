import type { BookingsRelationshipsRuntime } from "@voyant-travel/bookings/runtime-port"
import { bookingAllocations, bookings } from "@voyant-travel/bookings/schema"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  createSelfServiceCreateRuntime,
  FINANCE_BOOKING_CREATE_SELF_SERVICE_ROUTE_ACTION,
  type FinanceServiceRuntime,
} from "@voyant-travel/finance"
import { createRouteActionRegistry } from "@voyant-travel/tools"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { PricingBasis } from "../snapshot/schema.js"
import type { OwnedBookingHandlerRegistry, SelfServiceBillingParty } from "./owned-handler.js"
import { engineParametersFromDraft } from "./routes.js"
import {
  type BookingSessionModule,
  type BookingSessionRepository,
  type CommitOwnedBookingInput,
  createBookingSessionModule,
} from "./sessions-service.js"

export interface ProductionBookingSessionModuleDeps {
  db: PostgresJsDatabase
  repository: BookingSessionRepository
  resolveOwnedHandlers(): OwnedBookingHandlerRegistry | Promise<OwnedBookingHandlerRegistry>
  relationships?: BookingsRelationshipsRuntime
  financeRuntime?: FinanceServiceRuntime
}

export function createProductionBookingSessionModule(
  deps: ProductionBookingSessionModuleDeps,
): BookingSessionModule {
  return createBookingSessionModule({
    ports: {
      repository: deps.repository,
      normalizeSelection: async ({ selection }) => structuredClone(selection),
      composeQuote: async ({ session }) => {
        const handlers = await deps.resolveOwnedHandlers()
        const handler = handlers.resolve(entityModuleForSession(session.target))
        if (!handler) throw new Error("booking_session_quote_unsupported_vertical")
        const result = await handler.computeQuote(
          { db: deps.db, adapterContext: {} as never },
          {
            entityModule: handler.entityModule,
            entityId: entityIdForSession(session.target),
            draft: session.statePayload,
            parameters: engineParametersFromDraft(undefined, session.statePayload, {
              entityModule: handler.entityModule,
              sourceKind: "owned",
            }),
            scope: { locale: "en", audience: "customer", market: "default" },
          },
        )
        if (!result.available || !result.pricing) {
          throw new Error(result.invalidReason ?? "booking_session_quote_unavailable")
        }
        return pricingBreakdownFromBasis(result.pricing)
      },
      placeCapacityHold: async ({ session, holdId, expiresAt }) => {
        const handlers = await deps.resolveOwnedHandlers()
        const handler = handlers.resolve(entityModuleForSession(session.target))
        if (!handler) return "unavailable"
        if (!handler.placeHold) return "unavailable"
        const result = await handler.placeHold(
          { db: deps.db, adapterContext: {} as never },
          {
            entityModule: handler.entityModule,
            entityId: entityIdForSession(session.target),
            draftId: holdId,
            ttlMs: Math.max(1, expiresAt.getTime() - Date.now()),
            parameters: engineParametersFromDraft(undefined, session.statePayload, {
              entityModule: handler.entityModule,
              sourceKind: "owned",
            }),
          },
        )
        return result.holdToken === holdId ? "held" : "unavailable"
      },
      commitOwnedBooking: (input) => commitOwnedBooking(deps, input),
    },
  })
}

async function commitOwnedBooking(
  deps: ProductionBookingSessionModuleDeps,
  input: CommitOwnedBookingInput,
) {
  const handlers = await deps.resolveOwnedHandlers()
  const handler = handlers.resolve(entityModuleForSession(input.session.target))
  if (!handler) throw new Error("booking_session_commit_unsupported_vertical")
  if (!handler.deriveSelfServiceCommand) {
    throw new Error("booking_session_commit_unsupported_vertical")
  }
  const billing = await resolveBilling(deps, input)
  if (!billing) throw new Error("booking_session_commit_billing_unresolved")
  const derived = await handler.deriveSelfServiceCommand(
    { db: deps.db, adapterContext: {} as never },
    {
      entityModule: handler.entityModule,
      entityId: entityIdForSession(input.session.target),
      draft: input.session.statePayload,
      pricing: pricingBasisFromBreakdown(input.quote.pricing),
      billing,
      availabilityHoldToken: input.hold.id,
    },
  )
  if (derived.status !== "ok") throw new Error(`booking_session_commit_${derived.reason}`)

  const routeActions = createRouteActionRegistry()
  routeActions.register(FINANCE_BOOKING_CREATE_SELF_SERVICE_ROUTE_ACTION)
  const runtime = createSelfServiceCreateRuntime({
    resolveSource: () => ({
      async resolveBookingSource() {
        return {
          status: "ok" as const,
          command: derived.command as never,
          holdExpiresAt: input.hold.expiresAt,
        }
      },
      async consumeBookingSource(tx: AnyDrizzleDb, sourceInput) {
        const rows = await tx
          .select({ id: bookingAllocations.id })
          .from(bookingAllocations)
          .where(eq(bookingAllocations.bookingId, sourceInput.bookingId))
        await input.consumeSources(
          tx,
          sourceInput.bookingId,
          rows.map((row) => row.id),
        )
      },
    }),
    admit: (actor, idempotencyKey) =>
      routeActions.admit(FINANCE_BOOKING_CREATE_SELF_SERVICE_ROUTE_ACTION.actionPolicy.id, {
        actor,
        invocation: { idempotencyKey },
      }),
    runtime: deps.financeRuntime,
    async readBookingSummary(db, bookingId) {
      const [row] = await db
        .select({ bookingNumber: bookings.bookingNumber, status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)
      return row ? { bookingNumber: row.bookingNumber, status: row.status } : null
    },
  })
  const result = await runtime.createFromDraft({
    db: deps.db,
    draftId: input.session.id,
    quoteId: input.quote.id,
    caller: { personId: billing.personId ?? undefined },
    idempotencyKey: input.idempotencyKey,
    userId: input.access.actorKind === "staff" ? input.access.principalId : undefined,
  })
  if (result.status !== "ok") throw new Error(`booking_session_commit_${result.reason}`)
  const allocations = await deps.db
    .select({ id: bookingAllocations.id })
    .from(bookingAllocations)
    .where(eq(bookingAllocations.bookingId, result.bookingId))
  return { bookingId: result.bookingId, allocationIds: allocations.map((row) => row.id) }
}

async function resolveBilling(
  deps: ProductionBookingSessionModuleDeps,
  input: CommitOwnedBookingInput,
): Promise<SelfServiceBillingParty | null> {
  const contact = billingContact(input.session.statePayload)
  if (input.access.actorKind !== "anonymous" && input.access.principalId) {
    return {
      ...contact,
      personId: input.access.principalId,
      organizationId: input.access.organizationId ?? null,
    }
  }
  const personId = await deps.relationships?.upsertPersonFromContact(
    deps.db,
    {
      firstName: contact.contactFirstName,
      lastName: contact.contactLastName,
      email: contact.contactEmail,
      phone: contact.contactPhone,
      preferredLanguage: null,
    },
    { source: "booking-session-v1", sourceRef: input.session.id, requireContactPoint: true },
  )
  return personId ? { ...contact, personId: personId.id, organizationId: null } : null
}

function billingContact(payload: Record<string, unknown>) {
  const billing = asRecord(payload.billing)
  const contact = asRecord(billing?.contact)
  const trim = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)
  return {
    personId: null,
    organizationId: null,
    contactFirstName: trim(contact?.firstName),
    contactLastName: trim(contact?.lastName),
    contactEmail: trim(contact?.email),
    contactPhone: trim(contact?.phone),
  }
}

function entityModuleForSession(target: CommitOwnedBookingInput["session"]["target"]) {
  if (target.kind === "product") return "products"
  return "catalog"
}

function entityIdForSession(target: CommitOwnedBookingInput["session"]["target"]) {
  return target.kind === "product" ? target.productId : target.catalogItemId
}

function pricingBreakdownFromBasis(pricing: PricingBasis) {
  const base = Number(pricing.base_amount ?? 0)
  const taxes = Number(pricing.taxes ?? 0)
  const fees = Number(pricing.fees ?? 0)
  const surcharges = Number(pricing.surcharges ?? 0)
  const total = base + taxes + fees + surcharges
  return {
    currency: pricing.currency ?? "EUR",
    lines: [
      { kind: "base" as const, label: "Base", quantity: 1, unitAmount: base, totalAmount: base },
    ],
    taxes: [],
    subtotal: base,
    taxTotal: taxes,
    total,
  }
}

function pricingBasisFromBreakdown(
  pricing: CommitOwnedBookingInput["quote"]["pricing"],
): PricingBasis {
  return {
    base_amount: pricing.subtotal,
    taxes: pricing.taxTotal,
    fees: 0,
    surcharges: 0,
    currency: pricing.currency,
    breakdown: pricing,
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
