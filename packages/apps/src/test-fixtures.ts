import type { AppManifest } from "./contracts.js"

export const validManifest = {
  schemaVersion: "voyant.app-manifest.v1",
  releaseVersion: "1.0.0",
  apiCompatibility: { min: "2026-07-01", max: "2026-12-31" },
  scopes: {
    requested: ["app-webhooks:configure", "bookings:read"],
    optional: ["invoices:read"],
  },
  admin: {
    pages: [
      {
        key: "settings",
        titleKey: "settings.title",
        path: "/settings",
        entryUrl: "https://app.example.com/admin/settings",
      },
    ],
    slotExtensions: [
      {
        key: "booking-panel",
        titleKey: "booking.panel.title",
        version: "1.0.0",
        extensionApi: "^1",
        entryUrl: "https://app.example.com/admin/booking-panel",
        slots: ["booking.details.header"],
      },
    ],
  },
  webhooks: [
    {
      eventType: "booking.created",
      eventVersion: "1.0.0",
      endpointUrl: "https://app.example.com/webhooks/voyant",
    },
  ],
  customFields: [
    {
      entityType: "booking",
      key: "external_id",
      label: "External ID",
      fieldType: "text",
      isRequired: false,
      isSearchable: false,
      isExportable: true,
      isInvoiceable: false,
      options: null,
      dataClassification: "internal",
    },
  ],
  locales: {
    default: "en-US",
    supported: ["en-US", "ro-RO"],
    host: {
      "en-US": {
        name: "Example App",
        summary: "Synchronizes example records.",
        navigation: { settings: "Example" },
        extensions: { "booking-panel": "Example panel" },
        setup: {},
      },
      "ro-RO": {
        name: "Aplicatie Exemplu",
        summary: "Sincronizeaza inregistrari exemplu.",
        navigation: {},
        extensions: {},
        setup: {},
      },
    },
  },
  urls: {
    health: "https://app.example.com/health",
    launch: "https://app.example.com/launch",
    privacy: "https://app.example.com/privacy",
    support: "https://app.example.com/support",
  },
  data: {
    classifications: ["internal"],
    retention: "Retained until the operator removes the app-owned records.",
    storesSecrets: false,
  },
} satisfies AppManifest
