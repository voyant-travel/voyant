// Seeded fixtures for the apps-react browser harness. Shapes mirror the
// `/v1/admin/apps/*` response envelopes the real hooks validate.

const now = "2026-07-15T09:24:00.000Z"

export const apps = [
  {
    id: "app_smartbill_7f3a",
    platformNamespace: "app--7f3a91c22e",
    distribution: "custom",
    ownerId: "org_voyant",
    displayName: "SmartBill Accounting",
    slug: "smartbill-accounting",
    lifecycleState: "active",
    createdBy: "user_admin",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "app_stripe_2b1c",
    platformNamespace: "app--2b1c44de90",
    distribution: "custom",
    ownerId: "org_voyant",
    displayName: "Stripe Reconciliation",
    slug: "stripe-reconciliation",
    lifecycleState: "active",
    createdBy: "user_admin",
    createdAt: now,
    updatedAt: now,
  },
]

const releaseBase = {
  appId: "app_smartbill_7f3a",
  manifestSchemaVersion: "voyant.app-manifest.v1",
  manifestSnapshot: {},
  apiCompatibility: { min: "1.0.0", max: "2.0.0" },
  defaultLocale: "en",
  supportedLocales: ["en", "ro"],
  state: "available",
  createdBy: "user_admin",
  createdAt: now,
}

export const releases = [
  {
    ...releaseBase,
    id: "rel_smartbill_120",
    releaseVersion: "1.2.0",
    manifestDigest: "sha256:9ac31be7712f0d55",
    normalizedRecord: {
      requestedScopes: ["apps:read", "finance:read"],
      optionalScopes: ["finance:write", "custom-fields:read"],
    },
  },
  {
    ...releaseBase,
    id: "rel_smartbill_110",
    releaseVersion: "1.1.0",
    manifestDigest: "sha256:1188aa03cd77e900",
    normalizedRecord: {
      requestedScopes: ["apps:read", "finance:read"],
      optionalScopes: ["finance:write"],
    },
  },
  {
    ...releaseBase,
    id: "rel_smartbill_200",
    releaseVersion: "2.0.0",
    manifestDigest: "sha256:aa77cc9021ee4413",
    normalizedRecord: {
      requestedScopes: ["apps:read", "finance:read", "finance:write", "audit:read"],
      optionalScopes: [],
    },
  },
]

const installation = {
  id: "inst_smartbill",
  appId: "app_smartbill_7f3a",
  deploymentId: "dep_operator_eu",
  releaseId: "rel_smartbill_110",
  status: "active",
  namespace: "app--7f3a91c22e",
  installedBy: "user_admin",
  credentialGeneration: 2,
  updatePolicy: "compatible",
  pendingReleaseId: null,
  pendingReason: null,
  installedAt: "2026-06-01T08:00:00.000Z",
  activatedAt: "2026-06-01T08:00:00.000Z",
  pausedAt: null,
  uninstalledAt: null,
  purgedAt: null,
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: now,
}

export const installations = [
  {
    ...installation,
    appDisplayName: "SmartBill Accounting",
    appSlug: "smartbill-accounting",
    distribution: "custom",
    releaseVersion: "1.1.0",
  },
  {
    ...installation,
    id: "inst_stripe",
    appId: "app_stripe_2b1c",
    releaseId: "rel_stripe_301",
    status: "paused",
    namespace: "app--2b1c44de90",
    appDisplayName: "Stripe Reconciliation",
    appSlug: "stripe-reconciliation",
    distribution: "custom",
    releaseVersion: "3.0.1",
    pausedAt: now,
  },
  {
    ...installation,
    id: "inst_legacy",
    appId: "app_legacy_9d2f",
    releaseId: "rel_legacy_050",
    status: "uninstalled",
    namespace: "app--9d2f01aa77",
    appDisplayName: "Legacy Exporter",
    appSlug: "legacy-exporter",
    distribution: "custom",
    releaseVersion: "0.5.0",
    uninstalledAt: now,
  },
]

export const installationDetail = {
  installation: { ...installation, pendingReleaseId: "rel_smartbill_200", pendingReason: null },
  app: apps[0],
  activeRelease: releases[1],
  pendingRelease: releases[2],
  pendingReason: "New required scopes need consent: audit:read, finance:write",
  grants: [
    { id: "g1", installationId: "inst_smartbill", scope: "apps:read", status: "granted", optional: false, requestedAt: now, grantedAt: now, revokedAt: null },
    { id: "g2", installationId: "inst_smartbill", scope: "finance:read", status: "granted", optional: false, requestedAt: now, grantedAt: now, revokedAt: null },
    { id: "g3", installationId: "inst_smartbill", scope: "finance:write", status: "optional", optional: true, requestedAt: now, grantedAt: null, revokedAt: null },
    { id: "g4", installationId: "inst_smartbill", scope: "custom-fields:read", status: "revoked", optional: true, requestedAt: now, grantedAt: null, revokedAt: now },
  ],
  extensions: [
    { id: "e1", installationId: "inst_smartbill", releaseId: "rel_smartbill_110", extensionKey: "invoice.details.after-summary", descriptor: {}, status: "active", installedAt: now, deactivatedAt: null },
    { id: "e2", installationId: "inst_smartbill", releaseId: "rel_smartbill_110", extensionKey: "page:reconciliation", descriptor: {}, status: "active", installedAt: now, deactivatedAt: null },
  ],
  webhooks: {
    data: [
      { id: "w1", installationId: "inst_smartbill", eventType: "invoice.issued", eventVersion: "1.0.0", endpointUrl: "https://smartbill.example.com/hooks/invoice", status: "active", lastDeliveryAt: now, failureCount: 0, pausedAt: null },
      { id: "w2", installationId: "inst_smartbill", eventType: "invoice.voided", eventVersion: "1.0.0", endpointUrl: "https://smartbill.example.com/hooks/void", status: "failed", lastDeliveryAt: "2026-07-14T22:10:00.000Z", failureCount: 6, pausedAt: null },
    ],
  },
  recentAudit: [
    { id: "a1", installationId: "inst_smartbill", appId: "app_smartbill_7f3a", deploymentId: "dep_operator_eu", actorId: "user_admin", kind: "lifecycle", action: "install.active", details: {}, createdAt: "2026-06-01T08:00:00.000Z" },
    { id: "a2", installationId: "inst_smartbill", appId: "app_smartbill_7f3a", deploymentId: "dep_operator_eu", actorId: "user_admin", kind: "grant", action: "grant.reconciled", details: {}, createdAt: "2026-06-01T08:00:01.000Z" },
    { id: "a3", installationId: "inst_smartbill", appId: "app_smartbill_7f3a", deploymentId: "dep_operator_eu", actorId: "system", kind: "token", action: "token.issued", details: {}, createdAt: "2026-07-10T11:30:00.000Z" },
    { id: "a4", installationId: "inst_smartbill", appId: "app_smartbill_7f3a", deploymentId: "dep_operator_eu", actorId: "system", kind: "reconciliation", action: "webhook.delivery.failed", details: {}, createdAt: "2026-07-14T22:10:00.000Z" },
  ],
  availableUpdates: [
    { release: releases[2], blocked: true, blockedReason: "New required scopes need consent: audit:read, finance:write" },
  ],
}

export const purgePreview = {
  installation: { ...installation, status: "uninstalled" },
  grants: 4,
  credentials: 2,
  extensions: 2,
  webhooks: 2,
}
