/**
 * Convert between the `PaymentScheduleSection` editor value
 * (`{ mode, installments }`) and the booking draft's `paymentSchedules` rows.
 *
 * The row shape is derived from `Draft` so it always matches the engine
 * contract. Paid-installment metadata (date / method / reference) is encoded
 * as JSON in the row `notes` — the SAME format the owned create-sheet uses —
 * so a schedule round-trips losslessly through the draft (and both flows write
 * an identical wire shape).
 */

import {
  createInstallment,
  createPaymentScheduleValue,
  type PaymentInstallment,
  type PaymentScheduleValue,
} from "../../components/payment-schedule-section.js"
import type { Draft } from "./draft-state.js"

type PaymentScheduleRow = NonNullable<Draft["paymentSchedules"]>[number]

interface PaidNotesPayload {
  alreadyPaid: true
  paymentDate: string | null
  paymentMethod: string
  paymentReference: string | null
}

function paidNotes(installment: PaymentInstallment): string | null {
  if (!installment.alreadyPaid) return null
  return JSON.stringify({
    alreadyPaid: true,
    paymentDate: installment.paymentDate,
    paymentMethod: installment.paymentMethod,
    paymentReference: installment.paymentReference.trim() || null,
  } satisfies PaidNotesPayload)
}

/** Editor value → draft rows. Returns `[]` when nothing is schedulable yet. */
export function paymentScheduleValueToRows(
  value: PaymentScheduleValue,
  currency: string,
  totalAmountCents: number | null,
): PaymentScheduleRow[] {
  if (!currency) return []
  if (value.mode === "full") {
    const inst = value.installments[0]
    if (!inst?.dueDate || totalAmountCents === null) return []
    return [
      {
        scheduleType: "balance",
        status: inst.alreadyPaid ? "paid" : "due",
        dueDate: inst.dueDate,
        currency,
        amountCents: totalAmountCents,
        notes: paidNotes(inst),
      },
    ]
  }
  // split — N installments; first defaults to `due`, the rest to `pending`.
  const rows: PaymentScheduleRow[] = []
  for (const [idx, inst] of value.installments.entries()) {
    if (!inst.dueDate || inst.amountCents == null) continue
    rows.push({
      scheduleType: "installment",
      status: inst.alreadyPaid ? "paid" : idx === 0 ? "due" : "pending",
      dueDate: inst.dueDate,
      currency,
      amountCents: inst.amountCents,
      notes: paidNotes(inst),
    })
  }
  return rows
}

export function findPaidScheduleRowsMissingPaymentDate(
  rows: PaymentScheduleRow[] | undefined,
): number | null {
  if (!rows) return null
  const index = rows.findIndex((row) => {
    const meta = parsePaidNotes(row.notes)
    if (row.status !== "paid" && meta?.alreadyPaid !== true) return false
    return !hasExplicitPaymentDate(meta)
  })
  return index >= 0 ? index : null
}

/** Draft rows → editor value (re-init on step remount; preserves paid metadata). */
export function rowsToPaymentScheduleValue(
  rows: PaymentScheduleRow[] | undefined,
  departureDate: string | null,
): PaymentScheduleValue {
  if (!rows || rows.length === 0) return createPaymentScheduleValue(departureDate)
  const installments: PaymentInstallment[] = rows.map((row) => {
    let alreadyPaid = row.status === "paid"
    let paymentDate: string | null = null
    let paymentMethod = "bank_transfer"
    let paymentReference = ""
    const meta = parsePaidNotes(row.notes)
    if (meta?.alreadyPaid) {
      alreadyPaid = true
      paymentDate = meta.paymentDate ?? null
      paymentMethod = meta.paymentMethod ?? "bank_transfer"
      paymentReference = meta.paymentReference ?? ""
    }
    return createInstallment({
      amountCents: row.amountCents,
      dueDate: row.dueDate,
      alreadyPaid,
      paymentDate,
      paymentMethod,
      paymentReference,
    })
  })
  return { mode: rows.length > 1 ? "split" : "full", installments }
}

function parsePaidNotes(notes: string | null | undefined): Partial<PaidNotesPayload> | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes) as Partial<PaidNotesPayload>
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    // `notes` wasn't our JSON payload (e.g. a free-text note) — ignore.
    return null
  }
}

function hasExplicitPaymentDate(meta: Partial<PaidNotesPayload> | null): boolean {
  return typeof meta?.paymentDate === "string" && meta.paymentDate.trim().length > 0
}
