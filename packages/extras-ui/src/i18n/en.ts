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
  slotManifest: {
    title: "Extras manifest",
    emptyExtras: "No slot-manifest extras are configured for this product.",
    emptyTravelers: "No active travelers are assigned to this slot.",
    travelerColumn: "Traveler",
    bookingColumn: "Booking",
    selectedLabel: "Selected",
    selectLabel: "Select",
    cancelLabel: "Cancel",
    collectedLabel: "Collected",
    pendingLabel: "Pending",
    waivedLabel: "Waived",
    notRequiredLabel: "No collection",
    markCollected: "Mark collected",
    markWaived: "Waive",
    selectAll: "Select all",
    clearAll: "Clear all",
    loading: "Loading extras...",
  },
} satisfies ExtrasUiMessages
