import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { appGrants, appInstallations } from "./schema.js"

export interface AppInstallationAccessInput {
  installationId: string
  requiredScopes?: readonly string[]
}

export async function assertActiveAppInstallationAccess(
  db: PostgresJsDatabase,
  input: AppInstallationAccessInput,
) {
  const [installation] = await db
    .select()
    .from(appInstallations)
    .where(eq(appInstallations.id, input.installationId))
    .limit(1)
  if (installation?.status !== "active") {
    throw new ApiHttpError("App installation is not active", {
      status: 403,
      code: "app_installation_not_active",
    })
  }

  const required = new Set(input.requiredScopes ?? [])
  if (required.size === 0) return installation

  const grants = await db
    .select({ scope: appGrants.scope })
    .from(appGrants)
    .where(and(eq(appGrants.installationId, installation.id), eq(appGrants.status, "granted")))
  for (const grant of grants) required.delete(grant.scope)
  if (required.size > 0) {
    throw new ApiHttpError("App installation is missing required scopes", {
      status: 403,
      code: "app_installation_scope_missing",
      details: { scopes: [...required].sort() },
    })
  }

  return installation
}
