import type {
  AncillaryOfferGroupV1,
  AncillaryOfferV1,
} from "@voyant-travel/catalog-contracts/booking-engine/ancillary-contracts"
import type { BookingRequirementsV1 } from "@voyant-travel/catalog-contracts/booking-engine/requirements-contracts"
import { describe, expect, it } from "vitest"

import {
  canAdvanceFromStep,
  defaultMinimalShape,
  isStepVisible,
} from "../../src/journey/components/booking-journey-rules.js"
import { emptyDraft, setAncillarySelection } from "../../src/journey/lib/draft-state.js"
import { JOURNEY_STEP_ORDER } from "../../src/journey/types.js"

const ENTITY = { module: "products", id: "prod_1", sourceKind: "owned" } as const

function offer(overrides: Partial<AncillaryOfferV1> = {}): AncillaryOfferV1 {
  return {
    offerId: "offer_1",
    sourceId: "source_1",
    providerId: "provider_1",
    providerLabel: "Northwind Assurance",
    kind: "insurance",
    title: "Trip protection",
    price: { amountMinor: 4500, currency: "EUR" },
    pricedPerPerson: true,
    highlights: [],
    eligibility: { status: "eligible", reasons: [] },
    disclosures: [],
    requiredTravelerFields: [],
    validUntil: "2026-09-01T10:00:00.000Z",
    quoteRef: "quote_1",
    ...overrides,
  }
}

function group(offers: AncillaryOfferV1[]): AncillaryOfferGroupV1 {
  return { kind: "insurance", label: "Cover for this trip", offers, diagnostics: [] }
}

function shapeWith(groups: AncillaryOfferGroupV1[]): BookingRequirementsV1 {
  return {
    ...defaultMinimalShape(),
    showsAncillaries: groups.length > 0,
    ancillaries: { groups },
  }
}

describe("ancillaries journey rules", () => {
  it("sits between the add-ons step and payment", () => {
    const order = [...JOURNEY_STEP_ORDER]
    expect(order.indexOf("ancillaries")).toBe(order.indexOf("addons") + 1)
    expect(order.indexOf("ancillaries")).toBe(order.indexOf("payment") - 1)
  })

  it("does not appear at all when no ancillary source is connected", () => {
    const shape = shapeWith([])

    expect(shape.showsAncillaries).toBe(false)
    expect(isStepVisible("ancillaries", shape)).toBe(false)
    expect(JOURNEY_STEP_ORDER.filter((step) => isStepVisible(step, shape))).not.toContain(
      "ancillaries",
    )
    // With no step to answer there is nothing to hold the journey on.
    expect(canAdvanceFromStep("ancillaries", emptyDraft(ENTITY), shape, true)).toBe(true)
  })

  it("appears once a source has quoted", () => {
    expect(isStepVisible("ancillaries", shapeWith([group([offer()])]))).toBe(true)
  })

  it("does not hold on a group whose sources all failed", () => {
    // Diagnostics but no offers: there is nothing to decide, so the step must
    // not lock behind a question it never asked.
    const shape: BookingRequirementsV1 = {
      ...defaultMinimalShape(),
      showsAncillaries: true,
      ancillaries: {
        groups: [
          {
            kind: "insurance",
            label: "Cover for this trip",
            offers: [],
            diagnostics: [{ sourceId: "source_1", status: "timeout" }],
          },
        ],
      },
    }

    expect(canAdvanceFromStep("ancillaries", emptyDraft(ENTITY), shape, true)).toBe(true)
  })

  it("holds until the traveler makes an explicit decision", () => {
    const shape = shapeWith([group([offer()])])
    const draft = emptyDraft(ENTITY)

    // Silence is not a decline.
    expect(draft.ancillaries).toEqual([])
    expect(canAdvanceFromStep("ancillaries", draft, shape, true)).toBe(false)
  })

  it("advances on an explicit decline", () => {
    const shape = shapeWith([group([offer()])])
    const draft = setAncillarySelection(emptyDraft(ENTITY), "insurance", {
      kind: "insurance",
      decision: "declined",
      travelers: [],
      selectedOptionIds: [],
      acceptedDisclosures: [],
    })

    expect(canAdvanceFromStep("ancillaries", draft, shape, true)).toBe(true)
  })

  it("advances on an explicit acceptance", () => {
    const accepted = offer()
    const shape = shapeWith([group([accepted])])
    const draft = setAncillarySelection(emptyDraft(ENTITY), "insurance", {
      kind: "insurance",
      decision: "accepted",
      offerId: accepted.offerId,
      sourceId: accepted.sourceId,
      providerId: accepted.providerId,
      quoteRef: accepted.quoteRef,
      travelers: [],
      selectedOptionIds: [],
      acceptedDisclosures: [],
    })

    expect(canAdvanceFromStep("ancillaries", draft, shape, true)).toBe(true)
  })

  it("holds an acceptance until every required disclosure is acknowledged", () => {
    const accepted = offer({
      disclosures: [
        {
          kind: "product_information",
          label: "Product information document",
          versionId: "v3",
          url: "https://provider.test/ipid-v3.pdf",
          required: true,
        },
        {
          kind: "terms",
          label: "Terms",
          versionId: "v9",
          required: false,
        },
      ],
    })
    const shape = shapeWith([group([accepted])])
    const base = {
      kind: "insurance",
      decision: "accepted" as const,
      offerId: accepted.offerId,
      sourceId: accepted.sourceId,
      providerId: accepted.providerId,
      quoteRef: accepted.quoteRef,
      travelers: [],
      selectedOptionIds: [],
      acceptedDisclosures: [],
    }

    expect(
      canAdvanceFromStep(
        "ancillaries",
        setAncillarySelection(emptyDraft(ENTITY), "insurance", base),
        shape,
        true,
      ),
    ).toBe(false)

    expect(
      canAdvanceFromStep(
        "ancillaries",
        setAncillarySelection(emptyDraft(ENTITY), "insurance", {
          ...base,
          acceptedDisclosures: [
            {
              kind: "product_information",
              versionId: "v3",
              acceptedAt: "2026-08-16T09:00:00.000Z",
            },
          ],
        }),
        shape,
        true,
      ),
    ).toBe(true)
  })

  it("requires a decision for every offered group", () => {
    const shape: BookingRequirementsV1 = {
      ...defaultMinimalShape(),
      showsAncillaries: true,
      ancillaries: {
        groups: [
          group([offer()]),
          {
            kind: "assistance",
            label: "Roadside assistance",
            offers: [offer({ offerId: "offer_2", kind: "assistance" })],
            diagnostics: [],
          },
        ],
      },
    }
    const oneAnswered = setAncillarySelection(emptyDraft(ENTITY), "insurance", {
      kind: "insurance",
      decision: "declined",
      travelers: [],
      selectedOptionIds: [],
      acceptedDisclosures: [],
    })

    expect(canAdvanceFromStep("ancillaries", oneAnswered, shape, true)).toBe(false)

    const bothAnswered = setAncillarySelection(oneAnswered, "assistance", {
      kind: "assistance",
      decision: "declined",
      travelers: [],
      selectedOptionIds: [],
      acceptedDisclosures: [],
    })

    expect(canAdvanceFromStep("ancillaries", bothAnswered, shape, true)).toBe(true)
  })

  it("never treats an ineligible offer as an acceptance", () => {
    const blocked = offer({
      eligibility: {
        status: "ineligible",
        reasons: [{ code: "max_age", message: "One traveler is over the age limit." }],
      },
    })
    const shape = shapeWith([group([blocked])])
    const draft = setAncillarySelection(emptyDraft(ENTITY), "insurance", {
      kind: "insurance",
      decision: "accepted",
      offerId: blocked.offerId,
      sourceId: blocked.sourceId,
      providerId: blocked.providerId,
      quoteRef: blocked.quoteRef,
      travelers: [],
      selectedOptionIds: [],
      acceptedDisclosures: [],
    })

    expect(canAdvanceFromStep("ancillaries", draft, shape, true)).toBe(false)
  })
})
