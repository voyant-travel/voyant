import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

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
