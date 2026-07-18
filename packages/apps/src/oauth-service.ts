import type { VoyantAppContextConstraint, VoyantAuthContext } from "@voyant-travel/core"
import { ApiHttpError } from "@voyant-travel/hono"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { and, eq, isNull } from "drizzle-orm"
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
  assertActiveInstallation,
  assertManagedBinding,
  assertManagedInstallationAuthority,
  assertTokenClient,
  ensureAuthorizedInstallation,
  grantedScopes,
  isInstallationUsable,
  managedBindingMatches,
  requireInstallation,
  selectInstallation,
} from "./oauth-installation.js"
import type {
  ManagedAppInstallationAuthority,
  ManagedAppInstallationBinding,
} from "./runtime-port.js"
import {
  type AppInstallation,
  appAccessCredentials,
  appAuditEvents,
  appCredentials,
  appInstallations,
  appOAuthAuthorizationCodes,
  appOAuthRefreshTokens,
  appRedirectUris,
  appReleases,
} from "./schema.js"

const CODE_TTL_MS = 5 * 60 * 1000
const OFFLINE_ACCESS_TTL_MS = 60 * 60 * 1000
const ONLINE_ACCESS_TTL_MS = 10 * 60 * 1000
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000

export interface AppOAuthServiceOptions {
  accessCatalog: AccessCatalog
  deploymentId: string
  /** Stable host identity required only for managed workload environments. */
  managedInstallation?: ManagedAppInstallationAuthority
  /** Managed confidential runtimes fail closed unless a client secret is registered. */
  clientAuthentication?: "optional" | "required"
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
  /** Immutable host context signed into the extension session token. */
  contextConstraint: VoyantAppContextConstraint
  clientId: string
  clientSecret?: string
}

export type AppTokenInput = TokenCodeInput | RefreshTokenInput | TokenExchangeInput

export function createAppOAuthService(options: AppOAuthServiceOptions) {
  assertManagedInstallationAuthority(options.managedInstallation)
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
    const managedBinding = await resolveManagedBinding(input.appId, input.releaseId)
    const installation = await ensureAuthorizedInstallation(db, {
      appId: input.appId,
      releaseId: input.releaseId,
      deploymentId: options.deploymentId,
      managedBinding,
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
      workloadEnvironmentId: managedBinding?.workloadEnvironmentId,
      contractGeneration: managedBinding?.contractGeneration,
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
    await authenticateClient(
      db,
      input.clientId,
      input.clientSecret,
      options.clientAuthentication === "required",
    )
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
    if (!installation) return null
    const managedBinding = await resolveManagedBindingOrNull(
      installation.appId,
      installation.releaseId,
    )
    if (options.managedInstallation && !managedBinding) return null
    const effectiveManagedBinding = managedBinding ?? undefined
    if (
      !isInstallationUsable(installation, credential.generation) ||
      !managedBindingMatches(installation, effectiveManagedBinding) ||
      !managedBindingMatches(credential, effectiveManagedBinding)
    ) {
      return null
    }
    // Online tokens resolve to the scope set minted at exchange (viewer/context
    // intersection); recomputing from grants would silently widen them. Offline
    // tokens track live grants so revoking a scope applies immediately. A
    // missing stored set on an online token fails closed to no scopes.
    const scopes =
      credential.tokenMode === "online"
        ? (readStoredScopes(credential.encryptedMetadata) ?? [])
        : await grantedScopes(db, installation.id)
    const appContextConstraint =
      credential.tokenMode === "online"
        ? readStoredAppContextConstraint(credential.encryptedMetadata)
        : undefined
    // Every online actor token is minted from an extension session. Missing or
    // malformed context metadata must invalidate it rather than silently widen it.
    if (credential.tokenMode === "online" && !appContextConstraint) return null
    return {
      callerType: "app",
      actor: "staff",
      audience: "staff",
      appId: installation.appId,
      appInstallationId: installation.id,
      appReleaseId: installation.releaseId,
      appCredentialGeneration: credential.generation,
      ...(effectiveManagedBinding
        ? {
            appWorkloadEnvironmentId: effectiveManagedBinding.workloadEnvironmentId,
            appContractGeneration: effectiveManagedBinding.contractGeneration,
          }
        : {}),
      appTokenMode: credential.tokenMode,
      appViewerId: credential.viewerId ?? undefined,
      ...(appContextConstraint ? { appContextConstraint } : {}),
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
      const managedBinding = await resolveManagedBinding(installation.appId, installation.releaseId)
      assertManagedBinding(installation, managedBinding)
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
      if (!options.managedInstallation && code.deploymentId !== options.deploymentId) {
        throw oauthError("invalid_grant", "Authorization code belongs to a different runtime")
      }
      const managedBinding = await resolveManagedBinding(code.appId, code.releaseId)
      assertManagedBinding(code, managedBinding)
      await tx
        .update(appOAuthAuthorizationCodes)
        .set({ consumedAt: now() })
        .where(eq(appOAuthAuthorizationCodes.id, code.id))
      const installation = await requireInstallation(tx, code.installationId)
      assertActiveInstallation(installation)
      assertManagedBinding(installation, managedBinding)
      const tokens = await mintTokens(
        tx,
        installation,
        code.actorId,
        null,
        code.grantedScopes,
        managedBinding,
      )
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
      const managedBinding = await resolveManagedBinding(installation.appId, installation.releaseId)
      assertTokenClient(installation, input.clientId)
      assertActiveInstallation(installation)
      assertManagedBinding(tokenRow, managedBinding)
      assertManagedBinding(installation, managedBinding)
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
        managedBinding,
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
    const managedBinding = await resolveManagedBinding(installation.appId, installation.releaseId)
    assertTokenClient(installation, input.clientId)
    assertActiveInstallation(installation)
    assertManagedBinding(installation, managedBinding)
    const grants = await grantedScopes(db, installation.id)
    const contextual = input.contextualScopes ?? grants
    const scopes = intersectAppTokenScopes(grants, input.viewerScopes, contextual)
    const accessToken = randomToken(APP_ACCESS_TOKEN_PREFIX)
    const expiresAt = new Date(now().getTime() + ONLINE_ACCESS_TTL_MS)
    await db.insert(appAccessCredentials).values({
      installationId: installation.id,
      generation: installation.credentialGeneration,
      workloadEnvironmentId: managedBinding?.workloadEnvironmentId,
      contractGeneration: managedBinding?.contractGeneration,
      tokenMode: "online",
      credentialHash: sha256Hex(accessToken),
      // Online tokens are intentionally narrowed; the resolver must honor the
      // minted set rather than recomputing from installation grants.
      encryptedMetadata: {
        scopeCount: scopes.length,
        scopes: [...scopes],
        contextConstraint: input.contextConstraint,
      },
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
    managedBinding: ManagedAppInstallationBinding | undefined,
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
      workloadEnvironmentId: managedBinding?.workloadEnvironmentId,
      contractGeneration: managedBinding?.contractGeneration,
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
      workloadEnvironmentId: managedBinding?.workloadEnvironmentId,
      contractGeneration: managedBinding?.contractGeneration,
      rotatedFromId: refreshOptions.rotatedFromId,
      expiresAt: refreshExpiresAt,
    })
    return tokenResponse(accessToken, refreshToken, accessExpiresAt, scopes, "offline")
  }

  function isExpired(expiresAt: Date | null) {
    return Boolean(expiresAt && expiresAt <= now())
  }

  async function resolveManagedBinding(appId: string, releaseId: string) {
    if (!options.managedInstallation) return undefined
    const contract = await options.managedInstallation.resolveInstallationContract({
      appId,
      releaseId,
    })
    if (
      !contract ||
      !Number.isSafeInteger(contract.contractGeneration) ||
      contract.contractGeneration <= 0
    ) {
      throw oauthError("invalid_grant", "Managed app installation contract is unavailable")
    }
    return {
      workloadEnvironmentId: options.managedInstallation.workloadEnvironmentId,
      contractGeneration: contract.contractGeneration,
    }
  }

  async function resolveManagedBindingOrNull(appId: string, releaseId: string) {
    try {
      return await resolveManagedBinding(appId, releaseId)
    } catch {
      return null
    }
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
  required: boolean,
) {
  const [secret] = await db
    .select()
    .from(appCredentials)
    .where(
      and(
        eq(appCredentials.appId, appId),
        eq(appCredentials.kind, "client_secret"),
        isNull(appCredentials.retiredAt),
      ),
    )
    .limit(1)
  if (!secret) {
    if (required) throw oauthError("invalid_client", "Client authentication failed", 401)
    return
  }
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

export function readStoredAppContextConstraint(
  metadata: Record<string, unknown>,
): VoyantAppContextConstraint | null {
  const value = metadata.contextConstraint
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const slot = record.slot
  if (slot !== null && (typeof slot !== "string" || slot.length === 0)) return null
  const entity = record.entity
  if (entity === null) return { entity: null, slot }
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) return null
  const entityRecord = entity as Record<string, unknown>
  if (
    typeof entityRecord.type !== "string" ||
    entityRecord.type.length === 0 ||
    typeof entityRecord.id !== "string" ||
    entityRecord.id.length === 0
  ) {
    return null
  }
  return { entity: { type: entityRecord.type, id: entityRecord.id }, slot }
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
