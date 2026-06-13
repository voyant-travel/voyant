import { financeBookingGuaranteeService } from "./service-booking-guarantees.js"
import { financeBookingItemBillingService } from "./service-booking-item-billing.js"
import { financeBookingPaymentScheduleService } from "./service-booking-payment-schedules.js"

export const financeBookingBillingService = {
  ...financeBookingPaymentScheduleService,
  ...financeBookingGuaranteeService,
  ...financeBookingItemBillingService,
}
