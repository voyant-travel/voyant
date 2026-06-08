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
import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
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
  DepartureStep,
  OptionsStep,
  PaymentStep,
  ReviewStep,
  TravelersStep,
} from "./journey-steps.js"
import { PriceSidePanel } from "./side-panel.js"
import { StepHeader } from "./step-header.js"

export function BookingJourney(props: BookingJourneyProps): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const surface = props.surface ?? "admin"
  // Admin books on a single stacked page (nothing hidden); the storefront
  // keeps the guided one-step-at-a-time wizard. Two deliberately separate
  // flows — see BookingJourneyProps.layout.
  const layout = props.layout ?? (surface === "admin" ? "stacked" : "wizard")

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
        // `hideConfigure` skips the configure phase — now split across the
        // Departure + Options steps.
        if (hideConfigure && (s === "departure" || s === "options")) return false
        return isStepVisible(s, shape)
      }),
    [shape, hideConfigure],
  )

  const [currentStep, setCurrentStep] = useState<JourneyStep>(() => steps[0] ?? "departure")
  const [visited, setVisited] = useState<Set<JourneyStep>>(() => new Set([steps[0] ?? "departure"]))

  // If the descriptor changes and removes the current step, reset to
  // the first available step. (Edge case: shape goes from
  // owned→sourced and the relevant step set narrows.)
  useEffect(() => {
    if (!steps.includes(currentStep)) {
      setCurrentStep(steps[0] ?? "departure")
    }
  }, [steps, currentStep])

  // PUT the draft to the server to keep the recovery surface fresh
  // without saving on every keystroke. Wizard saves on each step
  // transition; the stacked admin page has no steps, so it saves on
  // each settled quote (a natural, debounced cadence). The mutation
  // reads the latest draft + quote from the closure on each fire.
  const saveTrigger = layout === "wizard" ? currentStep : (quote.data?.quoteId ?? "")
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fires on save trigger only
  useEffect(() => {
    draftSync.save.mutate({
      draft: { ...draft, quoteId: quote.data?.quoteId },
      currentStep,
      currentQuoteId: quote.data?.quoteId,
    })
  }, [saveTrigger])

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
    // Wizard: don't hold while still on the configure steps. Stacked:
    // everything's on one page, so the signature (slot + pax present)
    // is the trigger.
    if (layout === "wizard" && (currentStep === "departure" || currentStep === "options")) return
    if (!holdSignature) return
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

  const available = quote.data?.available !== false
  const canAdvance = canAdvanceFromStep(currentStep, draft, shape, available)
  const warnings = warningsForStep(currentStep, draft, shape, messages)

  // Stacked layout: there's no "current" step, but the section nav still
  // nudges toward the first thing that isn't done yet, and the final
  // Confirm is gated until every section passes its check.
  const firstIncomplete = useMemo<JourneyStep>(
    () =>
      steps.find((s) => !canAdvanceFromStep(s, draft, shape, available)) ??
      steps[steps.length - 1] ??
      steps[0] ??
      "departure",
    [steps, draft, shape, available],
  )
  const canCommit = useMemo(
    () => steps.every((s) => canAdvanceFromStep(s, draft, shape, available)),
    [steps, draft, shape, available],
  )
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

  // Renders one step's content. Shared by both layouts — the wizard shows
  // exactly one at a time; the stacked page renders them all in sections.
  const renderStep = (step: JourneyStep): React.ReactNode => {
    switch (step) {
      case "departure":
        // First load: the descriptor arrives with the first quote. Show a
        // skeleton rather than the generic fallback, which would flash and
        // then shift into the real layout.
        return !quote.data && quote.isQuoting ? (
          <ConfigureStepSkeleton />
        ) : (
          <DepartureStep
            draft={draft}
            setDraft={setDraft}
            shape={shape}
            productId={props.entityId}
            renderDeparturePicker={props.renderDeparturePicker}
          />
        )
      case "options":
        return (
          <OptionsStep
            draft={draft}
            setDraft={setDraft}
            shape={shape}
            productId={props.entityId}
            renderUnitsPicker={props.renderUnitsPicker}
          />
        )
      case "billing":
        return (
          <BillingStep
            draft={draft}
            setDraft={setDraft}
            shape={shape}
            renderLeadContactPicker={props.renderLeadContactPicker}
            renderExtras={props.renderBillingExtras}
          />
        )
      case "travelers":
        return (
          <TravelersStep
            draft={draft}
            setDraft={setDraft}
            shape={shape}
            renderTravelerContactPicker={props.renderTravelerContactPicker}
          />
        )
      case "accommodation":
        return <AccommodationStep draft={draft} setDraft={setDraft} shape={shape} />
      case "addons":
        return <AddonsStep draft={draft} setDraft={setDraft} shape={shape} />
      case "payment":
        return (
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
        )
      case "review":
        return (
          <ReviewStep
            draft={draft}
            setDraft={setDraft}
            isCommitting={commit.isPending || isHandlingCheckout}
            onConfirm={onConfirm}
            // Stacked has no per-step gates, so the Confirm button enforces
            // the whole-booking validity itself.
            canConfirm={layout === "stacked" ? canCommit : undefined}
            renderExtras={props.renderReviewExtras}
            surface={surface}
            pricing={quote.data?.pricing ?? null}
          />
        )
    }
  }

  if (layout === "stacked") {
    return (
      <StackedJourney
        className={props.className}
        steps={steps}
        shape={shape}
        firstIncomplete={firstIncomplete}
        renderStep={renderStep}
        warningsForStep={(s) => warningsForStep(s, draft, shape, messages)}
        commitError={commit.error}
        onCancel={props.onCancelled}
        cancelLabel={messages.bookingJourney.navigation.back}
        sidePanel={
          <PriceSidePanel
            pricing={quote.data?.pricing ?? null}
            isQuoting={quote.isQuoting}
            invalidReason={quote.data?.invalidReason}
            entitySummary={props.entitySummary}
            currentStep={firstIncomplete}
            steps={steps}
            shape={shape}
            draft={draft}
            className={props.sidePanelClassName}
          />
        }
        contractDialog={
          contractConfig ? (
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
          ) : null
        }
      />
    )
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

          {currentStep === "departure" ? (
            // First load: the descriptor arrives with the first quote. Show a
            // skeleton rather than the generic fallback, which would flash
            // and then shift into the real layout.
            !quote.data && quote.isQuoting ? (
              <ConfigureStepSkeleton />
            ) : (
              <DepartureStep
                draft={draft}
                setDraft={setDraft}
                shape={shape}
                productId={props.entityId}
                renderDeparturePicker={props.renderDeparturePicker}
              />
            )
          ) : null}
          {currentStep === "options" ? (
            <OptionsStep
              draft={draft}
              setDraft={setDraft}
              shape={shape}
              productId={props.entityId}
              renderUnitsPicker={props.renderUnitsPicker}
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
            <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
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

const sectionId = (step: JourneyStep): string => `bj-section-${step}`

/**
 * The admin's single-page booking layout — every section stacked as its
 * own block so nothing is hidden. A sticky section nav (the same numbered
 * stepper) scroll-jumps between blocks and highlights the first section
 * that still needs attention. Each block carries its own inline warnings;
 * the Review block's Confirm is gated on the whole booking being valid.
 */
function StackedJourney({
  className,
  steps,
  shape,
  firstIncomplete,
  renderStep,
  warningsForStep,
  commitError,
  onCancel,
  cancelLabel,
  sidePanel,
  contractDialog,
}: {
  className?: string
  steps: ReadonlyArray<JourneyStep>
  shape: BookingDraftShape
  firstIncomplete: JourneyStep
  renderStep: (step: JourneyStep) => React.ReactNode
  warningsForStep: (step: JourneyStep) => ReadonlyArray<string>
  commitError: unknown
  onCancel?: () => void
  cancelLabel: string
  sidePanel: React.ReactNode
  contractDialog: React.ReactNode
}): React.ReactElement {
  const scrollToStep = (step: JourneyStep) => {
    if (typeof document === "undefined") return
    document.getElementById(sectionId(step))?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-8 md:items-start">
        <div className="space-y-6 md:col-span-5">
          {/* Sticky section nav — jump to any block, see what's still open. */}
          <div className="-mx-1 sticky top-0 z-10 bg-background/85 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <StepHeader
              current={firstIncomplete}
              visited={[...steps]}
              steps={steps}
              shape={shape}
              onJumpTo={scrollToStep}
            />
          </div>

          {steps.map((step) => {
            const stepWarnings = warningsForStep(step)
            return (
              <section key={step} id={sectionId(step)} className="scroll-mt-24 space-y-2">
                {renderStep(step)}
                {stepWarnings.length > 0 ? (
                  <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                    {stepWarnings.map((w) => (
                      <li key={w}>⚠ {w}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            )
          })}

          {commitError ? (
            <p className="text-destructive text-sm">
              {commitError instanceof Error ? commitError.message : String(commitError)}
            </p>
          ) : null}

          <div>
            <Button type="button" variant="outline" onClick={() => onCancel?.()}>
              {cancelLabel}
            </Button>
          </div>
        </div>

        <aside className="md:sticky md:top-4 md:col-span-3">{sidePanel}</aside>
      </div>
      {contractDialog}
    </div>
  )
}

function isStepVisible(step: JourneyStep, shape: BookingDraftShape): boolean {
  const subSteps = shape.configureSubSteps ?? []
  switch (step) {
    case "departure":
      // The departure step shows whenever the journey has a configure phase
      // (owned products always pick a departure; storefront free-date too).
      return shape.showsConfigure
    case "options":
      // The options step shows only when there's something to choose —
      // a product option, room/unit selection, or another configure
      // sub-step (cabin, date-range, air). Simple per-person tours skip it.
      return (
        shape.showsConfigure &&
        subSteps.some((s) => s.kind !== "departure" && s.kind !== "occupancy")
      )
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

/**
 * First-load placeholder for the Configure step. Mirrors the real layout
 * (departure, travelers, option) closely enough that swapping to the live
 * descriptor causes minimal layout shift.
 */
function ConfigureStepSkeleton(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-12 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function canAdvanceFromStep(
  step: JourneyStep,
  draft: Draft,
  shape: BookingDraftShape,
  available: boolean,
): boolean {
  if (!available) return false
  switch (step) {
    case "departure": {
      // Require a departure when the descriptor marks it required.
      const requiresDeparture = (shape.configureSubSteps ?? []).some(
        (s) => s.kind === "departure" && s.required,
      )
      if (!requiresDeparture) return true
      return Boolean(draft.configure.departureSlotId || draft.configure.departureDate)
    }
    case "options":
      // Rooms/options aren't hard-required here (availability is checked
      // above); the operator can proceed and refine.
      return true
    case "billing": {
      const c = draft.billing.contact
      return c.firstName.length > 0 && c.lastName.length > 0 && c.email.length > 0
    }
    case "travelers": {
      // Pax counts are set on this step now: require the allowed total and
      // that occupancy rules (e.g. "Child under 6 requires an Adult") hold.
      const total = totalPax(draft)
      if (total < shape.paxBandsAllowedTotal.min || total > shape.paxBandsAllowedTotal.max) {
        return false
      }
      if (
        evaluatePaxBandDependencies(draft.configure.pax, shape.paxBandDependencies, shape.paxBands)
          .length > 0
      ) {
        return false
      }
      // Hard-reject only on canonical traveler fields (firstName, lastName);
      // other required fields surface as warnings, fillable later.
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
