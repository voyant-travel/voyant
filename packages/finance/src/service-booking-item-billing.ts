import type {
  CreateBookingItemCommissionInput,
  CreateBookingItemTaxLineInput,
  PostgresJsDatabase,
  UpdateBookingItemCommissionInput,
  UpdateBookingItemTaxLineInput,
} from "./service-shared.js"
import {
  asc,
  bookingItemCommissions,
  bookingItems,
  bookingItemTaxLines,
  desc,
  eq,
  PaymentValidationError,
} from "./service-shared.js"

type CommissionValidationInput = {
  commissionModel?: "percentage" | "fixed" | "markup" | "net" | null
  currency?: string | null
  amountCents?: number | null
  rateBasisPoints?: number | null
  status?: "pending" | "accrued" | "payable" | "paid" | "void" | null
  paidAt?: string | Date | null
}

function validateBookingItemCommissionState(data: CommissionValidationInput) {
  const commissionModel = data.commissionModel ?? "percentage"

  if (commissionModel === "percentage" && data.rateBasisPoints == null) {
    throw new PaymentValidationError(
      "Percentage commissions require rateBasisPoints",
      { field: "rateBasisPoints", commissionModel },
      { code: "invalid_commission_basis" },
    )
  }

  if (commissionModel === "fixed" && (data.amountCents == null || !data.currency)) {
    throw new PaymentValidationError(
      "Fixed commissions require amountCents and currency",
      {
        field: data.amountCents == null ? "amountCents" : "currency",
        commissionModel,
      },
      { code: "invalid_commission_basis" },
    )
  }

  if (data.status === "paid" && !data.paidAt) {
    throw new PaymentValidationError(
      "Paid commissions require paidAt settlement metadata",
      { field: "paidAt", status: data.status },
      { code: "missing_commission_settlement_metadata" },
    )
  }
}

export const financeBookingItemBillingService = {
  listBookingItemTaxLines(db: PostgresJsDatabase, bookingItemId: string) {
    return db
      .select()
      .from(bookingItemTaxLines)
      .where(eq(bookingItemTaxLines.bookingItemId, bookingItemId))
      .orderBy(asc(bookingItemTaxLines.sortOrder), asc(bookingItemTaxLines.createdAt))
  },

  async createBookingItemTaxLine(
    db: PostgresJsDatabase,
    bookingItemId: string,
    data: CreateBookingItemTaxLineInput,
  ) {
    const [bookingItem] = await db
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .where(eq(bookingItems.id, bookingItemId))
      .limit(1)

    if (!bookingItem) {
      return null
    }

    const [row] = await db
      .insert(bookingItemTaxLines)
      .values({ ...data, bookingItemId })
      .returning()

    return row ?? null
  },

  async updateBookingItemTaxLine(
    db: PostgresJsDatabase,
    taxLineId: string,
    data: UpdateBookingItemTaxLineInput,
  ) {
    const [row] = await db
      .update(bookingItemTaxLines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookingItemTaxLines.id, taxLineId))
      .returning()

    return row ?? null
  },

  async deleteBookingItemTaxLine(db: PostgresJsDatabase, taxLineId: string) {
    const [row] = await db
      .delete(bookingItemTaxLines)
      .where(eq(bookingItemTaxLines.id, taxLineId))
      .returning({ id: bookingItemTaxLines.id })

    return row ?? null
  },

  listBookingItemCommissions(db: PostgresJsDatabase, bookingItemId: string) {
    return db
      .select()
      .from(bookingItemCommissions)
      .where(eq(bookingItemCommissions.bookingItemId, bookingItemId))
      .orderBy(desc(bookingItemCommissions.createdAt))
  },

  async createBookingItemCommission(
    db: PostgresJsDatabase,
    bookingItemId: string,
    data: CreateBookingItemCommissionInput,
  ) {
    const [bookingItem] = await db
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .where(eq(bookingItems.id, bookingItemId))
      .limit(1)

    if (!bookingItem) {
      return null
    }

    validateBookingItemCommissionState(data)

    const [row] = await db
      .insert(bookingItemCommissions)
      .values({ ...data, bookingItemId })
      .returning()

    return row ?? null
  },

  async updateBookingItemCommission(
    db: PostgresJsDatabase,
    commissionId: string,
    data: UpdateBookingItemCommissionInput,
  ) {
    const [existing] = await db
      .select()
      .from(bookingItemCommissions)
      .where(eq(bookingItemCommissions.id, commissionId))
      .limit(1)

    if (!existing) {
      return null
    }

    validateBookingItemCommissionState({ ...existing, ...data })

    const [row] = await db
      .update(bookingItemCommissions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookingItemCommissions.id, commissionId))
      .returning()

    return row ?? null
  },

  async deleteBookingItemCommission(db: PostgresJsDatabase, commissionId: string) {
    const [row] = await db
      .delete(bookingItemCommissions)
      .where(eq(bookingItemCommissions.id, commissionId))
      .returning({ id: bookingItemCommissions.id })

    return row ?? null
  },
}
