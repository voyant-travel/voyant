import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cloudDriver: { kind: "cloud" },
  createCloudWorkflowDriver: vi.fn(),
  createInMemoryDriver: vi.fn(),
  createPostgresConnection: vi.fn(),
  createStandaloneDriver: vi.fn(),
}))

vi.mock("@voyant-travel/workflows/client", () => ({
  createCloudWorkflowDriver: mocks.createCloudWorkflowDriver,
}))

vi.mock("@voyant-travel/workflows-orchestrator/in-memory", () => ({
  createInMemoryDriver: mocks.createInMemoryDriver,
}))

vi.mock("@voyant-travel/workflows-orchestrator/selfhost", () => ({
  createPostgresConnection: mocks.createPostgresConnection,
  createStandaloneDriver: mocks.createStandaloneDriver,
}))

import {
  createVoyantNodeWorkflowDriver,
  resolveVoyantNodeWorkflowProvider,
  type VoyantNodeRuntimeDeployment,
  type VoyantNodeRuntimeEnv,
} from "./node-runtime.js"

const factory = vi.fn()
const selfHostedDeployment: VoyantNodeRuntimeDeployment = {
  mode: "self-hosted",
  providers: { workflows: "self-hosted" },
}

describe("Node workflow provider authority", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createCloudWorkflowDriver.mockReturnValue(mocks.cloudDriver)
    mocks.createInMemoryDriver.mockReturnValue(factory)
    mocks.createPostgresConnection.mockReturnValue({ db: { kind: "postgres" } })
    mocks.createStandaloneDriver.mockReturnValue(factory)
  })

  it("rejects missing and unsupported providers before boot", () => {
    expect(() => resolveVoyantNodeWorkflowProvider(undefined)).toThrow(
      "Unsupported deployment.providers.workflows",
    )
    expect(() => resolveVoyantNodeWorkflowProvider("memory")).toThrow(
      "Unsupported deployment.providers.workflows",
    )
  })

  it("omits workflow composition when the provider is none", () => {
    expect(
      createVoyantNodeWorkflowDriver({
        deployment: { mode: "self-hosted", providers: { workflows: "none" } },
        env: {
          DATABASE_URL: "postgres://ignored",
          VOYANT_CLOUD_WORKFLOWS_URL: "https://workflows.example.com",
          VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: "token",
        },
        defaultAppSlug: "operator",
      }),
    ).toBeUndefined()
    expect(mocks.createCloudWorkflowDriver).not.toHaveBeenCalled()
    expect(mocks.createInMemoryDriver).not.toHaveBeenCalled()
  })

  it("selects Voyant Cloud only when declared and fails closed without credentials", () => {
    const deployment: VoyantNodeRuntimeDeployment = {
      mode: "managed-cloud",
      providers: { workflows: "voyant-cloud" },
    }
    expect(() =>
      createVoyantNodeWorkflowDriver({
        deployment,
        env: { DATABASE_URL: "postgres://ignored" },
        defaultAppSlug: "operator",
      }),
    ).toThrow("requires VOYANT_CLOUD_WORKFLOWS_URL")

    const selected = createVoyantNodeWorkflowDriver({
      deployment,
      env: {
        DATABASE_URL: "postgres://ignored",
        VOYANT_CLOUD_WORKFLOWS_URL: "https://workflows.example.com",
        VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: "token",
        VOYANT_CLOUD_APP_SLUG: "selected-app",
      },
      defaultAppSlug: "operator",
    })
    expect(selected?.({ services: {} as never, logger: vi.fn() })).toBe(mocks.cloudDriver)
    expect(mocks.createCloudWorkflowDriver).toHaveBeenCalledWith({
      env: expect.objectContaining({
        VOYANT_CLOUD_WORKFLOWS_URL: "https://workflows.example.com",
        VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: "token",
        VOYANT_CLOUD_APP_SLUG: "selected-app",
      }),
    })
  })

  it("uses the in-memory adapter only for local self-hosted development", () => {
    expect(
      createVoyantNodeWorkflowDriver({
        deployment: { mode: "local", providers: { workflows: "self-hosted" } },
        env: { DATABASE_URL: "postgres://ignored" },
        defaultAppSlug: "operator",
        oneShot: true,
      }),
    ).toBe(factory)
    expect(mocks.createInMemoryDriver).toHaveBeenCalledWith({
      defaultEnvironment: "development",
      disableScheduleRunner: true,
    })
    expect(mocks.createPostgresConnection).not.toHaveBeenCalled()
  })

  it("caches the Postgres connection and disables resident loops for one-shot dispatch", () => {
    const env: VoyantNodeRuntimeEnv = { DATABASE_URL: "postgres://workflow-db" }
    createVoyantNodeWorkflowDriver({
      deployment: selfHostedDeployment,
      env,
      defaultAppSlug: "operator",
      oneShot: true,
    })
    createVoyantNodeWorkflowDriver({
      deployment: selfHostedDeployment,
      env,
      defaultAppSlug: "operator",
      oneShot: true,
    })

    expect(mocks.createPostgresConnection).toHaveBeenCalledTimes(1)
    expect(mocks.createPostgresConnection).toHaveBeenCalledWith({
      databaseUrl: "postgres://workflow-db",
    })
    expect(mocks.createStandaloneDriver).toHaveBeenLastCalledWith({
      db: { kind: "postgres" },
      defaultEnvironment: "development",
      disableScheduleRunner: true,
      disableTimeWheel: true,
    })
  })

  it("rejects a self-hosted driver in managed-cloud mode", () => {
    expect(() =>
      createVoyantNodeWorkflowDriver({
        deployment: { mode: "managed-cloud", providers: { workflows: "self-hosted" } },
        env: { DATABASE_URL: "postgres://workflow-db" },
        defaultAppSlug: "operator",
      }),
    ).toThrow('workflows="self-hosted" is not supported in managed-cloud mode')
  })
})
