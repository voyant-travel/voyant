import { describe, expect, it } from "vitest"

import { appsUiEn } from "./i18n/en.js"
import { resolveAppsUiMessages } from "./i18n/provider.js"
import { appsUiRo } from "./i18n/ro.js"
import {
  appOAuthAuthorizationRequestSchema,
  installationDetailResponse,
  installationListResponse,
} from "./schemas.js"

describe("apps-react i18n", () => {
  it("keeps en and ro navigation keys in parity", () => {
    expect(Object.keys(appsUiRo.navigation).sort()).toEqual(Object.keys(appsUiEn.navigation).sort())
    expect(Object.keys(appsUiRo.statuses).sort()).toEqual(Object.keys(appsUiEn.statuses).sort())
    expect(Object.keys(appsUiRo.authorization).sort()).toEqual(
      Object.keys(appsUiEn.authorization).sort(),
    )
  })

  it("resolves ro then falls back to en", () => {
    expect(resolveAppsUiMessages({ locale: "ro" }).navigation.title).toBe("Aplicații")
    expect(resolveAppsUiMessages({ locale: "de" }).navigation.title).toBe("Apps")
  })
})

describe("apps-react response schemas", () => {
  const release = {
    id: "rel_1",
    appId: "app_1",
    releaseVersion: "1.0.0",
    manifestSchemaVersion: "voyant.app-manifest.v1",
    manifestDigest: "sha256:abc",
    manifestSnapshot: {},
    normalizedRecord: { requestedScopes: ["apps:read"], optionalScopes: ["finance:read"] },
    apiCompatibility: { min: "1.0.0", max: "2.0.0" },
    defaultLocale: "en",
    supportedLocales: ["en"],
    state: "available",
    createdBy: "operator",
    createdAt: "2026-07-17T00:00:00.000Z",
  }
  const installation = {
    id: "inst_1",
    appId: "app_1",
    deploymentId: "dep_1",
    releaseId: "rel_1",
    status: "active",
    namespace: "app--abc",
    installedBy: "operator",
    credentialGeneration: 0,
    updatePolicy: "compatible",
    pendingReleaseId: null,
    pendingReason: null,
    installedAt: "2026-07-17T00:00:00.000Z",
    activatedAt: "2026-07-17T00:00:00.000Z",
    pausedAt: null,
    uninstalledAt: null,
    purgedAt: null,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  }

  it("parses the browser OAuth request with PKCE, state, and nonce", () => {
    const parsed = appOAuthAuthorizationRequestSchema.parse({
      response_type: "code",
      client_id: "app_1",
      release_id: "rel_1",
      redirect_uri: "https://app.example.com/oauth/callback",
      state: "state_1",
      nonce: "n".repeat(43),
      code_challenge: "challenge_1",
      code_challenge_method: "S256",
    })

    expect(parsed.nonce).toHaveLength(43)
    expect(parsed.optional_scopes).toBe("")
  })

  it("parses the installation summary list envelope, tolerating extra row columns", () => {
    const parsed = installationListResponse.parse({
      data: [
        {
          ...installation,
          degradedAt: null,
          revokedAt: null,
          appDisplayName: "Acme",
          appSlug: "acme",
          distribution: "custom",
          releaseVersion: "1.0.0",
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    })
    expect(parsed.data[0]?.appDisplayName).toBe("Acme")
  })

  it("parses the installation detail with a nested webhook health envelope", () => {
    const parsed = installationDetailResponse.parse({
      data: {
        installation,
        app: {
          id: "app_1",
          platformNamespace: "app--abc",
          distribution: "custom",
          ownerId: "org_1",
          displayName: "Acme",
          slug: "acme",
          lifecycleState: "active",
          createdBy: "operator",
          createdAt: "2026-07-17T00:00:00.000Z",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
        activeRelease: release,
        pendingRelease: null,
        grants: [],
        extensions: [],
        webhooks: { data: [] },
        recentAudit: [],
        availableUpdates: [
          {
            release,
            blocked: true,
            blockedReason: "New required scopes need consent: finance:read",
          },
        ],
      },
    })
    expect(parsed.data.availableUpdates[0]?.blocked).toBe(true)
    expect(parsed.data.webhooks.data).toEqual([])
  })
})
