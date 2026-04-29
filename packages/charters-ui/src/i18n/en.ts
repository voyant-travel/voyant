import type { ChartersUiMessages } from "./messages"

export const chartersUiEn: ChartersUiMessages = {
  common: {
    fallbackCurrencyAmount: "{currency} {amount}",
  },
  externalCharterBadge: {
    title: "Sourced via {sourceProvider}",
    label: "External · {sourceProvider}",
  },
  apaTracker: {
    heading: "APA reconciliation",
    subtitle: "Advance Provisioning Allowance · {percent}% of charter fee",
    status: {
      settled: "Settled",
      inProgress: "In progress",
    },
    bars: {
      collectedFromCharterer: "Collected from charterer",
      spentOnBoard: "Spent on board",
      ofAmount: "of {amount}",
    },
    tiles: {
      refundIssued: "Refund issued",
      remainingToRefundOrSpend: "remaining to refund/spend",
      overspentTopUpRequired: "overspent (top-up required)",
      fullyReconciled: "fully reconciled",
    },
    settledAt: "Settled at {date}",
  },
  wholeYachtQuoteCard: {
    wholeYacht: {
      heading: "Whole-yacht charter quote",
      summary: "Charter fee + APA collected up front; APA reconciled post-charter",
      dueBeforeEmbarkation: "due before embarkation",
      charterFee: "Charter fee",
      apaLabel: "APA (Advance Provisioning Allowance, {percent}% of charter fee)",
      totalDue: "Total due",
      explanation:
        "The APA covers fuel, food, beverages, port charges, and other operational expenses during the charter. The actual spend is reconciled at the end of the charter and any surplus is refunded to the charterer.",
    },
    perSuite: {
      summary: "Per-suite charter quote",
      allInForSuite: "all-in for this suite",
      suitePrice: "Suite price",
      portFee: "Port fee",
      total: "Total",
    },
  },
  voyageSuiteGrid: {
    empty: "No suites published for this voyage yet.",
    defaultSelectLabel: "Quote suite",
    priceOnRequest: "Price on request",
    perSuiteAllIn: "per suite, all-in",
    availabilityLabels: {
      available: "Available",
      limited: "Limited",
      on_request: "On request",
      wait_list: "Wait list",
      sold_out: "Sold out",
    },
    categoryLabels: {
      standard: "Standard",
      deluxe: "Deluxe",
      suite: "Suite",
      penthouse: "Penthouse",
      owners: "Owners",
      signature: "Signature",
    },
    metadata: {
      squareFeet: "{value} sq ft",
      maxGuests: "up to {count} guests",
    },
  },
}
