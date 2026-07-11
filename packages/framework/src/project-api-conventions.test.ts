import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  analyzeProjectApiConventions,
  compileProjectApiConventions,
  ProjectApiConventionError,
} from "./project-api-conventions.js"

const fixtureRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  )
})

describe("project API conventions", () => {
  it("compiles deterministic route metadata and adapter source", async () => {
    const root = await projectFixture({
      "src/api/admin/orders/[orderId]/route.ts": [
        'import type { VoyantRouteHandler } from "@voyant-travel/hono"',
        "export type RouteState = { loaded: true }",
        "export const POST: VoyantRouteHandler = (c) => c.json({ id: c.req.param('orderId') })",
        "export const GET: VoyantRouteHandler = (c) => c.json({ id: c.req.param('orderId') })",
      ].join("\n"),
      "src/api/store/catalog/(sales)/[...slug]/route.ts":
        "export const OPTIONS = (c: any) => c.body(null, 204)\n",
    })

    const compilation = await compileProjectApiConventions({ projectRoot: root })

    expect(
      compilation.routes.map(({ methods, route, sourcePath, surface }) => ({
        methods,
        route,
        sourcePath,
        surface,
      })),
    ).toEqual([
      {
        methods: ["GET", "POST"],
        route: "/orders/:orderId",
        sourcePath: "src/api/admin/orders/[orderId]/route.ts",
        surface: "admin",
      },
      {
        methods: ["OPTIONS"],
        route: "/catalog/*slug",
        sourcePath: "src/api/store/catalog/(sales)/[...slug]/route.ts",
        surface: "public",
      },
    ])
    expect(compilation.graphRoutes).toEqual([
      {
        id: "project.api.admin.orders.by-orderid",
        methods: ["GET", "POST"],
        mount: "/orders/:orderId",
        surface: "admin",
      },
      {
        id: "project.api.public.catalog.all-slug",
        methods: ["OPTIONS"],
        mount: "/catalog/*slug",
        surface: "public",
      },
    ])
    expect(compilation.generatedFile.path).toBe("runtime/project-api.generated.ts")
    expect(compilation.generatedFile.contents).toBe(
      [
        'import { Hono, type HonoModule, type VoyantBindings, type VoyantVariables } from "@voyant-travel/framework/project-runtime"',
        'import * as route0 from "../../src/api/admin/orders/[orderId]/route.js"',
        'import * as route1 from "../../src/api/store/catalog/(sales)/[...slug]/route.js"',
        "",
        "type ProjectApiEnv = { Bindings: VoyantBindings; Variables: VoyantVariables }",
        "const adminRoutes = new Hono<ProjectApiEnv>()",
        'adminRoutes.on("GET", "/orders/:orderId", route0.GET)',
        'adminRoutes.on("POST", "/orders/:orderId", route0.POST)',
        "const publicRoutes = new Hono<ProjectApiEnv>()",
        'publicRoutes.on("OPTIONS", "/catalog/*slug", route1.OPTIONS)',
        "",
        "export const projectApiHonoModule = {",
        '  module: { name: "project-api" },',
        "  adminRoutes,",
        "  publicRoutes,",
        '  publicPath: "/",',
        "} satisfies HonoModule",
        "",
      ].join("\n"),
    )
  })

  it("allows disjoint methods at one canonical path and rejects duplicate methods", async () => {
    const root = await projectFixture({
      "src/api/admin/orders/[id]/route.ts": "export const GET = () => new Response()\n",
      "src/api/admin/(internal)/orders/[orderId]/route.ts":
        "export const POST = () => new Response()\n",
      "src/api/admin/(duplicate)/orders/[slug]/route.ts":
        "export const GET = () => new Response()\n",
      "src/api/store/orders/[id]/route.ts": "export const GET = () => new Response()\n",
    })

    const analysis = await analyzeProjectApiConventions({ projectRoot: root })

    expect(analysis.diagnostics).toEqual([
      {
        code: "PROJECT_API_DUPLICATE_ROUTE_METHOD",
        message:
          'GET routes on the admin surface collide at "/orders/:param": "src/api/admin/(duplicate)/orders/[slug]/route.ts", "src/api/admin/orders/[id]/route.ts".',
        method: "GET",
        route: "/orders/:param",
        severity: "error",
        sourcePaths: [
          "src/api/admin/(duplicate)/orders/[slug]/route.ts",
          "src/api/admin/orders/[id]/route.ts",
        ],
        surface: "admin",
      },
    ])
  })

  it("rejects missing methods, default exports, and unsupported runtime exports", async () => {
    const root = await projectFixture({
      "src/api/admin/empty/route.ts": "export type Empty = true\n",
      "src/api/admin/defaulted/route.ts":
        "const handler = () => new Response()\nexport default handler\nexport const GET = handler\n",
      "src/api/store/unsupported/route.ts":
        "export const schema = {}\nexport const PATCH = () => new Response()\n",
    })

    const analysis = await analyzeProjectApiConventions({ projectRoot: root })

    expect(
      analysis.diagnostics.map(({ code, exportName, sourcePaths }) => ({
        code,
        exportName,
        sourcePath: sourcePaths[0],
      })),
    ).toEqual([
      {
        code: "PROJECT_API_DEFAULT_EXPORT",
        exportName: "default",
        sourcePath: "src/api/admin/defaulted/route.ts",
      },
      {
        code: "PROJECT_API_MISSING_METHOD",
        exportName: undefined,
        sourcePath: "src/api/admin/empty/route.ts",
      },
      {
        code: "PROJECT_API_UNSUPPORTED_EXPORT",
        exportName: "schema",
        sourcePath: "src/api/store/unsupported/route.ts",
      },
    ])
    await expect(compileProjectApiConventions({ projectRoot: root })).rejects.toBeInstanceOf(
      ProjectApiConventionError,
    )
  })

  it("rejects static, re-export, and dynamic import paths that escape the project", async () => {
    const root = await projectFixture({
      "src/api/admin/escaped/route.ts": [
        'import "../../../../../outside.js"',
        'import "file:///tmp/absolute.js"',
        'export { value } from "../../../../../shared.js"',
        'const load = () => import("../../../../../secret.js")',
        "export const GET = () => new Response(String(load))",
      ].join("\n"),
    })

    const analysis = await analyzeProjectApiConventions({ projectRoot: root })

    expect(analysis.diagnostics).toHaveLength(5)
    expect(analysis.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROJECT_API_IMPORT_ESCAPE",
          message: expect.stringContaining('"file:///tmp/absolute.js"'),
        }),
        expect.objectContaining({
          code: "PROJECT_API_IMPORT_ESCAPE",
          message: expect.stringContaining('"../../../../../secret.js"'),
        }),
        expect.objectContaining({
          code: "PROJECT_API_IMPORT_ESCAPE",
          message: expect.stringContaining('"../../../../../shared.js"'),
        }),
        expect.objectContaining({
          code: "PROJECT_API_IMPORT_ESCAPE",
          message: expect.stringContaining('"../../../../../outside.js"'),
        }),
        expect.objectContaining({
          code: "PROJECT_API_UNSUPPORTED_EXPORT",
          exportName: "value",
        }),
      ]),
    )
  })
})

async function projectFixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(process.cwd(), ".project-api-test-"))
  fixtureRoots.push(root)
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = path.join(root, ...relativePath.split("/"))
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, contents)
    }),
  )
  return root
}
