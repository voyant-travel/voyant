import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { discoverProjectConventions } from "./project-conventions.js"

const fixtureRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  )
})

describe("discoverProjectConventions", () => {
  it("discovers an index-only local module and ignores voyant-only or nested modules", async () => {
    const root = await projectFixture([
      "src/api/admin/orders/route.tsx",
      "src/api/admin/orders/routes.ts",
      "src/modules/accepted/index.ts",
      "src/modules/group/loyalty/index.ts",
      "src/modules/package-style/voyant.ts",
    ])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toEqual([
      {
        id: "project.module.accepted",
        kind: "module",
        sourcePath: "src/modules/accepted/index.ts",
      },
    ])
  })

  it("discovers an index-only local extension for generated runtime composition", async () => {
    const root = await projectFixture([
      "src/extensions/booking-notes/index.ts",
      "src/extensions/group/nested/index.ts",
      "src/extensions/package-style/voyant.ts",
    ])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toEqual([
      {
        id: "project.extension.booking-notes",
        kind: "extension",
        sourcePath: "src/extensions/booking-notes/index.ts",
      },
    ])
  })

  it("ignores declaration and test files in subscriber and link directories", async () => {
    const root = await projectFixture([
      "src/subscribers/accepted.ts",
      "src/subscribers/ignored.d.ts",
      "src/subscribers/ignored.test.ts",
      "src/subscribers/ignored.spec.ts",
      "src/links/accepted.ts",
      "src/links/ignored.d.ts",
      "src/links/ignored.test.ts",
      "src/links/ignored.spec.ts",
    ])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toEqual([
      {
        id: "project.link.accepted",
        kind: "link",
        sourcePath: "src/links/accepted.ts",
      },
      {
        id: "project.subscriber.accepted",
        kind: "subscriber",
        sourcePath: "src/subscribers/accepted.ts",
      },
    ])
  })

  it("reports same-surface dynamic and route-group collisions", async () => {
    const root = await projectFixture([
      "src/api/admin/orders/[id]/route.ts",
      "src/api/admin/orders/[orderId]/route.ts",
      "src/api/admin/(internal)/orders/[slug]/route.ts",
      "src/api/public/orders/[id]/route.ts",
    ])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toHaveLength(4)
    expect(result.diagnostics).toEqual([
      {
        code: "PROJECT_CONVENTION_ROUTE_COLLISION",
        message:
          'Convention routes on the admin surface collide at "/orders/:param": "src/api/admin/(internal)/orders/[slug]/route.ts", "src/api/admin/orders/[id]/route.ts", "src/api/admin/orders/[orderId]/route.ts".',
        route: "/orders/:param",
        severity: "error",
        sourcePaths: [
          "src/api/admin/(internal)/orders/[slug]/route.ts",
          "src/api/admin/orders/[id]/route.ts",
          "src/api/admin/orders/[orderId]/route.ts",
        ],
        surface: "admin",
      },
    ])
  })

  it("discovers only one-level index entries and ignores supporting files", async () => {
    const root = await projectFixture([
      "src/admin/accepted/index.tsx",
      "src/admin/accepted/page.tsx",
      "src/admin/accepted/styles.css",
      "src/admin/file.ts",
      "src/admin/nested/group/index.ts",
      "src/admin/no-index/page.tsx",
    ])

    await expect(discoverProjectConventions(root)).resolves.toEqual({
      contributions: [
        {
          id: "project.admin.accepted",
          kind: "admin",
          sourcePath: "src/admin/accepted/index.tsx",
        },
      ],
      diagnostics: [],
    })
  })

  it("reports both admin index variants as an ID collision", async () => {
    const root = await projectFixture(["src/admin/orders/index.ts", "src/admin/orders/index.tsx"])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toHaveLength(2)
    expect(result.diagnostics).toEqual([
      {
        code: "PROJECT_CONVENTION_ID_COLLISION",
        id: "project.admin.orders",
        message:
          'Convention ID "project.admin.orders" is produced by "src/admin/orders/index.ts", "src/admin/orders/index.tsx".',
        severity: "error",
        sourcePaths: ["src/admin/orders/index.ts", "src/admin/orders/index.tsx"],
      },
    ])
  })

  it("normalizes optional catch-all routes", async () => {
    const root = await projectFixture(["src/api/public/docs/[[...parts]]/route.ts"])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toEqual([
      {
        id: "project.api.public.docs.all-parts-optional",
        kind: "api-route",
        route: "/docs/*parts?",
        sourcePath: "src/api/public/docs/[[...parts]]/route.ts",
        surface: "public",
      },
    ])
  })

  it("returns an empty discovery for a project without convention directories", async () => {
    const root = await projectFixture(["src/index.ts", "package.json"])

    await expect(discoverProjectConventions(root)).resolves.toEqual({
      contributions: [],
      diagnostics: [],
    })
  })
})

async function projectFixture(files: readonly string[]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-project-conventions-"))
  fixtureRoots.push(root)
  await Promise.all(files.map((file) => writeFixtureFile(root, file)))
  return root
}

async function writeFixtureFile(root: string, relativePath: string): Promise<void> {
  const filePath = path.join(root, ...relativePath.split("/"))
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, "export {}\n")
}
