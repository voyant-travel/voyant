import { bookings } from "@voyant-travel/bookings/schema"
import type { EventBus } from "@voyant-travel/core"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type BookingDocumentAttachmentResolver,
  bookingDocumentNotificationsService,
} from "./service-booking-documents.js"
import type {
  BookingDocumentBundleItem,
  NotificationService,
  SendBookingDocumentsNotificationInput,
} from "./service-shared.js"
import {
  listBookingNotificationItems,
  listBookingNotificationParticipants,
  resolveReminderRecipient,
} from "./service-shared.js"

export const BOOKING_FULLY_PAID_EVENT = "booking.fully-paid" as const

export type BookingDocumentBundleLifecycleTrigger =
  | "booking.confirmed"
  | typeof BOOKING_FULLY_PAID_EVENT

export type BookingDocumentBundleLifecycleDocumentType = BookingDocumentBundleItem["documentType"]

export interface BookingDocumentBundleLifecycleEvent {
  bookingId: string
  bookingNumber?: string | null
  actorId?: string | null
  [key: string]: unknown
}

export interface BookingFullyPaidEvent extends BookingDocumentBundleLifecycleEvent {
  paymentSessionId?: string | null
  invoiceId?: string | null
  amountCents?: number | null
  currency?: string | null
  provider?: string | null
}

type BookingNotificationParticipant = Awaited<
  ReturnType<typeof listBookingNotificationParticipants>
>[number]
type BookingNotificationItem = Awaited<ReturnType<typeof listBookingNotificationItems>>[number]

export interface BookingDocumentBundleLifecycleContext {
  trigger: BookingDocumentBundleLifecycleTrigger
  event: BookingDocumentBundleLifecycleEvent
  booking: typeof bookings.$inferSelect
  customer: ReturnType<typeof resolveReminderRecipient>
  travelers: BookingNotificationParticipant[]
  items: BookingNotificationItem[]
  existingDocuments: BookingDocumentBundleItem[]
}

export interface BookingDocumentBundleLifecycleStep {
  source: "legal" | "finance" | "products" | "notification" | "policy"
  documentType?: BookingDocumentBundleLifecycleDocumentType
  status: "existing" | "created" | "skipped" | "sent" | "failed"
  reason?: string
}

export type BookingDocumentBundleLifecyclePolicyResult =
  | {
      status: "ok"
      bookingId: string
      documents: BookingDocumentBundleItem[]
      steps: BookingDocumentBundleLifecycleStep[]
    }
  | {
      status: "failed"
      bookingId: string
      steps: BookingDocumentBundleLifecycleStep[]
      error: string
    }

export type BookingDocumentBundleLifecycleResult =
  | BookingDocumentBundleLifecyclePolicyResult
  | { status: "not_found"; bookingId: string }

export interface BookingDocumentBundleLifecyclePolicyHelpers {
  refreshDocuments(): Promise<BookingDocumentBundleItem[]>
  ensureLegalDocuments?: BookingDocumentBundleLifecycleEnsureDocuments
  ensureFinanceDocuments?: BookingDocumentBundleLifecycleEnsureDocuments
  resolveBrochureDocuments?: BookingDocumentBundleLifecycleResolveBrochures
}

export type BookingDocumentBundleLifecyclePolicy = (
  context: BookingDocumentBundleLifecycleContext,
  helpers: BookingDocumentBundleLifecyclePolicyHelpers,
) =>
  | Promise<BookingDocumentBundleLifecyclePolicyResult>
  | BookingDocumentBundleLifecyclePolicyResult

export type BookingDocumentBundleLifecycleEnsureDocuments = (
  context: BookingDocumentBundleLifecycleContext,
  request: {
    trigger: BookingDocumentBundleLifecycleTrigger
    documentTypes: BookingDocumentBundleLifecycleDocumentType[]
  },
) =>
  | Promise<undefined | BookingDocumentBundleLifecycleStep[]>
  | undefined
  | BookingDocumentBundleLifecycleStep[]

export type BookingDocumentBundleLifecycleResolveBrochures = (
  context: BookingDocumentBundleLifecycleContext,
) => Promise<BookingDocumentBundleItem[]> | BookingDocumentBundleItem[]

export type BookingDocumentBundleNotificationPolicy = (
  context: BookingDocumentBundleLifecycleContext,
  result: Extract<BookingDocumentBundleLifecyclePolicyResult, { status: "ok" }>,
) =>
  | Promise<SendBookingDocumentsNotificationInput | false | null | undefined>
  | SendBookingDocumentsNotificationInput
  | false
  | null
  | undefined

export interface BookingDocumentBundleLifecycleStageOptions {
  documentTypes?: BookingDocumentBundleLifecycleDocumentType[]
  notification?: SendBookingDocumentsNotificationInput | false
}

export interface BookingDocumentBundleLifecycleOptions {
  enabled?: boolean
  confirmation?: BookingDocumentBundleLifecycleStageOptions
  fullyPaid?: BookingDocumentBundleLifecycleStageOptions
  policy?: BookingDocumentBundleLifecyclePolicy
  notificationPolicy?: BookingDocumentBundleNotificationPolicy
  ensureLegalDocuments?: BookingDocumentBundleLifecycleEnsureDocuments
  ensureFinanceDocuments?: BookingDocumentBundleLifecycleEnsureDocuments
  resolveBrochureDocuments?: BookingDocumentBundleLifecycleResolveBrochures
}

export interface RunBookingDocumentBundleLifecycleInput {
  trigger: BookingDocumentBundleLifecycleTrigger
  event: BookingDocumentBundleLifecycleEvent
}

interface BookingDocumentBundleLifecycleRuntime {
  eventBus?: EventBus
  attachmentResolver?: BookingDocumentAttachmentResolver
  resolveContext?: (
    db: PostgresJsDatabase,
    input: RunBookingDocumentBundleLifecycleInput,
  ) => Promise<BookingDocumentBundleLifecycleContext | null>
}

function stageOptionsForTrigger(
  options: BookingDocumentBundleLifecycleOptions,
  trigger: BookingDocumentBundleLifecycleTrigger,
) {
  return trigger === BOOKING_FULLY_PAID_EVENT ? options.fullyPaid : options.confirmation
}

function defaultDocumentTypesForTrigger(
  trigger: BookingDocumentBundleLifecycleTrigger,
): BookingDocumentBundleLifecycleDocumentType[] {
  return trigger === BOOKING_FULLY_PAID_EVENT ? ["contract", "invoice"] : ["contract", "proforma"]
}

function getRequestedDocumentTypes(
  options: BookingDocumentBundleLifecycleOptions,
  trigger: BookingDocumentBundleLifecycleTrigger,
) {
  return (
    stageOptionsForTrigger(options, trigger)?.documentTypes ??
    defaultDocumentTypesForTrigger(trigger)
  )
}

function hasDocument(
  documents: ReadonlyArray<BookingDocumentBundleItem>,
  documentType: BookingDocumentBundleLifecycleDocumentType,
) {
  return documents.some((document) => document.documentType === documentType)
}

function isFinanceDocumentType(
  documentType: BookingDocumentBundleLifecycleDocumentType,
): documentType is "invoice" | "proforma" {
  return documentType === "invoice" || documentType === "proforma"
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function generatorStep(
  source: "legal" | "finance",
  documentType: BookingDocumentBundleLifecycleDocumentType,
  status: BookingDocumentBundleLifecycleStep["status"],
  reason?: string,
): BookingDocumentBundleLifecycleStep {
  return {
    source,
    documentType,
    status,
    ...(reason ? { reason } : {}),
  }
}

export async function resolveBookingDocumentBundleLifecycleContext(
  db: PostgresJsDatabase,
  input: RunBookingDocumentBundleLifecycleInput,
): Promise<BookingDocumentBundleLifecycleContext | null> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, input.event.bookingId))
    .limit(1)

  if (!booking) {
    return null
  }

  const [bundle, travelers, items] = await Promise.all([
    bookingDocumentNotificationsService.listBookingDocumentBundle(db, booking.id),
    listBookingNotificationParticipants(db, booking.id),
    listBookingNotificationItems(db, booking.id),
  ])

  return {
    trigger: input.trigger,
    event: input.event,
    booking,
    customer: resolveReminderRecipient(booking, travelers),
    travelers,
    items,
    existingDocuments: bundle?.documents ?? [],
  }
}

export function createDefaultBookingDocumentBundlePolicy(
  options: BookingDocumentBundleLifecycleOptions,
): BookingDocumentBundleLifecyclePolicy {
  return async (context, helpers) => {
    const requestedTypes = getRequestedDocumentTypes(options, context.trigger)
    const steps: BookingDocumentBundleLifecycleStep[] = []
    let documents = context.existingDocuments

    const missingTypes = requestedTypes.filter(
      (documentType) => !hasDocument(documents, documentType),
    )
    const needsContract = missingTypes.includes("contract")
    const financeTypes = missingTypes.filter(isFinanceDocumentType)

    if (needsContract) {
      if (helpers.ensureLegalDocuments) {
        try {
          steps.push(
            ...((await helpers.ensureLegalDocuments(context, {
              trigger: context.trigger,
              documentTypes: ["contract"],
            })) ?? [generatorStep("legal", "contract", "created")]),
          )
          documents = await helpers.refreshDocuments()
        } catch (error) {
          return {
            status: "failed",
            bookingId: context.booking.id,
            steps: [
              ...steps,
              generatorStep("legal", "contract", "failed", messageFromError(error)),
            ],
            error: messageFromError(error),
          }
        }
      } else {
        steps.push(generatorStep("legal", "contract", "skipped", "no_generator"))
      }
    } else if (requestedTypes.includes("contract")) {
      steps.push(generatorStep("legal", "contract", "existing"))
    }

    for (const documentType of financeTypes) {
      if (!helpers.ensureFinanceDocuments) {
        steps.push(generatorStep("finance", documentType, "skipped", "no_generator"))
        continue
      }

      try {
        steps.push(
          ...((await helpers.ensureFinanceDocuments(context, {
            trigger: context.trigger,
            documentTypes: [documentType],
          })) ?? [generatorStep("finance", documentType, "created")]),
        )
        documents = await helpers.refreshDocuments()
      } catch (error) {
        return {
          status: "failed",
          bookingId: context.booking.id,
          steps: [
            ...steps,
            generatorStep("finance", documentType, "failed", messageFromError(error)),
          ],
          error: messageFromError(error),
        }
      }
    }

    for (const documentType of requestedTypes) {
      if (isFinanceDocumentType(documentType) && !financeTypes.includes(documentType)) {
        steps.push(generatorStep("finance", documentType, "existing"))
      }
    }

    if (requestedTypes.includes("brochure")) {
      if (helpers.resolveBrochureDocuments) {
        try {
          const brochures = await helpers.resolveBrochureDocuments(context)
          documents = [...documents, ...brochures]
          steps.push({
            source: "products",
            documentType: "brochure",
            status: brochures.length > 0 ? "existing" : "skipped",
            ...(brochures.length === 0 ? { reason: "not_available" } : {}),
          })
        } catch (error) {
          return {
            status: "failed",
            bookingId: context.booking.id,
            steps: [
              ...steps,
              {
                source: "products",
                documentType: "brochure",
                status: "failed",
                reason: messageFromError(error),
              },
            ],
            error: messageFromError(error),
          }
        }
      } else {
        steps.push({
          source: "products",
          documentType: "brochure",
          status: "skipped",
          reason: "no_resolver",
        })
      }
    }

    return {
      status: "ok",
      bookingId: context.booking.id,
      documents,
      steps,
    }
  }
}

function defaultNotificationInput(
  options: BookingDocumentBundleLifecycleOptions,
  context: BookingDocumentBundleLifecycleContext,
): SendBookingDocumentsNotificationInput | false | undefined {
  const stage = stageOptionsForTrigger(options, context.trigger)
  if (stage?.notification === false) return false
  return {
    ...(stage?.notification ?? {}),
    documentTypes:
      stage?.notification && "documentTypes" in stage.notification
        ? stage.notification.documentTypes
        : getRequestedDocumentTypes(options, context.trigger),
  }
}

export const bookingDocumentBundleLifecycleService = {
  async run(
    db: PostgresJsDatabase,
    dispatcher: NotificationService,
    input: RunBookingDocumentBundleLifecycleInput,
    options: BookingDocumentBundleLifecycleOptions = {},
    runtime: BookingDocumentBundleLifecycleRuntime = {},
  ): Promise<BookingDocumentBundleLifecycleResult> {
    const resolveContext = runtime.resolveContext ?? resolveBookingDocumentBundleLifecycleContext
    const context = await resolveContext(db, input)
    if (!context) {
      return { status: "not_found", bookingId: input.event.bookingId }
    }

    const helpers: BookingDocumentBundleLifecyclePolicyHelpers = {
      refreshDocuments: async () => {
        const bundle = await bookingDocumentNotificationsService.listBookingDocumentBundle(
          db,
          context.booking.id,
        )
        return bundle?.documents ?? []
      },
      ensureLegalDocuments: options.ensureLegalDocuments,
      ensureFinanceDocuments: options.ensureFinanceDocuments,
      resolveBrochureDocuments: options.resolveBrochureDocuments,
    }

    let policyResult: BookingDocumentBundleLifecyclePolicyResult
    try {
      const policy = options.policy ?? createDefaultBookingDocumentBundlePolicy(options)
      policyResult = await policy(context, helpers)
    } catch (error) {
      policyResult = {
        status: "failed",
        bookingId: context.booking.id,
        steps: [{ source: "policy", status: "failed", reason: messageFromError(error) }],
        error: messageFromError(error),
      }
    }

    if (policyResult.status !== "ok") {
      return policyResult
    }

    let notificationInput: SendBookingDocumentsNotificationInput | false | null | undefined
    try {
      notificationInput =
        options.notificationPolicy !== undefined
          ? await options.notificationPolicy(context, policyResult)
          : defaultNotificationInput(options, context)
    } catch (error) {
      return {
        status: "failed",
        bookingId: context.booking.id,
        steps: [
          ...policyResult.steps,
          { source: "notification", status: "failed", reason: messageFromError(error) },
        ],
        error: messageFromError(error),
      }
    }

    if (notificationInput === false || notificationInput == null) {
      return policyResult
    }

    let notification: Awaited<
      ReturnType<typeof bookingDocumentNotificationsService.sendBookingDocumentsNotification>
    >
    try {
      notification = await bookingDocumentNotificationsService.sendBookingDocumentsNotification(
        db,
        dispatcher,
        context.booking.id,
        notificationInput,
        { attachmentResolver: runtime.attachmentResolver, eventBus: runtime.eventBus },
      )
    } catch (error) {
      return {
        status: "failed",
        bookingId: context.booking.id,
        steps: [
          ...policyResult.steps,
          { source: "notification", status: "failed", reason: messageFromError(error) },
        ],
        error: messageFromError(error),
      }
    }

    return {
      ...policyResult,
      steps: [
        ...policyResult.steps,
        {
          source: "notification",
          status: notification.status === "sent" ? "sent" : "skipped",
          reason: notification.status === "sent" ? undefined : notification.status,
        },
      ],
    }
  },
}
