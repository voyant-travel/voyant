import { describe, expect, it } from "vitest"
import { FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"
import {
  defineVoyantProject,
  getVoyantProjectMigrationMetadata,
  getVoyantProjectRequirements,
  MANAGED_OPERATOR_DEFAULT_PROVIDERS,
  toCreateVoyantAppProfileConfig,
  VOYANT_PROJECT_SCHEMA_VERSION,
  type VoyantProjectManifest,
  validateVoyantProject,
} from "./profile.js"

function validProject(overrides: Partial<VoyantProjectManifest> = {}): VoyantProjectManifest {
  return defineVoyantProject({
    profile: "operator",
    frameworkVersion: "0.12.22",
    modules: ["catalog", "bookings", "finance", "relationships"],
    plugins: ["@voyant-travel/plugin-netopia"],
    settings: { finance: { fiscalRegion: "RO" } },
    ...overrides,
  })
}

describe("managed profile contract", () => {
  it("defines a serializable operator project manifest with stable module ids", () => {
    const project = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.12.22",
      region: "eu",
      modules: ["catalog", "@voyant-travel/bookings", "finance", "relationships"],
      plugins: ["@voyant-travel/plugin-stripe", "@third-party/plugin-regional-accounting"],
      settings: {
        finance: { fiscalRegion: "RO" },
        "@third-party/plugin-regional-accounting": { enabled: true },
      },
      admin: { enabled: true, path: "/app" },
    })

    expect(JSON.parse(JSON.stringify(project))).toEqual(project)
    expect(project.schemaVersion).toBe(VOYANT_PROJECT_SCHEMA_VERSION)
    expect(project.modules).toEqual(["catalog", "bookings", "finance", "relationships"])
    expect(project.plugins).toEqual([
      "@voyant-travel/plugin-stripe",
      "@third-party/plugin-regional-accounting",
    ])
    expect(project.settings).toEqual({
      finance: { fiscalRegion: "RO" },
      "@third-party/plugin-regional-accounting": { enabled: true },
    })
    expect(project.providers).toBeUndefined()
    expect(MANAGED_OPERATOR_DEFAULT_PROVIDERS).not.toHaveProperty("payments")
  })

  it("keeps managed Cloud substrate implicit while still exporting Redis requirements", () => {
    const project = {
      ...validProject(),
      providers: {
        ...MANAGED_OPERATOR_DEFAULT_PROVIDERS,
        cache: "postgres",
        sharedState: "postgres",
        rateLimit: "kv",
      },
    }

    const result = validateVoyantProject(project)

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        path: "providers",
        code: "incompatible_provider",
      }),
    ])
  })

  it("allows non-Redis cache choices for self-hosted profiles", () => {
    const project = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.12.22",
      mode: "self-hosted",
      modules: ["catalog", "bookings", "finance", "relationships"],
      providers: {
        ...MANAGED_OPERATOR_DEFAULT_PROVIDERS,
        cache: "postgres",
        sharedState: "postgres",
        rateLimit: "kv",
        auth: "better-auth",
        workflows: "self-hosted",
      },
    })

    expect(validateVoyantProject(project)).toEqual({ ok: true, issues: [] })
  })

  it("exports resource requirements before app boot", () => {
    const requirements = getVoyantProjectRequirements(validProject())

    const redisResource = requirements.resources.find((resource) => resource.provider === "redis")

    expect(redisResource).toEqual(
      expect.objectContaining({
        resourceKey: "redis",
        roles: ["cache", "sharedState", "rateLimit"],
      }),
    )
    expect(redisResource?.env.map((env) => env.name)).toEqual(["REDIS_URL"])
    expect(requirements.resources).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ roles: ["payments"] })]),
    )
    expect(requirements.plugins).toEqual(["@voyant-travel/plugin-netopia"])
    expect(requirements.settings).toEqual({ finance: { fiscalRegion: "RO" } })
    expect(
      requirements.resources.find((resource) => resource.roles.includes("database"))?.env,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "DATABASE_URL", kind: "secret", required: true }),
        expect.objectContaining({ name: "DATABASE_URL_DIRECT", kind: "secret", required: false }),
      ]),
    )
    expect(requirements.migration.packageName).toBe("@voyant-travel/framework-migrations")
  })

  it("bridges a validated snapshot to createVoyantApp exclude config", () => {
    const bridge = toCreateVoyantAppProfileConfig(validProject())

    expect(bridge.exclude).toContain("@voyant-travel/flights")
    expect(bridge.exclude).toContain("@voyant-travel/storefront")
    expect(bridge.exclude).toContain("@voyant-travel/storefront/customer-portal")
    expect(bridge.exclude).toContain("@voyant-travel/storefront/verification")
    expect(bridge.exclude).toContain("operator/quote-version-snapshot-extension")
    expect(bridge.exclude).toContain("operator/proposal-extension")
    expect(bridge.manifest.modules).not.toContain("@voyant-travel/flights")
    expect(bridge.manifest.modules).not.toContain("@voyant-travel/storefront")
    expect(bridge.manifest.extensions).not.toContain("operator/quote-version-snapshot-extension")
    expect(bridge.manifest.extensions).not.toContain("operator/proposal-extension")
    expect(bridge.manifest.modules).toContain("@voyant-travel/bookings")
    expect(bridge.plugins).toEqual(["@voyant-travel/plugin-netopia"])
    expect(bridge.settings).toEqual({ finance: { fiscalRegion: "RO" } })
    expect(bridge.customSource).toEqual({
      modulesInput: "modules",
      extensionsInput: "extensions",
      supported: true,
    })
  })

  it("turns include lists into an exclusion set while preserving required core modules", () => {
    const project = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.12.22",
      modules: ["bookings", "finance", "relationships"],
    })

    const bridge = toCreateVoyantAppProfileConfig(project)

    expect(bridge.manifest.modules).toEqual(
      expect.arrayContaining([
        "@voyant-travel/action-ledger",
        "@voyant-travel/identity",
        "@voyant-travel/commerce",
        "@voyant-travel/relationships",
        "@voyant-travel/bookings",
        "@voyant-travel/finance",
      ]),
    )
    expect(bridge.exclude).toEqual(
      expect.arrayContaining(
        FRAMEWORK_RUNTIME_MANIFEST.modules.filter(
          (specifier) =>
            ![
              "@voyant-travel/action-ledger",
              "@voyant-travel/identity",
              "@voyant-travel/commerce",
              "@voyant-travel/relationships",
              "@voyant-travel/bookings",
              "@voyant-travel/finance",
            ].includes(specifier),
        ),
      ),
    )
    expect(bridge.manifest.extensions).not.toContain("operator/quote-version-snapshot-extension")
    expect(bridge.manifest.extensions).not.toContain("operator/proposal-extension")
  })

  it("surfaces actionable validation errors for unknown modules", () => {
    const result = validateVoyantProject({
      ...validProject(),
      modules: ["does-not-exist"],
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        path: "modules[0]",
        code: "unknown_module",
      }),
    ])
  })

  it("uses an admin/API operator default when modules are omitted", () => {
    const project = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.12.22",
    })

    const bridge = toCreateVoyantAppProfileConfig(project)

    expect(bridge.manifest.modules).toContain("@voyant-travel/catalog")
    expect(bridge.manifest.modules).not.toContain("@voyant-travel/storefront")
    expect(bridge.manifest.modules).not.toContain("@voyant-travel/storefront/customer-portal")
    expect(bridge.manifest.modules).not.toContain("@voyant-travel/storefront/verification")
  })

  it("rejects website artifacts because customer-facing apps are separate", () => {
    const result = validateVoyantProject({
      ...validProject(),
      websites: [{ id: "main", kind: "storefront" }],
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        path: "websites",
        code: "invalid_value",
      }),
    ])
  })

  it("rejects storefront modules in the managed operator profile", () => {
    const result = validateVoyantProject({
      ...validProject(),
      modules: ["catalog", "storefront"],
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        path: "modules[1]",
        code: "invalid_value",
      }),
    ])
  })

  it("requires JSON-serializable module and plugin settings", () => {
    const result = validateVoyantProject({
      ...validProject(),
      settings: { finance: Number.NaN },
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        path: "settings",
        code: "non_serializable",
      }),
    ])
    expect(() =>
      defineVoyantProject({
        profile: "operator",
        frameworkVersion: "0.12.22",
        settings: { finance: Number.NaN },
      }),
    ).toThrow("JSON-serializable")
  })

  it("exposes profile migration and doctor metadata", () => {
    expect(getVoyantProjectMigrationMetadata(validProject())).toEqual({
      packageName: "@voyant-travel/framework-migrations",
      bundleId: "operator-standard-profile",
      bundleSource: "framework",
      cutlineExport: "loadCutline",
      doctor: {
        command: "voyant db doctor --fail-on-drift",
        parity: expect.arrayContaining(["schema drift"]),
      },
    })
  })
})
