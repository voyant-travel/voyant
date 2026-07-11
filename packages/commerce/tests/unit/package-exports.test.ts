import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
  createAcceptanceSignatureSubscriberGraphRuntime,
  createCheckoutFinalizeSubscriberGraphRuntime,
} from "../../src/checkout/subscriber-runtime.js"

interface PublishedExport {
  types: string
  import: string
  default: string
}

interface PackageJson {
  exports: Record<string, string>
  publishConfig: {
    exports: Record<string, PublishedExport>
  }
}

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageJson

describe("@voyant-travel/commerce package exports", () => {
  it.each([
    ["./catalog-checkout-runner", "./src/checkout/runner-runtime.ts", "checkout/runner-runtime"],
    [
      "./catalog-checkout-subscribers",
      "./src/checkout/subscriber-runtime.ts",
      "checkout/subscriber-runtime",
    ],
  ])("publishes %s with matching source and distribution targets", (subpath, source, dist) => {
    expect(packageJson.exports[subpath]).toBe(source)
    expect(packageJson.publishConfig.exports[subpath]).toEqual({
      types: `./dist/${dist}.d.ts`,
      import: `./dist/${dist}.js`,
      default: `./dist/${dist}.js`,
    })
  })

  it("publishes selected-graph checkout factories and typed host ports", () => {
    expect(createAcceptanceSignatureSubscriberGraphRuntime).toBeTypeOf("function")
    expect(createCheckoutFinalizeSubscriberGraphRuntime).toBeTypeOf("function")
    expect(catalogCheckoutDatabaseRuntimePort.id).toBe("commerce.checkout-database")
    expect(catalogCheckoutLegalRuntimePort.id).toBe("legal.acceptance-signature")
    expect(catalogCheckoutContractPdfRuntimePort.id).toBe("legal.booking-contract-pdf")
  })

  it("publishes the promotion-redemption subscriber runtime subpath", () => {
    expect(packageJson.exports["./promotion-redemption-subscriber"]).toBe(
      "./src/promotions/subscriber-runtime.ts",
    )
    expect(packageJson.publishConfig.exports["./promotion-redemption-subscriber"]).toEqual({
      types: "./dist/promotions/subscriber-runtime.d.ts",
      import: "./dist/promotions/subscriber-runtime.js",
      default: "./dist/promotions/subscriber-runtime.js",
    })
  })
})
