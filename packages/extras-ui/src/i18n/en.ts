import type { ExtrasUiMessages } from "./messages.js"

export const extrasUiEn = {
  catalogCard: {
    untitled: "Untitled extra",
    unitPrefix: "/ {unit}",
  },
  productCombobox: {
    placeholder: "Search products...",
    loading: "Loading...",
    empty: "No products found.",
    statusLabels: {
      draft: "Draft",
      active: "Active",
      archived: "Archived",
    },
    bookingModeLabels: {
      date: "Date",
      date_time: "Date and time",
      open: "Open",
      stay: "Stay",
      transfer: "Transfer",
      itinerary: "Itinerary",
      other: "Other",
    },
  },
} satisfies ExtrasUiMessages
