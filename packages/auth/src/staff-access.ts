import { cloudAuthUserLinks, userProfilesTable } from "@voyant-travel/db/schema/iam"
import type { VoyantDb } from "@voyant-travel/hono"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { accessCatalogScopesForRole, isFullAccessRole } from "@voyant-travel/types/member-roles"
import { and, eq, isNull } from "drizzle-orm"

const FULL_ACCESS_SCOPES = ["*"]
const VOYANT_CLOUD_PROVIDER_ID = "voyant-cloud"

export type StaffAccessContext = {
  organizationId: string | null
  scopes: string[]
}

function scopesForOperatorRole(
  role: string | null | undefined,
  accessCatalog: AccessCatalog,
): string[] | null {
  const base = accessCatalogScopesForRole(role, accessCatalog)
  if (!base) return null
  const normalizedRole = (role ?? "").trim().toLowerCase()
  const presetId =
    normalizedRole === "member" ? "editor" : normalizedRole === "guest" ? "viewer" : normalizedRole
  const selected = accessCatalog.presets.find(
    (preset) => preset.kind === "staff" && preset.id === presetId,
  )
  return [...new Set([...base, ...(selected?.grants ?? [])])].sort()
}

export async function resolveStaffAccess(input: {
  accessCatalog: AccessCatalog
  authMode: "local" | "voyant-cloud"
  db: VoyantDb
  deploymentId?: string
  userId: string
}): Promise<StaffAccessContext | null> {
  if (input.authMode === "voyant-cloud") {
    const deploymentId = input.deploymentId?.trim()
    if (!deploymentId) return null

    const [link] = await input.db
      .select({
        deploymentId: cloudAuthUserLinks.deploymentId,
        platformOrganizationId: cloudAuthUserLinks.platformOrganizationId,
        providerId: cloudAuthUserLinks.providerId,
        revokedAt: cloudAuthUserLinks.revokedAt,
        roleSlug: cloudAuthUserLinks.roleSlug,
        scopes: cloudAuthUserLinks.scopes,
      })
      .from(cloudAuthUserLinks)
      .where(
        and(
          eq(cloudAuthUserLinks.userId, input.userId),
          eq(cloudAuthUserLinks.providerId, VOYANT_CLOUD_PROVIDER_ID),
          eq(cloudAuthUserLinks.deploymentId, deploymentId),
          isNull(cloudAuthUserLinks.revokedAt),
        ),
      )
      .limit(1)

    if (
      !link ||
      link.providerId !== VOYANT_CLOUD_PROVIDER_ID ||
      link.deploymentId !== deploymentId ||
      link.revokedAt ||
      !link.platformOrganizationId.trim()
    ) {
      return null
    }

    const fullAccessScopes =
      scopesForOperatorRole("admin", input.accessCatalog) ?? FULL_ACCESS_SCOPES
    const roleScopes = scopesForOperatorRole(link.roleSlug, input.accessCatalog) ?? fullAccessScopes
    return {
      organizationId: link.platformOrganizationId,
      scopes: isFullAccessRole(link.roleSlug) ? roleScopes : (link.scopes ?? roleScopes),
    }
  }

  // Local deployments have no staff organization context. Preserve the
  // existing profile-permission lookup and full-access compatibility fallback.
  const [profile] = await input.db
    .select({ permissions: userProfilesTable.permissions })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.id, input.userId))
    .limit(1)
  return {
    organizationId: null,
    scopes: profile?.permissions ?? FULL_ACCESS_SCOPES,
  }
}
