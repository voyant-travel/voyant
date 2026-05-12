import type { EnrichmentProgramRecord, PriceRecord, Quote } from "@voyantjs/cruises-react"

export type EnrichmentProgramKind = EnrichmentProgramRecord["kind"]
export type CruisePriceAvailability = PriceRecord["availability"]
export type CruiseQuoteComponentKind = Quote["components"][number]["kind"]

export type CruisesUiMessages = {
  common: {
    fallbackCurrencyAmount: string
    occupancyTableLabels: {
      single: string
      double: string
      triple: string
      quad: string
      fallback: string
    }
  }
  catalogCard: {
    untitled: string
    priceFrom: string
    nightsSingular: string
    nightsPlural: string
  }
  enrichmentProgramList: {
    loading: string
    empty: string
    avatarFallback: string
    kindLabels: Record<EnrichmentProgramKind, string>
  }
  externalCruiseBadge: {
    title: string
    label: string
  }
  pricingGrid: {
    empty: string
    cabinCategory: string
    perPerson: string
    availabilityLabels: Record<CruisePriceAvailability, string>
  }
  quoteDisplay: {
    heading: string
    guestLabelSingular: string
    guestLabelPlural: string
    occupancyCabin: string
    guestSummary: string
    baseLine: string
    sections: {
      additions: string
      credits: string
      included: string
    }
    componentKindLabels: Record<CruiseQuoteComponentKind, string>
    componentScope: {
      perPerson: string
      perCabin: string
    }
    includedAmount: string
    totals: {
      perPerson: string
      totalForCabin: string
    }
  }
}
