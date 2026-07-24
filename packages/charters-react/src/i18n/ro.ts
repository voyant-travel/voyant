import type { ChartersUiMessages } from "./messages.js"

export const chartersUiRo: ChartersUiMessages = {
  common: {
    fallbackCurrencyAmount: "{currency} {amount}",
  },
  catalogCard: {
    untitled: "Charter fara nume",
    ratePerWeek: "{amount} / saptamana",
    cabinsSingular: "{count} cabina",
    cabinsPlural: "{count} cabine",
  },
  externalCharterBadge: {
    title: "Preluat prin {sourceProvider}",
    label: "Extern · {sourceProvider}",
  },
  apaTracker: {
    heading: "Reconciliere APA",
    subtitle: "Advance Provisioning Allowance · {percent}% din taxa de charter",
    status: {
      settled: "Reconciliat",
      inProgress: "In curs",
    },
    bars: {
      collectedFromCharterer: "Incasat de la charterer",
      spentOnBoard: "Cheltuit la bord",
      ofAmount: "din {amount}",
    },
    tiles: {
      refundIssued: "Rambursare emisa",
      remainingToRefundOrSpend: "ramas de rambursat/cheltuit",
      overspentTopUpRequired: "depasit (este necesara completare)",
      fullyReconciled: "reconciliat complet",
    },
    settledAt: "Reconciliat la {date}",
  },
  wholeYachtQuoteCard: {
    wholeYacht: {
      heading: "Oferta charter pentru intregul yacht",
      summary: "Taxa de charter + APA incasate in avans; APA se reconciliaza dupa charter",
      dueBeforeEmbarkation: "scadent inainte de imbarcare",
      charterFee: "Taxa de charter",
      apaLabel: "APA (Advance Provisioning Allowance, {percent}% din taxa de charter)",
      totalDue: "Total de plata",
      explanation:
        "APA acopera combustibilul, mancarea, bauturile, taxele portuare si costurile curente. Se reconciliaza dupa charter, iar orice surplus se ramburseaza.",
    },
    perSuite: {
      summary: "Oferta charter per suita",
      allInForSuite: "total pentru aceasta suita",
      suitePrice: "Pret suita",
      portFee: "Taxa portuara",
      total: "Total",
    },
  },
  voyageSuiteGrid: {
    empty: "Nu exista inca suite publicate pentru acest voiaj.",
    defaultSelectLabel: "Cere oferta",
    priceOnRequest: "Pret la cerere",
    perSuiteAllIn: "per suita, total",
    availabilityLabels: {
      available: "Disponibil",
      limited: "Limitat",
      on_request: "La cerere",
      wait_list: "Lista de asteptare",
      sold_out: "Epuizat",
    },
    categoryLabels: {
      standard: "Standard",
      deluxe: "Deluxe",
      suite: "Suita",
      penthouse: "Penthouse",
      owners: "Owners",
      signature: "Signature",
    },
    metadata: {
      squareFeet: "{value} ft²",
      maxGuests: "pana la {count} oaspeti",
    },
  },
}
