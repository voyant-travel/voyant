import type { ContractAcceptanceEvent, Draft } from "../journey/index.js"

export function buildStorefrontBookBody(input: {
  draftId: string
  quoteId?: string
  draft: Draft
  acceptedAt?: string
}) {
  return {
    draftId: input.draftId,
    quoteId: input.quoteId,
    party: buildStorefrontCommitParty(input.draft),
    paymentIntent: { type: "hold" as const },
    idempotencyKey: `bj-${input.draftId}-${input.acceptedAt ?? "noaccept"}`,
  }
}

export function buildStorefrontCheckoutStartBody(input: {
  bookingId: string
  draft: Draft
  acceptance: ContractAcceptanceEvent | null
  returnOrigin: string
}) {
  const contact = input.draft.billing?.contact
  const payerName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim()
  return {
    bookingId: input.bookingId,
    paymentIntent: checkoutIntentFromDraft(input.draft.payment.intent),
    ...(input.acceptance
      ? {
          contractAcceptance: {
            templateId: input.acceptance.templateId,
            templateSlug: input.acceptance.templateSlug,
            acceptedTerms: true as const,
            acceptedMarketing: input.acceptance.acceptedMarketing,
            acceptedAt: input.acceptance.acceptedAt,
            renderedHtml: input.acceptance.renderedHtml,
          },
        }
      : {}),
    ...(contact?.email ? { payerEmail: contact.email } : {}),
    ...(payerName ? { payerName } : {}),
    returnOrigin: input.returnOrigin,
  }
}

function checkoutIntentFromDraft(
  intent: Draft["payment"]["intent"],
): "card" | "bank_transfer" | "hold" | "inquiry" {
  if (intent === "card" || intent === "bank_transfer" || intent === "inquiry") return intent
  return "hold"
}

export function buildStorefrontCommitParty(draft: Draft): Record<string, unknown> {
  const contact = draft.billing.contact
  const personId = draft.billing.buyerType === "B2C" ? contact.personId : undefined
  const organizationId =
    draft.billing.buyerType === "B2B" ? draft.billing.organizationId : undefined
  return {
    personId,
    organizationId,
    billing: {
      personId,
      organizationId,
      contact: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
      },
    },
    travelerParty: {
      travelers: draft.travelers.map((traveler) => ({
        personId: traveler.personId,
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        email: traveler.email,
        phone: traveler.phone,
        dateOfBirth: traveler.dateOfBirth,
        band: traveler.band,
        documents: traveler.documents,
        isPrimary: traveler.isPrimary,
      })),
    },
  }
}
