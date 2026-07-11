// agent-quality: file-size exception -- owner: operator; artifact fixtures, canonical-hash checks, and resource-contract validation stay co-located around the deployment graph reader.
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

import {
  assertOperatorDeploymentGraphResourceEnv,
  loadOperatorDeploymentGraphArtifacts,
  validateOperatorDeploymentGraphResourceEnv,
} from "./deployment-graph-artifacts"

const OTHER_HASH = `sha256:${"b".repeat(64)}`

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("loadOperatorDeploymentGraphArtifacts", () => {
  it("loads the generated operator graph artifacts", () => {
    const summary = loadOperatorDeploymentGraphArtifacts()
    const graph = JSON.parse(
      readFileSync(join(process.cwd(), ".voyant", "deployment-graph.generated.json"), "utf8"),
    ) as {
      modules: Array<{
        id: string
        subscribers: Array<{
          id: string
          eventType: string
          runtime?: { entry: string; export?: string }
        }>
      }>
      extensions: Array<{
        id: string
        api: Array<{ runtime?: { entry: string; export?: string } }>
        subscribers: Array<{
          id: string
          eventType: string
          runtime?: { entry: string; export?: string }
        }>
      }>
    }

    expect(summary.graphHash).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(summary.moduleIds).toContain("@voyant-travel/bookings")
    expect(summary.packageNames).toContain("@voyant-travel/framework")
    expect(summary.migrationSources.map((source) => source.packageName)).toEqual(
      expect.arrayContaining(["@voyant-travel/db", "@voyant-travel/bookings"]),
    )
    expect(summary.migrationSources.map((source) => source.schema)).toContain(
      "@voyant-travel/db/schema",
    )
    expect(summary.providers).toMatchObject({
      database: "postgres",
      storage: "memory",
      cache: "postgres",
      rateLimit: "memory",
    })
    expect(summary.resourceRequirements.map((resource) => resource.resourceKey)).toContain(
      "database:postgres",
    )
    expect(summary.scheduledJobs.map((job) => job.id)).toContain("external-cruise-catalog-refresh")
    expect(summary.scheduledJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "@voyant-travel/bookings#schedule.bookings.expire-stale-holds.every-5-minutes",
          cron: "*/5 * * * *",
          workflowId: "bookings.expire-stale-holds",
        }),
        expect.objectContaining({
          id: "@voyant-travel/notifications#schedule.notifications.send-due-reminders.hourly",
          cron: "0 * * * *",
          workflowId: "notifications.send-due-reminders",
        }),
      ]),
    )
    const channelPush = graph.extensions.find(
      (extension) => extension.id === "@voyant-travel/distribution#channel-push-extension",
    )
    expect(channelPush?.api).toEqual([
      expect.objectContaining({
        runtime: {
          entry: "@voyant-travel/distribution",
          export: "createChannelPushExtension",
        },
      }),
    ])
    expect(channelPush?.subscribers).toEqual([
      expect.objectContaining({
        eventType: "availability.slot.changed",
        runtime: {
          entry: "./channel-push-subscribers",
          export: "channelPushAvailabilityChangedSubscriber",
        },
      }),
      expect.objectContaining({
        eventType: "booking.confirmed",
        runtime: {
          entry: "./channel-push-subscribers",
          export: "channelPushBookingConfirmedSubscriber",
        },
      }),
      expect.objectContaining({
        eventType: "product.content.changed",
        runtime: {
          entry: "./channel-push-subscribers",
          export: "channelPushContentChangedSubscriber",
        },
      }),
    ])
    const bookingSchedule = graph.extensions.find(
      (extension) => extension.id === "@voyant-travel/finance#booking-schedule-extension",
    )
    expect(bookingSchedule?.subscribers).toEqual([
      expect.objectContaining({
        id: "@voyant-travel/finance#subscriber.booking-schedule-confirmed",
        eventType: "booking.confirmed",
        runtime: {
          entry: "./booking-schedule-subscriber",
          export: "bookingScheduleConfirmedSubscriber",
        },
      }),
    ])
    const storefront = graph.modules.find((module) => module.id === "@voyant-travel/storefront")
    expect(storefront?.subscribers).toEqual([
      expect.objectContaining({
        id: "@voyant-travel/storefront#subscriber.booking-bootstrap",
        eventType: "storefront.booking.bootstrap.requested",
        runtime: {
          entry: "./booking-bootstrap-subscriber",
          export: "storefrontBookingBootstrapSubscriber",
        },
      }),
    ])

    const trips = graph.modules.find((module) => module.id === "@voyant-travel/trips")
    expect(trips?.subscribers).toEqual([
      expect.objectContaining({
        id: "@voyant-travel/trips#subscriber.payment-completed",
        eventType: "payment.completed",
        runtime: {
          entry: "./payment-subscribers",
          export: "tripsPaymentCompletedSubscriber",
        },
      }),
    ])

    const notifications = graph.extensions.find(
      (extension) => extension.id === "@voyant-travel/notifications#reminder-subscribers-extension",
    )
    expect(notifications?.subscribers).toEqual([
      expect.objectContaining({
        id: "@voyant-travel/notifications#subscriber.booking-confirmation-auto-dispatch",
        eventType: "booking.confirmed",
      }),
      expect.objectContaining({
        id: "@voyant-travel/notifications#subscriber.reminder-booking-cancelled",
        eventType: "booking.cancelled",
      }),
      expect.objectContaining({
        id: "@voyant-travel/notifications#subscriber.reminder-booking-confirmed",
        eventType: "booking.confirmed",
      }),
      expect.objectContaining({
        id: "@voyant-travel/notifications#subscriber.reminder-booking-expired",
        eventType: "booking.expired",
      }),
      expect.objectContaining({
        id: "@voyant-travel/notifications#subscriber.reminder-payment-completed",
        eventType: "payment.completed",
      }),
    ])

    for (const artifactPath of [
      "admin/project-admin.generated.ts",
      "admin/selected-graph-admin.generated.ts",
      "runtime/project-api.generated.ts",
      "runtime/project-jobs.generated.ts",
      "runtime/project-links.generated.ts",
      "runtime/project-subscribers.generated.ts",
      "runtime/project-workflows.generated.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), ".voyant", artifactPath), "utf8")).not.toBe("")
    }
    const selectedGraphAdmin = readFileSync(
      join(process.cwd(), ".voyant", "admin/selected-graph-admin.generated.ts"),
      "utf8",
    )
    expect(selectedGraphAdmin).toMatch(/"@voyant-travel\/action-ledger": selectedAdminFactory\d+/)
    expect(selectedGraphAdmin).not.toContain("createBookingsAdminExtension")
    const projectLinks = readFileSync(
      join(process.cwd(), ".voyant", "runtime/project-links.generated.ts"),
      "utf8",
    )
    expect(projectLinks).toContain('import link0 from "../../src/links/bid-supplier.js"')
    expect(projectLinks).toContain('import link19 from "../../src/links/session-function-space.js"')
  })

  it("fails when the artifact graph hash does not match the graph content hash", () => {
    const root = fixtureRoot()
    writeFixture(root, { manifestGraphHash: OTHER_HASH })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/does not match graph contentHash/)
  })

  it("fails when the graph content hash does not match the canonical graph body", () => {
    const root = fixtureRoot()
    writeFixture(root)
    const graphPath = join(root, ".voyant", "deployment-graph.generated.json")
    const graph = JSON.parse(readFileSync(graphPath, "utf8")) as FixtureDeploymentGraph
    graph.modules.push({ id: "@voyant-travel/catalog" })
    writeJson(graphPath, graph)

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/does not match canonical graph hash/)
  })

  it("fails when generated graph hashes are not sha256 content hashes", () => {
    const root = fixtureRoot()
    writeFixture(root, { graphHash: "not-a-content-hash" })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/must match sha256:<64 lowercase hex chars>/)
  })

  it("fails when the graph reports diagnostics", () => {
    const root = fixtureRoot()
    writeFixture(root, {
      diagnostics: [
        {
          code: "VOYANT_GRAPH_MISSING_CAPABILITY",
          message: "Required capability acme.crm.people is not provided.",
        },
      ],
    })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/VOYANT_GRAPH_MISSING_CAPABILITY/)
  })

  it("fails when the graph omits resource requirements", () => {
    const root = fixtureRoot()
    writeFixture(root, { omitRequirements: true })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/deployment graph requirements must be an object/)
  })

  it("reports missing required resource environment before boot", () => {
    const root = fixtureRoot()
    writeFixture(root)
    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(validateOperatorDeploymentGraphResourceEnv(summary, {})).toEqual([
      "secret DATABASE_URL is required for database:postgres",
    ])
    expect(validateOperatorDeploymentGraphResourceEnv(summary, { DATABASE_URL: "   " })).toEqual([
      "secret DATABASE_URL is required for database:postgres",
    ])
    expect(
      validateOperatorDeploymentGraphResourceEnv(summary, {
        DATABASE_URL_DIRECT: "postgres://user:pass@example.test:5432/voyant",
      }),
    ).toEqual([])
    expect(
      validateOperatorDeploymentGraphResourceEnv(summary, { DATABASE_URL: "not-a-postgres-url" }),
    ).toEqual(["secret DATABASE_URL must be a Postgres URL for database:postgres"])
    expect(() => assertOperatorDeploymentGraphResourceEnv(summary, {})).toThrow(
      /Operator deployment graph resource requirements are not satisfied:\n- secret DATABASE_URL is required for database:postgres/,
    )
  })

  it("validates Redis and HTTP resource configuration formats before boot", () => {
    const summary = {
      resourceRequirements: [
        {
          resourceKey: "redis",
          roles: ["cache"],
          provider: "redis",
          required: true,
          env: [
            {
              name: "REDIS_URL",
              format: "redis-url" as const,
              kind: "secret",
              required: true,
              description: "Redis URL.",
            },
          ],
        },
        {
          resourceKey: "object-storage",
          roles: ["storage"],
          provider: "s3",
          required: true,
          env: [
            {
              name: "R2_S3_ENDPOINT",
              format: "http-url" as const,
              kind: "variable",
              required: true,
              description: "S3 endpoint.",
            },
          ],
        },
      ],
    }

    expect(
      validateOperatorDeploymentGraphResourceEnv(summary, {
        REDIS_URL: "https://redis.example.test",
        R2_S3_ENDPOINT: "redis://r2.example.test",
      }),
    ).toEqual([
      "secret REDIS_URL must be a Redis URL for redis",
      "variable R2_S3_ENDPOINT must be an HTTP(S) URL for object-storage",
    ])
  })

  it("loads graph-derived scheduled jobs for provisioning", () => {
    const root = fixtureRoot()
    writeFixture(root)
    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(summary.scheduledJobs).toEqual([
      {
        id: "outbox-drain",
        cron: "*/2 * * * *",
        description: "Redelivers failed/interrupted event-outbox deliveries (every 2 min).",
        route: "/__voyant/scheduled",
        module: "framework",
      },
    ])
  })

  it("loads graph-derived workflow schedule metadata for dispatch", () => {
    const root = fixtureRoot()
    writeFixture(root, {
      provisioning: {
        scheduledJobs: [
          {
            id: "@voyant-travel/operator#schedule.notifications.send-due-reminders.hourly",
            cron: "0 * * * *",
            description: "Triggers due reminders.",
            route: "/__voyant/scheduled",
            module: "operator",
            workflowId: "notifications.send-due-reminders",
            input: { now: "2026-07-10T05:30:00.000Z" },
          },
        ],
      },
    })
    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(summary.scheduledJobs).toEqual([
      {
        id: "@voyant-travel/operator#schedule.notifications.send-due-reminders.hourly",
        cron: "0 * * * *",
        description: "Triggers due reminders.",
        route: "/__voyant/scheduled",
        module: "operator",
        workflowId: "notifications.send-due-reminders",
        input: { now: "2026-07-10T05:30:00.000Z" },
      },
    ])
  })

  it("loads graph-derived deployment providers for runtime binding selection", () => {
    const root = fixtureRoot()
    writeFixture(root, {
      deployment: {
        target: "node",
        mode: "self-hosted",
        providers: {
          database: "postgres",
          storage: "s3",
          cache: "redis",
          sharedState: "redis",
          rateLimit: "postgres",
          search: "none",
          email: "none",
          sms: "none",
          auth: "better-auth",
          scheduledJobs: "cloud-scheduler",
          workflows: "none",
        },
      },
    })
    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(summary.providers).toEqual({
      database: "postgres",
      storage: "s3",
      cache: "redis",
      sharedState: "redis",
      rateLimit: "postgres",
      search: "none",
      email: "none",
      sms: "none",
      auth: "better-auth",
      scheduledJobs: "cloud-scheduler",
      workflows: "none",
    })
  })

  it("fails when graph-derived deployment providers are missing", () => {
    const root = fixtureRoot()
    writeFixture(root, { deployment: { target: "node", mode: "self-hosted" } })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/deployment graph deployment\.providers must be an object/)
  })

  it("fails when graph-derived scheduler provisioning metadata is missing", () => {
    const root = fixtureRoot()
    writeFixture(root, { omitProvisioning: true })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/deployment graph provisioning is missing/)
  })

  it("fails when graph-derived scheduled jobs are malformed", () => {
    const root = fixtureRoot()
    writeFixture(root, {
      provisioning: {
        scheduledJobs: [
          {
            id: "outbox-drain",
            cron: "*/2 * * * *",
            description: "Redelivers failed/interrupted event-outbox deliveries (every 2 min).",
            module: "framework",
          },
        ],
      },
    })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/deployment graph provisioning\.scheduledJobs\[0\]\.route/)
  })

  it("fails when artifact migration sources are not graph package records", () => {
    const root = fixtureRoot()
    writeFixture(root, {
      migrationSources: [
        {
          packageName: "@voyant-travel/missing",
          schema: "../../packages/missing/src/schema.ts",
        },
      ],
    })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/is not present in deployment graph packageRecords/)
  })

  it("accepts satisfied required resource environment before boot", () => {
    const root = fixtureRoot()
    writeFixture(root)
    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(
      validateOperatorDeploymentGraphResourceEnv(summary, {
        DATABASE_URL: "postgres://user:pass@example.test:5432/voyant",
      }),
    ).toEqual([])
    expect(() =>
      assertOperatorDeploymentGraphResourceEnv(summary, {
        DATABASE_URL: "postgres://user:pass@example.test:5432/voyant",
      }),
    ).not.toThrow()
  })

  it("resolves source-style artifact paths beside src", () => {
    const root = fixtureRoot()
    const graphHash = writeFixture(root)

    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "src", "server.ts")).href,
    )

    expect(summary.graphHash).toBe(graphHash)
    expect(summary.moduleIds).toEqual(["@voyant-travel/bookings"])
  })

  it("resolves dist-style artifact paths beside dist/server", () => {
    const root = fixtureRoot()
    const graphHash = writeFixture(join(root, "dist"), { writeRuntimeEntrySource: false })
    mkdirSync(join(root, "dist", "server"), { recursive: true })

    const summary = loadOperatorDeploymentGraphArtifacts(
      pathToFileURL(join(root, "dist", "server", "server.js")).href,
    )

    expect(summary.graphHash).toBe(graphHash)
    expect(summary.pluginIds).toEqual(["@voyant-travel/plugin-smartbill"])
  })

  it("requires the managed node runtime entry metadata", () => {
    const root = fixtureRoot()
    writeFixture(root, { runtimeEntry: { kind: "custom-node" } })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/kind must be managed-profile-node/)
  })

  it("fails when generated runtime entry constants drift from the graph", () => {
    const root = fixtureRoot()
    writeFixture(root, { runtimeEntrySource: { graphHash: OTHER_HASH } })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/GENERATED_DEPLOYMENT_GRAPH_HASH/)
  })

  it("fails when the generated graph runtime module drifts from the graph", () => {
    const root = fixtureRoot()
    writeFixture(root, { graphRuntimeSource: { graphHash: OTHER_HASH } })

    expect(() =>
      loadOperatorDeploymentGraphArtifacts(pathToFileURL(join(root, "src", "server.ts")).href),
    ).toThrow(/GENERATED_GRAPH_RUNTIME_HASH/)
  })
})

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "voyant-operator-graph-artifacts-"))
  roots.push(root)
  return root
}

function writeFixture(
  root: string,
  options: {
    manifestGraphHash?: string
    graphHash?: string
    diagnostics?: Array<{ code: string; message: string }>
    deployment?: FixtureDeploymentGraph["deployment"]
    requirements?: FixtureDeploymentGraph["requirements"]
    provisioning?: FixtureDeploymentGraph["provisioning"]
    omitRequirements?: boolean
    omitProvisioning?: boolean
    runtimeEntry?: Record<string, unknown>
    runtimeEntrySource?: { graphHash?: string }
    graphRuntimeSource?: { graphHash?: string }
    writeRuntimeEntrySource?: boolean
    migrationSources?: Array<{ packageName: string; schema: string }>
  } = {},
): string {
  mkdirSync(join(root, "src"), { recursive: true })
  mkdirSync(join(root, ".voyant"), { recursive: true })
  writeFileSync(join(root, ".voyant", "managed-profile.json"), "{}\n")
  const graphWithoutHash: Omit<FixtureDeploymentGraph, "contentHash"> = {
    schemaVersion: "voyant.resolved-graph.v1",
    diagnostics: options.diagnostics ?? [],
    deployment: options.deployment ?? {
      target: "node",
      mode: "self-hosted",
      providers: {
        database: "postgres",
        storage: "memory",
        cache: "memory",
        sharedState: "memory",
        rateLimit: "memory",
        search: "none",
        email: "none",
        sms: "none",
        auth: "better-auth",
        scheduledJobs: "none",
        workflows: "none",
      },
    },
    ...(!options.omitRequirements && options.requirements !== undefined
      ? { requirements: options.requirements }
      : !options.omitRequirements
        ? {
            requirements: {
              resources: [
                {
                  resourceKey: "database:postgres",
                  roles: ["database"],
                  provider: "postgres",
                  required: true,
                  env: [
                    {
                      name: "DATABASE_URL",
                      aliases: ["DATABASE_URL_DIRECT"],
                      format: "postgres-url",
                      kind: "secret",
                      required: true,
                      description: "Primary Postgres connection URL.",
                    },
                  ],
                },
              ],
            },
          }
        : {}),
    modules: [{ id: "@voyant-travel/bookings" }],
    extensions: [{ id: "@voyant-travel/bookings#booking-supplier-extension" }],
    plugins: [{ id: "@voyant-travel/plugin-smartbill" }],
    packageRecords: [{ packageName: "@voyant-travel/framework" }],
    ...(!options.omitProvisioning
      ? {
          provisioning: options.provisioning ?? {
            scheduledJobs: [
              {
                id: "outbox-drain",
                cron: "*/2 * * * *",
                description: "Redelivers failed/interrupted event-outbox deliveries (every 2 min).",
                route: "/__voyant/scheduled",
                module: "framework",
              },
            ],
          },
        }
      : {}),
  }
  const graphHash = options.graphHash ?? computeGraphContentHash(graphWithoutHash)
  const graph: FixtureDeploymentGraph = { ...graphWithoutHash, contentHash: graphHash }
  writeJson(join(root, ".voyant", "deployment-artifacts.generated.json"), {
    schemaVersion: "voyant.deployment-artifacts.v1",
    graphHash: options.manifestGraphHash ?? graphHash,
    graph: "./deployment-graph.generated.json",
    runtimeEntries: [
      {
        ...{
          id: "@voyant-travel/framework#runtime.node",
          target: "node",
          file: "./runtime-entry.generated.ts",
          graphHash,
          kind: "managed-profile-node",
          profileSnapshot: "./managed-profile.json",
        },
        ...options.runtimeEntry,
      },
    ],
    migrationSources: options.migrationSources ?? [
      {
        packageName: "@voyant-travel/framework",
        schema: "../../packages/framework/src/schema.ts",
      },
    ],
  })
  writeJson(join(root, ".voyant", "deployment-graph.generated.json"), graph)
  if (options.writeRuntimeEntrySource !== false) {
    writeGeneratedRuntimeEntrySource(root, graph, {
      graphHash: options.runtimeEntrySource?.graphHash ?? graphHash,
    })
    writeGeneratedGraphRuntimeSource(root, graph, {
      graphHash: options.graphRuntimeSource?.graphHash ?? graphHash,
    })
  }
  return graphHash
}

function writeGeneratedGraphRuntimeSource(
  root: string,
  graph: FixtureDeploymentGraph,
  options: { graphHash: string },
): void {
  mkdirSync(join(root, ".voyant", "runtime"), { recursive: true })
  writeFileSync(
    join(root, ".voyant", "runtime", "graph-runtime.generated.ts"),
    [
      `export const GENERATED_GRAPH_RUNTIME_HASH = ${JSON.stringify(options.graphHash)} as const`,
      `export const GENERATED_GRAPH_RUNTIME_MODULE_IDS = ${stringArrayLiteral(
        graph.modules.map((module) => module.id),
      )} as const`,
      `export const GENERATED_GRAPH_RUNTIME_EXTENSION_IDS = ${stringArrayLiteral(
        graph.extensions.map((extension) => extension.id),
      )} as const`,
      `export const GENERATED_GRAPH_RUNTIME_PLUGIN_IDS = ${stringArrayLiteral(
        graph.plugins.map((plugin) => plugin.id),
      )} as const`,
      "",
    ].join("\n"),
  )
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

interface FixtureDeploymentGraph {
  schemaVersion: string
  contentHash: string
  diagnostics: Array<{ code: string; message: string }>
  deployment: {
    target: string
    mode: string
    providers?: Record<string, string>
  }
  requirements?: {
    resources: Array<{
      resourceKey: string
      roles: string[]
      provider: string
      required: boolean
      env: Array<{
        name: string
        aliases?: string[]
        format?: "postgres-url" | "redis-url" | "http-url"
        kind: string
        required: boolean
        description: string
      }>
    }>
  }
  modules: Array<{ id: string }>
  extensions: Array<{ id: string }>
  plugins: Array<{ id: string }>
  packageRecords: Array<{ packageName: string }>
  provisioning?: {
    scheduledJobs: Array<{
      id: string
      cron: string
      description: string
      route?: string
      module: string
      workflowId?: string
      input?: unknown
    }>
  }
}

function writeGeneratedRuntimeEntrySource(
  root: string,
  graph: FixtureDeploymentGraph,
  options: { graphHash: string },
): void {
  writeFileSync(
    join(root, ".voyant", "runtime-entry.generated.ts"),
    [
      `export const GENERATED_DEPLOYMENT_GRAPH_SCHEMA_VERSION = ${JSON.stringify(
        graph.schemaVersion,
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_HASH = ${JSON.stringify(options.graphHash)} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_TARGET = ${JSON.stringify(
        graph.deployment.target,
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_MODE = ${JSON.stringify(
        graph.deployment.mode,
      )} as const`,
      'export const GENERATED_DEPLOYMENT_GRAPH_ARTIFACT_PATH = "./deployment-graph.generated.json" as const',
      'export const GENERATED_MANAGED_PROFILE_SNAPSHOT_PATH = "./managed-profile.json" as const',
      `export const GENERATED_DEPLOYMENT_GRAPH_MODULE_IDS = ${stringArrayLiteral(
        graph.modules.map((module) => module.id),
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_EXTENSION_IDS = ${stringArrayLiteral(
        graph.extensions.map((extension) => extension.id),
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_PLUGIN_IDS = ${stringArrayLiteral(
        graph.plugins.map((plugin) => plugin.id),
      )} as const`,
      `export const GENERATED_DEPLOYMENT_GRAPH_PACKAGE_NAMES = ${stringArrayLiteral(
        graph.packageRecords.map((record) => record.packageName),
      )} as const`,
      "",
    ].join("\n"),
  )
}

function stringArrayLiteral(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`
}

function computeGraphContentHash(graphWithoutHash: Omit<FixtureDeploymentGraph, "contentHash">) {
  return `sha256:${createHash("sha256").update(canonicalJson(graphWithoutHash)).digest("hex")}`
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(canonicalize)

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key])
  }
  return sorted
}
