import { definePort } from "@voyant-travel/core/project"

import type { CloudAdminMembersConfig } from "./cloud-broker.js"

export interface IdentityAccessDeploymentConfig {
  appUrl: string
  authMode: "local" | "voyant-cloud"
  cloudAdminMembers: CloudAdminMembersConfig | null
}

export interface IdentityAccessInvitationEmail {
  acceptUrl: string
  expiresInHours: number
  to: string
}

/** Deployment capabilities consumed by the package-owned identity/access routes. */
export interface IdentityAccessRuntimeProvider {
  resolveDeployment(bindings: Record<string, unknown>): IdentityAccessDeploymentConfig
  sendInvitationEmail(
    bindings: Record<string, unknown>,
    message: IdentityAccessInvitationEmail,
  ): Promise<boolean>
}

export const identityAccessRuntimePort = definePort<IdentityAccessRuntimeProvider>({
  id: "auth.identity-access-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("auth.identity-access-runtime provider must be an object.")
    }
    for (const method of ["resolveDeployment", "sendInvitationEmail"] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`auth.identity-access-runtime provider must implement ${method}().`)
      }
    }
  },
})
