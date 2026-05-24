import { describe, expect, it } from "vitest"

/**
 * Unit tests for invoice payment status derivation and aging bucket calculation.
 */

type PaymentStatus = "draft" | "issued" | "paid" | "partially_paid" | "overdue" | "cancelled"

function derivePaymentStatus(
  totalCents: number,
  paidCents: number,
  currentStatus: PaymentStatus,
): PaymentStatus {
  if (currentStatus === "draft" || currentStatus === "cancelled") return currentStatus
  if (paidCents >= totalCents) return "paid"
  if (paidCents > 0) return "partially_paid"
  return currentStatus
}

type AgingBucket = "current" | "30_days" | "60_days" | "90_days" | "over_90"

function getAgingBucket(dueDateStr: string, nowStr: string): AgingBucket {
  const dueDate = new Date(dueDateStr)
  const now = new Date(nowStr)
  const diffMs = now.getTime() - dueDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return "current"
  if (diffDays <= 30) return "30_days"
  if (diffDays <= 60) return "60_days"
  if (diffDays <= 90) return "90_days"
  return "over_90"
}

describe("Invoice payment status", () => {
  it("keeps draft status regardless of payments", () => {
    expect(derivePaymentStatus(10000, 10000, "draft")).toBe("draft")
  })

  it("keeps cancelled status regardless of payments", () => {
    expect(derivePaymentStatus(10000, 5000, "cancelled")).toBe("cancelled")
  })

  it("marks as paid when full amount received", () => {
    expect(derivePaymentStatus(10000, 10000, "issued")).toBe("paid")
  })

  it("marks as paid when overpaid", () => {
    expect(derivePaymentStatus(10000, 15000, "issued")).toBe("paid")
  })

  it("marks as partially_paid when partial payment received", () => {
    expect(derivePaymentStatus(10000, 5000, "issued")).toBe("partially_paid")
  })

  it("keeps issued status when no payments", () => {
    expect(derivePaymentStatus(10000, 0, "issued")).toBe("issued")
  })

  it("keeps overdue status when no payments", () => {
    expect(derivePaymentStatus(10000, 0, "overdue")).toBe("overdue")
  })

  it("marks overdue as partially_paid with partial payment", () => {
    expect(derivePaymentStatus(10000, 1, "overdue")).toBe("partially_paid")
  })
})

describe("Aging bucket calculation", () => {
  it("classifies as current when not yet due", () => {
    expect(getAgingBucket("2025-06-15", "2025-06-10")).toBe("current")
  })

  it("classifies as current on due date", () => {
    expect(getAgingBucket("2025-06-15", "2025-06-15")).toBe("current")
  })

  it("classifies as 30_days when 1-30 days overdue", () => {
    expect(getAgingBucket("2025-06-01", "2025-06-15")).toBe("30_days")
  })

  it("classifies as 30_days at exactly 30 days", () => {
    expect(getAgingBucket("2025-06-01", "2025-07-01")).toBe("30_days")
  })

  it("classifies as 60_days when 31-60 days overdue", () => {
    expect(getAgingBucket("2025-06-01", "2025-07-15")).toBe("60_days")
  })

  it("classifies as 90_days when 61-90 days overdue", () => {
    expect(getAgingBucket("2025-06-01", "2025-08-15")).toBe("90_days")
  })

  it("classifies as over_90 when > 90 days overdue", () => {
    expect(getAgingBucket("2025-01-01", "2025-06-01")).toBe("over_90")
  })
})
