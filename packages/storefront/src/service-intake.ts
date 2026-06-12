import { crmService } from "@voyantjs/crm"
import { CUSTOMER_SIGNAL_CREATED_EVENT, emitCustomerSignalCreated } from "@voyantjs/crm/events"
import { customerSignals } from "@voyantjs/crm/schema"
import { and, eq } from "drizzle-orm"

import type { StorefrontRequestContext } from "./service.js"
import type {
  StorefrontIntakeResponse,
  StorefrontLeadContact,
  StorefrontLeadIntakeInput,
  StorefrontNewsletterSubscribeInput,
  StorefrontNewsletterSubscribeResponse,
} from "./validation.js"

export { CUSTOMER_SIGNAL_CREATED_EVENT }

export interface StorefrontIntakeGuardDecision {
  allowed: boolean
  status?: 400 | 403 | 429
  error?: string
}

export type StorefrontIntakeGuard = (
  input:
    | {
        kind: "lead"
        body: StorefrontLeadIntakeInput
        context: StorefrontRequestContext
      }
    | {
        kind: "newsletter"
        body: StorefrontNewsletterSubscribeInput
        context: StorefrontRequestContext
      },
) => Promise<StorefrontIntakeGuardDecision | undefined> | StorefrontIntakeGuardDecision | undefined

export type StorefrontNewsletterDoubleOptInHook = (input: {
  email: string
  personId: string
  signalId: string
  sourceSubmissionId: string
  body: StorefrontNewsletterSubscribeInput
  context: StorefrontRequestContext
}) => Promise<void> | void

export interface StorefrontIntakeOptions {
  guard?: StorefrontIntakeGuard
  requestNewsletterDoubleOptIn?: StorefrontNewsletterDoubleOptInHook
}

function requireDb(context: StorefrontRequestContext) {
  if (!context.db) {
    throw new Error("Storefront intake requires a request database")
  }
  return context.db
}

function splitName(name: string | undefined): { firstName?: string; lastName?: string } {
  if (!name) return {}
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { firstName: parts[0] }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

function personNameFromContact(contact: StorefrontLeadContact) {
  const split = splitName(contact.name)
  return {
    firstName: contact.firstName ?? split.firstName ?? "Storefront",
    lastName: contact.lastName ?? split.lastName ?? "Lead",
  }
}

function personNameFromNewsletter(input: StorefrontNewsletterSubscribeInput) {
  const split = splitName(input.name)
  const emailLocalPart = input.email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim()
  return {
    firstName: input.firstName ?? split.firstName ?? emailLocalPart ?? "Newsletter",
    lastName: input.lastName ?? split.lastName ?? "Subscriber",
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function defaultNewsletterSubmissionId(email: string) {
  return `newsletter:${normalizeEmail(email)}`
}

function normalizePhone(phone: string | undefined) {
  return phone?.replace(/[^\d+]/g, "").toLowerCase()
}

function defaultLeadSubmissionId(input: StorefrontLeadIntakeInput) {
  const contactKey = input.contact.email
    ? `email:${normalizeEmail(input.contact.email)}`
    : `phone:${normalizePhone(input.contact.phone) ?? "unknown"}`
  return [
    "lead",
    input.kind,
    input.source,
    input.productId ?? "-",
    input.optionUnitId ?? "-",
    contactKey,
  ].join(":")
}

async function findExistingSignal(
  db: ReturnType<typeof requireDb>,
  input: {
    kind: StorefrontLeadIntakeInput["kind"]
    sourceSubmissionId?: string | null
  },
) {
  if (!input.sourceSubmissionId) return null
  const [row] = await db
    .select()
    .from(customerSignals)
    .where(
      and(
        eq(customerSignals.kind, input.kind),
        eq(customerSignals.sourceSubmissionId, input.sourceSubmissionId),
      ),
    )
    .limit(1)
  return row ?? null
}

function leadResponse(
  signal: NonNullable<Awaited<ReturnType<typeof findExistingSignal>>>,
  duplicate: boolean,
): StorefrontIntakeResponse {
  return {
    id: signal.id,
    personId: signal.personId,
    kind: signal.kind,
    source: signal.source,
    status: signal.status,
    duplicate,
  }
}

function newsletterDoubleOptInFromSignal(
  signal: NonNullable<Awaited<ReturnType<typeof findExistingSignal>>>,
) {
  const metadata = signal.metadata
  const newsletter =
    metadata && typeof metadata === "object" && "newsletter" in metadata
      ? metadata.newsletter
      : null
  if (!newsletter || typeof newsletter !== "object" || !("doubleOptIn" in newsletter)) {
    return "not_configured"
  }
  return newsletter.doubleOptIn === "requested" ? "requested" : "not_configured"
}

function newsletterSignalMetadata(input: {
  email: string
  doubleOptIn: "not_configured" | "requested"
  body: StorefrontNewsletterSubscribeInput
}) {
  return {
    intake: { surface: "storefront", type: "newsletter" },
    newsletter: { email: input.email, doubleOptIn: input.doubleOptIn },
    payload: input.body.payload,
    consent: input.body.consent,
    source: {
      url: input.body.sourceUrl ?? null,
      locale: input.body.locale ?? null,
    },
  }
}

export async function createStorefrontLeadSignal(input: {
  body: StorefrontLeadIntakeInput
  context: StorefrontRequestContext
}): Promise<StorefrontIntakeResponse> {
  const db = requireDb(input.context)
  const sourceSubmissionId = input.body.sourceSubmissionId ?? defaultLeadSubmissionId(input.body)
  const existing = await findExistingSignal(db, {
    kind: input.body.kind,
    sourceSubmissionId,
  })
  if (existing) return leadResponse(existing, true)

  const { firstName, lastName } = personNameFromContact(input.body.contact)
  const person = await crmService.createPerson(db, {
    firstName,
    lastName,
    status: "active",
    website: null,
    email: input.body.contact.email ? normalizeEmail(input.body.contact.email) : null,
    phone: input.body.contact.phone ?? null,
    source: "storefront",
    sourceRef: sourceSubmissionId,
    tags: input.body.tags,
  })
  if (!person) throw new Error("Failed to create CRM person for storefront lead")

  const signal = await crmService.createCustomerSignal(db, {
    personId: person.id,
    productId: input.body.productId ?? null,
    optionUnitId: input.body.optionUnitId ?? null,
    kind: input.body.kind,
    source: input.body.source,
    status: "new",
    priority: "normal",
    notes: input.body.notes ?? null,
    tags: input.body.tags,
    sourceSubmissionId,
    metadata: {
      intake: { surface: "storefront", type: "lead" },
      payload: input.body.payload,
      consent: input.body.consent,
      source: {
        url: input.body.sourceUrl ?? null,
        locale: input.body.locale ?? null,
      },
    },
  })
  if (!signal) throw new Error("Failed to create CRM customer signal for storefront lead")

  await emitCustomerSignalCreated(
    input.context.eventBus,
    {
      id: signal.id,
      personId: signal.personId,
      kind: signal.kind,
      source: signal.source,
      status: signal.status,
      productId: signal.productId,
      optionUnitId: signal.optionUnitId,
      sourceSubmissionId: signal.sourceSubmissionId,
      intake: { surface: "storefront", type: "lead" },
    },
    "route",
  )

  return leadResponse(signal, false)
}

export async function subscribeStorefrontNewsletter(input: {
  body: StorefrontNewsletterSubscribeInput
  context: StorefrontRequestContext
  requestDoubleOptIn?: StorefrontNewsletterDoubleOptInHook
}): Promise<StorefrontNewsletterSubscribeResponse> {
  const db = requireDb(input.context)
  const email = normalizeEmail(input.body.email)
  const sourceSubmissionId =
    input.body.sourceSubmissionId ?? defaultNewsletterSubmissionId(input.body.email)
  const existing = await findExistingSignal(db, {
    kind: "notify",
    sourceSubmissionId,
  })
  if (existing) {
    return {
      ...leadResponse(existing, true),
      doubleOptIn: newsletterDoubleOptInFromSignal(existing),
    }
  }

  const { firstName, lastName } = personNameFromNewsletter(input.body)
  const person = await crmService.createPerson(db, {
    firstName,
    lastName,
    status: "active",
    website: null,
    email,
    source: "storefront-newsletter",
    sourceRef: sourceSubmissionId,
    tags: input.body.tags,
  })
  if (!person) throw new Error("Failed to create CRM person for newsletter subscription")

  const doubleOptIn = input.requestDoubleOptIn ? "requested" : "not_configured"
  let signal = await crmService.createCustomerSignal(db, {
    personId: person.id,
    kind: "notify",
    source: input.body.source,
    status: "new",
    priority: "normal",
    notes: "Newsletter subscription",
    tags: input.body.tags,
    sourceSubmissionId,
    metadata: newsletterSignalMetadata({
      email,
      doubleOptIn: "not_configured",
      body: input.body,
    }),
  })
  if (!signal) throw new Error("Failed to create CRM customer signal for newsletter subscription")

  if (input.requestDoubleOptIn) {
    try {
      await input.requestDoubleOptIn({
        email,
        personId: person.id,
        signalId: signal.id,
        sourceSubmissionId,
        body: input.body,
        context: input.context,
      })
    } catch (error) {
      await crmService.deleteCustomerSignal(db, signal.id).catch(() => null)
      await crmService.deletePerson(db, person.id).catch(() => null)
      throw error
    }

    signal =
      (await crmService.updateCustomerSignal(db, signal.id, {
        metadata: newsletterSignalMetadata({
          email,
          doubleOptIn,
          body: input.body,
        }),
      })) ?? signal
  }

  await emitCustomerSignalCreated(
    input.context.eventBus,
    {
      id: signal.id,
      personId: signal.personId,
      kind: signal.kind,
      source: signal.source,
      status: signal.status,
      productId: signal.productId,
      optionUnitId: signal.optionUnitId,
      sourceSubmissionId: signal.sourceSubmissionId,
      intake: { surface: "storefront", type: "newsletter", doubleOptIn },
    },
    "route",
  )

  return {
    ...leadResponse(signal, false),
    doubleOptIn,
  }
}
