/**
 * `@voyant-travel/notifications/emails` — the code-owned staff alert templates.
 *
 * A SEPARATE ENTRY POINT ON PURPOSE. This subtree pulls in React and
 * `@react-email/*`; the package's main entry must not, because every consumer
 * that only mounts notification routes would otherwise carry the renderer.
 *
 * These templates are deliberately NOT operator-editable. Customer-facing
 * templates live in `notification_templates` as Liquid and are content; staff
 * alerts are product surface, and an operator editing one would break the
 * layout without gaining anything they wanted.
 */

export type { StaffAlertBrand } from "./brand.js"
export {
  buildAdminUrl,
  cornerRadiusToPx,
  DEFAULT_STAFF_ALERT_BRAND_COLOR,
  DEFAULT_STAFF_ALERT_CORNER_RADIUS,
  EMAIL_FONT_STACK,
  normalizeBrandColor,
  readableTextOn,
} from "./brand.js"
export { formatDate, formatDateRange, formatDateTime, formatMoney } from "./format.js"
export type { StaffAlertEmailLocale, StaffAlertEmailMessages } from "./messages/index.js"
export {
  staffAlertEmailMessagesEn,
  staffAlertEmailMessagesFor,
  staffAlertEmailMessagesRo,
} from "./messages/index.js"
export type { RenderedStaffAlertEmail, RenderStaffAlertEmailInput } from "./render.jsx"
export { renderStaffAlertEmail } from "./render.jsx"
export { StaffBookingCancelledEmail } from "./staff/booking-cancelled.jsx"
export { StaffBookingConfirmedEmail } from "./staff/booking-confirmed.jsx"
export { StaffContractSignedEmail } from "./staff/contract-signed.jsx"
export { StaffCustomerSignalCreatedEmail } from "./staff/customer-signal-created.jsx"
export { StaffInvoiceSettledEmail } from "./staff/invoice-settled.jsx"
export { StaffPaymentCompletedEmail } from "./staff/payment-completed.jsx"
