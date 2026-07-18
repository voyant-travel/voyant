import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { appsUiEn } from "../i18n/en.js"
import { ConsentDisclosures, readConsentDisclosures } from "./consent-disclosures.js"

const normalizedRecord = {
  requestedScopes: ["finance-documents:read"],
  optionalScopes: ["finance-document-artifacts:write"],
  webhooks: [
    {
      eventType: "invoice.issued",
      eventVersion: "1.0.0",
      endpointUrl: "https://app.example.com/webhooks/voyant",
    },
  ],
  adminPages: [
    {
      key: "settings",
      titleKey: "settings.title",
      path: "/settings",
      entryUrl: "https://app.example.com/extensions/settings",
    },
  ],
  slotExtensions: [
    {
      key: "invoice-status",
      titleKey: "invoice.status",
      version: "1.0.0",
      extensionApi: "1.0.0",
      entryUrl: "https://app.example.com/extensions/invoice-status",
      slots: ["invoice.details.after-summary"],
    },
  ],
  urls: {
    setup: "https://app.example.com/setup",
    health: "https://app.example.com/healthz",
    launch: "https://app.example.com",
    privacy: "https://app.example.com/privacy",
    support: "https://app.example.com/support",
  },
  data: {
    classifications: ["financial", "personal"],
    retention: "Provider records are retained for the legally required period.",
    storesSecrets: true,
  },
}

describe("Marketplace consent disclosures", () => {
  it("reads every consent category from the admitted normalized release", () => {
    expect(readConsentDisclosures(normalizedRecord)).toMatchObject({
      requestedScopes: ["finance-documents:read"],
      optionalScopes: ["finance-document-artifacts:write"],
      data: { classifications: ["financial", "personal"], storesSecrets: true },
      webhooks: [{ eventType: "invoice.issued" }],
      adminPages: [{ key: "settings" }],
      slotExtensions: [{ key: "invoice-status" }],
      urls: {
        privacy: "https://app.example.com/privacy",
        support: "https://app.example.com/support",
      },
    })
  })

  it("renders data custody, retention, webhooks, extensions, privacy, and support dynamically", () => {
    const disclosure = readConsentDisclosures(normalizedRecord)
    expect(disclosure).not.toBeNull()
    const html = renderToStaticMarkup(
      <ConsentDisclosures disclosure={disclosure!} messages={appsUiEn} />,
    )

    expect(html).toContain("financial")
    expect(html).toContain("stores encrypted installation or provider credentials")
    expect(html).toContain("legally required period")
    expect(html).toContain("invoice.issued")
    expect(html).toContain("settings.title")
    expect(html).toContain("invoice.details.after-summary")
    expect(html).toContain("https://app.example.com/privacy")
    expect(html).toContain("https://app.example.com/support")
  })

  it("fails closed on incomplete unadmitted records", () => {
    expect(readConsentDisclosures({ requestedScopes: [] })).toBeNull()
  })
})
