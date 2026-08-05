/**
 * Fan one domain event out to the staff who asked to hear about it.
 *
 * The dispatcher owns sequencing and idempotency. It owns neither the data the
 * email shows (resolvers, supplied by the deployment) nor the operator's
 * identity (`operator_profile` belongs to `operator-settings`, so the brand is
 * supplied by the deployment too — reading it here would open a
 * `notifications->operator-settings` table-privacy pair that does not exist).
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { StaffAlertBrand } from "./emails/brand.js"
import { renderStaffAlertEmail } from "./emails/render.jsx"
import type { notificationTargetTypeEnum } from "./schema.js"
import { enqueueNotification } from "./service-durable-send.js"
import type { NotificationService } from "./service-shared.js"
import { resolveStaffAlertRecipients } from "./service-staff-alert-recipients.js"
import { getStaffAlertSetting, listStaffAlertOptOutUserIds } from "./service-staff-alerts.js"
import {
  getStaffAlertDefinition,
  type StaffAlertContextMap,
  type StaffAlertContextResolverRegistry,
  type StaffAlertEventKey,
} from "./staff-alert-registry.js"

type NotificationTargetType = (typeof notificationTargetTypeEnum.enumValues)[number]

/** Deployment-owned services the staff alert path needs. */
export interface StaffAlertRuntime {
  dispatcher: NotificationService
  resolvers: StaffAlertContextResolverRegistry
  /** Operator identity for the email shell. Resolved once per dispatch. */
  resolveBrand(db: PostgresJsDatabase): Promise<StaffAlertBrand>
}

export const STAFF_ALERT_RUNTIME_KEY = "notifications.staffAlertRuntime"

export interface DispatchStaffAlertInput {
  db: PostgresJsDatabase
  runtime: StaffAlertRuntime
  eventKey: StaffAlertEventKey
  /** Raw domain event payload. */
  payload: Record<string, unknown>
  /**
   * Event bus envelope id. The idempotency key is derived from it, so a
   * redelivered event collapses onto the original send rather than mailing
   * everyone twice.
   */
  eventId: string
}

export interface DispatchStaffAlertResult {
  /** Why nothing was sent, when nothing was. */
  skipped: "disabled" | "no-resolver" | "no-context" | "no-recipients" | null
  enqueued: number
}

/**
 * How a resolved context maps onto the delivery ledger's target columns, so a
 * staff alert is findable from the record it is about.
 */
function targetFor(
  eventKey: StaffAlertEventKey,
  context: StaffAlertContextMap[StaffAlertEventKey],
): {
  targetType: NotificationTargetType
  targetId: string | null
  bookingId: string | null
  invoiceId: string | null
  paymentSessionId: string | null
} {
  const empty = { bookingId: null, invoiceId: null, paymentSessionId: null }

  switch (eventKey) {
    case "staff.booking.confirmed":
    case "staff.booking.cancelled": {
      const typed = context as StaffAlertContextMap["staff.booking.confirmed"]
      return {
        ...empty,
        targetType: "booking",
        targetId: typed.bookingId,
        bookingId: typed.bookingId,
      }
    }
    case "staff.payment.completed": {
      const typed = context as StaffAlertContextMap["staff.payment.completed"]
      return {
        ...empty,
        targetType: "payment_session",
        targetId: typed.paymentSessionId,
        bookingId: typed.bookingId,
        paymentSessionId: typed.paymentSessionId,
      }
    }
    case "staff.invoice.settled": {
      const typed = context as StaffAlertContextMap["staff.invoice.settled"]
      return {
        ...empty,
        targetType: "invoice",
        targetId: typed.invoiceId,
        bookingId: typed.bookingId,
        invoiceId: typed.invoiceId,
      }
    }
    case "staff.contract.signed": {
      const typed = context as StaffAlertContextMap["staff.contract.signed"]
      return {
        ...empty,
        targetType: "other",
        targetId: typed.contractId,
        bookingId: typed.bookingId,
      }
    }
    case "staff.customer-signal.created": {
      const typed = context as StaffAlertContextMap["staff.customer-signal.created"]
      // `notification_target_type` has no customer-signal value. Rather than
      // migrate the enum for one alert, record `other` and keep the signal id
      // in `target_id` where the ledger can still be filtered on it.
      return { ...empty, targetType: "other", targetId: typed.signalId }
    }
    default: {
      const exhaustive: never = eventKey
      throw new Error(`No delivery target mapping for "${String(exhaustive)}".`)
    }
  }
}

export async function dispatchStaffAlert(
  input: DispatchStaffAlertInput,
): Promise<DispatchStaffAlertResult> {
  const { db, runtime, eventKey } = input

  const definition = getStaffAlertDefinition(eventKey)
  if (!definition) return { skipped: "disabled", enqueued: 0 }

  const setting = await getStaffAlertSetting(db, eventKey)
  if (!setting.enabled) return { skipped: "disabled", enqueued: 0 }

  const resolver = runtime.resolvers[eventKey]
  if (!resolver) return { skipped: "no-resolver", enqueued: 0 }

  const context = await resolver.resolve({ db, payload: input.payload })
  if (!context) return { skipped: "no-context", enqueued: 0 }

  const optedOutUserIds = await listStaffAlertOptOutUserIds(db, eventKey)
  const recipients = await resolveStaffAlertRecipients({
    db,
    setting,
    assigneeUserId: context.assigneeUserId,
    actorUserId: context.actorUserId,
    optedOutUserIds,
  })
  if (recipients.length === 0) return { skipped: "no-recipients", enqueued: 0 }

  const brand = await runtime.resolveBrand(db)
  const target = targetFor(eventKey, context)

  let enqueued = 0
  for (const recipient of recipients) {
    // Each recipient's locale changes the rendered body, so rendering is per
    // recipient rather than hoisted. The template call is pure, so this costs
    // CPU rather than round trips.
    const rendered = await renderStaffAlertEmail({
      eventKey,
      context,
      brand: { ...brand, locale: recipient.locale ?? brand.locale },
      isAssignee: recipient.isAssignee,
    })

    await enqueueNotification({
      db,
      registry: runtime.dispatcher,
      input: {
        idempotencyKey: `staff-alert:${input.eventId}:${eventKey}:${recipient.email}`,
        templateSlug: definition.templateSlug,
        channel: "email",
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        targetType: target.targetType,
        targetId: target.targetId,
        bookingId: target.bookingId,
        invoiceId: target.invoiceId,
        paymentSessionId: target.paymentSessionId,
        metadata: {
          staffAlert: true,
          eventKey,
          staffUserId: recipient.userId,
          isAssignee: recipient.isAssignee,
        },
      },
    })
    enqueued += 1
  }

  return { skipped: null, enqueued }
}
