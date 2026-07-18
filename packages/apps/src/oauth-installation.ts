import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  ManagedAppInstallationAuthority,
  ManagedAppInstallationBinding,
} from "./runtime-port.js"
import { type AppInstallation, appGrants, appInstallations, apps } from "./schema.js"

export async function ensureAuthorizedInstallation(
  db: PostgresJsDatabase,
  input: {
    appId: string
    releaseId: string
    deploymentId: string
    actorId: string
    grantedScopes: readonly string[]
    deniedOptionalScopes: readonly string[]
    managedBinding?: ManagedAppInstallationBinding
  },
) {
  return db.transaction(async (tx) => {
    const [app] = await tx.select().from(apps).where(eq(apps.id, input.appId)).limit(1)
    if (!app) throw oauthError("invalid_request", "App registration not found", 404)
    const [existing] = await tx
      .select()
      .from(appInstallations)
      .where(
        input.managedBinding
          ? and(
              eq(
                appInstallations.workloadEnvironmentId,
                input.managedBinding.workloadEnvironmentId,
              ),
              eq(appInstallations.appId, input.appId),
            )
          : and(
              eq(appInstallations.deploymentId, input.deploymentId),
              eq(appInstallations.appId, input.appId),
            ),
      )
      .limit(1)
    let installation =
      existing ??
      (
        await tx
          .insert(appInstallations)
          .values({
            appId: input.appId,
            deploymentId: input.deploymentId,
            workloadEnvironmentId: input.managedBinding?.workloadEnvironmentId,
            contractGeneration: input.managedBinding?.contractGeneration,
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
    if (existing && input.managedBinding) {
      if (existing.contractGeneration === null) {
        throw oauthError(
          "invalid_grant",
          "Managed installation is missing its workload-environment binding",
        )
      }
      if (existing.contractGeneration > input.managedBinding.contractGeneration) {
        throw oauthError("invalid_grant", "Managed app contract generation is stale")
      }
      if (
        existing.contractGeneration < input.managedBinding.contractGeneration ||
        existing.deploymentId !== input.deploymentId
      ) {
        const generationAdvanced =
          existing.contractGeneration < input.managedBinding.contractGeneration
        const [updated] = await tx
          .update(appInstallations)
          .set({
            deploymentId: input.deploymentId,
            contractGeneration: input.managedBinding.contractGeneration,
            // agent-quality: raw-sql reviewed -- owner: apps; atomically invalidates the prior credential generation.
            credentialGeneration: generationAdvanced
              ? sql`${appInstallations.credentialGeneration} + 1`
              : existing.credentialGeneration,
            updatedAt: new Date(),
          })
          .where(eq(appInstallations.id, existing.id))
          .returning()
        installation = updated ?? existing
      }
    }
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

export async function requireInstallation(db: PostgresJsDatabase, installationId: string) {
  const installation = await selectInstallation(db, installationId)
  if (!installation) throw oauthError("invalid_grant", "App installation not found", 404)
  return installation
}

export async function selectInstallation(db: PostgresJsDatabase, installationId: string) {
  const [installation] = await db
    .select()
    .from(appInstallations)
    .where(eq(appInstallations.id, installationId))
    .limit(1)
  return installation ?? null
}

export async function grantedScopes(db: PostgresJsDatabase, installationId: string) {
  const rows = await db
    .select({ scope: appGrants.scope })
    .from(appGrants)
    .where(and(eq(appGrants.installationId, installationId), eq(appGrants.status, "granted")))
    .orderBy(appGrants.scope)
  return rows.map((row) => row.scope)
}

export function assertActiveInstallation(installation: AppInstallation) {
  if (installation.status !== "active") {
    throw oauthError("invalid_grant", "App installation is not active")
  }
}

export function isInstallationUsable(installation: AppInstallation | null, generation: number) {
  return installation?.status === "active" && installation.credentialGeneration === generation
}

export function assertTokenClient(installation: AppInstallation, clientId: string) {
  if (installation.appId !== clientId) {
    throw oauthError("invalid_grant", "Token belongs to a different app")
  }
}

type PersistedManagedBinding = {
  workloadEnvironmentId: string | null
  contractGeneration: number | null
}

export function assertManagedInstallationAuthority(
  authority: ManagedAppInstallationAuthority | undefined,
) {
  if (!authority) return
  if (
    !authority.workloadEnvironmentId.trim() ||
    typeof authority.resolveInstallationContract !== "function"
  ) {
    throw new TypeError("Managed app installation authority is invalid")
  }
}

export function managedBindingMatches(
  persisted: PersistedManagedBinding,
  expected: ManagedAppInstallationBinding | undefined,
) {
  if (!expected) return true
  return (
    persisted.workloadEnvironmentId === expected.workloadEnvironmentId &&
    persisted.contractGeneration === expected.contractGeneration
  )
}

export function assertManagedBinding(
  persisted: PersistedManagedBinding,
  expected: ManagedAppInstallationBinding | undefined,
) {
  if (!managedBindingMatches(persisted, expected)) {
    throw oauthError(
      "invalid_grant",
      "App credential belongs to a different workload environment or contract generation",
    )
  }
}

function oauthError(error: string, description: string, status = 400) {
  return new ApiHttpError(description, { status, code: error })
}
