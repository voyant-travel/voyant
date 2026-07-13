import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildViteApplication,
  buildVoyantProjectWithDependencies,
  createProjectViteConfig,
  developVoyantProjectWithDependencies,
  loadStandardRouteFiles,
  prepareProjectBootstrap,
  type VoyantProjectToolingDependencies,
} from "./tooling-internal.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  )
})

describe("Voyant project tooling", () => {
  it("builds the complete Vite application instead of only the client environment", async () => {
    const buildApp = vi.fn(async () => {})
    const createBuilder = vi.fn(async () => ({ buildApp }))
    const config = { root: "/workspace/operator", configFile: false as const }

    await buildViteApplication(config, createBuilder)

    expect(createBuilder).toHaveBeenCalledWith(config)
    expect(buildApp).toHaveBeenCalledOnce()
  })

  it("aliases product dependencies exactly without capturing package subpaths", () => {
    const config = createProjectViteConfig({
      appRootUrl: pathToFileURL("/workspace/operator/generated-config-anchor.ts").href,
      generatedRoutes: {
        plugin: { name: "generated-routes" },
        routesDirectory: "/workspace/operator/.voyant/routes",
        generatedRouteTree: "/workspace/operator/.voyant/routeTree.gen.ts",
      },
      bootstrap: {
        serverEntry: "/workspace/operator/src/server.ts",
        aliases: { "@tanstack/react-router": "/product/react-router/index.cjs" },
      },
    })
    const aliases = config.resolve?.alias
    expect(Array.isArray(aliases)).toBe(true)
    const dependencyAlias = (aliases as Array<{ find: string | RegExp; replacement: string }>).find(
      ({ replacement }) => replacement === "/product/react-router/index.cjs",
    )

    expect(dependencyAlias?.find).toBeInstanceOf(RegExp)
    expect((dependencyAlias?.find as RegExp).test("@tanstack/react-router")).toBe(true)
    expect((dependencyAlias?.find as RegExp).test("@tanstack/react-router/ssr/server")).toBe(false)
  })

  it("keeps the Node distribution under the lifecycle-owned dist directory", () => {
    const config = createProjectViteConfig({
      appRootUrl: pathToFileURL("/workspace/operator/generated-config-anchor.ts").href,
      generatedRoutes: {
        plugin: { name: "generated-routes" },
        routesDirectory: "/workspace/operator/.voyant/routes",
        generatedRouteTree: "/workspace/operator/.voyant/routeTree.gen.ts",
      },
      bootstrap: { serverEntry: "/workspace/operator/src/server.ts" },
    })

    expect(config.build?.outDir).toBe("dist")
  })

  it("generates, builds, and copies both deployment artifact layouts", async () => {
    const projectRoot = "/workspace/operator"
    const calls: string[] = []
    const dependencies = createDependencies(calls)

    await buildVoyantProjectWithDependencies({ projectRoot }, dependencies)

    const appRootUrl = pathToFileURL(path.join(projectRoot, "generated-config-anchor.ts")).href
    expect(dependencies.loadStandardRouteFiles).toHaveBeenCalledWith(projectRoot)
    expect(dependencies.materializeRoutes).toHaveBeenCalledWith({
      appRootUrl,
      files: [{ path: "__root.tsx", source: "export const Route = {}" }],
    })
    expect(dependencies.prepareProjectBootstrap).toHaveBeenCalledWith(projectRoot)
    expect(dependencies.generateRouteTree).toHaveBeenCalledWith({
      projectRoot,
      routesDirectory: "/workspace/operator/.voyant/routes",
      generatedRouteTree: "/workspace/operator/.voyant/routeTree.gen.ts",
    })
    expect(dependencies.createViteConfig).toHaveBeenCalledWith({
      appRootUrl,
      generatedRoutes: {
        plugin: { name: "generated-routes" },
        routesDirectory: "/workspace/operator/.voyant/routes",
        generatedRouteTree: "/workspace/operator/.voyant/routeTree.gen.ts",
      },
      bootstrap: { serverEntry: "/workspace/operator/src/server.ts" },
    })
    expect(dependencies.buildVite).toHaveBeenCalledWith({
      marker: "voyant-vite-config",
      root: projectRoot,
      server: { allowedHosts: true },
    })
    expect(vi.mocked(dependencies.buildVite).mock.calls[0]?.[0]).not.toHaveProperty("configFile")
    expect(dependencies.replaceDirectory).toHaveBeenCalledTimes(2)
    expect(dependencies.replaceDirectory).toHaveBeenCalledWith(
      "/workspace/operator/.voyant",
      "/workspace/operator/dist/.voyant",
    )
    expect(dependencies.replaceDirectory).toHaveBeenCalledWith(
      "/workspace/operator/.voyant",
      "/workspace/operator/dist/server/.voyant",
    )
    expect(calls.indexOf("generate-route-tree")).toBeLessThan(calls.indexOf("vite-build"))
    expect(calls.indexOf("vite-build")).toBeLessThan(calls.indexOf("replace-directory"))
  })

  it("starts Vite SSR on port 3300 and closes the server once", async () => {
    const calls: string[] = []
    const dependencies = createDependencies(calls)

    const development = await developVoyantProjectWithDependencies(
      { projectRoot: "/workspace/operator" },
      dependencies,
    )

    expect(dependencies.createViteServer).toHaveBeenCalledWith({
      marker: "voyant-vite-config",
      root: "/workspace/operator",
      server: { allowedHosts: true, port: 3300 },
    })
    expect(vi.mocked(dependencies.createViteServer).mock.calls[0]?.[0]).not.toHaveProperty(
      "configFile",
    )
    expect(development.url).toBe("http://localhost:3300/")
    expect(calls).toContain("vite-listen")

    await development.close()
    await development.close()
    expect(calls.filter((call) => call === "vite-close")).toHaveLength(1)
  })

  it("passes explicit host and port to Vite and provides a fallback URL", async () => {
    const dependencies = createDependencies([])
    vi.mocked(dependencies.createViteServer).mockResolvedValue({
      resolvedUrls: null,
      listen: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    })

    const development = await developVoyantProjectWithDependencies(
      { projectRoot: "/workspace/operator", host: "127.0.0.1", port: 4400 },
      dependencies,
    )

    expect(dependencies.createViteServer).toHaveBeenCalledWith(
      expect.objectContaining({
        server: { allowedHosts: true, host: "127.0.0.1", port: 4400 },
      }),
    )
    expect(development.url).toBe("http://127.0.0.1:4400")
  })

  it("closes Vite when the server cannot start listening", async () => {
    const dependencies = createDependencies([])
    const close = vi.fn(async () => {})
    vi.mocked(dependencies.createViteServer).mockResolvedValue({
      resolvedUrls: null,
      listen: vi.fn(async () => {
        throw new Error("port unavailable")
      }),
      close,
    })

    await expect(
      developVoyantProjectWithDependencies({ projectRoot: "/workspace/operator" }, dependencies),
    ).rejects.toThrow("port unavailable")
    expect(close).toHaveBeenCalledOnce()
  })

  it("loads selected presentation routes from the product BOM package", async () => {
    const projectRoot = await createTemporaryDirectory()
    await writeProductBom(projectRoot, "@voyant-travel/operator-standard", [
      "@voyant-travel/storefront#presentation.customer",
    ])
    const packageRoot = path.join(projectRoot, "node_modules/@voyant-travel/operator-standard")
    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "@voyant-travel/operator-standard",
        type: "module",
        exports: { "./standard-route-files": "./standard-route-files.ts" },
      }),
    )
    await writeFile(
      path.join(packageRoot, "standard-route-files.ts"),
      `interface RouteFile { readonly path: string; readonly source: string }
export function createStandardOperatorRouteFiles(options: { presentationIds: readonly string[] }): readonly RouteFile[] {
  return [{ path: "project.tsx", source: options.presentationIds.join(",") }]
}
`,
    )

    await expect(loadStandardRouteFiles(projectRoot)).resolves.toEqual([
      {
        path: "project.tsx",
        source: "@voyant-travel/storefront#presentation.customer",
      },
    ])
  })

  it("materializes hidden router and style fallbacks for a minimal project", async () => {
    const projectRoot = await createTemporaryDirectory()
    await writeProductBom(projectRoot, "@acme/operator")

    const bootstrap = await prepareProjectBootstrap(projectRoot)

    expect(bootstrap).toEqual({
      serverEntry: path.join(projectRoot, ".voyant/app/server.ts"),
      routerEntry: path.join(projectRoot, ".voyant/app/router.tsx"),
      stylesEntry: path.join(projectRoot, ".voyant/app/styles.css"),
    })
    await expect(readText(bootstrap.serverEntry)).resolves.toContain(
      "createVoyantProjectServerEntry(projectOptions).start",
    )
    await expect(readText(bootstrap.routerEntry!)).resolves.toContain(
      'from "@acme/operator/standard-frontend"',
    )
    await expect(readText(bootstrap.routerEntry!)).resolves.toContain(
      'from "../routes/_lib/operator-frontend.js"',
    )
    await expect(readText(bootstrap.stylesEntry!)).resolves.toBe(
      '@import "@acme/operator/standard-styles.css";\n',
    )
  })

  it("preserves project-authored server, router, and style overrides", async () => {
    const projectRoot = await createTemporaryDirectory()
    await writeProductBom(projectRoot, "@acme/operator")
    await mkdir(path.join(projectRoot, "src"), { recursive: true })
    await writeFile(path.join(projectRoot, "src/server.ts"), "export default { fetch() {} }\n")
    await writeFile(path.join(projectRoot, "src/router.tsx"), "export const projectRouter = true\n")
    await writeFile(path.join(projectRoot, "src/styles.css"), "/* project */\n")

    await expect(prepareProjectBootstrap(projectRoot)).resolves.toEqual({
      serverEntry: path.join(projectRoot, "src/server.ts"),
    })
  })

  it("fails when the generated product BOM artifact is missing", async () => {
    const projectRoot = await createTemporaryDirectory()

    await expect(loadStandardRouteFiles(projectRoot)).rejects.toThrow(
      `Voyant product BOM artifact is missing at ${path.join(
        projectRoot,
        ".voyant/product-bom.generated.json",
      )}`,
    )
  })

  it("fails when productBom.id is not a canonical package name", async () => {
    const projectRoot = await createTemporaryDirectory()
    await writeProductBom(projectRoot, "../operator-standard")

    await expect(loadStandardRouteFiles(projectRoot)).rejects.toThrow(
      "must declare productBom.id as a canonical package name",
    )
  })

  it("fails when the selected product package has no route tooling export", async () => {
    const projectRoot = await createTemporaryDirectory()
    await writeProductBom(projectRoot, "@acme/operator")
    const packageRoot = path.join(projectRoot, "node_modules/@acme/operator")
    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "@acme/operator",
        type: "module",
        exports: { ".": "./index.js" },
      }),
    )
    await writeFile(path.join(packageRoot, "index.js"), "export default {}\n")

    await expect(loadStandardRouteFiles(projectRoot)).rejects.toThrow(
      "Voyant product BOM @acme/operator does not provide @acme/operator/standard-route-files",
    )
  })
})

function createDependencies(calls: string[]): VoyantProjectToolingDependencies {
  return {
    loadStandardRouteFiles: vi.fn(async () => [
      { path: "__root.tsx", source: "export const Route = {}" },
    ]),
    prepareProjectBootstrap: vi.fn(async () => ({
      serverEntry: "/workspace/operator/src/server.ts",
    })),
    materializeRoutes: vi.fn(() => ({
      plugin: { name: "generated-routes" },
      routesDirectory: "/workspace/operator/.voyant/routes",
      generatedRouteTree: "/workspace/operator/.voyant/routeTree.gen.ts",
    })),
    generateRouteTree: vi.fn(async () => {
      calls.push("generate-route-tree")
    }),
    createViteConfig: vi.fn(() => ({
      marker: "voyant-vite-config",
      server: { allowedHosts: true as const },
    })),
    buildVite: vi.fn(async () => {
      calls.push("vite-build")
    }),
    createViteServer: vi.fn(async () => ({
      resolvedUrls: {
        local: ["http://localhost:3300/"],
        network: [],
      },
      listen: vi.fn(async () => {
        calls.push("vite-listen")
      }),
      close: vi.fn(async () => {
        calls.push("vite-close")
      }),
    })),
    replaceDirectory: vi.fn(async () => {
      calls.push("replace-directory")
    }),
  }
}

async function readText(file: string): Promise<string> {
  return readFile(file, "utf8")
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "voyant-runtime-tooling-"))
  temporaryDirectories.push(directory)
  return directory
}

async function writeProductBom(
  projectRoot: string,
  id: string,
  presentationIds: readonly string[] = [],
): Promise<void> {
  const artifactDirectory = path.join(projectRoot, ".voyant")
  await mkdir(artifactDirectory, { recursive: true })
  await writeFile(
    path.join(artifactDirectory, "product-bom.generated.json"),
    JSON.stringify({
      schemaVersion: "voyant.product-bom-expansion.v1",
      productBom: {
        schemaVersion: "voyant.product-bom-reference.v1",
        id,
        version: "1",
      },
      graph: { presentations: presentationIds },
    }),
  )
}
