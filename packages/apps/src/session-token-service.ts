/**
 * Issuance, replay guard, and backend exchange for admin session tokens.
 *
 * The crypto lives in `session-token.ts`; this module binds it to the
 * installation aggregate:
 * - {@link issueAppSessionToken} mints a token for an active installation and
 *   records the `jti` so it can be consumed exactly once.
 * - {@link exchangeAppSessionToken} verifies a token an app backend presents,
 *   consumes its `jti` (rejecting replay), and swaps it for online actor access
 *   via the existing OAuth actor-token-exchange primitive — bounded by the
 *   intersection of the app's grants and the viewer's scopes.
 *
 * Both paths write `app_audit_events` so issuance and exchange are auditable.
 */
import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq, gt, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { createAppOAuthService } from "./oauth-service.js"
import {
  type AppInstallation,
  appAuditEvents,
  appInstallations,
  appSessionTokens,
} from "./schema.js"
import {
  type AppSessionTokenContext,
  type AppSessionTokenEntity,
  signAppSessionToken,
  verifyAppSessionToken,
} from "./session-token.js"

type AppOAuthService = ReturnType<typeof createAppOAuthService>

export interface AppSessionTokenServiceOptions {
  /** Root secret; the signing key is HKDF-derived from it under a private context. */
  secret: string
  /** The deployment audience the tokens are bound to. */
  deploymentId: string
  /** OAuth service supplying the online actor-token-exchange primitive. */
  oauth: AppOAuthService
  ttlSeconds?: number
  now?: () => Date
}

export interface IssueAppSessionTokenInput {
  installationId: string
  viewerId: string
  /** Current host-authenticated viewer permissions. */
  viewerScopes?: readonly string[]
  entity?: AppSessionTokenEntity | null
  slot?: string | null
}

export interface IssuedAppSessionToken {
  token: string
  tokenId: string
  expiresAtMs: number
}

export interface ExchangeAppSessionTokenInput {
  token: string
  /** Authenticating app client; must match the token audience (confused-deputy guard). */
  clientId: string
  clientSecret?: string
  /** The viewer's current effective scopes; the online token is bounded by these. */
  viewerScopes: readonly string[]
  /** Optional further contextual narrowing (defaults to the app grants). */
  contextualScopes?: readonly string[]
}

export function createAppSessionTokenService(options: AppSessionTokenServiceOptions) {
  const now = () => options.now?.() ?? new Date()

  async function issue(
    db: PostgresJsDatabase,
    input: IssueAppSessionTokenInput,
  ): Promise<IssuedAppSessionToken> {
    const installation = await requireActiveInstallation(db, input.installationId)
    const context: AppSessionTokenContext = {
      appId: installation.appId,
      installationId: installation.id,
      deploymentId: installation.deploymentId,
      viewerId: input.viewerId,
      viewerScopes: input.viewerScopes ?? [],
      entity: input.entity ?? null,
      slot: input.slot ?? null,
    }
    const signed = signAppSessionToken(context, options.secret, {
      now,
      ttlSeconds: options.ttlSeconds,
    })
    await db.insert(appSessionTokens).values({
      installationId: installation.id,
      appId: installation.appId,
      deploymentId: installation.deploymentId,
      jti: signed.claims.jti,
      viewerId: input.viewerId,
      entityType: signed.claims.entity?.type ?? null,
      entityId: signed.claims.entity?.id ?? null,
      slot: signed.claims.slot,
      expiresAt: new Date(signed.claims.exp * 1000),
    })
    await audit(db, installation, input.viewerId, "session-token.issued", {
      jti: signed.claims.jti,
      slot: signed.claims.slot,
      entityType: signed.claims.entity?.type ?? null,
    })
    return { token: signed.token, tokenId: signed.claims.jti, expiresAtMs: signed.expiresAtMs }
  }

  async function exchange(db: PostgresJsDatabase, input: ExchangeAppSessionTokenInput) {
    const verified = verifyAppSessionToken(input.token, options.secret, {
      deploymentId: options.deploymentId,
      audience: input.clientId,
      now,
    })
    if (!verified.ok) {
      throw new ApiHttpError("Session token rejected", {
        status: 401,
        code: `app_session_token_${verified.reason}`,
      })
    }
    const { claims } = verified
    return db.transaction(async (tx) => {
      const installation = await requireActiveInstallation(tx, claims.installationId)
      if (installation.appId !== claims.aud || installation.deploymentId !== claims.deploymentId) {
        throw new ApiHttpError("Session token installation context changed", {
          status: 401,
          code: "app_session_token_installation_mismatch",
        })
      }

      // Client authentication and token construction happen before consumption,
      // but in the same transaction. If authentication/minting fails, or another
      // exchange wins the JTI race, every credential side effect rolls back.
      const tokens = await options.oauth.token(tx, {
        grantType: "urn:voyant:params:oauth:grant-type:actor-token-exchange",
        installationId: installation.id,
        viewerId: claims.sub,
        viewerScopes: intersectRequestedScopes(claims.viewerScopes, input.viewerScopes),
        contextualScopes: input.contextualScopes,
        contextConstraint: { entity: claims.entity, slot: claims.slot },
        clientId: input.clientId,
        clientSecret: input.clientSecret,
      })
      const consumed = await tx
        .update(appSessionTokens)
        .set({ consumedAt: now(), consumedByActorId: claims.sub })
        .where(
          and(
            eq(appSessionTokens.jti, claims.jti),
            eq(appSessionTokens.installationId, installation.id),
            eq(appSessionTokens.appId, claims.aud),
            eq(appSessionTokens.deploymentId, claims.deploymentId),
            eq(appSessionTokens.viewerId, claims.sub),
            isNull(appSessionTokens.consumedAt),
            gt(appSessionTokens.expiresAt, now()),
          ),
        )
        .returning({ id: appSessionTokens.id })
      if (consumed.length === 0) {
        throw new ApiHttpError("Session token has already been used", {
          status: 401,
          code: "app_session_token_replayed",
        })
      }
      await audit(tx, installation, claims.sub, "session-token.exchanged", {
        jti: claims.jti,
        slot: claims.slot,
        entityType: claims.entity?.type ?? null,
        entityId: claims.entity?.id ?? null,
      })
      return tokens
    })
  }

  return { issue, exchange }
}

function intersectRequestedScopes(
  trustedViewerScopes: readonly string[],
  requestedScopes: readonly string[],
) {
  const trusted = new Set(trustedViewerScopes)
  return Array.from(new Set(requestedScopes.filter((scope) => trusted.has(scope)))).sort()
}

async function requireActiveInstallation(
  db: PostgresJsDatabase,
  installationId: string,
): Promise<AppInstallation> {
  const [installation] = await db
    .select()
    .from(appInstallations)
    .where(eq(appInstallations.id, installationId))
    .limit(1)
  if (!installation) {
    throw new ApiHttpError("App installation not found", {
      status: 404,
      code: "app_installation_not_found",
    })
  }
  if (installation.status !== "active") {
    throw new ApiHttpError("App installation is not active", {
      status: 403,
      code: "app_installation_not_active",
    })
  }
  return installation
}

async function audit(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  actorId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await db.insert(appAuditEvents).values({
    installationId: installation.id,
    appId: installation.appId,
    deploymentId: installation.deploymentId,
    actorId,
    kind: "token",
    action,
    details,
  })
}
