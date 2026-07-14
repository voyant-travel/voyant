import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { Alias, Plugin, ResolverFunction } from "vite"
import { describe, expect, it, vi } from "vitest"
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
    const aliases = config.resolve?.alias

    expect(aliases).toEqual([{ find: "@", replacement: "/repo/starters/operator/src" }])
  })

  it("resolves legacy frontend imports from the product BOM in each Vite environment", async () => {
    const dependencyAliases = {
      react: "/product/runtime/react.js",
      "react/jsx-runtime": "/product/runtime/react-jsx-runtime.js",
      "@tanstack/react-router": "/product/runtime/tanstack-react-router.js",
    }
    const serverDependencyFacades = {
      react: "@acme/operator/runtime/react",
      "react/jsx-runtime": "@acme/operator/runtime/react/jsx-runtime",
      "@tanstack/react-router": "@acme/operator/runtime/tanstack/react-router",
    }
    const config = voyantStartViteConfig({
      ...base,
      dependencyAliases,
      serverDependencyFacades,
      nodeSsr: true,
    })
    const plugin = (config.plugins as Plugin[]).find(
      (candidate) => candidate.name === "voyant:dependency-facades",
    )
    const resolveId = plugin?.resolveId as Exclude<Plugin["resolveId"], object | undefined>
    const configEnvironmentHook = plugin?.configEnvironment
    const configEnvironment =
      typeof configEnvironmentHook === "object"
        ? configEnvironmentHook.handler
        : configEnvironmentHook
    const resolve = vi.fn(async (source: string) => ({ id: `/resolved/${source}` }))
    const aliases = config.resolve?.alias as Alias[]
    expect(aliases[0]).toEqual({ find: "@", replacement: "/repo/starters/operator/src" })
    expect(aliases.slice(1).map(({ find }) => String(find))).toEqual([
      "/^react$/",
      "/^react\\/jsx-runtime$/",
      "/^@tanstack\\/react-router$/",
    ])
    const reactAlias = aliases[1]!
    const customResolver = reactAlias.customResolver as ResolverFunction

    await expect(
      customResolver.call(
        { environment: { config: { consumer: "server" }, mode: "build" } } as never,
        reactAlias.replacement,
        "/app/route.tsx",
        {} as never,
      ),
    ).resolves.toEqual({ id: serverDependencyFacades.react, external: true })

    await expect(
      customResolver.call(
        { environment: { config: { consumer: "client" }, mode: "dev" }, resolve } as never,
        reactAlias.replacement,
        "/app/route.tsx",
        {} as never,
      ),
    ).resolves.toEqual({ id: `/resolved/${reactAlias.replacement}` })
    expect(resolve).toHaveBeenCalledWith(reactAlias.replacement, "/app/route.tsx", {
      skipSelf: true,
    })

    await expect(
      customResolver.call(
        { environment: { config: { consumer: "client" }, mode: "dev" }, resolve } as never,
        reactAlias.replacement,
        "/product/node_modules/react-dom/index.js",
        {} as never,
      ),
    ).resolves.toEqual({ id: "/resolved/react" })
    expect(resolve).toHaveBeenCalledWith("react", "/product/node_modules/react-dom/index.js", {
      skipSelf: true,
    })

    const jsxAlias = aliases[2]!
    await expect(
      (jsxAlias.customResolver as ResolverFunction).call(
        { environment: { config: { consumer: "server" }, mode: "dev" }, resolve } as never,
        jsxAlias.replacement,
        "/app/route.tsx",
        {} as never,
      ),
    ).resolves.toEqual({
      id: "file:///resolved/@acme/operator/runtime/react/jsx-runtime",
      external: true,
    })
    expect(resolve).toHaveBeenCalledWith(serverDependencyFacades["react/jsx-runtime"], undefined, {
      skipSelf: true,
    })

    await expect(
      resolveId.call(
        { environment: { config: { consumer: "server" }, mode: "dev" }, resolve } as never,
        "#frontend/react",
        "/product/runtime/react.js",
        {} as never,
      ),
    ).resolves.toEqual({
      id: "file:///resolved/%23frontend/react",
      external: true,
    })
    expect(resolve).toHaveBeenCalledWith("#frontend/react", "/product/runtime/react.js", {
      skipSelf: true,
    })
    await expect(
      resolveId.call(
        { environment: { config: { consumer: "client" }, mode: "build" } } as never,
        "unrelated",
        "/app/route.tsx",
        {} as never,
      ),
    ).resolves.toBeNull()

    const clientEnvironment = {
      consumer: "client",
      optimizeDeps: {
        include: [
          ...(config.optimizeDeps?.include ?? []),
          "react",
          "react-dom/client",
          "@tanstack/react-router > @tanstack/react-store",
          "unrelated-package",
        ],
      },
    }
    await configEnvironment?.call(
      {} as never,
      "client",
      clientEnvironment as never,
      { command: "serve", mode: "development" } as never,
    )
    expect(clientEnvironment.optimizeDeps.include).toEqual([
      ...(config.optimizeDeps?.include ?? []),
      "@acme/operator > react",
      "@acme/operator > react-dom/client",
      "unrelated-package",
    ])

    expect(config.optimizeDeps?.exclude).toEqual([
      "@voyant-travel/operator-standard",
      "@voyant-travel/operator-standard/standard-frontend",
    ])
    expect(config.optimizeDeps?.include).toEqual([
      "@acme/operator > @tanstack/react-router > @tanstack/react-store",
      "@acme/operator > @tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector",
    ])
    expect(config.optimizeDeps?.holdUntilCrawlEnd).toBe(false)
    expect(config.ssr?.optimizeDeps?.include).toEqual([])
    expect(config.ssr?.external).toEqual(["pg"])
    expect(config.ssr?.noExternal).toEqual([/^@voyant-travel\//, /^@pxmstudio\//])
  })

  it("deduplicates framework dependencies declared and resolvable from a fresh app root", () => {
    const root = createAppFixture([
      "react",
      "react-dom",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ])
    try {
      const config = voyantStartViteConfig({
        ...base,
        appRootUrl: pathToFileURL(join(root, "vite.config.ts")).href,
      })

      expect(config.resolve?.dedupe).toEqual([
        "react",
        "react-dom",
        "@tanstack/react-query",
        "@tanstack/react-router",
      ])
      expect(config.resolve?.dedupe).not.toContain("@voyant-travel/admin")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("does not deduplicate framework dependencies only installed below a legacy app dependency", () => {
    const root = createAppFixture(["@voyant-travel/operator-standard"])
    try {
      for (const dependency of [
        "react",
        "react-dom",
        "@tanstack/react-query",
        "@tanstack/react-router",
      ]) {
        writeResolvablePackage(
          join(root, "node_modules/@voyant-travel/operator-standard/node_modules"),
          dependency,
        )
      }

      const config = voyantStartViteConfig({
        ...base,
        appRootUrl: pathToFileURL(join(root, "vite.config.ts")).href,
      })

      expect(config.resolve?.dedupe).toEqual([])
      expect(config.ssr?.optimizeDeps?.include).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("does not prebundle the broad operator composition entry", () => {
    const config = voyantStartViteConfig(base)

    expect(config.optimizeDeps?.exclude).toEqual([
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
    const root = createAppFixture([
      "react",
      "react-dom",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ])
    try {
      const config = voyantStartViteConfig({
        ...base,
        appRootUrl: pathToFileURL(join(root, "vite.config.ts")).href,
        ssrOptimizeDepsInclude: ["my-lib"],
      })
      const include = config.ssr?.optimizeDeps?.include ?? []

      expect(include).toEqual([...VOYANT_SSR_OPTIMIZE_DEPS, "my-lib"])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
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

function createAppFixture(dependencies: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "voyant-vite-config-"))
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "test-app",
      dependencies: Object.fromEntries(dependencies.map((id) => [id, "1.0.0"])),
    }),
  )
  for (const dependency of dependencies)
    writeResolvablePackage(join(root, "node_modules"), dependency)
  return root
}

function writeResolvablePackage(nodeModulesRoot: string, name: string): void {
  const packageRoot = join(nodeModulesRoot, name)
  mkdirSync(packageRoot, { recursive: true })
  writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name, main: "index.js" }))
  writeFileSync(join(packageRoot, "index.js"), "module.exports = {}\n")
  if (name === "react") {
    writeFileSync(join(packageRoot, "jsx-runtime.js"), "module.exports = {}\n")
    writeFileSync(join(packageRoot, "jsx-dev-runtime.js"), "module.exports = {}\n")
  }
  if (name === "react-dom") {
    writeFileSync(join(packageRoot, "server.js"), "module.exports = {}\n")
  }
}

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
