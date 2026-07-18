import type { VoyantAuthContext } from "@voyant-travel/core"
import { ApiHttpError } from "@voyant-travel/hono"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { computeAppConsent } from "./consent.js"
import {
  APP_ACCESS_TOKEN_PREFIX,
  APP_AUTH_CODE_PREFIX,
  APP_REFRESH_TOKEN_PREFIX,
  constantTimeEqual,
  randomToken,
  sha256Hex,
  verifyPkceS256,
} from "./oauth-crypto.js"
import {
  type AppInstallation,
  appAccessCredentials,
  appAuditEvents,
  appCredentials,
  appGrants,
  appInstallations,
  appOAuthAuthorizationCodes,
  appOAuthRefreshTokens,
  appRedirectUris,
  appReleases,
  apps,
} from "./schema.js"

const CODE_TTL_MS = 5 * 60 * 1000
const OFFLINE_ACCESS_TTL_MS = 60 * 60 * 1000
const ONLINE_ACCESS_TTL_MS = 10 * 60 * 1000
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000

export interface AppOAuthServiceOptions {
  accessCatalog: AccessCatalog
  deploymentId: string
  now?: () => Date
}

export interface AuthorizeAppInput {
  appId: string
  releaseId: string
  redirectUri: string
  state: string
  codeChallenge: string
  codeChallengeMethod: "S256"
  actorId: string
  operatorGrantedScopes: readonly string[]
  grantedOptionalScopes?: readonly string[]
}

export interface TokenCodeInput {
  grantType: "authorization_code"
  code: string
  redirectUri: string
  codeVerifier: string
  clientId: string
  clientSecret?: string
}

export interface RefreshTokenInput {
  grantType: "refresh_token"
  refreshToken: string
  clientId: string
  clientSecret?: string
}

export interface TokenExchangeInput {
  grantType: "urn:voyant:params:oauth:grant-type:actor-token-exchange"
  installationId: string
  viewerId: string
  viewerScopes: readonly string[]
  contextualScopes?: readonly string[]
  clientId: string
  clientSecret?: string
}

export type AppTokenInput = TokenCodeInput | RefreshTokenInput | TokenExchangeInput

export function createAppOAuthService(options: AppOAuthServiceOptions) {
  const now = () => options.now?.() ?? new Date()

  async function authorize(db: PostgresJsDatabase, input: AuthorizeAppInput) {
    assertState(input.state)
    if (input.codeChallengeMethod !== "S256") {
      throw oauthError("invalid_request", "PKCE S256 is required")
    }
    const release = await requireRelease(db, input.appId, input.releaseId)
    await requireExactRedirectUri(db, input.appId, input.redirectUri)
    const consent = computeAppConsent({
      release,
      accessCatalog: options.accessCatalog,
      operatorGrantedScopes: input.operatorGrantedScopes,
      grantedOptionalScopes: input.grantedOptionalScopes,
    })
    const installation = await ensureAuthorizedInstallation(db, {
      appId: input.appId,
      releaseId: input.releaseId,
      deploymentId: options.deploymentId,
      actorId: input.actorId,
      grantedScopes: consent.grantedScopes,
      deniedOptionalScopes: consent.deniedOptionalScopes,
    })
    const code = randomToken(APP_AUTH_CODE_PREFIX)
    const expiresAt = new Date(now().getTime() + CODE_TTL_MS)
    await db.insert(appOAuthAuthorizationCodes).values({
      appId: input.appId,
      installationId: installation.id,
      releaseId: input.releaseId,
      deploymentId: options.deploymentId,
      codeHash: sha256Hex(code),
      stateHash: sha256Hex(input.state),
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      requestedScopes: [...consent.requiredScopes, ...consent.optionalScopes].sort(),
      grantedScopes: consent.grantedScopes,
      deniedOptionalScopes: consent.deniedOptionalScopes,
      actorId: input.actorId,
      expiresAt,
    })
    await audit(db, installation, input.actorId, "consent", "oauth.consent.recorded", {
      grantedScopes: consent.grantedScopes,
      deniedOptionalScopes: consent.deniedOptionalScopes,
    })
    return { code, state: input.state, redirectUri: input.redirectUri, expiresAt }
  }

  async function token(db: PostgresJsDatabase, input: AppTokenInput) {
    await authenticateClient(db, input.clientId, input.clientSecret)
    if (input.grantType === "authorization_code") return exchangeCode(db, input)
    if (input.grantType === "refresh_token") return refresh(db, input)
    return exchangeActorToken(db, input)
  }

  async function resolveAccessToken(
    db: PostgresJsDatabase,
    rawToken: string,
  ): Promise<VoyantAuthContext | null> {
    if (!rawToken.startsWith(APP_ACCESS_TOKEN_PREFIX)) return null
    const [credential] = await db
      .select()
      .from(appAccessCredentials)
      .where(
        and(
          eq(appAccessCredentials.credentialHash, sha256Hex(rawToken)),
          eq(appAccessCredentials.status, "active"),
        ),
      )
      .limit(1)
    if (!credential || (credential.expiresAt && credential.expiresAt <= now())) return null
    const installation = await selectInstallation(db, credential.installationId)
    if (!installation || !isInstallationUsable(installation, credential.generation)) return null
    // Online tokens resolve to the scope set minted at exchange (viewer/context
    // intersection); recomputing from grants would silently widen them. Offline
    // tokens track live grants so revoking a scope applies immediately. A
    // missing stored set on an online token fails closed to no scopes.
    const scopes =
      credential.tokenMode === "online"
        ? (readStoredScopes(credential.encryptedMetadata) ?? [])
        : await grantedScopes(db, installation.id)
    return {
      callerType: "app",
      actor: "staff",
      audience: "staff",
      appId: installation.appId,
      appInstallationId: installation.id,
      appReleaseId: installation.releaseId,
      appCredentialGeneration: credential.generation,
      appTokenMode: credential.tokenMode,
      appViewerId: credential.viewerId ?? undefined,
      scopes,
    }
  }

  async function revokeInstallationCredentials(
    db: PostgresJsDatabase,
    installationId: string,
    actorId: string,
  ) {
    return db.transaction(async (tx) => {
      const installation = await requireInstallation(tx, installationId)
      const generation = installation.credentialGeneration + 1
      await tx
        .update(appInstallations)
        .set({ credentialGeneration: generation, updatedAt: now() })
        .where(eq(appInstallations.id, installation.id))
      await tx
        .update(appAccessCredentials)
        .set({ status: "revoked", deactivatedAt: now() })
        .where(eq(appAccessCredentials.installationId, installation.id))
      await tx
        .update(appOAuthRefreshTokens)
        .set({ status: "revoked", revokedAt: now() })
        .where(eq(appOAuthRefreshTokens.installationId, installation.id))
      await audit(tx, installation, actorId, "credential", "credential.revoked", { generation })
      return { installationId: installation.id, generation }
    })
  }

  return { authorize, token, resolveAccessToken, revokeInstallationCredentials }

  async function exchangeCode(db: PostgresJsDatabase, input: TokenCodeInput) {
    return db.transaction(async (tx) => {
      const codeHash = sha256Hex(input.code)
      const [code] = await tx
        .select()
        .from(appOAuthAuthorizationCodes)
        .where(eq(appOAuthAuthorizationCodes.codeHash, codeHash))
        .for("update")
        .limit(1)
      if (!code || code.consumedAt || code.expiresAt <= now()) {
        throw oauthError("invalid_grant", "Authorization code is invalid, expired, or consumed")
      }
      if (code.appId !== input.clientId || code.redirectUri !== input.redirectUri) {
        throw oauthError("invalid_grant", "Authorization code was issued to different client data")
      }
      if (!verifyPkceS256(input.codeVerifier, code.codeChallenge)) {
        throw oauthError("invalid_grant", "PKCE verifier does not match the authorization code")
      }
      await tx
        .update(appOAuthAuthorizationCodes)
        .set({ consumedAt: now() })
        .where(eq(appOAuthAuthorizationCodes.id, code.id))
      const installation = await requireInstallation(tx, code.installationId)
      assertActiveInstallation(installation)
      const tokens = await mintTokens(tx, installation, code.actorId, null, code.grantedScopes)
      await audit(tx, installation, code.actorId, "token", "oauth.code.exchanged", {})
      return tokens
    })
  }

  async function refresh(db: PostgresJsDatabase, input: RefreshTokenInput) {
    return db.transaction(async (tx) => {
      const [tokenRow] = await tx
        .select()
        .from(appOAuthRefreshTokens)
        .where(eq(appOAuthRefreshTokens.tokenHash, sha256Hex(input.refreshToken)))
        .for("update")
        .limit(1)
      if (tokenRow?.status !== "active" || isExpired(tokenRow.expiresAt)) {
        throw oauthError("invalid_grant", "Refresh token is invalid")
      }
      const installation = await requireInstallation(tx, tokenRow.installationId)
      assertTokenClient(installation, input.clientId)
      assertActiveInstallation(installation)
      if (installation.credentialGeneration !== tokenRow.generation) {
        throw oauthError("invalid_grant", "Refresh token generation was revoked")
      }
      await tx
        .update(appOAuthRefreshTokens)
        .set({ status: "inactive", revokedAt: now() })
        .where(eq(appOAuthRefreshTokens.id, tokenRow.id))
      const tokens = await mintTokens(
        tx,
        installation,
        "app",
        null,
        await grantedScopes(tx, installation.id),
        {
          rotatedFromId: tokenRow.id,
        },
      )
      await audit(tx, installation, "app", "token", "oauth.refresh.rotated", {
        generation: installation.credentialGeneration,
      })
      return tokens
    })
  }

  async function exchangeActorToken(db: PostgresJsDatabase, input: TokenExchangeInput) {
    const installation = await requireInstallation(db, input.installationId)
    assertTokenClient(installation, input.clientId)
    assertActiveInstallation(installation)
    const grants = await grantedScopes(db, installation.id)
    const contextual = input.contextualScopes ?? grants
    const scopes = intersectAppTokenScopes(grants, input.viewerScopes, contextual)
    const accessToken = randomToken(APP_ACCESS_TOKEN_PREFIX)
    const expiresAt = new Date(now().getTime() + ONLINE_ACCESS_TTL_MS)
    await db.insert(appAccessCredentials).values({
      installationId: installation.id,
      generation: installation.credentialGeneration,
      tokenMode: "online",
      credentialHash: sha256Hex(accessToken),
      // Online tokens are intentionally narrowed; the resolver must honor the
      // minted set rather than recomputing from installation grants.
      encryptedMetadata: { scopeCount: scopes.length, scopes: [...scopes] },
      status: "active",
      actorId: input.viewerId,
      viewerId: input.viewerId,
      expiresAt,
    })
    await audit(db, installation, input.viewerId, "token", "oauth.actor_token.exchanged", {
      grantedScopes: scopes,
    })
    return tokenResponse(accessToken, null, expiresAt, scopes, "online")
  }

  async function mintTokens(
    db: PostgresJsDatabase,
    installation: AppInstallation,
    actorId: string,
    viewerId: string | null,
    scopes: readonly string[],
    refreshOptions: { rotatedFromId?: string } = {},
  ) {
    const accessToken = randomToken(APP_ACCESS_TOKEN_PREFIX)
    const refreshToken = randomToken(APP_REFRESH_TOKEN_PREFIX)
    const accessExpiresAt = new Date(now().getTime() + OFFLINE_ACCESS_TTL_MS)
    const refreshExpiresAt = new Date(now().getTime() + REFRESH_TTL_MS)
    const generation = installation.credentialGeneration
    await db.insert(appAccessCredentials).values({
      installationId: installation.id,
      generation,
      tokenMode: "offline",
      credentialHash: sha256Hex(accessToken),
      encryptedMetadata: { scopeCount: scopes.length },
      status: "active",
      actorId,
      viewerId,
      expiresAt: accessExpiresAt,
    })
    await db.insert(appOAuthRefreshTokens).values({
      installationId: installation.id,
      tokenHash: sha256Hex(refreshToken),
      generation,
      rotatedFromId: refreshOptions.rotatedFromId,
      expiresAt: refreshExpiresAt,
    })
    return tokenResponse(accessToken, refreshToken, accessExpiresAt, scopes, "offline")
  }

  function isExpired(expiresAt: Date | null) {
    return Boolean(expiresAt && expiresAt <= now())
  }
}

function tokenResponse(
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date,
  scopes: readonly string[],
  tokenMode: "offline" | "online",
) {
  return {
    accessToken,
    tokenType: "Bearer" as const,
    expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    scope: scopes.join(" "),
    tokenMode,
    ...(refreshToken ? { refreshToken } : {}),
  }
}

async function authenticateClient(
  db: PostgresJsDatabase,
  appId: string,
  clientSecret: string | undefined,
) {
  const [secret] = await db
    .select()
    .from(appCredentials)
    .where(and(eq(appCredentials.appId, appId), eq(appCredentials.kind, "client_secret")))
    .limit(1)
  if (!secret) return
  if (!clientSecret || !secret.kmsKeyRef.startsWith("sha256:")) {
    throw oauthError("invalid_client", "Client authentication failed", 401)
  }
  const expected = secret.kmsKeyRef.slice("sha256:".length)
  if (!constantTimeEqual(sha256Hex(clientSecret), expected)) {
    throw oauthError("invalid_client", "Client authentication failed", 401)
  }
}

async function requireRelease(db: PostgresJsDatabase, appId: string, releaseId: string) {
  const [release] = await db
    .select()
    .from(appReleases)
    .where(and(eq(appReleases.id, releaseId), eq(appReleases.appId, appId)))
    .limit(1)
  if (!release) throw oauthError("invalid_request", "App release not found", 404)
  if (release.state !== "available") {
    throw oauthError("invalid_request", "App release is not available for authorization", 409)
  }
  return release
}

async function requireExactRedirectUri(db: PostgresJsDatabase, appId: string, redirectUri: string) {
  const [row] = await db
    .select()
    .from(appRedirectUris)
    .where(and(eq(appRedirectUris.appId, appId), eq(appRedirectUris.redirectUri, redirectUri)))
    .limit(1)
  if (!row) throw oauthError("invalid_request", "Redirect URI is not registered for this app")
}

async function ensureAuthorizedInstallation(
  db: PostgresJsDatabase,
  input: {
    appId: string
    releaseId: string
    deploymentId: string
    actorId: string
    grantedScopes: readonly string[]
    deniedOptionalScopes: readonly string[]
  },
) {
  return db.transaction(async (tx) => {
    const [app] = await tx.select().from(apps).where(eq(apps.id, input.appId)).limit(1)
    if (!app) throw oauthError("invalid_request", "App registration not found", 404)
    const [existing] = await tx
      .select()
      .from(appInstallations)
      .where(
        and(
          eq(appInstallations.deploymentId, input.deploymentId),
          eq(appInstallations.appId, input.appId),
        ),
      )
      .limit(1)
    const installation =
      existing ??
      (
        await tx
          .insert(appInstallations)
          .values({
            appId: input.appId,
            deploymentId: input.deploymentId,
            releaseId: input.releaseId,
            status: "active",
            namespace: app.platformNamespace,
            installedBy: input.actorId,
            authorizedAt: new Date(),
            activatedAt: new Date(),
          })
          .returning()
      )[0]
    if (!installation) throw oauthError("server_error", "Could not create installation", 500)
    for (const scope of input.grantedScopes) {
      await tx
        .insert(appGrants)
        .values({
          installationId: installation.id,
          scope,
          status: "granted",
          optional: false,
          grantedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [appGrants.installationId, appGrants.scope],
          set: { status: "granted", grantedAt: new Date(), revokedAt: null },
        })
    }
    for (const scope of input.deniedOptionalScopes) {
      await tx
        .insert(appGrants)
        .values({ installationId: installation.id, scope, status: "optional", optional: true })
        .onConflictDoUpdate({
          target: [appGrants.installationId, appGrants.scope],
          set: { status: "optional", optional: true },
        })
    }
    return installation
  })
}

async function requireInstallation(db: PostgresJsDatabase, installationId: string) {
  const installation = await selectInstallation(db, installationId)
  if (!installation) throw oauthError("invalid_grant", "App installation not found", 404)
  return installation
}

async function selectInstallation(db: PostgresJsDatabase, installationId: string) {
  const [installation] = await db
    .select()
    .from(appInstallations)
    .where(eq(appInstallations.id, installationId))
    .limit(1)
  return installation ?? null
}

async function grantedScopes(db: PostgresJsDatabase, installationId: string) {
  const rows = await db
    .select({ scope: appGrants.scope })
    .from(appGrants)
    .where(and(eq(appGrants.installationId, installationId), eq(appGrants.status, "granted")))
    .orderBy(appGrants.scope)
  return rows.map((row) => row.scope)
}

function assertActiveInstallation(installation: AppInstallation) {
  if (installation.status !== "active") {
    throw oauthError("invalid_grant", "App installation is not active")
  }
}

function isInstallationUsable(installation: AppInstallation | null, generation: number) {
  return installation?.status === "active" && installation.credentialGeneration === generation
}

function assertTokenClient(installation: AppInstallation, clientId: string) {
  if (installation.appId !== clientId) {
    throw oauthError("invalid_grant", "Token belongs to a different app")
  }
}

export function intersectAppTokenScopes(...sets: readonly (readonly string[])[]): string[] {
  const [first = [], ...rest] = sets
  return first.filter((scope) => rest.every((set) => set.includes(scope))).sort()
}

function assertState(state: string) {
  if (!state.trim()) throw oauthError("invalid_request", "OAuth state is required")
}

export function readStoredScopes(metadata: Record<string, unknown>): string[] | null {
  const stored = metadata.scopes
  if (!Array.isArray(stored)) return null
  return stored.filter((scope): scope is string => typeof scope === "string")
}

function oauthError(error: string, description: string, status = 400) {
  return new ApiHttpError(description, { status, code: error })
}

async function audit(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  actorId: string,
  kind: "consent" | "credential" | "token",
  action: string,
  details: Record<string, unknown>,
) {
  await db.insert(appAuditEvents).values({
    installationId: installation.id,
    appId: installation.appId,
    deploymentId: installation.deploymentId,
    actorId,
    kind,
    action,
    details,
  })
}
