import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import {
  VOYANT_ROUTE_FILE_IGNORE_PATTERN,
  VOYANT_SSR_OPTIMIZE_DEPS,
  voyantGeneratedRoutes,
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

describe("voyantGeneratedRoutes", () => {
  it("writes package-owned route files under the ignored graph directory", () => {
    const root = mkdtempSync(join(tmpdir(), "voyant-routes-"))
    try {
      const generated = voyantGeneratedRoutes({
        appRootUrl: pathToFileURL(join(root, "vite.config.ts")).href,
        files: [{ path: "(auth)/sign-in.tsx", source: "export const Route = true" }],
      })

      expect(generated.routesDirectory).toBe(join(root, ".voyant/routes"))
      expect(generated.generatedRouteTree).toBe(join(root, ".voyant/routeTree.gen.ts"))
      expect(readFileSync(join(generated.routesDirectory, "(auth)/sign-in.tsx"), "utf8")).toBe(
        "export const Route = true\n",
      )
      expect(existsSync(join(root, "src/routes"))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("rejects route paths that can escape the generated directory", () => {
    const root = mkdtempSync(join(tmpdir(), "voyant-routes-"))
    try {
      expect(() =>
        voyantGeneratedRoutes({
          appRootUrl: pathToFileURL(join(root, "vite.config.ts")).href,
          files: [{ path: "../route.tsx", source: "" }],
        }),
      ).toThrow("Invalid generated route path")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
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

  it("deduplicates only dependencies available from the generated app root", () => {
    const config = voyantStartViteConfig(base)

    expect(config.resolve?.dedupe).toEqual([
      "react",
      "react-dom",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ])
    expect(config.resolve?.dedupe).not.toContain("@voyant-travel/admin")
  })

  it("does not prebundle the broad operator composition entry", () => {
    const config = voyantStartViteConfig(base)

    expect(config.optimizeDeps?.exclude).toEqual([
      "@voyant-travel/admin",
      "@voyant-travel/operator-standard",
      "@voyant-travel/operator-standard/standard-frontend",
    ])
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

  it("prebundles only direct generated-app dependencies", () => {
    expect(VOYANT_SSR_OPTIMIZE_DEPS).toEqual([
      "react",
      "react-dom",
      "react-dom/server",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ])
  })

  it("keeps the CommonJS Postgres driver external in Node SSR builds", () => {
    const config = voyantStartViteConfig({ ...base, nodeSsr: true })

    expect(config.ssr?.external).toContain("pg")
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
