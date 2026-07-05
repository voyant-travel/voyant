import { describe, expect, it } from "vitest"
import {
  VOYANT_ROUTE_FILE_IGNORE_PATTERN,
  VOYANT_SSR_OPTIMIZE_DEPS,
  voyantStartViteConfig,
  voyantVendorChunk,
} from "../src/index.js"

describe("voyantVendorChunk", () => {
  it("ignores first-party modules", () => {
    expect(voyantVendorChunk("/repo/packages/ui/src/components/button.tsx")).toBeUndefined()
  })

  it("pins react, react-dom, scheduler, and the JSX runtime into the react chunk", () => {
    expect(voyantVendorChunk("/repo/node_modules/react/index.js")).toBe("react")
    expect(voyantVendorChunk("/repo/node_modules/react-dom/client.js")).toBe("react")
    expect(voyantVendorChunk("/repo/node_modules/scheduler/index.js")).toBe("react")
    expect(voyantVendorChunk("/repo/node_modules/react/jsx-runtime.js")).toBe("react")
    expect(voyantVendorChunk("/repo/node_modules/react/jsx-dev-runtime.js")).toBe("react")
  })

  it("isolates the heavy editor, chart, and pdf vendors", () => {
    expect(voyantVendorChunk("/repo/node_modules/@tiptap/core/index.js")).toBe("tiptap")
    expect(voyantVendorChunk("/repo/node_modules/prosemirror-state/index.js")).toBe("tiptap")
    expect(voyantVendorChunk("/repo/node_modules/recharts/es6/index.js")).toBe("recharts")
    expect(voyantVendorChunk("/repo/node_modules/pdf-lib/cjs/index.js")).toBe("pdf-lib")
    expect(voyantVendorChunk("/repo/node_modules/@pdf-lib/fontkit/index.js")).toBe("pdf-lib")
  })

  it("keeps class-name helpers out of heavy vendor chunks", () => {
    expect(voyantVendorChunk("/repo/node_modules/clsx/dist/clsx.mjs")).toBe("class-utils")
    expect(voyantVendorChunk("/repo/node_modules/tailwind-merge/dist/index.mjs")).toBe(
      "class-utils",
    )
  })

  it("leaves other vendors to the default chunking", () => {
    expect(voyantVendorChunk("/repo/node_modules/zod/index.js")).toBeUndefined()
    // react-hook-form must NOT match the /react/ pin.
    expect(voyantVendorChunk("/repo/node_modules/react-hook-form/dist/index.js")).toBeUndefined()
    expect(
      voyantVendorChunk("/repo/node_modules/better-auth/dist/client/react/index.js"),
    ).toBeUndefined()
    expect(
      voyantVendorChunk("/repo/node_modules/@better-auth/utils/dist/client/react/error-codes.js"),
    ).toBeUndefined()
  })
})

describe("voyantStartViteConfig", () => {
  const base = {
    appRootUrl: "file:///repo/starters/operator/vite.config.ts",
    plugins: [],
  }

  it("anchors the @ alias at the app's src directory", () => {
    const config = voyantStartViteConfig(base)
    const alias = config.resolve?.alias as Record<string, string>

    expect(alias["@"]).toBe("/repo/starters/operator/src")
  })

  it("layers extra manual chunks after the Voyant vendor rules", () => {
    const config = voyantStartViteConfig({
      ...base,
      extraManualChunks: (id) => (id.includes("/lodash/") ? "lodash" : undefined),
    })
    const output = config.build?.rollupOptions?.output
    const manualChunks = (Array.isArray(output) ? output[0] : output)?.manualChunks as (
      id: string,
    ) => string | undefined

    expect(manualChunks("/repo/node_modules/react/index.js")).toBe("react")
    expect(manualChunks("/repo/node_modules/lodash/index.js")).toBe("lodash")
    expect(manualChunks("/repo/node_modules/zod/index.js")).toBeUndefined()
  })

  it("appends app-specific SSR optimizeDeps to the Voyant set", () => {
    const config = voyantStartViteConfig({ ...base, ssrOptimizeDepsInclude: ["my-lib"] })
    const include = config.ssr?.optimizeDeps?.include ?? []

    expect(include).toEqual([...VOYANT_SSR_OPTIMIZE_DEPS, "my-lib"])
  })

  it("allows dev tunnel hosts by default and supports an explicit host list", () => {
    expect(voyantStartViteConfig(base).server?.allowedHosts).toBe(true)
    expect(
      voyantStartViteConfig({ ...base, allowedHosts: ["app.example.test"] }).server?.allowedHosts,
    ).toEqual(["app.example.test"])
  })
})

describe("VOYANT_ROUTE_FILE_IGNORE_PATTERN", () => {
  const pattern = new RegExp(VOYANT_ROUTE_FILE_IGNORE_PATTERN)

  it("ignores colocated non-route modules", () => {
    expect(pattern.test("_components")).toBe(true)
    expect(pattern.test("_hooks")).toBe(true)
    expect(pattern.test("booking-detail-page.tsx")).toBe(true)
    expect(pattern.test("contract-dialogs.tsx")).toBe(true)
    expect(pattern.test("shop-product-detail-content.ts")).toBe(true)
    expect(pattern.test("shop-product-detail-accommodations.tsx")).toBe(true)
    expect(pattern.test("shop-product-detail-cruises.tsx")).toBe(true)
    expect(pattern.test("shop-product-detail-products.tsx")).toBe(true)
    expect(pattern.test("types.ts")).toBe(true)
  })

  it("keeps real route files", () => {
    expect(pattern.test("index.tsx")).toBe(false)
    expect(pattern.test("route.tsx")).toBe(false)
    expect(pattern.test("$bookingId.tsx")).toBe(false)
  })
})
