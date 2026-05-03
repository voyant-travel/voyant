"use client"

/**
 * `<BookingJourney />` — the unified booking journey shell.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §3 + §8.1.
 *
 * Composes:
 *   - draft state (held at this root, mutated by step components)
 *   - quote orchestration (debounced re-quote on every meaningful change)
 *   - server-side draft persistence (PUT on every step transition)
 *   - commit (Review step's Confirm button)
 *
 * Surface differences (CRM picker for operators vs. inline contact for
 * customers, B2B billing default vs. B2C, payment provider hookup) live
 * in injectable slots passed via props — same shell on every surface.
 */

import {
  type BookingDraftShape,
  DEFAULT_PAX_BANDS,
  defaultBookingFields,
  defaultDraftShapeFlags,
  defaultTravelerFields,
  paxBandsAllowedTotalFrom,
} from "@voyantjs/catalog/booking-engine"
import {
  useBookingCommit,
  useBookingDraft,
  useBookingDraftShape,
  useBookingHold,
  useBookingQuote,
} from "@voyantjs/catalog-react/booking-engine"
import { Button } from "@voyantjs/ui/components/button"
import { useEffect, useMemo, useRef, useState } from "react"

import { type Draft, emptyDraft, totalPax } from "../lib/draft-state.js"
import { type BookingJourneyProps, JOURNEY_STEP_ORDER, type JourneyStep } from "../types.js"

import {
  AccommodationStep,
  AddonsStep,
  BillingStep,
  ConfigureStep,
  PaymentStep,
  ReviewStep,
  TravelersStep,
} from "./journey-steps.js"
import { PriceSidePanel } from "./side-panel.js"
import { StepHeader } from "./step-header.js"

export function BookingJourney(props: BookingJourneyProps): React.ReactElement {
  const surface = props.surface ?? "admin"

  const [draft, setDraft] = useState<Draft>(() =>
    emptyDraft(
      {
        module: props.entityModule,
        id: props.entityId,
        sourceKind: props.sourceKind,
        sourceConnectionId: props.sourceConnectionId,
        sourceRef: props.sourceRef,
      },
      { buyerType: props.defaultBuyerType ?? (surface === "admin" ? "B2B" : "B2C") },
    ),
  )

  const fallbackShape: BookingDraftShape = useMemo(
    () => props.fallbackShape ?? defaultMinimalShape(),
    [props.fallbackShape],
  )

  // Server-side draft sync — PUT on each step transition. The shell
  // doesn't read from the server in Phase B (drafts are recovery
  // surface, not source of truth) but the wire is in place.
  const draftSync = useBookingDraft({
    surface,
    draftId: props.draftId,
    enableLoad: false,
  })

  // Live quote — debounced 250ms.
  const quote = useBookingQuote({
    surface,
    draft,
  })

  const shape = useBookingDraftShape({
    surface,
    quote: quote.data,
    fallback: fallbackShape,
  })

  // Step navigation — only show steps the descriptor says are relevant.
  const steps = useMemo<ReadonlyArray<JourneyStep>>(
    () => JOURNEY_STEP_ORDER.filter((s) => isStepVisible(s, shape)),
    [shape],
  )

  const [currentStep, setCurrentStep] = useState<JourneyStep>(() => steps[0] ?? "configure")
  const [visited, setVisited] = useState<Set<JourneyStep>>(() => new Set([steps[0] ?? "configure"]))

  // If the descriptor changes and removes the current step, reset to
  // the first available step. (Edge case: shape goes from
  // owned→sourced and the relevant step set narrows.)
  useEffect(() => {
    if (!steps.includes(currentStep)) {
      setCurrentStep(steps[0] ?? "configure")
    }
  }, [steps, currentStep])

  // PUT the draft to the server every time the user transitions
  // steps. Keeps the recovery surface fresh without saving on every
  // keystroke. The mutation reads the latest draft + quote from the
  // closure on each fire — adding them to the deps array would defeat
  // the "save on step change only" semantics.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fires on step transition only
  useEffect(() => {
    draftSync.save.mutate({
      draft: { ...draft, quoteId: quote.data?.quoteId },
      currentStep,
      currentQuoteId: quote.data?.quoteId,
    })
  }, [currentStep])

  // Commit
  const commit = useBookingCommit({
    surface,
    draftId: props.draftId,
    onCommitted: props.onCommitted,
  })

  // Inventory hold — fired when the user advances past Configure
  // with a slot + pax picked. Failures are non-blocking (the engine
  // re-validates capacity at commit time anyway); we just don't
  // want to silently let two shoppers race past Configure with one
  // capacity unit between them.
  const holdApi = useBookingHold({ surface })
  const holdState = useRef<{ holdToken?: string; signature?: string }>({})
  const holdSignature = makeHoldSignature(draft, props.entityModule, props.entityId)

  // biome-ignore lint/correctness/useExhaustiveDependencies: signature change is the only trigger; refs + closure read latest values
  useEffect(() => {
    if (currentStep === "configure" || !holdSignature) return
    if (holdState.current.signature === holdSignature) return
    const previousToken = holdState.current.holdToken
    holdState.current = { signature: holdSignature }
    void holdApi
      .place({
        entityModule: props.entityModule,
        entityId: props.entityId,
        draftId: props.draftId,
        parameters: {
          slotId: draft.configure.departureSlotId,
          paxCount: totalPax(draft),
          productId: props.entityId,
        },
      })
      .then((result) => {
        holdState.current = { holdToken: result.holdToken, signature: holdSignature }
      })
      .catch(() => {
        // Non-blocking — see comment above.
      })
    if (previousToken) {
      void holdApi
        .release({ entityModule: props.entityModule, holdToken: previousToken })
        .catch(() => {})
    }
  }, [holdSignature, currentStep])

  const canAdvance = canAdvanceFromStep(currentStep, draft, shape, quote.data?.available !== false)
  const warnings = warningsForStep(currentStep, draft, shape)

  const idx = steps.indexOf(currentStep)
  const next = steps[idx + 1]
  const prev = steps[idx - 1]

  const advance = () => {
    if (!next || !canAdvance) return
    setCurrentStep(next)
    setVisited((s) => new Set(s).add(next))
  }

  const goBack = () => {
    if (!prev) return
    setCurrentStep(prev)
  }

  const jumpTo = (step: JourneyStep) => {
    if (!visited.has(step) && step !== currentStep) return
    setCurrentStep(step)
  }

  const onConfirm = async () => {
    if (!quote.data?.quoteId) return
    await commit.mutateAsync({
      draft: { ...draft, quoteId: quote.data.quoteId },
      quoteId: quote.data.quoteId,
      paymentIntent: { type: draft.payment.intent === "card" ? "card" : "hold" } as never,
    })
  }

  return (
    <div className={props.className}>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <StepHeader
            current={currentStep}
            visited={[...visited]}
            steps={steps}
            shape={shape}
            onJumpTo={jumpTo}
          />

          {currentStep === "configure" ? (
            <ConfigureStep draft={draft} setDraft={setDraft} shape={shape} />
          ) : null}
          {currentStep === "billing" ? (
            <BillingStep
              draft={draft}
              setDraft={setDraft}
              shape={shape}
              renderLeadContactPicker={props.renderLeadContactPicker}
              renderExtras={props.renderBillingExtras}
            />
          ) : null}
          {currentStep === "travelers" ? (
            <TravelersStep
              draft={draft}
              setDraft={setDraft}
              shape={shape}
              renderTravelerContactPicker={props.renderTravelerContactPicker}
            />
          ) : null}
          {currentStep === "accommodation" ? (
            <AccommodationStep draft={draft} setDraft={setDraft} shape={shape} />
          ) : null}
          {currentStep === "addons" ? (
            <AddonsStep draft={draft} setDraft={setDraft} shape={shape} />
          ) : null}
          {currentStep === "payment" ? (
            <PaymentStep
              draft={draft}
              setDraft={setDraft}
              shape={shape}
              capabilities={
                props.paymentCapabilities ?? {
                  acceptsCard: false,
                  acceptsHold: true,
                  acceptsTicketOnCredit: false,
                }
              }
              renderProviderStep={props.renderPaymentProviderStep}
            />
          ) : null}
          {currentStep === "review" ? (
            <ReviewStep
              draft={draft}
              setDraft={setDraft}
              isCommitting={commit.isPending}
              onConfirm={onConfirm}
              renderExtras={props.renderReviewExtras}
            />
          ) : null}

          {warnings.length > 0 ? (
            <ul className="space-y-1 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              {warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={props.onCancelled}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={!prev} onClick={goBack}>
                Back
              </Button>
              {next ? (
                <Button type="button" onClick={advance} disabled={!canAdvance}>
                  Next
                </Button>
              ) : null}
            </div>
          </div>

          {commit.error ? (
            <p className="text-destructive text-sm">
              {commit.error instanceof Error ? commit.error.message : String(commit.error)}
            </p>
          ) : null}
        </div>

        <aside className="w-full lg:w-80">
          <PriceSidePanel
            pricing={quote.data?.pricing ?? null}
            isQuoting={quote.isQuoting}
            invalidReason={quote.data?.invalidReason}
            className={props.sidePanelClassName}
          />
        </aside>
      </div>
    </div>
  )
}

function isStepVisible(step: JourneyStep, shape: BookingDraftShape): boolean {
  switch (step) {
    case "configure":
      return shape.showsConfigure
    case "billing":
      return shape.showsBilling
    case "travelers":
      return shape.showsTravelers
    case "accommodation":
      return shape.showsAccommodation
    case "addons":
      return shape.showsAddons
    case "payment":
      return shape.showsPayment
    case "review":
      return shape.showsReview
  }
}

function canAdvanceFromStep(
  step: JourneyStep,
  draft: Draft,
  shape: BookingDraftShape,
  available: boolean,
): boolean {
  if (!available) return false
  switch (step) {
    case "configure": {
      const total = totalPax(draft)
      return total >= shape.paxBandsAllowedTotal.min && total <= shape.paxBandsAllowedTotal.max
    }
    case "billing": {
      const c = draft.billing.contact
      return c.firstName.length > 0 && c.lastName.length > 0 && c.email.length > 0
    }
    case "travelers": {
      // Hard-reject only on canonical traveler fields (firstName,
      // lastName) — those are always required regardless of
      // descriptor configuration. All other required fields surface
      // as warnings so operators can complete the journey and fill
      // them in later from the booking detail page.
      return draft.travelers.every((t) => t.firstName && t.lastName)
    }
    default:
      return true
  }
}

/**
 * Soft warnings for the current step — surfaced inline above the
 * Next button. Don't block advancement; they're hints. Per
 * booking-journey-architecture §12.5.
 *
 * The hard-reject path stays in `canAdvanceFromStep` for fields
 * that are physically required to commit (e.g. traveler names);
 * everything else is a warning here.
 */
function warningsForStep(
  step: JourneyStep,
  draft: Draft,
  shape: BookingDraftShape,
): ReadonlyArray<string> {
  const warnings: string[] = []
  switch (step) {
    case "billing": {
      const c = draft.billing.contact
      if (c.phone == null || c.phone.length === 0) {
        warnings.push("Phone number not set — useful for last-minute supplier contact.")
      }
      if (!draft.billing.address.country) {
        warnings.push("Billing country not set — taxes won't compute until it's filled in.")
      }
      if (draft.billing.buyerType === "B2B" && !draft.billing.company?.vatId) {
        warnings.push("VAT id missing — required for B2B reverse-charge invoicing.")
      }
      break
    }
    case "travelers": {
      const requiredKeys = shape.travelerFields.filter((f) => f.required).map((f) => f.key)
      const skipBaseline = new Set(["firstName", "lastName"])
      const optionalRequired = requiredKeys.filter((k) => !skipBaseline.has(k))
      for (const t of draft.travelers) {
        for (const key of optionalRequired) {
          const docs = t.documents ?? {}
          // Email is on the row directly; everything else lives in
          // the document map.
          const value = key === "email" ? t.email : (docs as Record<string, unknown>)[key]
          if (value == null || value === "") {
            const traveler = `${t.firstName || "Traveler"} ${t.lastName || ""}`.trim()
            warnings.push(`${traveler}: ${labelForFieldKey(key, shape)} is required.`)
          }
        }
      }
      break
    }
    case "review": {
      if (!draft.payment.intent) {
        warnings.push("Payment intent not set — booking will default to hold.")
      }
      if (draft.travelers.length === 0) {
        warnings.push("No travelers added — at least one is recommended for ops handoff.")
      }
      break
    }
  }
  return warnings
}

function labelForFieldKey(key: string, shape: BookingDraftShape): string {
  return shape.travelerFields.find((f) => f.key === key)?.label ?? key
}

/**
 * Compose a stable signature off the inputs the hold cares about.
 * Includes entity + slot + pax so any change re-issues the hold;
 * excludes billing / traveler details so cosmetic edits don't
 * thrash the inventory layer.
 */
function makeHoldSignature(draft: Draft, entityModule: string, entityId: string): string | null {
  const slot = draft.configure.departureSlotId
  if (!slot) return null
  const pax = totalPax(draft)
  if (pax <= 0) return null
  return `${entityModule}/${entityId}/${slot}/${pax}`
}

function defaultMinimalShape(): BookingDraftShape {
  return {
    ...defaultDraftShapeFlags(),
    paxBands: DEFAULT_PAX_BANDS,
    paxBandsAllowedTotal: paxBandsAllowedTotalFrom(DEFAULT_PAX_BANDS),
    travelerFields: defaultTravelerFields(),
    bookingFields: defaultBookingFields(),
    paymentIntents: ["hold"],
  }
}
