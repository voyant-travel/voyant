import type { CruisesUiMessages } from "./messages"

export const cruisesUiRo: CruisesUiMessages = {
  common: {
    fallbackCurrencyAmount: "{currency} {amount}",
    occupancyTableLabels: {
      single: "Single",
      double: "Dubla",
      triple: "Tripla",
      quad: "Cvadrupla",
      fallback: "{count} locuri",
    },
  },
  enrichmentProgramList: {
    loading: "Se incarca programele de imbogatire…",
    empty: "Nu exista programe de imbogatire publicate pentru aceasta croaziera.",
    avatarFallback: "?",
    kindLabels: {
      naturalist: "Naturalist",
      historian: "Istoric",
      photographer: "Fotograf",
      lecturer: "Lector",
      expert: "Expert",
      other: "Specialist",
    },
  },
  externalCruiseBadge: {
    title: "Preluat prin {sourceProvider}",
    label: "Extern · {sourceProvider}",
  },
  pricingGrid: {
    empty: "Nu exista tarife publicate pentru aceasta plecare.",
    cabinCategory: "Categoria cabinei",
    perPerson: "de persoana",
    availabilityLabels: {
      available: "Disponibil",
      limited: "Limitat",
      on_request: "La cerere",
      wait_list: "Lista de asteptare",
      sold_out: "Epuizat",
    },
  },
  quoteDisplay: {
    heading: "Oferta ta",
    guestLabelSingular: "pasager",
    guestLabelPlural: "pasageri",
    occupancyCabin: "cabina pentru {count} persoane",
    guestSummary: "pentru {guestCount} {guestLabel} ({occupancyLabel})",
    baseLine: "Baza · {price} pp × {guestCount}",
    sections: {
      additions: "Costuri suplimentare",
      credits: "Credite",
      included: "Inclus",
    },
    componentKindLabels: {
      gratuity: "Bacsis",
      onboard_credit: "Credit la bord",
      port_charge: "Taxe portuare",
      tax: "Taxa",
      ncf: "Taxe necomisionabile",
      airfare: "Bilet de avion",
      transfer: "Transfer",
      insurance: "Asigurare",
    },
    componentScope: {
      perPerson: "de persoana",
      perCabin: "pe cabina",
    },
    includedAmount: "Inclus",
    totals: {
      perPerson: "Per persoana",
      totalForCabin: "Total pentru cabina",
    },
  },
}
