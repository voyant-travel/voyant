import { bookingsService } from "@voyantjs/bookings"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { SourceRef } from "./adapters/index.js"
import { type CharterVoyage, charterProducts, charterVoyages } from "./schema-core.js"
import { type CharterSuite, charterSuites } from "./schema-pricing.js"
import { type CharterYacht, charterYachts } from "./schema-yachts.js"
import type { CharterGuest } from "./service-bookings-types.js"

export function generateCharterBookingNumber(prefix: "CHT" | "WYC" = "CHT"): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${ts}-${rand}`
}

export function priceCentsFromString(s: string): number {
  const negative = s.startsWith("-")
  const abs = negative ? s.slice(1) : s
  const [whole = "0", frac = ""] = abs.split(".")
  const fracPadded = `${frac}00`.slice(0, 2)
  const cents = Number(whole) * 100 + Number(fracPadded)
  return negative ? -cents : cents
}

export async function loadVoyage(db: PostgresJsDatabase, voyageId: string): Promise<CharterVoyage> {
  const [row] = await db
    .select()
    .from(charterVoyages)
    .where(eq(charterVoyages.id, voyageId))
    .limit(1)
  if (!row) throw new Error(`Charter voyage ${voyageId} not found`)
  return row
}

export async function loadSuite(db: PostgresJsDatabase, suiteId: string): Promise<CharterSuite> {
  const [row] = await db.select().from(charterSuites).where(eq(charterSuites.id, suiteId)).limit(1)
  if (!row) throw new Error(`Charter suite ${suiteId} not found`)
  return row
}

export async function loadYacht(
  db: PostgresJsDatabase,
  yachtId: string,
): Promise<CharterYacht | null> {
  const [row] = await db.select().from(charterYachts).where(eq(charterYachts.id, yachtId)).limit(1)
  return row ?? null
}

export async function loadProductDefaults(
  db: PostgresJsDatabase,
  productId: string,
): Promise<{ defaultApaPercent: string | null; defaultMybaTemplateId: string | null } | null> {
  const [row] = await db
    .select({
      defaultApaPercent: charterProducts.defaultApaPercent,
      defaultMybaTemplateId: charterProducts.defaultMybaTemplateId,
    })
    .from(charterProducts)
    .where(eq(charterProducts.id, productId))
    .limit(1)
  return row ?? null
}

export function sourceRefEquals(a: SourceRef, b: SourceRef): boolean {
  return (a.connectionId ?? null) === (b.connectionId ?? null) && a.externalId === b.externalId
}

export async function createCharterTravelers(
  db: PostgresJsDatabase,
  bookingId: string,
  guests: ReadonlyArray<CharterGuest>,
  userId: string | undefined,
  options: { includeGuestNotes: boolean },
): Promise<void> {
  for (const guest of guests) {
    await bookingsService.createTraveler(
      db,
      bookingId,
      {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email ?? null,
        phone: guest.phone ?? null,
        travelerCategory: guest.travelerCategory ?? null,
        preferredLanguage: guest.preferredLanguage ?? null,
        specialRequests: guest.specialRequests ?? null,
        isPrimary: guest.isPrimary ?? false,
        notes: options.includeGuestNotes ? (guest.notes ?? null) : null,
      },
      userId,
    )
  }
}
