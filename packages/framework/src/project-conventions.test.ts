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
  it("discovers every supported source convention with normalized metadata", async () => {
    const root = await projectFixture([
      "src/api/admin/route.ts",
      "src/api/admin/orders/[orderId]/route.ts",
      "src/api/store/catalog/(sales)/[...slug]/route.ts",
      "src/workflows/booking/confirm.ts",
      "src/jobs/reconcile.ts",
      "src/subscribers/booking/created.ts",
      "src/links/booking-person.ts",
      "src/admin/dashboard/index.tsx",
      "src/admin/dashboard/page.tsx",
      "src/admin/dashboard/styles.css",
      "src/modules/loyalty/index.ts",
    ])

    await expect(discoverProjectConventions({ projectRoot: root })).resolves.toEqual({
      contributions: [
        {
          id: "project.admin.dashboard",
          kind: "admin",
          sourcePath: "src/admin/dashboard/index.tsx",
        },
        {
          id: "project.api.admin.orders.by-orderid",
          kind: "api-route",
          route: "/orders/:orderId",
          sourcePath: "src/api/admin/orders/[orderId]/route.ts",
          surface: "admin",
        },
        {
          id: "project.api.admin.root",
          kind: "api-route",
          route: "/",
          sourcePath: "src/api/admin/route.ts",
          surface: "admin",
        },
        {
          id: "project.api.public.catalog.all-slug",
          kind: "api-route",
          route: "/catalog/*slug",
          sourcePath: "src/api/store/catalog/(sales)/[...slug]/route.ts",
          surface: "public",
        },
        {
          id: "project.job.reconcile",
          kind: "job",
          sourcePath: "src/jobs/reconcile.ts",
        },
        {
          id: "project.link.booking-person",
          kind: "link",
          sourcePath: "src/links/booking-person.ts",
        },
        {
          id: "project.module.loyalty",
          kind: "module",
          sourcePath: "src/modules/loyalty/index.ts",
        },
        {
          id: "project.subscriber.booking.created",
          kind: "subscriber",
          sourcePath: "src/subscribers/booking/created.ts",
        },
        {
          id: "project.workflow.booking.confirm",
          kind: "workflow",
          sourcePath: "src/workflows/booking/confirm.ts",
        },
      ],
      diagnostics: [],
    })
  })

  it("returns deterministic project-relative paths and ordering", async () => {
    const root = await projectFixture([
      "src/workflows/z-last.ts",
      "src/workflows/a-first.ts",
      "src/admin/z/index.tsx",
      "src/admin/a/index.ts",
      "src/jobs/middle.ts",
    ])

    const fromString = await discoverProjectConventions(`${root}${path.sep}`)
    const fromOptions = await discoverProjectConventions({ projectRoot: path.join(root, ".") })

    expect(fromString).toEqual(fromOptions)
    expect(fromString.contributions.map((contribution) => contribution.sourcePath)).toEqual([
      "src/admin/a/index.ts",
      "src/admin/z/index.tsx",
      "src/jobs/middle.ts",
      "src/workflows/a-first.ts",
      "src/workflows/z-last.ts",
    ])
    expect(
      fromString.contributions.every((contribution) => !contribution.sourcePath.includes("\\")),
    ).toBe(true)
  })

  it("ignores generated, vendor, hidden, and build output directories", async () => {
    const ignoredDirectories = [
      ".cache",
      ".generated",
      ".voyant",
      "__generated__",
      "build",
      "coverage",
      "dist",
      "generated",
      "node_modules",
      "vendor",
    ]
    const root = await projectFixture([
      "src/workflows/kept.ts",
      "src/modules/kept/index.ts",
      ...ignoredDirectories.flatMap((directory) => [
        `src/workflows/${directory}/ignored.ts`,
        `src/admin/${directory}/ignored/index.tsx`,
        `src/api/admin/${directory}/route.ts`,
        `src/modules/${directory}/index.ts`,
      ]),
    ])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toEqual([
      {
        id: "project.module.kept",
        kind: "module",
        sourcePath: "src/modules/kept/index.ts",
      },
      {
        id: "project.workflow.kept",
        kind: "workflow",
        sourcePath: "src/workflows/kept.ts",
      },
    ])
    expect(result.diagnostics).toEqual([])
  })

  it("discovers an index-only local module and ignores voyant-only or nested modules", async () => {
    const root = await projectFixture([
      "src/api/admin/orders/route.tsx",
      "src/api/admin/orders/routes.ts",
      "src/workflows/run.js",
      "src/workflows/types.d.ts",
      "src/jobs/run.tsx",
      "src/jobs/types.d.ts",
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
      "src/api/store/orders/[id]/route.ts",
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

  it("reports stable ID collisions without discarding either contribution", async () => {
    const root = await projectFixture([
      "src/admin/order-history/index.ts",
      "src/admin/order_history/index.tsx",
      "src/workflows/send-email.ts",
      "src/workflows/send_email.ts",
    ])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toHaveLength(4)
    expect(result.diagnostics).toEqual([
      {
        code: "PROJECT_CONVENTION_ID_COLLISION",
        id: "project.admin.order-history",
        message:
          'Convention ID "project.admin.order-history" is produced by "src/admin/order-history/index.ts", "src/admin/order_history/index.tsx".',
        severity: "error",
        sourcePaths: ["src/admin/order-history/index.ts", "src/admin/order_history/index.tsx"],
      },
      {
        code: "PROJECT_CONVENTION_ID_COLLISION",
        id: "project.workflow.send-email",
        message:
          'Convention ID "project.workflow.send-email" is produced by "src/workflows/send-email.ts", "src/workflows/send_email.ts".',
        severity: "error",
        sourcePaths: ["src/workflows/send-email.ts", "src/workflows/send_email.ts"],
      },
    ])
  })

  it("normalizes optional catch-all routes", async () => {
    const root = await projectFixture(["src/api/store/docs/[[...parts]]/route.ts"])

    const result = await discoverProjectConventions(root)

    expect(result.contributions).toEqual([
      {
        id: "project.api.public.docs.all-parts-optional",
        kind: "api-route",
        route: "/docs/*parts?",
        sourcePath: "src/api/store/docs/[[...parts]]/route.ts",
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
