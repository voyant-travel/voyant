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
import { formatMessage, useBookingsUiMessagesOrDefault } from "../../i18n/index.js"
import { type Draft, emptyDraft, totalPax } from "../lib/draft-state.js"
import { evaluatePaxBandDependencies } from "../lib/pax-band-dependencies.js"
import {
  type BookingJourneyProps,
  type ContractAcceptanceEvent,
  JOURNEY_STEP_ORDER,
  type JourneyStep,
} from "../types.js"
import { ContractPreviewDialog } from "./contract-preview-dialog.js"
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
  const messages = useBookingsUiMessagesOrDefault()
  const surface = props.surface ?? "admin"

  const [draft, setDraft] = useState<Draft>(() => {
    const base = emptyDraft(
      {
        module: props.entityModule,
        id: props.entityId,
        // Empty when storefront — the public engine route resolves
        // it server-side from (entityModule, entityId).
        sourceKind: props.sourceKind ?? "",
        sourceConnectionId: props.sourceConnectionId,
        sourceRef: props.sourceRef,
      },
      { buyerType: props.defaultBuyerType ?? (surface === "admin" ? "B2B" : "B2C") },
    )
    // Seed Configure when the caller passed pre-locked state —
    // detail page picks departure + pax, booking flow only handles
    // travelers + addons + payment.
    if (props.initialConfigure) {
      const seed = props.initialConfigure as Record<string, unknown>
      const seedPax = seed.pax as Record<string, number> | undefined
      base.configure = Object.assign({}, base.configure, seed, {
        pax: { ...base.configure.pax, ...(seedPax ?? {}) },
      }) as typeof base.configure
    }
    if (props.initialAccommodation) {
      const seed = props.initialAccommodation as Record<string, unknown>
      base.accommodation = Object.assign(
        { rooms: [], travelerAssignments: {} },
        base.accommodation ?? {},
        seed,
      ) as typeof base.accommodation
    }
    return base
  })

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
  const hideConfigure = props.hideConfigure === true
  const steps = useMemo<ReadonlyArray<JourneyStep>>(
    () =>
      JOURNEY_STEP_ORDER.filter((s) => {
        if (hideConfigure && s === "configure") return false
        return isStepVisible(s, shape)
      }),
    [shape, hideConfigure],
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
    // Inquiry mode is the lead-form path — capture the lead without
    // burning capacity. The operator follows up before any inventory
    // is touched.
    if (draft.payment.intent === "inquiry") return
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
  const warnings = warningsForStep(currentStep, draft, shape, messages)
  const [isAdvanceGuardPending, setIsAdvanceGuardPending] = useState(false)
  const [advanceGuardError, setAdvanceGuardError] = useState<string | null>(null)

  const idx = steps.indexOf(currentStep)
  const next = steps[idx + 1]
  const prev = steps[idx - 1]

  const advance = async () => {
    if (!next || !canAdvance || isAdvanceGuardPending) return
    setAdvanceGuardError(null)

    if (props.onBeforeStepAdvance) {
      setIsAdvanceGuardPending(true)
      try {
        const guardResult = await props.onBeforeStepAdvance({
          currentStep,
          nextStep: next,
          draft,
          pricing: quote.data?.pricing ?? null,
          quoteId: quote.data?.quoteId,
          surface,
        })
        if (
          guardResult &&
          typeof guardResult === "object" &&
          "draft" in guardResult &&
          guardResult.draft
        ) {
          setDraft(guardResult.draft)
        }

        if (guardResult === false) {
          setAdvanceGuardError(messages.bookingJourney.validation.completeStepBeforeContinuing)
          return
        }
        if (
          guardResult &&
          typeof guardResult === "object" &&
          "allow" in guardResult &&
          guardResult.allow === false
        ) {
          setAdvanceGuardError(
            guardResult.message ?? messages.bookingJourney.validation.completeStepBeforeContinuing,
          )
          return
        }
      } catch (error) {
        setAdvanceGuardError(
          error instanceof Error
            ? error.message
            : messages.bookingJourney.validation.unableToContinue,
        )
        return
      } finally {
        setIsAdvanceGuardPending(false)
      }
    }

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

  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  // Tracks the multi-step storefront checkout flow (book →
  // checkout-start → redirect). The legacy in-process commit has
  // its own `commit.isPending` so the Confirm button merges both
  // when deciding whether to show a spinner.
  const [isHandlingCheckout, setIsHandlingCheckout] = useState(false)
  const contractConfig = props.contract
  const contractVariables = useMemo(() => {
    if (!contractConfig) return {}
    return contractConfig.resolveVariables({ draft, pricing: quote.data?.pricing ?? null })
  }, [contractConfig, draft, quote.data?.pricing])

  const commitDraft = async () => {
    if (!quote.data?.quoteId) return
    await commit.mutateAsync({
      draft: { ...draft, quoteId: quote.data.quoteId },
      quoteId: quote.data.quoteId,
      paymentIntent: { type: draft.payment.intent === "card" ? "card" : "hold" } as never,
    })
  }

  const handleAccepted = async (acceptance: ContractAcceptanceEvent | null) => {
    if (!props.onContractAccepted) {
      await commitDraft()
      return
    }
    setIsHandlingCheckout(true)
    try {
      await props.onContractAccepted(acceptance, {
        draft,
        pricing: quote.data?.pricing ?? null,
        quoteId: quote.data?.quoteId,
      })
    } finally {
      setIsHandlingCheckout(false)
    }
  }

  const onConfirm = async () => {
    if (!quote.data?.quoteId) return
    // 1. Contract is wired → open the dialog. Acceptance triggers
    //    onContractAccepted (the storefront's checkout-start path).
    // 2. No contract but onContractAccepted is wired → call it
    //    directly without an acceptance payload. The storefront uses
    //    this to drive the /book + /checkout/start handoff so card
    //    intents redirect to the PSP. Skipping the dialog when no
    //    template is configured is intentional — the dialog is an
    //    optional gate, not a required step.
    // 3. Neither wired → in-process commit (the operator dashboard's
    //    legacy path).
    if (contractConfig) {
      setContractDialogOpen(true)
      return
    }
    await handleAccepted(null)
  }

  const onContractAccept = async (acceptance: ContractAcceptanceEvent) => {
    setContractDialogOpen(false)
    await handleAccepted(acceptance)
  }

  return (
    <div className={props.className}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-8 md:items-start">
        <div className="space-y-6 md:col-span-5">
          <StepHeader
            current={currentStep}
            visited={[...visited]}
            steps={steps}
            shape={shape}
            onJumpTo={jumpTo}
          />

          {currentStep === "configure" ? (
            <ConfigureStep
              draft={draft}
              setDraft={setDraft}
              shape={shape}
              productId={props.entityId}
              renderDeparturePicker={props.renderDeparturePicker}
            />
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
              surface={surface}
              pricing={quote.data?.pricing ?? null}
            />
          ) : null}
          {currentStep === "review" ? (
            <ReviewStep
              draft={draft}
              setDraft={setDraft}
              isCommitting={commit.isPending || isHandlingCheckout}
              onConfirm={onConfirm}
              renderExtras={props.renderReviewExtras}
              surface={surface}
              pricing={quote.data?.pricing ?? null}
            />
          ) : null}

          {warnings.length > 0 ? (
            <ul className="space-y-1 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              {warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center gap-2">
            {/* Back doubles as "exit the journey" on the first step
                — when there's no previous step the button navigates
                via `onCancelled` (back to the storefront / detail
                page); on inner steps it just walks the wizard. One
                button to keep the bottom rail uncluttered. */}
            <Button
              type="button"
              variant="outline"
              disabled={isAdvanceGuardPending}
              onClick={() => {
                if (prev) goBack()
                else props.onCancelled?.()
              }}
            >
              {messages.bookingJourney.navigation.back}
            </Button>
            {next ? (
              <Button
                type="button"
                onClick={() => void advance()}
                disabled={!canAdvance || isAdvanceGuardPending}
                className="ml-auto"
              >
                {isAdvanceGuardPending
                  ? messages.bookingJourney.navigation.checking
                  : messages.bookingJourney.navigation.next}
              </Button>
            ) : null}
          </div>

          {advanceGuardError ? (
            <p className="text-destructive text-sm" role="alert" aria-live="polite">
              {advanceGuardError}
            </p>
          ) : null}

          {commit.error ? (
            <p className="text-destructive text-sm">
              {commit.error instanceof Error ? commit.error.message : String(commit.error)}
            </p>
          ) : null}
        </div>

        <aside className="md:sticky md:top-4 md:col-span-3">
          <PriceSidePanel
            pricing={quote.data?.pricing ?? null}
            isQuoting={quote.isQuoting}
            invalidReason={quote.data?.invalidReason}
            entitySummary={props.entitySummary}
            currentStep={currentStep}
            steps={steps}
            shape={shape}
            draft={draft}
            className={props.sidePanelClassName}
          />
        </aside>
      </div>

      {contractConfig ? (
        <ContractPreviewDialog
          open={contractDialogOpen}
          onOpenChange={setContractDialogOpen}
          previewUrl={contractConfig.previewUrl}
          acceptLanguage={contractConfig.acceptLanguage}
          variables={contractVariables}
          marketingLabel={contractConfig.marketingLabel as string | undefined}
          termsLabel={contractConfig.termsLabel}
          onAccept={onContractAccept}
        />
      ) : null}
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
      if (total < shape.paxBandsAllowedTotal.min || total > shape.paxBandsAllowedTotal.max) {
        return false
      }
      // Occupancy rules (e.g. "Child under 6 requires an Adult") must hold.
      return (
        evaluatePaxBandDependencies(draft.configure.pax, shape.paxBandDependencies, shape.paxBands)
          .length === 0
      )
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
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>,
): ReadonlyArray<string> {
  const warnings: string[] = []
  switch (step) {
    case "billing": {
      const c = draft.billing.contact
      if (c.phone == null || c.phone.length === 0) {
        warnings.push(messages.bookingJourney.warnings.phoneMissing)
      }
      if (!draft.billing.address.country) {
        warnings.push(messages.bookingJourney.warnings.billingCountryMissing)
      }
      if (draft.billing.buyerType === "B2B" && !draft.billing.company?.vatId) {
        warnings.push(messages.bookingJourney.warnings.vatMissing)
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
            const traveler =
              `${t.firstName || messages.bookingJourney.steps.travelers} ${t.lastName || ""}`.trim()
            warnings.push(
              formatMessage(messages.bookingJourney.warnings.travelerFieldRequired, {
                traveler,
                field: labelForFieldKey(key, shape),
              }),
            )
          }
        }
      }
      break
    }
    case "review": {
      if (!draft.payment.intent) {
        warnings.push(messages.bookingJourney.warnings.paymentIntentMissing)
      }
      if (draft.travelers.length === 0) {
        warnings.push(messages.bookingJourney.warnings.noTravelers)
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
    // Engine-level allow list. Capabilities (per-deployment toggles)
    // narrow further at render time — listing every supported intent
    // here means consumers can opt in via PaymentProviderCapabilities
    // without needing a custom fallbackShape.
    paymentIntents: ["card", "bank_transfer", "hold", "inquiry", "ticket_on_credit"],
  }
}
