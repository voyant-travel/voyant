/**
 * In-memory CharterAdapter for tests and templates that need a working
 * external source without a real upstream.
 *
 * Seed via the `add*` / `set*` methods; queries against the seeded data work
 * exactly like a real adapter would. Booking commits return synthesized
 * confirmation refs and increment per-instance counters.
 */

import type {
  CharterAdapter,
  CreateExternalPerSuiteBookingInput,
  CreateExternalWholeYachtBookingInput,
  ExternalBookingResult,
  ExternalCharterProduct,
  ExternalCharterProductSummary,
  ExternalCharterScheduleDay,
  ExternalCharterSuite,
  ExternalCharterVoyage,
  ExternalCharterYacht,
  ListEntriesOptions,
  ListEntriesResult,
  SourceRef,
} from "./index.js"

export type MockCharterAdapterOptions = {
  name?: string
  version?: string
  /** Auto-fail every nth call to surface upstream-error handling in tests. */
  failEveryNthCall?: number
}

type SeededProduct = {
  product: ExternalCharterProduct
  voyages: ExternalCharterVoyage[]
  suitesByVoyage: Map<string, ExternalCharterSuite[]>
  scheduleByVoyage: Map<string, ExternalCharterScheduleDay[]>
}

function refKey(ref: SourceRef): string {
  return `${ref.connectionId ?? "_"}|${ref.externalId}`
}

export class MockCharterAdapter implements CharterAdapter {
  readonly name: string
  readonly version: string

  private readonly productsByRef = new Map<string, SeededProduct>()
  private readonly yachtsByRef = new Map<string, ExternalCharterYacht>()
  private readonly perSuiteBookingResults = new Map<string, ExternalBookingResult>()
  private readonly wholeYachtBookingResults = new Map<string, ExternalBookingResult>()

  // Telemetry — useful for assertions in tests.
  callCount = 0
  perSuiteBookingCount = 0
  wholeYachtBookingCount = 0
  private readonly failEveryNthCall: number

  constructor(options: MockCharterAdapterOptions = {}) {
    this.name = options.name ?? "mock-charter"
    this.version = options.version ?? "1.0.0"
    this.failEveryNthCall = options.failEveryNthCall ?? 0
  }

  // ---------- seeders ----------

  addProduct(product: ExternalCharterProduct, voyages: ExternalCharterVoyage[] = []): void {
    const key = refKey(product.sourceRef)
    this.productsByRef.set(key, {
      product,
      voyages: [...voyages],
      suitesByVoyage: new Map(),
      scheduleByVoyage: new Map(),
    })
  }

  addVoyage(productRef: SourceRef, voyage: ExternalCharterVoyage): void {
    const seeded = this.productsByRef.get(refKey(productRef))
    if (!seeded) throw new Error(`MockCharterAdapter: product ${productRef.externalId} not seeded`)
    seeded.voyages.push(voyage)
  }

  addYacht(yacht: ExternalCharterYacht): void {
    this.yachtsByRef.set(refKey(yacht.sourceRef), yacht)
  }

  setVoyageSuites(voyageRef: SourceRef, suites: ExternalCharterSuite[]): void {
    for (const seeded of this.productsByRef.values()) {
      const match = seeded.voyages.find((v) => refKey(v.sourceRef) === refKey(voyageRef))
      if (match) {
        seeded.suitesByVoyage.set(refKey(voyageRef), suites)
        return
      }
    }
    throw new Error(`MockCharterAdapter: voyage ${voyageRef.externalId} not seeded`)
  }

  setVoyageSchedule(voyageRef: SourceRef, days: ExternalCharterScheduleDay[]): void {
    for (const seeded of this.productsByRef.values()) {
      const match = seeded.voyages.find((v) => refKey(v.sourceRef) === refKey(voyageRef))
      if (match) {
        seeded.scheduleByVoyage.set(refKey(voyageRef), days)
        return
      }
    }
    throw new Error(`MockCharterAdapter: voyage ${voyageRef.externalId} not seeded`)
  }

  /** Pre-program a per-suite booking response for the next matching commit. */
  setPerSuiteBookingResult(
    voyageRef: SourceRef,
    suiteRef: SourceRef,
    result: ExternalBookingResult,
  ): void {
    this.perSuiteBookingResults.set(`${refKey(voyageRef)}::${refKey(suiteRef)}`, result)
  }

  /** Pre-program a whole-yacht booking response for the next matching commit. */
  setWholeYachtBookingResult(voyageRef: SourceRef, result: ExternalBookingResult): void {
    this.wholeYachtBookingResults.set(refKey(voyageRef), result)
  }

  // ---------- contract implementation ----------

  private tickAndCheck(): void {
    this.callCount++
    if (this.failEveryNthCall > 0 && this.callCount % this.failEveryNthCall === 0) {
      throw new Error(`MockCharterAdapter forced failure on call #${this.callCount}`)
    }
  }

  private resolveYachtName(yachtRef: SourceRef): string | null {
    return this.yachtsByRef.get(refKey(yachtRef))?.name ?? null
  }

  private lowestSuitePriceFor(productKey: string, currency: string): string | null {
    const seeded = this.productsByRef.get(productKey)
    if (!seeded) return null
    let lowest: number | null = null
    for (const voyage of seeded.voyages) {
      const suites = seeded.suitesByVoyage.get(refKey(voyage.sourceRef)) ?? []
      for (const suite of suites) {
        const amount = suite.pricesByCurrency?.[currency]
        if (!amount) continue
        const value = Number.parseFloat(amount)
        if (!Number.isFinite(value)) continue
        if (lowest === null || value < lowest) lowest = value
      }
    }
    return lowest === null ? null : lowest.toFixed(2)
  }

  async listEntries(options: ListEntriesOptions = {}): Promise<ListEntriesResult> {
    this.tickAndCheck()
    const limit = options.limit ?? 50
    const all: ExternalCharterProductSummary[] = []
    for (const [key, seeded] of this.productsByRef.entries()) {
      const sortedDates = seeded.voyages.map((v) => v.departureDate).sort()
      // Mock browse currency is USD by default; real adapters can publish
      // any currency the operator markets in.
      const browseCurrency = "USD"
      const lowest = this.lowestSuitePriceFor(key, browseCurrency)
      all.push({
        sourceRef: seeded.product.sourceRef,
        name: seeded.product.name,
        slug: seeded.product.slug,
        lineName: seeded.product.lineName,
        yachtName: seeded.product.defaultYachtRef
          ? this.resolveYachtName(seeded.product.defaultYachtRef)
          : null,
        earliestVoyage: sortedDates.at(0) ?? null,
        latestVoyage: sortedDates.at(-1) ?? null,
        lowestPriceAmount: lowest,
        lowestPriceCurrency: lowest ? browseCurrency : null,
        heroImageUrl: seeded.product.heroImageUrl ?? null,
      })
    }
    return { entries: all.slice(0, limit) }
  }

  async fetchProduct(ref: SourceRef): Promise<ExternalCharterProduct | null> {
    this.tickAndCheck()
    return this.productsByRef.get(refKey(ref))?.product ?? null
  }

  async fetchVoyage(ref: SourceRef): Promise<ExternalCharterVoyage | null> {
    this.tickAndCheck()
    for (const seeded of this.productsByRef.values()) {
      const match = seeded.voyages.find((v) => refKey(v.sourceRef) === refKey(ref))
      if (match) return match
    }
    return null
  }

  async fetchVoyageSuites(ref: SourceRef): Promise<ExternalCharterSuite[]> {
    this.tickAndCheck()
    for (const seeded of this.productsByRef.values()) {
      const suites = seeded.suitesByVoyage.get(refKey(ref))
      if (suites) return suites
    }
    return []
  }

  async fetchVoyageSchedule(ref: SourceRef): Promise<ExternalCharterScheduleDay[]> {
    this.tickAndCheck()
    for (const seeded of this.productsByRef.values()) {
      const days = seeded.scheduleByVoyage.get(refKey(ref))
      if (days) return days
    }
    return []
  }

  async fetchYacht(ref: SourceRef): Promise<ExternalCharterYacht | null> {
    this.tickAndCheck()
    return this.yachtsByRef.get(refKey(ref)) ?? null
  }

  async listVoyagesForProduct(productRef: SourceRef): Promise<ExternalCharterVoyage[]> {
    this.tickAndCheck()
    return this.productsByRef.get(refKey(productRef))?.voyages ?? []
  }

  async createPerSuiteBooking(
    input: CreateExternalPerSuiteBookingInput,
  ): Promise<ExternalBookingResult> {
    this.tickAndCheck()
    this.perSuiteBookingCount++
    const programmed = this.perSuiteBookingResults.get(
      `${refKey(input.voyageRef)}::${refKey(input.suiteRef)}`,
    )
    if (programmed) return programmed
    return {
      connectorBookingRef: `MOCK-CHT-${this.perSuiteBookingCount.toString().padStart(6, "0")}`,
      connectorStatus: "confirmed",
    }
  }

  async createWholeYachtBooking(
    input: CreateExternalWholeYachtBookingInput,
  ): Promise<ExternalBookingResult> {
    this.tickAndCheck()
    this.wholeYachtBookingCount++
    const programmed = this.wholeYachtBookingResults.get(refKey(input.voyageRef))
    if (programmed) return programmed
    return {
      connectorBookingRef: `MOCK-WYC-${this.wholeYachtBookingCount.toString().padStart(6, "0")}`,
      connectorStatus: "confirmed",
    }
  }
}
