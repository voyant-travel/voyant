export { createDefaultBookingDocumentAttachment } from "./service-booking-documents.js"
export type { NotificationService } from "./service-shared.js"
export {
  createNotificationService,
  NotificationError,
  previewNotificationTemplate,
  renderNotificationTemplate,
  summarizeNotificationAttachments,
} from "./service-shared.js"

import {
  bookingDocumentNotificationsService,
  createDefaultBookingDocumentAttachment,
} from "./service-booking-documents.js"
import {
  getDeliveryById,
  listDeliveries,
  resendDelivery,
  sendInvoiceNotification,
  sendNotification,
  sendPaymentSessionNotification,
} from "./service-deliveries.js"
import { runDueReminders } from "./service-reminders.js"
import { previewReminders } from "./service-sequence.js"
import { previewNotificationTemplate } from "./service-shared.js"
import {
  createReminderRuleStage,
  createStageChannel,
  deleteReminderRuleStage,
  deleteStageChannel,
  getNotificationSettingsRecord,
  getReminderRuleStageById,
  listReminderRuleStages,
  listStageChannels,
  reorderReminderRuleStages,
  updateReminderRuleStage,
  updateStageChannel,
  upsertNotificationSettings,
} from "./service-stages.js"
import {
  createReminderRule,
  createTemplate,
  getReminderRuleById,
  getReminderRunById,
  getTemplateById,
  getTemplateBySlug,
  listReminderRules,
  listReminderRuns,
  listTemplates,
  updateReminderRule,
  updateTemplate,
} from "./service-templates.js"

export const notificationsService = {
  listTemplates,
  getTemplateById,
  getTemplateBySlug,
  createTemplate,
  updateTemplate,
  previewNotificationTemplate,
  listDeliveries,
  getDeliveryById,
  resendDelivery,
  sendNotification,
  listReminderRules,
  getReminderRuleById,
  getReminderRunById,
  createReminderRule,
  updateReminderRule,
  listReminderRuns,
  runDueReminders,
  previewReminders,
  listReminderRuleStages,
  getReminderRuleStageById,
  createReminderRuleStage,
  updateReminderRuleStage,
  deleteReminderRuleStage,
  reorderReminderRuleStages,
  listStageChannels,
  createStageChannel,
  updateStageChannel,
  deleteStageChannel,
  getNotificationSettings: getNotificationSettingsRecord,
  upsertNotificationSettings,
  sendPaymentSessionNotification,
  sendInvoiceNotification,
  listBookingDocumentBundle: bookingDocumentNotificationsService.listBookingDocumentBundle,
  sendBookingDocumentsNotification:
    bookingDocumentNotificationsService.sendBookingDocumentsNotification,
  confirmAndDispatchBooking: bookingDocumentNotificationsService.confirmAndDispatchBooking,
  createDefaultBookingDocumentAttachment,
}
