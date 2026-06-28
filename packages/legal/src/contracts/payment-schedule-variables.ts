import type { bookingPaymentSchedules } from "@voyant-travel/finance/schema"

import type { DefaultContractVariables } from "./service-auto-generate-types.js"

type BookingPaymentScheduleRow = typeof bookingPaymentSchedules.$inferSelect

type BookingPaymentScheduleStatus = BookingPaymentScheduleRow["status"]

export interface PaymentScheduleSummary {
  entries: DefaultContractVariables["payment"]["schedule"]
  depositAmountCents: number
  depositDueDate: string
  balanceAmountCents: number
  balanceDueDate: string
}

const CONTRACT_PAYMENT_SCHEDULE_STATUSES = new Set<BookingPaymentScheduleStatus>([
  "pending",
  "due",
  "paid",
])

export function summarizeBookingPaymentScheduleRows(
  rows: readonly BookingPaymentScheduleRow[],
): PaymentScheduleSummary {
  const effectiveRows = rows.filter((row) => CONTRACT_PAYMENT_SCHEDULE_STATUSES.has(row.status))
  const deposit = effectiveRows.find((row) => row.scheduleType === "deposit")
  const balance = effectiveRows.find((row) => row.scheduleType === "balance")

  return {
    entries: effectiveRows.map((row, index) => ({
      index: index + 1,
      type: row.scheduleType,
      amountCents: row.amountCents,
      currency: row.currency,
      dueDate: row.dueDate,
      status: row.status,
    })),
    depositAmountCents: deposit?.amountCents ?? 0,
    depositDueDate: deposit?.dueDate ?? "",
    balanceAmountCents: balance?.amountCents ?? 0,
    balanceDueDate: balance?.dueDate ?? "",
  }
}
