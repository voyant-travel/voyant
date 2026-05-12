import type { ExtrasUiMessages } from "./messages.js"

export const extrasUiRo = {
  catalogCard: {
    untitled: "Extra fara nume",
    unitPrefix: "/ {unit}",
  },
  productCombobox: {
    placeholder: "Cauta produse...",
    loading: "Se incarca...",
    empty: "Nu s-au gasit produse.",
    statusLabels: {
      draft: "Ciorna",
      active: "Activ",
      archived: "Arhivat",
    },
    bookingModeLabels: {
      date: "Data",
      date_time: "Data si ora",
      open: "Deschis",
      stay: "Sejur",
      transfer: "Transfer",
      itinerary: "Itinerar",
      other: "Altul",
    },
  },
} satisfies ExtrasUiMessages
