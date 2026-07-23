import type { SellabilityUiMessages } from "./messages.js"

export const sellabilityUiEn = {
  common: {
    loading: "Loading...",
    cancel: "Cancel",
    active: "Active",
    channelKindLabels: {
      direct: "Direct",
      affiliate: "Affiliate",
      ota: "OTA",
      reseller: "Reseller",
      marketplace: "Marketplace",
      api_partner: "API Partner",
      connect: "Connect",
    },
    channelStatusLabels: {
      active: "Active",
      inactive: "Inactive",
      pending: "Pending",
      archived: "Archived",
    },
    productStatusLabels: {
      draft: "Draft",
      active: "Active",
      archived: "Archived",
    },
    // Short booking-mode labels, shared vocabulary with the products table and
    // editor picker. Keep in sync with the operator catalog `bookingMode*` keys.
    productBookingModeLabels: {
      date: "Day trip",
      date_time: "Timed activity",
      open: "Open-dated voucher",
      stay: "Accommodation",
      transfer: "Transfer",
      itinerary: "Multi-day tour",
      other: "Other",
    },
    policyScopeLabels: {
      global: "Global",
      product: "Product",
      option: "Option",
      market: "Market",
      channel: "Channel",
    },
    policyTypeLabels: {
      capability: "Capability",
      occupancy: "Occupancy",
      pickup: "Pickup",
      question: "Question",
      allotment: "Allotment",
      availability_window: "Availability window",
      currency: "Currency",
      custom: "Custom",
    },
  },
  channelCombobox: {
    placeholder: "Select channel...",
    empty: "No channels found.",
  },
  marketCombobox: {
    placeholder: "Search markets...",
    empty: "No markets found.",
  },
  productCombobox: {
    placeholder: "Search products...",
    empty: "No products found.",
  },
  productOptionCombobox: {
    placeholder: "Select product option...",
    empty: "No product options found.",
    selectProductFirst: "Select a product first.",
  },
  policyDialog: {
    titles: {
      create: "Add Policy",
      edit: "Edit Policy",
    },
    fields: {
      name: "Name",
      scope: "Scope",
      type: "Type",
      priority: "Priority",
      product: "Product",
      option: "Option",
      market: "Market",
      channel: "Channel",
      conditionsJson: "Conditions (JSON)",
      effectsJson: "Effects (JSON)",
      notes: "Notes",
      active: "Active",
    },
    placeholders: {
      name: "Block bookings without capability",
    },
    actions: {
      create: "Add Policy",
      save: "Save Changes",
    },
    validation: {
      nameRequired: "Name is required",
      jsonObject: "Must be a JSON object",
    },
  },
} satisfies SellabilityUiMessages
