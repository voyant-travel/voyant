import { describe, expect, it } from "vitest"
import {
  FRAMEWORK_RUNTIME_MANIFEST,
  FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIERS,
} from "./manifest.js"
import {
  defineVoyantProject,
  getVoyantProjectMigrationMetadata,
  getVoyantProjectProviders,
  getVoyantProjectRequirements,
  MANAGED_OPERATOR_DEFAULT_PROVIDERS,
  resolveActiveModuleIds,
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
        rateLimit: "platform",
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
        rateLimit: "postgres",
        auth: "better-auth",
        workflows: "self-hosted",
      },
    })

    expect(validateVoyantProject(project)).toEqual({ ok: true, issues: [] })
  })

  it("normalizes providers for managed-cloud and self-hosted profiles", () => {
    expect(getVoyantProjectProviders(validProject())).toEqual(MANAGED_OPERATOR_DEFAULT_PROVIDERS)

    const selfHostedProviders = {
      ...MANAGED_OPERATOR_DEFAULT_PROVIDERS,
      storage: "memory",
      cache: "postgres",
      sharedState: "postgres",
      rateLimit: "postgres",
      search: "none",
      email: "none",
      sms: "none",
      auth: "better-auth",
      scheduledJobs: "none",
      workflows: "self-hosted",
    } as const
    const selfHostedProject = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.12.22",
      mode: "self-hosted",
      modules: ["catalog", "bookings", "finance", "relationships"],
      providers: selfHostedProviders,
    })

    expect(getVoyantProjectProviders(selfHostedProject)).toEqual(selfHostedProviders)
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
        expect.objectContaining({
          name: "DATABASE_URL",
          aliases: ["DATABASE_URL_DIRECT"],
          format: "postgres-url",
          kind: "secret",
          required: true,
        }),
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
    expect(bridge.manifest.modules).toContain("operator/media")
    expect(bridge.manifest.modules).toContain("operator/payment-link")
    expect(bridge.manifest.modules).toContain("operator/contract-document")
    expect(bridge.manifest.modules).toContain("operator/catalog-booking")
    expect(bridge.manifest.modules).toContain("operator/catalog-content")
    expect(bridge.exclude).not.toContain("operator/catalog-booking")
    expect(bridge.exclude).not.toContain("operator/catalog-content")
    expect(bridge.manifest.extensions).toContain("operator/booking-maintenance-extension")
    expect(bridge.manifest.extensions).toContain("operator/action-ledger-health-extension")
    expect(bridge.manifest.extensions).toContain("operator/catalog-offers-extension")
    expect(bridge.manifest.extensions).toContain("operator/catalog-checkout-extension")
    expect(bridge.manifest.extensions).toContain("operator/proposal-extension")
    expect(bridge.manifest.extensions).toContain("operator/quote-version-snapshot-extension")
    expect(bridge.manifest.extensions).toContain("operator/booking-schedule-extension")
    expect(bridge.manifest.extensions).toContain(
      "@voyant-travel/distribution/channel-push-extension",
    )
    expect(bridge.exclude).not.toContain("@voyant-travel/distribution/channel-push-extension")
    expect(bridge.manifest.modules).toContain("@voyant-travel/flights")
    expect(bridge.manifest.modules).toContain("operator/mcp")
    for (const specifier of FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIERS) {
      expect([...bridge.manifest.modules, ...bridge.manifest.extensions]).not.toContain(specifier)
      expect(bridge.exclude).toContain(specifier)
    }
  })

  it("allows explicit managed-cloud flights modules", () => {
    const result = validateVoyantProject({
      ...validProject({ plugins: [] }),
      modules: ["catalog", "flights"],
    })

    expect(result.ok).toBe(true)
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
      moduleSources: [],
      doctor: {
        command: "voyant db doctor --fail-on-drift",
        parity: expect.arrayContaining(["schema drift"]),
      },
    })
  })

  it("enumerates custom schema-owning modules as ordered migration sources (voyant#3069)", () => {
    const project = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.21.0",
      modules: [],
      plugins: [],
      settings: {},
      customSource: { modules: ["@acme/loyalty", "@acme/gift-cards"] },
    })

    expect(getVoyantProjectMigrationMetadata(project).moduleSources).toEqual([
      { packageName: "@acme/loyalty", priority: 1 },
      { packageName: "@acme/gift-cards", priority: 2 },
    ])
  })

  it("rejects a malformed customSource.modules during validation", () => {
    const result = validateVoyantProject({
      ...validProject({ plugins: [] }),
      customSource: { modules: "@acme/loyalty" },
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: "customSource.modules", code: "invalid_type" }),
    )
  })

  it("coerces a malformed customSource.modules to no sources rather than per-character", () => {
    // Simulates a JSON-loaded snapshot that bypassed validation: a string is
    // iterable, so an unguarded derivation would emit one source per character.
    // Typed as `unknown` (a JSON boundary) and narrowed once at the call seam.
    const malformed: unknown = {
      profile: "operator",
      customSource: { modules: "@acme/loyalty" },
    }

    expect(
      getVoyantProjectMigrationMetadata(
        malformed as Pick<VoyantProjectManifest, "profile" | "customSource">,
      ).moduleSources,
    ).toEqual([])
  })
})

describe("resolveActiveModuleIds (admin gating signal, voyant#3063)", () => {
  it("returns the full standard operator module set when no subset is declared", () => {
    const project = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.19.0",
      modules: [],
      plugins: [],
      settings: {},
    })

    const active = resolveActiveModuleIds(project)

    // Standard domain modules the packaged admin can compose are all active.
    expect(active).toEqual(
      expect.arrayContaining([
        "bookings",
        "catalog",
        "finance",
        "relationships",
        "operations",
        "action-ledger",
      ]),
    )
    // Storefront customer-app modules are never part of the operator set, and
    // `mice` has no standard manifest module — so neither is ever active.
    expect(active).not.toContain("storefront")
    expect(active).not.toContain("mice")
  })

  it("honors a declared subset, plus the required foundational modules", () => {
    const project = validProject({ modules: ["catalog", "bookings"] })

    const active = resolveActiveModuleIds(project)

    expect(active).toEqual(expect.arrayContaining(["catalog", "bookings"]))
    // Required foundational modules are always active even when not listed.
    expect(active).toEqual(expect.arrayContaining(["action-ledger", "relationships", "commerce"]))
    // A domain excluded from the subset is not active — so its admin nav hides.
    expect(active).not.toContain("flights")
    expect(active).not.toContain("legal")
  })

  it("includes custom source modules the runtime mounts (voyant#3079)", () => {
    const project = validProject({
      modules: ["catalog", "bookings"],
      customSource: { modules: ["@acme/loyalty", "@acme/gift-cards"] },
    })

    const active = resolveActiveModuleIds(project)

    // Custom schema-owning modules are now mounted, so the admin gating signal
    // must report them alongside the standard subset — otherwise a source-free
    // admin hides a UI whose API routes are live.
    expect(active).toEqual(expect.arrayContaining(["@acme.loyalty", "@acme.gift-cards"]))
    expect(active).toEqual(expect.arrayContaining(["catalog", "bookings"]))
  })
})
