import type {
  CreateExternalBookingInput,
  CruiseAdapter,
  ExternalFareVariant,
  ExternalPassengerComposition,
  ExternalPriceRow,
  SourceRef,
} from "./index.js"

export type CruiseAdapterCompatibilityFixture = {
  /**
   * Two cruise refs with the same upstream `externalId` but different
   * connection/source context. This proves the adapter keys by full SourceRef.
   */
  primaryCruiseRef: SourceRef
  alternateCruiseRef: SourceRef
  sailingRef: SourceRef
  shipRef: SourceRef
  cabinCategoryRef: SourceRef
  minimumItineraryDays?: number
  passengerComposition?: ExternalPassengerComposition | null
  fareCode?: string | null
  fareVariant?: ExternalFareVariant | null
  bookingInput: CreateExternalBookingInput
}

export type CruiseAdapterCompatibilityCheckName =
  | "sourceRef.roundTrip.listEntries"
  | "sourceRef.roundTrip.searchProjection"
  | "sourceRef.multiConnection.fetchCruise"
  | "detail.fetchCruise"
  | "detail.fetchSailing"
  | "detail.listSailingsForCruise"
  | "detail.fetchSailingItinerary"
  | "detail.fetchShip"
  | "pricing.fetchSailingPricing"
  | "booking.createBooking"

export type CruiseAdapterCompatibilityCheck = {
  name: CruiseAdapterCompatibilityCheckName
  passed: boolean
  detail?: string
}

export type CruiseAdapterCompatibilityReport = {
  adapterName: string
  adapterVersion: string
  ok: boolean
  checks: CruiseAdapterCompatibilityCheck[]
}

export async function validateCruiseAdapterCompatibility(
  adapter: CruiseAdapter,
  fixture: CruiseAdapterCompatibilityFixture,
): Promise<CruiseAdapterCompatibilityReport> {
  const checks: CruiseAdapterCompatibilityCheck[] = []

  async function check(
    name: CruiseAdapterCompatibilityCheckName,
    run: () => Promise<void>,
  ): Promise<void> {
    try {
      await run()
      checks.push({ name, passed: true })
    } catch (error) {
      checks.push({
        name,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await check("sourceRef.roundTrip.listEntries", async () => {
    const page = await adapter.listEntries({ limit: 100 })
    assertHasRef(
      page.entries.map((entry) => entry.sourceRef),
      fixture.primaryCruiseRef,
      "listEntries() must expose the primary cruise full SourceRef",
    )
    assertHasRef(
      page.entries.map((entry) => entry.sourceRef),
      fixture.alternateCruiseRef,
      "listEntries() must keep same-externalId connection contexts distinct",
    )
  })

  await check("sourceRef.roundTrip.searchProjection", async () => {
    const refs: SourceRef[] = []
    for await (const entry of adapter.searchProjection({ limit: 100 })) {
      refs.push(entry.sourceRef)
      if (refs.length >= 100) break
    }
    assertHasRef(refs, fixture.primaryCruiseRef, "searchProjection() must emit full SourceRef")
    assertHasRef(
      refs,
      fixture.alternateCruiseRef,
      "searchProjection() must not collapse same-externalId SourceRefs",
    )
  })

  await check("sourceRef.multiConnection.fetchCruise", async () => {
    const primary = await adapter.fetchCruise(fixture.primaryCruiseRef)
    const alternate = await adapter.fetchCruise(fixture.alternateCruiseRef)
    if (!primary) throw new Error("fetchCruise(primaryCruiseRef) returned null")
    if (!alternate) throw new Error("fetchCruise(alternateCruiseRef) returned null")
    assertSameRef(primary.sourceRef, fixture.primaryCruiseRef, "primary cruise SourceRef")
    assertSameRef(alternate.sourceRef, fixture.alternateCruiseRef, "alternate cruise SourceRef")
  })

  await check("detail.fetchCruise", async () => {
    const cruise = await adapter.fetchCruise(fixture.primaryCruiseRef)
    if (!cruise) throw new Error("fetchCruise() returned null")
    assertSameRef(cruise.sourceRef, fixture.primaryCruiseRef, "cruise SourceRef")
    if (!cruise.name) throw new Error("fetchCruise() returned a cruise without a name")
  })

  await check("detail.fetchSailing", async () => {
    const sailing = await adapter.fetchSailing(fixture.sailingRef)
    if (!sailing) throw new Error("fetchSailing() returned null")
    assertSameRef(sailing.sourceRef, fixture.sailingRef, "sailing SourceRef")
    assertSameRef(sailing.cruiseRef, fixture.primaryCruiseRef, "sailing cruiseRef")
    assertSameRef(sailing.shipRef, fixture.shipRef, "sailing shipRef")
  })

  await check("detail.listSailingsForCruise", async () => {
    const sailings = await adapter.listSailingsForCruise(fixture.primaryCruiseRef)
    const matching = sailings.find((sailing) => sameRef(sailing.sourceRef, fixture.sailingRef))
    if (!matching) {
      throw new Error("listSailingsForCruise() did not return the fixture sailing")
    }
    assertSameRef(matching.cruiseRef, fixture.primaryCruiseRef, "listed sailing cruiseRef")
    assertSameRef(matching.shipRef, fixture.shipRef, "listed sailing shipRef")
  })

  await check("detail.fetchSailingItinerary", async () => {
    const days = await adapter.fetchSailingItinerary(fixture.sailingRef)
    const minimumDays = fixture.minimumItineraryDays ?? 1
    if (days.length < minimumDays) {
      throw new Error(
        `fetchSailingItinerary() returned ${days.length} day(s); expected at least ${minimumDays}`,
      )
    }
    if (days.some((day) => !Number.isInteger(day.dayNumber) || day.dayNumber < 1)) {
      throw new Error("fetchSailingItinerary() returned a day without a positive dayNumber")
    }
  })

  await check("detail.fetchShip", async () => {
    const ship = await adapter.fetchShip(fixture.shipRef)
    if (!ship) throw new Error("fetchShip() returned null")
    assertSameRef(ship.sourceRef, fixture.shipRef, "ship SourceRef")
    if (!ship.name) throw new Error("fetchShip() returned a ship without a name")
  })

  await check("pricing.fetchSailingPricing", async () => {
    const prices = await adapter.fetchSailingPricing(fixture.sailingRef)
    const matching = prices.find((price) => priceMatchesFixture(price, fixture))
    if (!matching) {
      throw new Error(
        "fetchSailingPricing() did not return a row for the fixture cabin, composition, and fare",
      )
    }
  })

  await check("booking.createBooking", async () => {
    const result = await adapter.createBooking(fixture.bookingInput)
    if (!result.connectorBookingRef) {
      throw new Error("createBooking() returned no connectorBookingRef")
    }
  })

  return {
    adapterName: adapter.name,
    adapterVersion: adapter.version,
    ok: checks.every((entry) => entry.passed),
    checks,
  }
}

export async function assertCruiseAdapterCompatibility(
  adapter: CruiseAdapter,
  fixture: CruiseAdapterCompatibilityFixture,
): Promise<void> {
  const report = await validateCruiseAdapterCompatibility(adapter, fixture)
  if (report.ok) return
  const failures = report.checks
    .filter((entry) => !entry.passed)
    .map((entry) => `- ${entry.name}: ${entry.detail ?? "failed"}`)
    .join("\n")
  throw new Error(
    `CruiseAdapter compatibility failed for ${report.adapterName}@${report.adapterVersion}\n${failures}`,
  )
}

function priceMatchesFixture(
  price: ExternalPriceRow,
  fixture: CruiseAdapterCompatibilityFixture,
): boolean {
  if (!sameRef(price.cabinCategoryRef, fixture.cabinCategoryRef)) return false
  if (fixture.fareCode && price.fareCode !== fixture.fareCode) return false
  if (fixture.fareVariant && price.fareVariant !== fixture.fareVariant) return false
  if (fixture.passengerComposition && price.passengerComposition) {
    return stableJson(price.passengerComposition) === stableJson(fixture.passengerComposition)
  }
  return !fixture.passengerComposition || !price.passengerComposition
}

function assertHasRef(refs: SourceRef[], expected: SourceRef, message: string): void {
  if (!refs.some((ref) => sameRef(ref, expected))) {
    throw new Error(`${message}: expected ${stableJson(expected)}`)
  }
}

function assertSameRef(actual: SourceRef, expected: SourceRef, label: string): void {
  if (!sameRef(actual, expected)) {
    throw new Error(
      `${label} mismatch: expected ${stableJson(expected)}, got ${stableJson(actual)}`,
    )
  }
}

function sameRef(a: SourceRef, b: SourceRef): boolean {
  return stableJson(a) === stableJson(b)
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    out[key] = sortValue((value as Record<string, unknown>)[key])
  }
  return out
}
