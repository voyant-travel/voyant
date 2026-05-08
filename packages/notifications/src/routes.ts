import type { EventBus, ModuleContainer } from "@voyantjs/core"
import { parseJsonBody, parseOptionalJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { createNotificationService, notificationsService } from "./service.js"
import type { BookingDocumentAttachmentResolver } from "./service-booking-documents.js"
import type { NotificationProvider } from "./types.js"
import {
  bookingDocumentBundleSchema,
  confirmAndDispatchBookingResultSchema,
  confirmAndDispatchBookingSchema,
  insertNotificationReminderRuleSchema,
  insertNotificationReminderRuleStageSchema,
  insertNotificationReminderStageChannelSchema,
  insertNotificationTemplateSchema,
  notificationDeliveryListQuerySchema,
  notificationReminderRuleListQuerySchema,
  notificationReminderRunListQuerySchema,
  notificationTemplateListQuerySchema,
  previewNotificationTemplateResultSchema,
  previewNotificationTemplateSchema,
  previewRemindersQuerySchema,
  reorderReminderRuleStagesSchema,
  runDueRemindersSchema,
  sendBookingDocumentsNotificationResultSchema,
  sendBookingDocumentsNotificationSchema,
  sendInvoiceNotificationSchema,
  sendNotificationSchema,
  sendPaymentSessionNotificationSchema,
  updateNotificationReminderRuleSchema,
  updateNotificationReminderRuleStageSchema,
  updateNotificationReminderStageChannelSchema,
  updateNotificationSettingsSchema,
  updateNotificationTemplateSchema,
} from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

export type NotificationsRoutesOptions = {
  providers?: ReadonlyArray<NotificationProvider>
  resolveProviders?: (bindings: Record<string, unknown>) => ReadonlyArray<NotificationProvider>
  documentAttachmentResolver?: BookingDocumentAttachmentResolver
  resolveDocumentAttachmentResolver?: (
    bindings: Record<string, unknown>,
  ) => BookingDocumentAttachmentResolver | undefined
  eventBus?: EventBus
  resolveEventBus?: (bindings: Record<string, unknown>) => EventBus | undefined
}

export type NotificationsRouteRuntime = {
  providers: ReadonlyArray<NotificationProvider>
  documentAttachmentResolver?: BookingDocumentAttachmentResolver
  eventBus?: EventBus
}

export const NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY = "providers.notifications.runtime"

export function buildNotificationsRouteRuntime(
  bindings: Record<string, unknown>,
  options?: NotificationsRoutesOptions,
): NotificationsRouteRuntime {
  return {
    providers: options?.resolveProviders?.(bindings) ?? options?.providers ?? [],
    documentAttachmentResolver:
      options?.resolveDocumentAttachmentResolver?.(bindings) ?? options?.documentAttachmentResolver,
    eventBus: options?.resolveEventBus?.(bindings) ?? options?.eventBus,
  }
}

function getRuntime(
  bindings: Record<string, unknown>,
  options: NotificationsRoutesOptions | undefined,
  resolveFromContainer: (key: string) => NotificationsRouteRuntime,
): NotificationsRouteRuntime {
  try {
    return resolveFromContainer(NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY)
  } catch {
    return buildNotificationsRouteRuntime(bindings, options)
  }
}

export function createNotificationsRoutes(options?: NotificationsRoutesOptions) {
  return new Hono<Env>()
    .get("/templates", async (c) => {
      const query = parseQuery(c, notificationTemplateListQuerySchema)
      return c.json(await notificationsService.listTemplates(c.get("db"), query))
    })
    .post("/templates", async (c) => {
      const row = await notificationsService.createTemplate(
        c.get("db"),
        await parseJsonBody(c, insertNotificationTemplateSchema),
      )
      return c.json({ data: row }, 201)
    })
    .get("/templates/:id", async (c) => {
      const row = await notificationsService.getTemplateById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Notification template not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/templates/:id", async (c) => {
      const row = await notificationsService.updateTemplate(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateNotificationTemplateSchema),
      )
      if (!row) return c.json({ error: "Notification template not found" }, 404)
      return c.json({ data: row })
    })
    .post("/preview", async (c) => {
      const rendered = notificationsService.previewNotificationTemplate(
        await parseJsonBody(c, previewNotificationTemplateSchema),
      )
      return c.json({ data: previewNotificationTemplateResultSchema.parse(rendered) })
    })
    .get("/deliveries", async (c) => {
      const query = parseQuery(c, notificationDeliveryListQuerySchema)
      return c.json(await notificationsService.listDeliveries(c.get("db"), query))
    })
    .get("/deliveries/:id", async (c) => {
      const row = await notificationsService.getDeliveryById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Notification delivery not found" }, 404)
      return c.json({ data: row })
    })
    .post("/deliveries/:id/resend", async (c) => {
      try {
        const runtime = getRuntime(c.env, options, (key) => c.var.container.resolve(key))
        const dispatcher = createNotificationService(runtime.providers)
        const row = await notificationsService.resendDelivery(
          c.get("db"),
          dispatcher,
          c.req.param("id"),
        )
        if (!row) return c.json({ error: "Notification delivery not found" }, 404)
        return c.json({ data: row }, 201)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Notification resend failed"
        return c.json({ error: message }, 400)
      }
    })
    .get("/reminder-rules", async (c) => {
      const query = parseQuery(c, notificationReminderRuleListQuerySchema)
      return c.json(await notificationsService.listReminderRules(c.get("db"), query))
    })
    .post("/reminder-rules", async (c) => {
      const row = await notificationsService.createReminderRule(
        c.get("db"),
        await parseJsonBody(c, insertNotificationReminderRuleSchema),
      )
      return c.json({ data: row }, 201)
    })
    .get("/reminder-rules/:id", async (c) => {
      const row = await notificationsService.getReminderRuleById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Notification reminder rule not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/reminder-rules/:id", async (c) => {
      const row = await notificationsService.updateReminderRule(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateNotificationReminderRuleSchema),
      )
      if (!row) return c.json({ error: "Notification reminder rule not found" }, 404)
      return c.json({ data: row })
    })
    .get("/reminder-rules/:id/stages", async (c) => {
      const stages = await notificationsService.listReminderRuleStages(
        c.get("db"),
        c.req.param("id"),
      )
      return c.json({ data: stages })
    })
    .post("/reminder-rules/:id/stages", async (c) => {
      const stage = await notificationsService.createReminderRuleStage(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, insertNotificationReminderRuleStageSchema),
      )
      return c.json({ data: stage }, 201)
    })
    .post("/reminder-rules/:id/stages/reorder", async (c) => {
      const stages = await notificationsService.reorderReminderRuleStages(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, reorderReminderRuleStagesSchema),
      )
      return c.json({ data: stages })
    })
    .patch("/reminder-rules/:id/stages/:stageId", async (c) => {
      const stage = await notificationsService.updateReminderRuleStage(
        c.get("db"),
        c.req.param("stageId"),
        await parseJsonBody(c, updateNotificationReminderRuleStageSchema),
      )
      if (!stage) return c.json({ error: "Reminder stage not found" }, 404)
      return c.json({ data: stage })
    })
    .delete("/reminder-rules/:id/stages/:stageId", async (c) => {
      const ok = await notificationsService.deleteReminderRuleStage(
        c.get("db"),
        c.req.param("stageId"),
      )
      if (!ok) return c.json({ error: "Reminder stage not found" }, 404)
      return c.body(null, 204)
    })
    .get("/reminder-rules/:id/stages/:stageId/channels", async (c) => {
      const channels = await notificationsService.listStageChannels(
        c.get("db"),
        c.req.param("stageId"),
      )
      return c.json({ data: channels })
    })
    .post("/reminder-rules/:id/stages/:stageId/channels", async (c) => {
      const row = await notificationsService.createStageChannel(
        c.get("db"),
        c.req.param("stageId"),
        await parseJsonBody(c, insertNotificationReminderStageChannelSchema),
      )
      return c.json({ data: row }, 201)
    })
    .patch("/reminder-rules/:id/stages/:stageId/channels/:channelId", async (c) => {
      const row = await notificationsService.updateStageChannel(
        c.get("db"),
        c.req.param("channelId"),
        await parseJsonBody(c, updateNotificationReminderStageChannelSchema),
      )
      if (!row) return c.json({ error: "Stage channel not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/reminder-rules/:id/stages/:stageId/channels/:channelId", async (c) => {
      const ok = await notificationsService.deleteStageChannel(
        c.get("db"),
        c.req.param("channelId"),
      )
      if (!ok) return c.json({ error: "Stage channel not found" }, 404)
      return c.body(null, 204)
    })
    .get("/notification-settings", async (c) => {
      const row = await notificationsService.getNotificationSettings(c.get("db"))
      return c.json({ data: row })
    })
    .patch("/notification-settings", async (c) => {
      const row = await notificationsService.upsertNotificationSettings(
        c.get("db"),
        await parseJsonBody(c, updateNotificationSettingsSchema),
      )
      return c.json({ data: row })
    })
    .get("/reminders/preview", async (c) => {
      const query = parseQuery(c, previewRemindersQuerySchema)
      const now = query.date ? new Date(`${query.date}T00:00:00Z`) : new Date()
      const rows = await notificationsService.previewReminders(c.get("db"), {
        now,
        ruleId: query.ruleId,
        targetId: query.targetId,
      })
      return c.json({ data: rows })
    })
    .get("/reminder-runs", async (c) => {
      const query = parseQuery(c, notificationReminderRunListQuerySchema)
      return c.json(await notificationsService.listReminderRuns(c.get("db"), query))
    })
    .get("/reminder-runs/:id", async (c) => {
      const row = await notificationsService.getReminderRunById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Notification reminder run not found" }, 404)
      return c.json({ data: row })
    })
    .post("/reminders/run-due", async (c) => {
      try {
        const runtime = getRuntime(c.env, options, (key) => c.var.container.resolve(key))
        const dispatcher = createNotificationService(runtime.providers)
        const result = await notificationsService.runDueReminders(
          c.get("db"),
          dispatcher,
          await parseOptionalJsonBody(c, runDueRemindersSchema),
        )
        return c.json({ data: result })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Reminder sweep failed"
        return c.json({ error: message }, 400)
      }
    })
    .post("/payment-sessions/:id/send", async (c) => {
      try {
        const runtime = getRuntime(c.env, options, (key) => c.var.container.resolve(key))
        const dispatcher = createNotificationService(runtime.providers)
        const row = await notificationsService.sendPaymentSessionNotification(
          c.get("db"),
          dispatcher,
          c.req.param("id"),
          await parseJsonBody(c, sendPaymentSessionNotificationSchema),
        )
        if (!row) return c.json({ error: "Payment session not found" }, 404)
        return c.json({ data: row }, 201)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Payment session notification failed"
        return c.json({ error: message }, 400)
      }
    })
    .post("/invoices/:id/send", async (c) => {
      try {
        const runtime = getRuntime(c.env, options, (key) => c.var.container.resolve(key))
        const dispatcher = createNotificationService(runtime.providers)
        const row = await notificationsService.sendInvoiceNotification(
          c.get("db"),
          dispatcher,
          c.req.param("id"),
          await parseJsonBody(c, sendInvoiceNotificationSchema),
        )
        if (!row) return c.json({ error: "Invoice not found" }, 404)
        return c.json({ data: row }, 201)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invoice notification failed"
        return c.json({ error: message }, 400)
      }
    })
    .get("/bookings/:id/document-bundle", async (c) => {
      const bundle = await notificationsService.listBookingDocumentBundle(
        c.get("db"),
        c.req.param("id"),
      )
      if (!bundle) return c.json({ error: "Booking not found" }, 404)
      return c.json({ data: bookingDocumentBundleSchema.parse(bundle) })
    })
    .post("/bookings/:id/confirm-and-dispatch", async (c) => {
      try {
        const runtime = getRuntime(c.env, options, (key) => c.var.container.resolve(key))
        const dispatcher = createNotificationService(runtime.providers)
        const result = await notificationsService.confirmAndDispatchBooking(
          c.get("db"),
          dispatcher,
          c.req.param("id"),
          await parseOptionalJsonBody(c, confirmAndDispatchBookingSchema),
          {
            attachmentResolver: runtime.documentAttachmentResolver,
            eventBus: runtime.eventBus,
          },
        )
        if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
        if (result.status === "preview") {
          return c.json({
            data: confirmAndDispatchBookingResultSchema.parse({
              bookingId: result.bookingId,
              documents: result.documents,
              notification: null,
              skipReason: "preview_only",
            }),
          })
        }
        if (result.status === "skipped") {
          return c.json({
            data: confirmAndDispatchBookingResultSchema.parse({
              bookingId: result.bookingId,
              documents: result.documents,
              notification: null,
              skipReason: result.skipReason,
            }),
          })
        }
        return c.json(
          {
            data: confirmAndDispatchBookingResultSchema.parse({
              bookingId: result.bookingId,
              documents: result.documents,
              notification: {
                recipient: result.recipient,
                deliveryId: result.delivery.id,
                provider: result.delivery.provider,
                status: result.delivery.status,
              },
              skipReason: null,
            }),
          },
          201,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : "Confirm-and-dispatch failed"
        return c.json({ error: message }, 400)
      }
    })
    .post("/bookings/:id/send-documents", async (c) => {
      try {
        const runtime = getRuntime(c.env, options, (key) => c.var.container.resolve(key))
        const dispatcher = createNotificationService(runtime.providers)
        const result = await notificationsService.sendBookingDocumentsNotification(
          c.get("db"),
          dispatcher,
          c.req.param("id"),
          await parseOptionalJsonBody(c, sendBookingDocumentsNotificationSchema),
          {
            attachmentResolver: runtime.documentAttachmentResolver,
            eventBus: runtime.eventBus,
          },
        )
        if (result.status === "not_found") return c.json({ error: "Booking not found" }, 404)
        if (result.status === "no_documents") return c.json({ error: "No booking documents" }, 400)
        if (result.status === "no_recipient")
          return c.json({ error: "No recipient available" }, 400)
        if (result.status === "no_attachments") {
          return c.json({ error: "No deliverable document attachments available" }, 400)
        }
        if (result.status === "send_failed") {
          return c.json({ error: "Booking document notification failed" }, 400)
        }
        return c.json(
          {
            data: sendBookingDocumentsNotificationResultSchema.parse({
              bookingId: result.bookingId,
              recipient: result.recipient,
              documents: result.documents,
              deliveryId: result.delivery.id,
              provider: result.delivery.provider,
              status: result.delivery.status,
            }),
          },
          201,
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Booking document notification failed"
        return c.json({ error: message }, 400)
      }
    })
    .post("/send", async (c) => {
      try {
        const runtime = getRuntime(c.env, options, (key) => c.var.container.resolve(key))
        const dispatcher = createNotificationService(runtime.providers)
        const row = await notificationsService.sendNotification(
          c.get("db"),
          dispatcher,
          await parseJsonBody(c, sendNotificationSchema),
        )
        return c.json({ data: row }, 201)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Notification send failed"
        return c.json({ error: message }, 400)
      }
    })
}
