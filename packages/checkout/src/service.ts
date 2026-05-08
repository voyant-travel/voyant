import { bookingItems, bookings, bookingTravelers } from "@voyantjs/bookings"
import {
  bookingPaymentSchedules,
  financeService,
  invoiceLineItems,
  invoiceNumberSeries,
  invoices,
  type PaymentSession,
} from "@voyantjs/finance"
import type {
  NotificationDelivery,
  NotificationReminderRun,
  NotificationService,
} from "@voyantjs/notifications"
import {
  notificationDeliveries,
  notificationReminderRules,
  notificationReminderRuns,
  notificationsService,
} from "@voyantjs/notifications"
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  BootstrapCheckoutCollectionInput,
  CheckoutBankTransferInstructionsRecord,
  CheckoutProviderStartInput,
  CheckoutReminderRunListQuery,
  InitiateCheckoutCollectionInput,
  PreviewCheckoutCollectionInput,
} from "./validation.js"

export interface CheckoutPolicyOptions {
  defaultCardCollectionTarget?: "schedule" | "invoice"
  defaultReminderCardCollectionTarget?: "schedule" | "invoice"
  defaultBankTransferDocumentType?: "proforma" | "invoice"
  defaultPaymentPlan?: {
    depositMode: "none" | "percentage" | "fixed_amount"
    depositValue: number
    balanceDueDaysBeforeStart: number
    clearExistingPending: boolean
    createGuarantee: boolean
    guaranteeType:
      | "deposit"
      | "credit_card"
      | "preauth"
      | "card_on_file"
      | "bank_transfer"
      | "voucher"
      | "agency_letter"
    notes?: string | null
  }
}

type LoadedBookingContext = {
  booking: typeof bookings.$inferSelect
  items: Array<typeof bookingItems.$inferSelect>
  participants: Array<typeof bookingTravelers.$inferSelect>
  schedules: Array<typeof bookingPaymentSchedules.$inferSelect>
  outstandingInvoices: Array<typeof invoices.$inferSelect>
}

export interface CheckoutCollectionPlan {
  bookingId: string
  method: "card" | "bank_transfer"
  stage: "initial" | "reminder" | "manual"
  paymentSessionTarget: "schedule" | "invoice" | null
  documentType: "proforma" | "invoice" | null
  willCreateDefaultPaymentPlan: boolean
  selectedSchedule: typeof bookingPaymentSchedules.$inferSelect | null
  selectedInvoice: typeof invoices.$inferSelect | null
  amountCents: number
  currency: string
  recommendedAction:
    | "create_bank_transfer_document"
    | "create_payment_session"
    | "create_invoice_then_payment_session"
    | "none"
}

export interface CheckoutBankTransferDetails {
  provider?: string | null
  beneficiary: string
  iban: string
  bankName?: string | null
  /**
   * Deploy-wide instructions appended to every bank-transfer block (e.g.
   * "Please reference your invoice number in the wire memo"). Per-call
   * notes from `initiateCheckoutCollection({ notes })` take precedence —
   * use this slot for boilerplate, not booking-specific content.
   */
  notes?: string | null
}

export interface CheckoutProviderStartResult {
  provider: string
  paymentSessionId: string
  redirectUrl: string | null
  externalReference: string | null
  providerSessionId: string | null
  providerPaymentId: string | null
  response: Record<string, unknown> | null
}

export interface CheckoutPaymentStarterContext {
  db: PostgresJsDatabase
  bookingId: string
  plan: CheckoutCollectionPlan
  invoice: typeof invoices.$inferSelect | null
  paymentSession: PaymentSession
  input: InitiateCheckoutCollectionInput
  startProvider: CheckoutProviderStartInput
  bindings: Record<string, unknown>
}

export type CheckoutPaymentStarter = (
  context: CheckoutPaymentStarterContext,
) => Promise<CheckoutProviderStartResult>

export interface InitiatedCheckoutCollection {
  plan: CheckoutCollectionPlan
  invoice: typeof invoices.$inferSelect | null
  paymentSession: PaymentSession | null
  invoiceNotification: NotificationDelivery | null
  paymentSessionNotification: NotificationDelivery | null
  bankTransferInstructions: CheckoutBankTransferInstructionsRecord | null
  providerStart: CheckoutProviderStartResult | null
}

export interface BootstrappedCheckoutCollection extends InitiatedCheckoutCollection {
  bookingId: string
  sessionId: string
  sourceType: "booking" | "session"
  intent: "deposit" | "balance" | "custom"
}

export interface CheckoutRuntimeOptions {
  bindings?: Record<string, unknown>
  bankTransferDetails?: CheckoutBankTransferDetails | null
  paymentStarters?: Record<string, CheckoutPaymentStarter>
}

export interface CheckoutReminderRunSummary {
  id: string
  reminderRuleId: string
  reminderRuleSlug: string | null
  reminderRuleName: string | null
  targetType: NotificationReminderRun["targetType"]
  targetId: string
  bookingId: string | null
  paymentSessionId: string | null
  notificationDeliveryId: string | null
  status: "queued" | "processing" | "sent" | "skipped" | "failed"
  deliveryStatus: "pending" | "sent" | "failed" | "cancelled" | null
  channel: "email" | "sms" | null
  provider: string | null
  recipient: string | null
  scheduledFor: string
  processedAt: string
  errorMessage: string | null
  createdAt: string
}

export interface CheckoutReminderRunList {
  data: CheckoutReminderRunSummary[]
  total: number
  limit: number
  offset: number
}

const OUTSTANDING_SCHEDULE_STATUSES: Array<
  (typeof bookingPaymentSchedules.$inferSelect)["status"]
> = ["pending", "due"]
const OUTSTANDING_INVOICE_STATUSES: Array<(typeof invoices.$inferSelect)["status"]> = [
  "draft",
  "sent",
  "partially_paid",
  "overdue",
]

function normalizeRequiredDateTime(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

function defaultPaymentPlan(options: CheckoutPolicyOptions) {
  return {
    depositMode: options.defaultPaymentPlan?.depositMode ?? "percentage",
    depositValue: options.defaultPaymentPlan?.depositValue ?? 30,
    balanceDueDaysBeforeStart: options.defaultPaymentPlan?.balanceDueDaysBeforeStart ?? 30,
    clearExistingPending: options.defaultPaymentPlan?.clearExistingPending ?? true,
    createGuarantee: options.defaultPaymentPlan?.createGuarantee ?? false,
    guaranteeType: options.defaultPaymentPlan?.guaranteeType ?? "deposit",
    notes: options.defaultPaymentPlan?.notes ?? null,
  } as const
}

export function resolvePaymentSessionTarget(
  method: "card" | "bank_transfer",
  stage: "initial" | "reminder" | "manual",
  override: "schedule" | "invoice" | undefined,
  options: CheckoutPolicyOptions,
) {
  if (method === "bank_transfer") return "invoice" as const
  if (override) return override
  if (stage === "reminder") return options.defaultReminderCardCollectionTarget ?? "schedule"
  return options.defaultCardCollectionTarget ?? "schedule"
}

function resolveDocumentType(
  method: "card" | "bank_transfer",
  target: "schedule" | "invoice" | null,
  options: CheckoutPolicyOptions,
) {
  if (method === "bank_transfer") {
    return options.defaultBankTransferDocumentType ?? "proforma"
  }
  if (target === "invoice") {
    return "invoice" as const
  }
  return null
}

function fallbackInvoiceNumber(
  bookingNumber: string,
  documentType: "proforma" | "invoice",
  amountCents: number,
) {
  const stamp = Date.now().toString(36).toUpperCase()
  const suffix = documentType === "proforma" ? "PF" : "INV"
  return `${bookingNumber}-${suffix}-${amountCents}-${stamp}`
}

function lineDescription(
  booking: typeof bookings.$inferSelect,
  schedule: typeof bookingPaymentSchedules.$inferSelect | null,
  stage: "initial" | "reminder" | "manual",
) {
  if (!schedule) {
    return `Booking ${booking.bookingNumber}`
  }
  const kind = schedule.scheduleType === "deposit" ? "deposit" : schedule.scheduleType
  if (stage === "reminder") {
    return `Booking ${booking.bookingNumber} ${kind} reminder`
  }
  return `Booking ${booking.bookingNumber} ${kind}`
}

function normalizeExactAmountCents(amountCents: number | undefined) {
  return typeof amountCents === "number" && Number.isFinite(amountCents) && amountCents > 0
    ? Math.round(amountCents)
    : null
}

function resolveCheckoutIntent(
  input:
    | Pick<BootstrapCheckoutCollectionInput, "intent" | "stage" | "amountCents">
    | Pick<InitiateCheckoutCollectionInput, "stage" | "amountCents">,
) {
  if ("intent" in input && input.intent) {
    return input.intent
  }

  if (
    typeof input.amountCents === "number" &&
    Number.isFinite(input.amountCents) &&
    input.amountCents > 0
  ) {
    return "custom" as const
  }

  if (input.stage === "initial") {
    return "deposit" as const
  }

  if (input.stage === "reminder") {
    return "balance" as const
  }

  return "custom" as const
}

function resolveCheckoutSubject(input: BootstrapCheckoutCollectionInput) {
  if (input.bookingId && input.sessionId && input.bookingId !== input.sessionId) {
    throw new Error("bookingId and sessionId must refer to the same booking session")
  }

  if (input.bookingId) {
    return {
      bookingId: input.bookingId,
      sessionId: input.sessionId ?? input.bookingId,
      sourceType: "booking" as const,
    }
  }

  if (input.sessionId) {
    return {
      bookingId: input.sessionId,
      sessionId: input.sessionId,
      sourceType: "session" as const,
    }
  }

  throw new Error("Provide a bookingId or sessionId")
}

function toInvoiceDueDateTime(value: string | null | undefined) {
  return value ? `${value}T00:00:00.000Z` : null
}

function buildBankTransferInstructions(
  invoice: typeof invoices.$inferSelect,
  details: CheckoutBankTransferDetails | null | undefined,
  callNotes?: string | null,
): CheckoutBankTransferInstructionsRecord | null {
  if (!details) {
    return null
  }

  return {
    provider: details.provider ?? null,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    documentType: invoice.invoiceType === "proforma" ? "proforma" : "invoice",
    amountCents: invoice.balanceDueCents,
    // Currency always tracks the invoice — the deploy-wide bank-transfer
    // block can't predict what the customer is buying. EUR booking +
    // RON-default env would have shown the wrong currency to the customer.
    currency: invoice.currency,
    dueDate: toInvoiceDueDateTime(invoice.dueDate),
    beneficiary: details.beneficiary,
    iban: details.iban,
    bankName: details.bankName ?? null,
    // Per-call notes win over deploy-wide boilerplate — the caller knows
    // booking context (invoice number, due date, etc.) the env can't.
    notes: callNotes ?? details.notes ?? null,
  }
}

async function loadBookingContext(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<LoadedBookingContext | null> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (!booking) return null

  const [items, participants, schedules, outstandingInvoices] = await Promise.all([
    db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId))
      .orderBy(bookingItems.createdAt),
    db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, bookingId))
      .orderBy(desc(bookingTravelers.isPrimary), bookingTravelers.createdAt),
    db
      .select()
      .from(bookingPaymentSchedules)
      .where(
        and(
          eq(bookingPaymentSchedules.bookingId, bookingId),
          inArray(bookingPaymentSchedules.status, OUTSTANDING_SCHEDULE_STATUSES),
        ),
      )
      .orderBy(asc(bookingPaymentSchedules.dueDate), asc(bookingPaymentSchedules.createdAt)),
    db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.bookingId, bookingId),
          inArray(invoices.status, OUTSTANDING_INVOICE_STATUSES),
          gt(invoices.balanceDueCents, 0),
        ),
      )
      .orderBy(desc(invoices.createdAt)),
  ])

  return {
    booking,
    items,
    participants,
    schedules,
    outstandingInvoices,
  }
}

async function ensurePaymentPlanIfNeeded(
  db: PostgresJsDatabase,
  bookingId: string,
  existingSchedules: Array<typeof bookingPaymentSchedules.$inferSelect>,
  input: PreviewCheckoutCollectionInput | InitiateCheckoutCollectionInput,
  options: CheckoutPolicyOptions,
) {
  if (existingSchedules.length > 0 || !input.ensureDefaultPaymentPlan) {
    return existingSchedules
  }

  const created = await financeService.applyDefaultBookingPaymentPlan(db, bookingId, {
    ...defaultPaymentPlan(options),
    ...(input.paymentPlan ?? {}),
  })

  return created ?? []
}

async function allocateDocumentNumber(
  db: PostgresJsDatabase,
  bookingNumber: string,
  documentType: "proforma" | "invoice",
  amountCents: number,
) {
  const [series] = await db
    .select()
    .from(invoiceNumberSeries)
    .where(eq(invoiceNumberSeries.scope, documentType))
    .orderBy(desc(invoiceNumberSeries.active), asc(invoiceNumberSeries.createdAt))
    .limit(1)

  if (!series) {
    return fallbackInvoiceNumber(bookingNumber, documentType, amountCents)
  }

  const allocated = await financeService.allocateInvoiceNumber(db, series.id)
  if (allocated.status === "allocated") {
    return allocated.formattedNumber
  }

  return fallbackInvoiceNumber(bookingNumber, documentType, amountCents)
}

function pickSchedule(
  schedules: Array<typeof bookingPaymentSchedules.$inferSelect>,
  scheduleId?: string,
) {
  if (scheduleId) {
    return schedules.find((schedule) => schedule.id === scheduleId) ?? null
  }
  return schedules[0] ?? null
}

function pickInvoice(outstandingInvoices: Array<typeof invoices.$inferSelect>, invoiceId?: string) {
  if (invoiceId) {
    return outstandingInvoices.find((invoice) => invoice.id === invoiceId) ?? null
  }
  return outstandingInvoices[0] ?? null
}

export async function previewCheckoutCollection(
  db: PostgresJsDatabase,
  bookingId: string,
  input: PreviewCheckoutCollectionInput,
  options: CheckoutPolicyOptions = {},
): Promise<CheckoutCollectionPlan | null> {
  const context = await loadBookingContext(db, bookingId)
  if (!context) return null

  const schedules = await ensurePaymentPlanIfNeeded(
    db,
    bookingId,
    context.schedules,
    input,
    options,
  )

  let paymentSessionTarget = resolvePaymentSessionTarget(
    input.method,
    input.stage,
    input.paymentSessionTarget,
    options,
  )
  let documentType = resolveDocumentType(input.method, paymentSessionTarget, options)
  let selectedSchedule = pickSchedule(schedules, input.scheduleId)
  let selectedInvoice = pickInvoice(context.outstandingInvoices, input.invoiceId)
  const requestedAmountCents = normalizeExactAmountCents(input.amountCents)

  let amountCents = 0
  if (requestedAmountCents !== null) {
    amountCents = requestedAmountCents

    if (
      paymentSessionTarget === "schedule" &&
      selectedSchedule &&
      selectedSchedule.amountCents === requestedAmountCents
    ) {
      selectedInvoice = null
    } else {
      paymentSessionTarget = "invoice"
      documentType = resolveDocumentType(input.method, paymentSessionTarget, options)
      selectedInvoice =
        selectedInvoice && selectedInvoice.balanceDueCents === requestedAmountCents
          ? selectedInvoice
          : null
      selectedSchedule = null
    }
  } else if (paymentSessionTarget === "invoice") {
    amountCents =
      selectedInvoice?.balanceDueCents ??
      selectedSchedule?.amountCents ??
      context.booking.sellAmountCents ??
      0
  } else if (paymentSessionTarget === "schedule") {
    amountCents = selectedSchedule?.amountCents ?? context.booking.sellAmountCents ?? 0
  }

  let recommendedAction: CheckoutCollectionPlan["recommendedAction"] = "none"
  if (input.method === "bank_transfer") {
    recommendedAction = "create_bank_transfer_document"
  } else if (paymentSessionTarget === "invoice") {
    recommendedAction = selectedInvoice
      ? "create_payment_session"
      : "create_invoice_then_payment_session"
  } else if (paymentSessionTarget === "schedule") {
    recommendedAction = "create_payment_session"
  }

  return {
    bookingId,
    method: input.method,
    stage: input.stage,
    paymentSessionTarget,
    documentType,
    willCreateDefaultPaymentPlan: context.schedules.length === 0 && schedules.length > 0,
    selectedSchedule,
    selectedInvoice,
    amountCents,
    currency: context.booking.sellCurrency,
    recommendedAction,
  }
}

async function createCollectionInvoice(
  db: PostgresJsDatabase,
  context: LoadedBookingContext,
  plan: CheckoutCollectionPlan,
  notes?: string | null,
) {
  const amountCents = plan.amountCents
  const issueDate = new Date().toISOString().slice(0, 10)
  const dueDate = plan.selectedSchedule?.dueDate ?? issueDate
  const documentType = plan.documentType ?? "invoice"
  const invoiceNumber = await allocateDocumentNumber(
    db,
    context.booking.bookingNumber,
    documentType,
    amountCents,
  )

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      bookingId: context.booking.id,
      personId: context.booking.personId,
      organizationId: context.booking.organizationId,
      invoiceType: documentType,
      status: "sent",
      currency: context.booking.sellCurrency,
      baseCurrency: context.booking.baseCurrency,
      fxRateSetId: null,
      subtotalCents: amountCents,
      baseSubtotalCents: context.booking.baseSellAmountCents,
      taxCents: 0,
      baseTaxCents: null,
      totalCents: amountCents,
      baseTotalCents: context.booking.baseSellAmountCents,
      paidCents: 0,
      basePaidCents: 0,
      balanceDueCents: amountCents,
      baseBalanceDueCents: context.booking.baseSellAmountCents,
      commissionAmountCents: null,
      issueDate,
      dueDate,
      notes: notes ?? plan.selectedSchedule?.notes ?? null,
    })
    .returning()

  if (!invoice) {
    throw new Error("Failed to create collection invoice")
  }

  await db.insert(invoiceLineItems).values({
    invoiceId: invoice.id,
    bookingItemId: plan.selectedSchedule?.bookingItemId ?? null,
    description: lineDescription(context.booking, plan.selectedSchedule, plan.stage),
    quantity: 1,
    unitPriceCents: amountCents,
    totalCents: amountCents,
    taxRate: null,
    sortOrder: 0,
  })

  return invoice
}

export async function initiateCheckoutCollection(
  db: PostgresJsDatabase,
  bookingId: string,
  input: InitiateCheckoutCollectionInput,
  options: CheckoutPolicyOptions = {},
  dispatcher?: NotificationService,
  runtime: CheckoutRuntimeOptions = {},
): Promise<InitiatedCheckoutCollection | null> {
  const context = await loadBookingContext(db, bookingId)
  if (!context) return null

  const plan = await previewCheckoutCollection(db, bookingId, input, options)
  if (!plan) return null
  if (plan.amountCents <= 0) {
    throw new Error("No outstanding amount available for collection")
  }

  let invoice = plan.selectedInvoice
  let paymentSession: PaymentSession | null = null
  let invoiceNotification: NotificationDelivery | null = null
  let paymentSessionNotification: NotificationDelivery | null = null
  let bankTransferInstructions: CheckoutBankTransferInstructionsRecord | null = null
  let providerStart: CheckoutProviderStartResult | null = null

  if (input.method === "bank_transfer") {
    invoice = await createCollectionInvoice(db, context, plan, input.notes ?? null)
    bankTransferInstructions = buildBankTransferInstructions(
      invoice,
      runtime.bankTransferDetails ?? null,
      input.notes ?? null,
    )

    if (dispatcher && input.invoiceNotification) {
      invoiceNotification = await notificationsService.sendInvoiceNotification(
        db,
        dispatcher,
        invoice.id,
        input.invoiceNotification,
      )
    }
  } else if (plan.paymentSessionTarget === "invoice") {
    if (!invoice) {
      invoice = await createCollectionInvoice(
        db,
        context,
        { ...plan, documentType: "invoice" },
        input.notes ?? null,
      )
    }

    paymentSession = await financeService.createPaymentSessionFromInvoice(db, invoice.id, {
      ...(input.paymentSession ?? {}),
      notes: input.notes ?? input.paymentSession?.notes ?? null,
    })

    if (!paymentSession) {
      throw new Error("Failed to create payment session from invoice")
    }

    if (dispatcher && input.invoiceNotification) {
      invoiceNotification = await notificationsService.sendInvoiceNotification(
        db,
        dispatcher,
        invoice.id,
        input.invoiceNotification,
      )
    }

    if (dispatcher && input.paymentSessionNotification) {
      paymentSessionNotification = await notificationsService.sendPaymentSessionNotification(
        db,
        dispatcher,
        paymentSession.id,
        input.paymentSessionNotification,
      )
    }
  } else {
    if (!plan.selectedSchedule) {
      throw new Error("No outstanding payment schedule available for collection")
    }

    paymentSession = await financeService.createPaymentSessionFromBookingSchedule(
      db,
      plan.selectedSchedule.id,
      {
        ...(input.paymentSession ?? {}),
        notes: input.notes ?? input.paymentSession?.notes ?? null,
      },
    )

    if (!paymentSession) {
      throw new Error("Failed to create payment session from booking schedule")
    }

    if (dispatcher && input.paymentSessionNotification) {
      paymentSessionNotification = await notificationsService.sendPaymentSessionNotification(
        db,
        dispatcher,
        paymentSession.id,
        input.paymentSessionNotification,
      )
    }
  }

  if (input.startProvider) {
    if (input.method !== "card") {
      throw new Error("Provider start is only available for card collections")
    }
    if (!paymentSession) {
      throw new Error("No payment session available for provider start")
    }

    const starter = runtime.paymentStarters?.[input.startProvider.provider]
    if (!starter) {
      throw new Error(`Payment provider "${input.startProvider.provider}" is not configured`)
    }

    providerStart = await starter({
      db,
      bookingId,
      plan,
      invoice: invoice ?? null,
      paymentSession,
      input,
      startProvider: input.startProvider,
      bindings: runtime.bindings ?? {},
    })

    if (providerStart.paymentSessionId !== paymentSession.id) {
      const updatedSession = await financeService.getPaymentSessionById(
        db,
        providerStart.paymentSessionId,
      )
      paymentSession = updatedSession ?? paymentSession
    } else {
      const updatedSession = await financeService.getPaymentSessionById(db, paymentSession.id)
      paymentSession = updatedSession ?? paymentSession
    }
  }

  return {
    plan,
    invoice: invoice ?? null,
    paymentSession,
    invoiceNotification,
    paymentSessionNotification,
    bankTransferInstructions,
    providerStart,
  }
}

export async function bootstrapCheckoutCollection(
  db: PostgresJsDatabase,
  input: BootstrapCheckoutCollectionInput,
  options: CheckoutPolicyOptions = {},
  dispatcher?: NotificationService,
  runtime: CheckoutRuntimeOptions = {},
): Promise<BootstrappedCheckoutCollection | null> {
  const subject = resolveCheckoutSubject(input)
  const initiated = await initiateCheckoutCollection(
    db,
    subject.bookingId,
    {
      method: input.method,
      stage: input.stage,
      scheduleId: input.scheduleId,
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      ensureDefaultPaymentPlan: input.ensureDefaultPaymentPlan,
      paymentSessionTarget: input.paymentSessionTarget,
      paymentPlan: input.paymentPlan,
      paymentSession: input.paymentSession,
      paymentSessionNotification: input.paymentSessionNotification,
      invoiceNotification: input.invoiceNotification,
      startProvider: input.startProvider,
      notes: input.notes,
    },
    options,
    dispatcher,
    runtime,
  )

  if (!initiated) {
    return null
  }

  return {
    bookingId: subject.bookingId,
    sessionId: subject.sessionId,
    sourceType: subject.sourceType,
    intent: resolveCheckoutIntent(input),
    ...initiated,
  }
}

export async function listBookingReminderRuns(
  db: PostgresJsDatabase,
  bookingId: string,
  query: CheckoutReminderRunListQuery,
): Promise<CheckoutReminderRunList> {
  const where = and(
    eq(notificationReminderRuns.bookingId, bookingId),
    ...(query.status ? [eq(notificationReminderRuns.status, query.status)] : []),
  )

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: notificationReminderRuns.id,
        reminderRuleId: notificationReminderRuns.reminderRuleId,
        targetType: notificationReminderRuns.targetType,
        targetId: notificationReminderRuns.targetId,
        bookingId: notificationReminderRuns.bookingId,
        paymentSessionId: notificationReminderRuns.paymentSessionId,
        notificationDeliveryId: notificationReminderRuns.notificationDeliveryId,
        status: notificationReminderRuns.status,
        recipient: notificationReminderRuns.recipient,
        scheduledFor: notificationReminderRuns.scheduledFor,
        processedAt: notificationReminderRuns.processedAt,
        errorMessage: notificationReminderRuns.errorMessage,
        createdAt: notificationReminderRuns.createdAt,
        reminderRuleSlug: notificationReminderRules.slug,
        reminderRuleName: notificationReminderRules.name,
        channel: notificationReminderRules.channel,
        ruleProvider: notificationReminderRules.provider,
        deliveryStatus: notificationDeliveries.status,
        deliveryProvider: notificationDeliveries.provider,
      })
      .from(notificationReminderRuns)
      .leftJoin(
        notificationReminderRules,
        eq(notificationReminderRules.id, notificationReminderRuns.reminderRuleId),
      )
      .leftJoin(
        notificationDeliveries,
        eq(notificationDeliveries.id, notificationReminderRuns.notificationDeliveryId),
      )
      .where(where)
      .orderBy(desc(notificationReminderRuns.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(notificationReminderRuns).where(where),
  ])

  return {
    data: rows.map((row) => ({
      id: row.id,
      reminderRuleId: row.reminderRuleId,
      reminderRuleSlug: row.reminderRuleSlug ?? null,
      reminderRuleName: row.reminderRuleName ?? null,
      targetType: row.targetType,
      targetId: row.targetId,
      bookingId: row.bookingId ?? null,
      paymentSessionId: row.paymentSessionId ?? null,
      notificationDeliveryId: row.notificationDeliveryId ?? null,
      status: row.status,
      deliveryStatus: row.deliveryStatus ?? null,
      channel: row.channel ?? null,
      provider: row.deliveryProvider ?? row.ruleProvider ?? null,
      recipient: row.recipient ?? null,
      scheduledFor: normalizeRequiredDateTime(row.scheduledFor),
      processedAt: normalizeRequiredDateTime(row.processedAt),
      errorMessage: row.errorMessage ?? null,
      createdAt: normalizeRequiredDateTime(row.createdAt),
    })),
    total: countResult[0]?.count ?? 0,
    limit: query.limit,
    offset: query.offset,
  }
}
