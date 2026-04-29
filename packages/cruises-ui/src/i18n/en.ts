import type { CruisesUiMessages } from "./messages"

export const cruisesUiEn: CruisesUiMessages = {
  common: {
    fallbackCurrencyAmount: "{currency} {amount}",
    occupancyTableLabels: {
      single: "Single",
      double: "Double",
      triple: "Triple",
      quad: "Quad",
      fallback: "{count}-occupancy",
    },
  },
  enrichmentProgramList: {
    loading: "Loading enrichment programs…",
    empty: "No enrichment programs published for this cruise.",
    avatarFallback: "?",
    kindLabels: {
      naturalist: "Naturalist",
      historian: "Historian",
      photographer: "Photographer",
      lecturer: "Lecturer",
      expert: "Expert",
      other: "Specialist",
    },
  },
  externalCruiseBadge: {
    title: "Sourced via {sourceProvider}",
    label: "External · {sourceProvider}",
  },
  pricingGrid: {
    empty: "No pricing published for this sailing.",
    cabinCategory: "Cabin category",
    perPerson: "per person",
    availabilityLabels: {
      available: "Available",
      limited: "Limited",
      on_request: "On request",
      wait_list: "Wait list",
      sold_out: "Sold out",
    },
  },
  quoteDisplay: {
    heading: "Your quote",
    guestLabelSingular: "guest",
    guestLabelPlural: "guests",
    occupancyCabin: "{count}-occupancy cabin",
    guestSummary: "for {guestCount} {guestLabel} ({occupancyLabel})",
    baseLine: "Base · {price} pp × {guestCount}",
    sections: {
      additions: "Additions",
      credits: "Credits",
      included: "Included",
    },
    componentKindLabels: {
      gratuity: "Gratuity",
      onboard_credit: "Onboard credit",
      port_charge: "Port charges",
      tax: "Tax",
      ncf: "Non-comm fees",
      airfare: "Airfare",
      transfer: "Transfer",
      insurance: "Insurance",
    },
    componentScope: {
      perPerson: "per person",
      perCabin: "per cabin",
    },
    includedAmount: "Included",
    totals: {
      perPerson: "Per person",
      totalForCabin: "Total for cabin",
    },
  },
}
