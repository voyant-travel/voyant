import { customFieldDefinitionInputSchema } from "@voyant-travel/custom-fields/contracts"
import { assertOutboundWebhookEndpointUrl } from "@voyant-travel/webhook-delivery"
import { z } from "zod"

export const APP_MANIFEST_SCHEMA_VERSION = "voyant.app-manifest.v1" as const
export const APP_ADMIN_EXTENSION_SLOTS = [
  "dashboard.header",
  "dashboard.after-kpis",
  "dashboard.footer",
  "booking.details.header",
  "booking.details.after-summary",
  "invoice.details.header",
  "invoice.details.after-summary",
  "workspace.header.actions",
] as const

const disallowedManifestKeys = {
  schemas: "Database schemas are deployment-package authority and cannot appear in app manifests.",
  migrations:
    "Database migrations are deployment-package authority and cannot appear in app manifests.",
  hostRoutes: "Host routes cannot be declared by remote app manifests.",
  routes: "Host routes cannot be declared by remote app manifests.",
  runtimeFactories: "Runtime factories cannot be declared by remote app manifests.",
  subscribers: "Subscribers cannot be declared by remote app manifests.",
  providers: "Infrastructure providers cannot be declared by remote app manifests.",
  scripts: "Package or lifecycle scripts are forbidden in app release manifests.",
  dependencies: "Dependency declarations are forbidden in app release manifests.",
  optionalDependencies: "Dependency declarations are forbidden in app release manifests.",
  peerDependencies: "Dependency declarations are forbidden in app release manifests.",
  bundledDependencies: "Dependency declarations are forbidden in app release manifests.",
  binaries: "Binary declarations are forbidden in app release manifests.",
  bin: "Binary declarations are forbidden in app release manifests.",
  exports: "Executable package exports are forbidden in app release manifests.",
  files: "Undeclared file inventories are forbidden in app release manifests.",
} as const

export const manifestDisallowedKeySchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, context) => {
    for (const [key, message] of Object.entries(disallowedManifestKeys)) {
      if (Object.hasOwn(value, key)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message,
        })
      }
    }
  })

const semverLikeSchema = z.string().trim().min(1).max(64)
const scopeSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/)
const localeSchema = z.string().trim().min(2).max(35)
const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "URL must use https.",
  })
const webhookEndpointUrlSchema = httpsUrlSchema.refine(
  (value) => {
    try {
      assertOutboundWebhookEndpointUrl(value)
      return true
    } catch {
      return false
    }
  },
  { message: "Webhook endpoint URL must be HTTPS and must not target local or private hosts." },
)
const extensionSlotSchema = z.enum(APP_ADMIN_EXTENSION_SLOTS)
const dataClassificationSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
  "personal",
  "financial",
])

const localizedHostMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(280),
    navigation: z.record(z.string(), z.string().trim().min(1).max(80)).default({}),
    extensions: z.record(z.string(), z.string().trim().min(1).max(80)).default({}),
    setup: z.record(z.string(), z.string().trim().min(1).max(80)).default({}),
  })
  .strict()

const adminPageSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    titleKey: z.string().trim().min(1).max(120),
    path: z
      .string()
      .trim()
      .regex(/^\/[a-z0-9-_/]*$/),
    entryUrl: httpsUrlSchema,
  })
  .strict()

const slotExtensionSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    titleKey: z.string().trim().min(1).max(120),
    version: semverLikeSchema,
    extensionApi: semverLikeSchema,
    entryUrl: httpsUrlSchema,
    slots: z.array(extensionSlotSchema).min(1),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const webhookSubscriptionSchema = z
  .object({
    eventType: z.string().trim().min(1).max(160),
    eventVersion: semverLikeSchema,
    endpointUrl: webhookEndpointUrlSchema,
  })
  .strict()

export const appOwnedCustomFieldDeclarationSchema = customFieldDefinitionInputSchema
  .extend({
    logicalNamespace: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9-]*$/)
      .optional(),
    dataClassification: dataClassificationSchema.default("internal"),
  })
  .strict()

export const appManifestSchema = manifestDisallowedKeySchema.pipe(
  z
    .object({
      schemaVersion: z.literal(APP_MANIFEST_SCHEMA_VERSION),
      releaseVersion: semverLikeSchema,
      apiCompatibility: z.object({ min: semverLikeSchema, max: semverLikeSchema }).strict(),
      scopes: z
        .object({
          requested: z.array(scopeSchema).default([]),
          optional: z.array(scopeSchema).default([]),
        })
        .strict(),
      admin: z
        .object({
          pages: z.array(adminPageSchema).default([]),
          slotExtensions: z.array(slotExtensionSchema).default([]),
        })
        .strict()
        .default({ pages: [], slotExtensions: [] }),
      webhooks: z.array(webhookSubscriptionSchema).default([]),
      customFields: z.array(appOwnedCustomFieldDeclarationSchema).default([]),
      locales: z
        .object({
          default: localeSchema,
          supported: z.array(localeSchema).min(1),
          host: z.record(localeSchema, localizedHostMetadataSchema),
        })
        .strict(),
      urls: z
        .object({
          setup: httpsUrlSchema.optional(),
          health: httpsUrlSchema,
          launch: httpsUrlSchema,
          privacy: httpsUrlSchema,
          support: httpsUrlSchema,
        })
        .strict(),
      data: z
        .object({
          classifications: z.array(dataClassificationSchema).min(1),
          retention: z.string().trim().min(1).max(280),
          storesSecrets: z.literal(false).default(false),
        })
        .strict(),
    })
    .strict()
    .superRefine((manifest, context) => {
      if (!manifest.locales.supported.includes(manifest.locales.default)) {
        context.addIssue({
          code: "custom",
          path: ["locales", "default"],
          message: "The default locale must be present in supported locales.",
        })
      }
      if (!manifest.locales.host[manifest.locales.default]) {
        context.addIssue({
          code: "custom",
          path: ["locales", "host", manifest.locales.default],
          message: "Host-rendered metadata is required for the default locale.",
        })
      }
    }),
)

export const createCustomAppRegistrationSchema = z
  .object({
    ownerId: z.string().trim().min(1).max(160),
    displayName: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/),
    redirectUris: z.array(httpsUrlSchema).default([]),
    createdBy: z.string().trim().min(1).max(160),
  })
  .strict()

export const releaseManifestUploadSchema = z
  .object({
    manifest: z.unknown(),
    createdBy: z.string().trim().min(1).max(160),
    provenance: z.record(z.string(), z.unknown()).default({ source: "admin-upload" }),
  })
  .strict()

export const releaseManifestFetchSchema = z
  .object({
    manifestUrl: httpsUrlSchema,
    createdBy: z.string().trim().min(1).max(160),
  })
  .strict()

export const appListQuerySchema = z.object({
  ownerId: z.string().trim().min(1).optional(),
  distribution: z.enum(["custom", "marketplace"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
})

export const appWebhookReplaySchema = z
  .object({
    deliveryId: z.string().trim().min(1),
    actorId: z.string().trim().min(1).max(160),
    signingKeyId: z.string().trim().min(1).max(160),
    signingSecret: z.string().min(32),
  })
  .strict()

export const appOAuthAuthorizeQuerySchema = z
  .object({
    response_type: z.literal("code"),
    client_id: z.string().trim().min(1),
    release_id: z.string().trim().min(1),
    redirect_uri: z.string().url(),
    state: z.string().trim().min(1),
    code_challenge: z.string().trim().min(1),
    code_challenge_method: z.literal("S256"),
    actor_id: z.string().trim().min(1),
    operator_scopes: z.string().trim().default(""),
    optional_scopes: z.string().trim().default(""),
  })
  .strict()

export const appOAuthTokenSchema = z
  .discriminatedUnion("grant_type", [
    z.object({
      grant_type: z.literal("authorization_code"),
      code: z.string().trim().min(1),
      redirect_uri: z.string().url(),
      code_verifier: z.string().trim().min(43).max(128),
      client_id: z.string().trim().min(1),
      client_secret: z.string().trim().optional(),
    }),
    z.object({
      grant_type: z.literal("refresh_token"),
      refresh_token: z.string().trim().min(1),
      client_id: z.string().trim().min(1),
      client_secret: z.string().trim().optional(),
    }),
    z.object({
      grant_type: z.literal("urn:voyant:params:oauth:grant-type:actor-token-exchange"),
      installation_id: z.string().trim().min(1),
      viewer_id: z.string().trim().min(1),
      viewer_scopes: z.array(scopeSchema).default([]),
      contextual_scopes: z.array(scopeSchema).optional(),
      client_id: z.string().trim().min(1),
      client_secret: z.string().trim().optional(),
    }),
  ])
  .transform((input) => ({
    ...input,
    client_secret: input.client_secret?.trim() || undefined,
  }))

export const appCredentialRevocationSchema = z
  .object({
    installationId: z.string().trim().min(1),
    actorId: z.string().trim().min(1),
  })
  .strict()

const sessionTokenEntitySchema = z
  .object({
    type: z.string().trim().min(1).max(80),
    id: z.string().trim().min(1).max(200),
  })
  .strict()

export const appSessionTokenIssueSchema = z
  .object({
    entity: sessionTokenEntitySchema.optional(),
    slot: z.string().trim().min(1).max(80).optional(),
  })
  .strict()

export const appSessionTokenExchangeSchema = z
  .object({
    session_token: z.string().trim().min(1),
    client_id: z.string().trim().min(1),
    client_secret: z.string().trim().optional(),
    viewer_scopes: z.array(scopeSchema).default([]),
    contextual_scopes: z.array(scopeSchema).optional(),
  })
  .strict()
  .transform((input) => ({
    ...input,
    client_secret: input.client_secret?.trim() || undefined,
  }))

export type AppManifest = z.infer<typeof appManifestSchema>
export type CreateCustomAppRegistrationInput = z.infer<typeof createCustomAppRegistrationSchema>
export type ReleaseManifestUploadInput = z.infer<typeof releaseManifestUploadSchema>
export type ReleaseManifestFetchInput = z.infer<typeof releaseManifestFetchSchema>
export type AppListQuery = z.infer<typeof appListQuerySchema>
export type AppWebhookReplayInput = z.infer<typeof appWebhookReplaySchema>
export type AppOAuthAuthorizeQuery = z.infer<typeof appOAuthAuthorizeQuerySchema>
export type AppOAuthTokenInput = z.infer<typeof appOAuthTokenSchema>
export type AppSessionTokenIssueInput = z.infer<typeof appSessionTokenIssueSchema>
export type AppSessionTokenExchangeInput = z.infer<typeof appSessionTokenExchangeSchema>
