import { OpenAPIHono } from "@hono/zod-openapi"
import type { Extension } from "@voyant-travel/core"
import { typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { parseJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { eq } from "drizzle-orm"
import {
  char,
  index,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

import { charterBookingModeEnum, charterSourceEnum } from "./schema-shared.js"

// ---------- source ref shape ----------

export type CharterSourceRef = {
  connectionId?: string
  externalId: string
  [key: string]: unknown
}

// ---------- schema ----------

/**
 * 1:1 booking extension for charters. Holds the mode discriminator
 * (`per_suite` | `whole_yacht`), provenance, snapshot pricing fields
 * for both modes, and APA reconciliation state for whole-yacht charters.
 *
 * Soft FKs to charter_voyages / charter_suites (text columns; no
 * cross-module .references()) follow the schema discipline rule.
 *
 * APA fields are only meaningful when bookingMode = 'whole_yacht'. They
 * stay null for per_suite bookings.
 */
export const bookingCharterDetails = pgTable(
  "booking_charter_details",
  {
    bookingId: text("booking_id").primaryKey(),
    bookingMode: charterBookingModeEnum("booking_mode").notNull(),

    // Provenance — local rows reference local TypeIDs; external rows carry
    // a sourceRef back to the upstream adapter and have nullable local FKs.
    source: charterSourceEnum("source").notNull().default("local"),
    sourceProvider: text("source_provider"),
    sourceRef: jsonb("source_ref").$type<CharterSourceRef>(),

    voyageId: typeIdRef("voyage_id"),
    suiteId: typeIdRef("suite_id"),
    yachtId: typeIdRef("yacht_id"),

    // Display hints — populated for both local and external so the UI can
    // render booking history without re-resolving the voyage every time.
    voyageDisplayName: text("voyage_display_name"),
    suiteDisplayName: text("suite_display_name"),
    yachtName: text("yacht_name"),
    charterAreaSnapshot: text("charter_area_snapshot"),

    guestCount: smallint("guest_count").notNull(),
    quotedCurrency: char("quoted_currency", { length: 3 }).notNull(),

    // per_suite pricing snapshot
    quotedSuitePrice: numeric("quoted_suite_price", { precision: 12, scale: 2 }),
    quotedPortFee: numeric("quoted_port_fee", { precision: 12, scale: 2 }),

    // whole_yacht pricing snapshot
    quotedCharterFee: numeric("quoted_charter_fee", { precision: 15, scale: 2 }),
    apaPercent: numeric("apa_percent", { precision: 5, scale: 2 }),
    apaAmount: numeric("apa_amount", { precision: 15, scale: 2 }),

    quotedTotal: numeric("quoted_total", { precision: 15, scale: 2 }).notNull(),

    // MYBA contract — soft FK; nullable until generateContract() runs.
    mybaTemplateIdSnapshot: text("myba_template_id_snapshot"),
    mybaContractId: typeIdRef("myba_contract_id"),

    // APA reconciliation state (whole_yacht only). All optional & default 0.
    apaPaidAmount: numeric("apa_paid_amount", { precision: 15, scale: 2 }).default("0.00"),
    apaSpentAmount: numeric("apa_spent_amount", { precision: 15, scale: 2 }).default("0.00"),
    apaRefundAmount: numeric("apa_refund_amount", { precision: 15, scale: 2 }).default("0.00"),
    apaSettledAt: timestamp("apa_settled_at", { withTimezone: true }),

    connectorBookingRef: text("connector_booking_ref"),
    connectorStatus: text("connector_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bchd_mode").on(t.bookingMode),
    index("idx_bchd_source").on(t.source),
    index("idx_bchd_voyage").on(t.voyageId),
    index("idx_bchd_suite").on(t.suiteId),
    index("idx_bchd_yacht").on(t.yachtId),
    index("idx_bchd_myba_contract").on(t.mybaContractId),
    index("idx_bchd_connector_ref").on(t.connectorBookingRef),
    index("idx_bchd_provider").on(t.sourceProvider),
  ],
)

export type BookingCharterDetail = typeof bookingCharterDetails.$inferSelect
export type NewBookingCharterDetail = typeof bookingCharterDetails.$inferInsert

// ---------- validation ----------

const sourceRefValueSchema = z
  .object({
    connectionId: z.string().optional(),
    externalId: z.string(),
  })
  .catchall(z.unknown())

const moneyString = z.string().regex(/^-?\d+(\.\d{1,2})?$/)

export const charterDetailUpsertSchema = z
  .object({
    bookingMode: z.enum(["per_suite", "whole_yacht"]),
    source: z.enum(["local", "external"]).default("local"),
    sourceProvider: z.string().optional().nullable(),
    sourceRef: sourceRefValueSchema.optional().nullable(),
    voyageId: z.string().optional().nullable(),
    suiteId: z.string().optional().nullable(),
    yachtId: z.string().optional().nullable(),
    voyageDisplayName: z.string().optional().nullable(),
    suiteDisplayName: z.string().optional().nullable(),
    yachtName: z.string().optional().nullable(),
    charterAreaSnapshot: z.string().optional().nullable(),
    guestCount: z.number().int().min(1).max(50),
    quotedCurrency: z.string().length(3),
    quotedSuitePrice: moneyString.optional().nullable(),
    quotedPortFee: moneyString.optional().nullable(),
    quotedCharterFee: moneyString.optional().nullable(),
    apaPercent: moneyString.optional().nullable(),
    apaAmount: moneyString.optional().nullable(),
    quotedTotal: moneyString,
    mybaTemplateIdSnapshot: z.string().optional().nullable(),
    mybaContractId: z.string().optional().nullable(),
    apaPaidAmount: moneyString.optional().nullable(),
    apaSpentAmount: moneyString.optional().nullable(),
    apaRefundAmount: moneyString.optional().nullable(),
    connectorBookingRef: z.string().optional().nullable(),
    connectorStatus: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "local") {
      if (!value.voyageId) {
        ctx.addIssue({
          code: "custom",
          path: ["voyageId"],
          message: "voyageId is required when source='local'",
        })
      }
      if (value.bookingMode === "per_suite" && !value.suiteId) {
        ctx.addIssue({
          code: "custom",
          path: ["suiteId"],
          message: "suiteId is required for local per_suite bookings",
        })
      }
    } else {
      if (!value.sourceProvider) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceProvider"],
          message: "sourceProvider is required when source='external'",
        })
      }
      if (!value.sourceRef) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceRef"],
          message: "sourceRef is required when source='external'",
        })
      }
    }
    if (value.bookingMode === "whole_yacht") {
      if (!value.quotedCharterFee) {
        ctx.addIssue({
          code: "custom",
          path: ["quotedCharterFee"],
          message: "quotedCharterFee is required for whole_yacht bookings",
        })
      }
      if (!value.apaPercent || !value.apaAmount) {
        ctx.addIssue({
          code: "custom",
          path: ["apaPercent"],
          message: "apaPercent + apaAmount required for whole_yacht bookings",
        })
      }
    } else if (value.bookingMode === "per_suite" && !value.quotedSuitePrice) {
      ctx.addIssue({
        code: "custom",
        path: ["quotedSuitePrice"],
        message: "quotedSuitePrice is required for per_suite bookings",
      })
    }
  })

export type CharterDetailUpsert = z.infer<typeof charterDetailUpsertSchema>

const apaPaymentSchema = z.object({
  amount: moneyString,
  note: z.string().optional().nullable(),
})

const apaReconcileSchema = z.object({
  spentAmount: moneyString.optional(),
  refundAmount: moneyString.optional(),
  settle: z.boolean().default(false),
  note: z.string().optional().nullable(),
})

// ---------- services ----------

export const bookingCharterDetailsService = {
  async get(db: PostgresJsDatabase, bookingId: string): Promise<BookingCharterDetail | null> {
    const [row] = await db
      .select()
      .from(bookingCharterDetails)
      .where(eq(bookingCharterDetails.bookingId, bookingId))
      .limit(1)
    return row ?? null
  },

  async upsert(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CharterDetailUpsert,
  ): Promise<BookingCharterDetail> {
    const payload: NewBookingCharterDetail = { ...data, bookingId }
    const [existing] = await db
      .select({ bookingId: bookingCharterDetails.bookingId })
      .from(bookingCharterDetails)
      .where(eq(bookingCharterDetails.bookingId, bookingId))
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(bookingCharterDetails)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(bookingCharterDetails.bookingId, bookingId))
        .returning()
      if (!row) throw new Error("Failed to update booking charter details")
      return row
    }
    const [row] = await db.insert(bookingCharterDetails).values(payload).returning()
    if (!row) throw new Error("Failed to insert booking charter details")
    return row
  },

  async remove(db: PostgresJsDatabase, bookingId: string): Promise<boolean> {
    const result = await db
      .delete(bookingCharterDetails)
      .where(eq(bookingCharterDetails.bookingId, bookingId))
      .returning({ id: bookingCharterDetails.bookingId })
    return result.length > 0
  },

  /**
   * Record an APA payment. Adds to apaPaidAmount; does not validate
   * against quoted apaAmount because real-world APA settlements may
   * involve top-ups during the charter.
   */
  async recordApaPayment(
    db: PostgresJsDatabase,
    bookingId: string,
    args: { amount: string; note?: string | null },
  ): Promise<BookingCharterDetail | null> {
    const existing = await this.get(db, bookingId)
    if (!existing) return null
    if (existing.bookingMode !== "whole_yacht") {
      throw new Error("APA payments only apply to whole_yacht bookings")
    }
    const newPaid = addDecimal(existing.apaPaidAmount ?? "0.00", args.amount)
    const [row] = await db
      .update(bookingCharterDetails)
      .set({
        apaPaidAmount: newPaid,
        notes: args.note
          ? appendNote(existing.notes, `APA payment ${args.amount}: ${args.note}`)
          : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookingCharterDetails.bookingId, bookingId))
      .returning()
    return row ?? null
  },

  /**
   * Post-charter APA reconciliation. Records what was actually spent on
   * board + any refund due back to the charterer. When `settle: true`
   * stamps `apaSettledAt`. Caller is responsible for kicking off any
   * downstream finance flow (refund issuance, etc.).
   */
  async reconcileApa(
    db: PostgresJsDatabase,
    bookingId: string,
    args: {
      spentAmount?: string
      refundAmount?: string
      settle?: boolean
      note?: string | null
    },
  ): Promise<BookingCharterDetail | null> {
    const existing = await this.get(db, bookingId)
    if (!existing) return null
    if (existing.bookingMode !== "whole_yacht") {
      throw new Error("APA reconciliation only applies to whole_yacht bookings")
    }
    const set: Partial<NewBookingCharterDetail> = { updatedAt: new Date() }
    if (args.spentAmount !== undefined) set.apaSpentAmount = args.spentAmount
    if (args.refundAmount !== undefined) set.apaRefundAmount = args.refundAmount
    if (args.settle) set.apaSettledAt = new Date()
    if (args.note) set.notes = appendNote(existing.notes, `APA reconcile: ${args.note}`)
    const [row] = await db
      .update(bookingCharterDetails)
      .set(set)
      .where(eq(bookingCharterDetails.bookingId, bookingId))
      .returning()
    return row ?? null
  },
}

function addDecimal(a: string, b: string): string {
  // Both validated to ^-?\d+(\.\d{1,2})?$. Convert to cents (BigInt) then back.
  return centsToString(stringToCents(a) + stringToCents(b))
}
function stringToCents(s: string): bigint {
  const negative = s.startsWith("-")
  const abs = negative ? s.slice(1) : s
  const [whole = "0", frac = ""] = abs.split(".")
  const fracPadded = `${frac}00`.slice(0, 2)
  const cents = BigInt(whole) * 100n + BigInt(fracPadded)
  return negative ? -cents : cents
}
function centsToString(c: bigint): string {
  const negative = c < 0n
  const abs = negative ? -c : c
  const whole = abs / 100n
  const frac = (abs % 100n).toString().padStart(2, "0")
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`
}
function appendNote(existing: string | null, addition: string): string {
  if (!existing) return addition
  return `${existing}\n${addition}`
}

// ---------- routes ----------

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const CHARTERS_BOOKING_OPENAPI_API_ID = "@voyant-travel/charters#booking-extension.api.admin"

export const chartersBookingExtensionRoutes = new OpenAPIHono<Env>()
chartersBookingExtensionRoutes
  .get("/:bookingId/charter-details", async (c) => {
    const row = await bookingCharterDetailsService.get(c.get("db"), c.req.param("bookingId"))
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .put("/:bookingId/charter-details", async (c) => {
    const data = await parseJsonBody(c, charterDetailUpsertSchema)
    const row = await bookingCharterDetailsService.upsert(
      c.get("db"),
      c.req.param("bookingId"),
      data,
    )
    return c.json({ data: row })
  })

  .delete("/:bookingId/charter-details", async (c) => {
    const ok = await bookingCharterDetailsService.remove(c.get("db"), c.req.param("bookingId"))
    if (!ok) return c.json({ error: "not_found" }, 404)
    return c.body(null, 204)
  })
  .post("/:bookingId/charter-details/apa/payment", async (c) => {
    const data = await parseJsonBody(c, apaPaymentSchema)
    const row = await bookingCharterDetailsService.recordApaPayment(
      c.get("db"),
      c.req.param("bookingId"),
      { amount: data.amount, note: data.note ?? null },
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .post("/:bookingId/charter-details/apa/reconcile", async (c) => {
    const data = await parseJsonBody(c, apaReconcileSchema)
    const row = await bookingCharterDetailsService.reconcileApa(
      c.get("db"),
      c.req.param("bookingId"),
      {
        spentAmount: data.spentAmount,
        refundAmount: data.refundAmount,
        settle: data.settle,
        note: data.note ?? null,
      },
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })

for (const [method, path] of [
  ["get", "/{bookingId}/charter-details"],
  ["put", "/{bookingId}/charter-details"],
  ["delete", "/{bookingId}/charter-details"],
  ["post", "/{bookingId}/charter-details/apa/payment"],
  ["post", "/{bookingId}/charter-details/apa/reconcile"],
] as const) {
  chartersBookingExtensionRoutes.openAPIRegistry.registerPath({
    method,
    path,
    responses: { 200: { description: "Charter booking detail response." } },
    "x-voyant-api-id": CHARTERS_BOOKING_OPENAPI_API_ID,
  })
}

// ---------- HonoExtension export ----------

const chartersBookingExtensionDef: Extension = {
  name: "charters-booking",
  module: "bookings",
}

export const chartersBookingExtension: HonoExtension = {
  extension: chartersBookingExtensionDef,
  adminRoutes: chartersBookingExtensionRoutes,
}
