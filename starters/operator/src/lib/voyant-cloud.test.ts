import { describe, expect, it } from "vitest"

import {
  isVoyantCloudAdminAuthMode,
  resolveVoyantApiKey,
  resolveVoyantCloudPdfApiKey,
  resolveVoyantDataApiKey,
  tryGetCloudClient,
  tryGetCloudPdfClient,
} from "./voyant-cloud"

describe("voyant cloud env helpers", () => {
  it("treats missing, empty, whitespace, and local placeholder API keys as unconfigured", () => {
    expect(resolveVoyantApiKey({})).toBeUndefined()
    expect(resolveVoyantApiKey({ VOYANT_API_KEY: "" })).toBeUndefined()
    expect(resolveVoyantApiKey({ VOYANT_API_KEY: "   " })).toBeUndefined()
    expect(resolveVoyantApiKey({ VOYANT_API_KEY: "local-dev" })).toBeUndefined()
  })

  it("prefers the canonical key and trims configured values", () => {
    expect(
      resolveVoyantApiKey({
        VOYANT_API_KEY: " vc_primary ",
        VOYANT_CLOUD_API_KEY: "vc_legacy",
      }),
    ).toBe("vc_primary")
    expect(resolveVoyantApiKey({ VOYANT_CLOUD_API_KEY: " vc_legacy " })).toBe("vc_legacy")
  })

  it("recognizes only explicit Voyant Cloud admin auth mode", () => {
    expect(isVoyantCloudAdminAuthMode({})).toBe(false)
    expect(isVoyantCloudAdminAuthMode({ VOYANT_ADMIN_AUTH_MODE: "local" })).toBe(false)
    expect(isVoyantCloudAdminAuthMode({ VOYANT_ADMIN_AUTH_MODE: "voyant-cloud" })).toBe(true)
  })

  it("resolves the Voyant Data key independently from the broad Cloud key in local mode", () => {
    expect(resolveVoyantDataApiKey({ VOYANT_API_KEY: "local-dev" })).toBeUndefined()
    expect(
      resolveVoyantDataApiKey({
        VOYANT_API_KEY: "local-dev",
        VOYANT_DATA_API_KEY: " vd_data ",
      }),
    ).toBe("vd_data")
  })

  it("keeps legacy broad Cloud keys working for Data in Cloud admin mode", () => {
    expect(
      resolveVoyantDataApiKey({
        VOYANT_ADMIN_AUTH_MODE: "voyant-cloud",
        VOYANT_API_KEY: " vc_cloud ",
      }),
    ).toBe("vc_cloud")
  })

  it("resolves the Cloud PDF key independently from the broad Cloud key in local mode", () => {
    expect(resolveVoyantCloudPdfApiKey({ VOYANT_API_KEY: "local-dev" })).toBeUndefined()
    expect(
      resolveVoyantCloudPdfApiKey({
        VOYANT_API_KEY: "local-dev",
        VOYANT_CLOUD_PDF_API_KEY: " vc_pdf ",
      }),
    ).toBe("vc_pdf")
  })

  it("keeps legacy broad Cloud keys working for PDF rendering in Cloud admin mode", () => {
    expect(
      resolveVoyantCloudPdfApiKey({
        VOYANT_ADMIN_AUTH_MODE: "voyant-cloud",
        VOYANT_API_KEY: " vc_cloud ",
      }),
    ).toBe("vc_cloud")
  })

  it("does not pass whitespace-only legacy API keys through to the Cloud SDK", () => {
    expect(tryGetCloudClient({ VOYANT_CLOUD_API_KEY: "   " })).toBeNull()
  })

  it("does not create a PDF Cloud client from a local broad placeholder key", () => {
    expect(tryGetCloudPdfClient({ VOYANT_API_KEY: "local-dev" })).toBeNull()
  })
})
