import type { BookingCharterDetailRecord, CharterSuiteRecord } from "@voyantjs/charters-react"

export type CharterSuiteAvailability = CharterSuiteRecord["availability"]
export type CharterSuiteCategory = NonNullable<CharterSuiteRecord["suiteCategory"]>
export type CharterBookingMode = BookingCharterDetailRecord["bookingMode"]

export type ChartersUiMessages = {
  common: {
    fallbackCurrencyAmount: string
  }
  catalogCard: {
    untitled: string
    ratePerWeek: string
    cabinsSingular: string
    cabinsPlural: string
  }
  externalCharterBadge: {
    title: string
    label: string
  }
  apaTracker: {
    heading: string
    subtitle: string
    status: {
      settled: string
      inProgress: string
    }
    bars: {
      collectedFromCharterer: string
      spentOnBoard: string
      ofAmount: string
    }
    tiles: {
      refundIssued: string
      remainingToRefundOrSpend: string
      overspentTopUpRequired: string
      fullyReconciled: string
    }
    settledAt: string
  }
  wholeYachtQuoteCard: {
    wholeYacht: {
      heading: string
      summary: string
      dueBeforeEmbarkation: string
      charterFee: string
      apaLabel: string
      totalDue: string
      explanation: string
    }
    perSuite: {
      summary: string
      allInForSuite: string
      suitePrice: string
      portFee: string
      total: string
    }
  }
  voyageSuiteGrid: {
    empty: string
    defaultSelectLabel: string
    priceOnRequest: string
    perSuiteAllIn: string
    availabilityLabels: Record<CharterSuiteAvailability, string>
    categoryLabels: Record<CharterSuiteCategory, string>
    metadata: {
      squareFeet: string
      maxGuests: string
    }
  }
}
