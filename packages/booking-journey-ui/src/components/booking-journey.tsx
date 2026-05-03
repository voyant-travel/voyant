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
  useBookingQuote,
} from "@voyantjs/catalog-react/booking-engine"
import { Button } from "@voyantjs/ui/components/button"
import { useEffect, useMemo, useState } from "react"

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

  const canAdvance = canAdvanceFromStep(currentStep, draft, shape, quote.data?.available !== false)

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
      // Hard-reject from descriptor (resolves §12.5 in the affirmative
      // for required fields). Soft warnings TBD.
      return draft.travelers.every((t) => t.firstName && t.lastName)
    }
    default:
      return true
  }
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
