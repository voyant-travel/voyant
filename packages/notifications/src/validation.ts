import { z } from "zod"

export const notificationChannelSchema = z.enum(["email", "sms"])
export const notificationTemplateStatusSchema = z.enum(["draft", "active", "archived"])
export const notificationDeliveryStatusSchema = z.enum(["pending", "sent", "failed", "cancelled"])
export const notificationTargetTypeSchema = z.enum([
  "booking",
  "booking_payment_schedule",
  "booking_guarantee",
  "invoice",
  "payment_session",
  "person",
  "organization",
  "other",
])
export const notificationReminderStatusSchema = z.enum(["draft", "active", "archived"])
export const notificationReminderTargetTypeSchema = z.enum([
  "booking_confirmed",
  "booking_payment_schedule",
  "payment_complete",
  "booking_cancelled_non_payment",
  "invoice",
])
export const notificationReminderRunStatusSchema = z.enum([
  "queued",
  "processing",
  "sent",
  "skipped",
  "failed",
])
export const notificationDocumentTypeSchema = z.enum(["contract", "invoice", "proforma"])
export const notificationDocumentSourceSchema = z.enum(["legal", "finance"])
export const notificationAttachmentSchema = z
  .object({
    filename: z.string().min(1).max(500),
    contentBase64: z.string().min(1).optional().nullable(),
    path: z.string().min(1).max(4000).optional().nullable(),
    contentType: z.string().max(255).optional().nullable(),
    disposition: z.enum(["attachment", "inline"]).optional().nullable(),
    contentId: z.string().max(255).optional().nullable(),
  })
  .refine((value) => Boolean(value.contentBase64 || value.path), {
    message: "contentBase64 or path is required",
    path: ["contentBase64"],
  })

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const notificationTemplateCoreSchema = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  channel: notificationChannelSchema,
  provider: z.string().max(255).optional().nullable(),
  status: notificationTemplateStatusSchema.default("draft"),
  subjectTemplate: z.string().max(2000).optional().nullable(),
  htmlTemplate: z.string().optional().nullable(),
  textTemplate: z.string().optional().nullable(),
  fromAddress: z.string().max(500).optional().nullable(),
  isSystem: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertNotificationTemplateSchema = notificationTemplateCoreSchema
export const updateNotificationTemplateSchema = notificationTemplateCoreSchema.partial()

export const notificationTemplateListQuerySchema = paginationSchema.extend({
  channel: notificationChannelSchema.optional(),
  provider: z.string().optional(),
  status: notificationTemplateStatusSchema.optional(),
  search: z.string().optional(),
})

export const notificationDeliveryListQuerySchema = paginationSchema.extend({
  channel: notificationChannelSchema.optional(),
  provider: z.string().optional(),
  status: notificationDeliveryStatusSchema.optional(),
  templateSlug: z.string().optional(),
  targetType: notificationTargetTypeSchema.optional(),
  targetId: z.string().optional(),
  bookingId: z.string().optional(),
  invoiceId: z.string().optional(),
  paymentSessionId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
})

const notificationReminderRuleCoreSchema = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  status: notificationReminderStatusSchema.default("draft"),
  targetType: notificationReminderTargetTypeSchema,
  channel: notificationChannelSchema,
  provider: z.string().max(255).optional().nullable(),
  templateId: z.string().optional().nullable(),
  templateSlug: z.string().max(255).optional().nullable(),
  relativeDaysFromDueDate: z.coerce.number().int().min(-365).max(365).default(0),
  isSystem: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertNotificationReminderRuleSchema = notificationReminderRuleCoreSchema.refine(
  (value) => Boolean(value.templateId || value.templateSlug),
  {
    message: "templateId or templateSlug is required",
    path: ["templateId"],
  },
)

export const updateNotificationReminderRuleSchema = notificationReminderRuleCoreSchema
  .partial()
  .refine((value) => value.templateId !== "" && value.templateSlug !== "", {
    message: "templateId and templateSlug cannot be empty strings",
  })

export const notificationReminderRuleListQuerySchema = paginationSchema.extend({
  status: notificationReminderStatusSchema.optional(),
  targetType: notificationReminderTargetTypeSchema.optional(),
  channel: notificationChannelSchema.optional(),
  search: z.string().optional(),
})

export const notificationReminderRunListQuerySchema = paginationSchema.extend({
  reminderRuleId: z.string().optional(),
  targetType: notificationReminderTargetTypeSchema.optional(),
  targetId: z.string().optional(),
  scheduleId: z.string().optional(),
  invoiceId: z.string().optional(),
  bookingId: z.string().optional(),
  paymentSessionId: z.string().optional(),
  notificationDeliveryId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  recipient: z.string().optional(),
  status: notificationReminderRunStatusSchema.optional(),
})

export const notificationReminderRunRuleSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: notificationReminderStatusSchema,
  targetType: notificationReminderTargetTypeSchema,
  channel: notificationChannelSchema,
  provider: z.string().nullable(),
  templateId: z.string().nullable(),
  templateSlug: z.string().nullable(),
  relativeDaysFromDueDate: z.number().int(),
})

export const notificationReminderRunDeliverySummarySchema = z.object({
  id: z.string(),
  status: notificationDeliveryStatusSchema,
  channel: notificationChannelSchema,
  provider: z.string(),
  toAddress: z.string(),
  subject: z.string().nullable(),
  sentAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
})

export const notificationReminderRunLinksSchema = z.object({
  bookingId: z.string().nullable(),
  bookingPaymentScheduleId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  paymentSessionId: z.string().nullable(),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  notificationDeliveryId: z.string().nullable(),
})

export const notificationReminderRunRecordSchema = z.object({
  id: z.string(),
  reminderRuleId: z.string(),
  targetType: notificationReminderTargetTypeSchema,
  targetId: z.string(),
  dedupeKey: z.string(),
  status: notificationReminderRunStatusSchema,
  recipient: z.string().nullable(),
  scheduledFor: z.string(),
  processedAt: z.string(),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  links: notificationReminderRunLinksSchema,
  reminderRule: notificationReminderRunRuleSummarySchema,
  delivery: notificationReminderRunDeliverySummarySchema.nullable(),
})

export const notificationReminderRunListResponseSchema = z.object({
  data: z.array(notificationReminderRunRecordSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export const runDueRemindersSchema = z.object({
  now: z.string().datetime().optional().nullable(),
})

const transportNotificationCoreSchema = z.object({
  templateId: z.string().optional().nullable(),
  templateSlug: z.string().optional().nullable(),
  channel: notificationChannelSchema.default("email"),
  provider: z.string().optional().nullable(),
  to: z.string().min(1).optional().nullable(),
  from: z.string().max(500).optional().nullable(),
  subject: z.string().max(2000).optional().nullable(),
  html: z.string().optional().nullable(),
  text: z.string().optional().nullable(),
  attachments: z.array(notificationAttachmentSchema).optional().nullable(),
  data: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
})

export const sendPaymentSessionNotificationSchema = transportNotificationCoreSchema.refine(
  (value) =>
    Boolean(value.templateId || value.templateSlug || value.subject || value.html || value.text),
  {
    message: "templateId, templateSlug, or direct content is required",
  },
)

export const sendInvoiceNotificationSchema = transportNotificationCoreSchema.refine(
  (value) =>
    Boolean(value.templateId || value.templateSlug || value.subject || value.html || value.text),
  {
    message: "templateId, templateSlug, or direct content is required",
  },
)

export const sendNotificationSchema = z
  .object({
    templateId: z.string().optional().nullable(),
    templateSlug: z.string().optional().nullable(),
    channel: notificationChannelSchema.optional(),
    provider: z.string().optional().nullable(),
    to: z.string().min(1),
    from: z.string().max(500).optional().nullable(),
    subject: z.string().max(2000).optional().nullable(),
    html: z.string().optional().nullable(),
    text: z.string().optional().nullable(),
    attachments: z.array(notificationAttachmentSchema).optional().nullable(),
    data: z.record(z.string(), z.unknown()).optional().nullable(),
    targetType: notificationTargetTypeSchema.default("other"),
    targetId: z.string().optional().nullable(),
    bookingId: z.string().optional().nullable(),
    invoiceId: z.string().optional().nullable(),
    paymentSessionId: z.string().optional().nullable(),
    personId: z.string().optional().nullable(),
    organizationId: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    scheduledFor: z.string().optional().nullable(),
  })
  .refine(
    (value) =>
      Boolean(value.templateId || value.templateSlug || value.subject || value.html || value.text),
    {
      message: "templateId, templateSlug, or direct content is required",
    },
  )

export const previewNotificationTemplateSchema = z
  .object({
    channel: notificationChannelSchema,
    provider: z.string().optional().nullable(),
    subjectTemplate: z.string().max(2000).optional().nullable(),
    htmlTemplate: z.string().optional().nullable(),
    textTemplate: z.string().optional().nullable(),
    fromAddress: z.string().max(500).optional().nullable(),
    data: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine((value) => Boolean(value.subjectTemplate || value.htmlTemplate || value.textTemplate), {
    message: "subjectTemplate, htmlTemplate, or textTemplate is required",
  })

export const previewNotificationTemplateResultSchema = z.object({
  channel: notificationChannelSchema,
  provider: z.string().nullable(),
  fromAddress: z.string().nullable(),
  subject: z.string().nullable(),
  html: z.string().nullable(),
  text: z.string().nullable(),
})

export const bookingDocumentBundleItemSchema = z.object({
  key: z.string().min(1),
  source: notificationDocumentSourceSchema,
  documentType: notificationDocumentTypeSchema,
  bookingId: z.string().min(1),
  contractId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  attachmentId: z.string().optional().nullable(),
  renditionId: z.string().optional().nullable(),
  contractStatus: z.string().optional().nullable(),
  invoiceStatus: z.string().optional().nullable(),
  name: z.string().min(1),
  format: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  storageKey: z.string().optional().nullable(),
  downloadUrl: z.string().url().optional().nullable(),
  language: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  createdAt: z.string().datetime(),
})

export const bookingDocumentBundleSchema = z.object({
  bookingId: z.string().min(1),
  documents: z.array(bookingDocumentBundleItemSchema),
})

export const sendBookingDocumentsNotificationSchema = z.object({
  templateId: z.string().optional().nullable(),
  templateSlug: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  to: z.string().min(1).optional().nullable(),
  from: z.string().max(500).optional().nullable(),
  subject: z.string().max(2000).optional().nullable(),
  html: z.string().optional().nullable(),
  text: z.string().optional().nullable(),
  data: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  documentTypes: z.array(notificationDocumentTypeSchema).optional().nullable(),
})

export const sendBookingDocumentsNotificationResultSchema = z.object({
  bookingId: z.string().min(1),
  recipient: z.string().min(1),
  documents: z.array(bookingDocumentBundleItemSchema),
  deliveryId: z.string().min(1),
  provider: z.string().optional().nullable(),
  status: notificationDeliveryStatusSchema,
})

/**
 * Confirm-and-dispatch — single orchestrated request that lists the booking's
 * document bundle and (optionally) sends it to the client in one round-trip.
 *
 * `sendNotification: false` turns the call into a preview: the bundle comes
 * back but no delivery is attempted. Templates use the preview to render the
 * "here's what's ready" checkbox list before the operator confirms.
 */
export const confirmAndDispatchBookingSchema = sendBookingDocumentsNotificationSchema.extend({
  sendNotification: z.boolean().default(true),
})

export const confirmAndDispatchBookingResultSchema = z.object({
  bookingId: z.string().min(1),
  documents: z.array(bookingDocumentBundleItemSchema),
  /**
   * Non-null when `sendNotification` was true and a delivery actually went
   * out. Null when either the operator asked for a preview only, or the send
   * couldn't proceed (no recipient / no attachments / no matching documents).
   */
  notification: z
    .object({
      recipient: z.string().min(1),
      deliveryId: z.string().min(1),
      provider: z.string().optional().nullable(),
      status: notificationDeliveryStatusSchema,
    })
    .nullable(),
  /**
   * When `sendNotification` was true but the dispatcher declined to send,
   * this captures which guard tripped so the UI can explain it — e.g.
   * "No recipient on file, add an email to the lead traveler and retry".
   */
  skipReason: z
    .enum(["preview_only", "no_documents", "no_recipient", "no_attachments", "send_failed"])
    .nullable(),
})
