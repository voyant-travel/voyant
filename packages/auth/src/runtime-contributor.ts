import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { cloudAdminMembersConfigFromRevalidate } from "./cloud-broker.js"
import {
  type IdentityAccessRuntimeProvider,
  identityAccessRuntimePort,
} from "./identity-access-runtime-port.js"
import { createCloudTeamManagementAdapter } from "./team-management-cloud-adapter.js"
import { createLocalTeamManagementAdapter } from "./team-management-local-adapter.js"
import { createGuardedTeamManagementProvider } from "./team-management-policy.js"
import { teamManagementRuntimePort } from "./team-management-runtime-port.js"

interface InvitationNotificationProvider {
  readonly channels: ReadonlyArray<string>
  send(payload: {
    channel: "email"
    to: string
    template: string
    subject: string
    html: string
  }): Promise<unknown>
}

export interface AuthRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

function selectedAdminAuthProvider(host: AuthRuntimeContributorHost, bindings: unknown): unknown {
  return host.primitives.config.read(bindings, "deployment.providers.adminAuth")
}

/** Package-owned registration map for Auth deployment adapters. */
export function createAuthRuntimePortContribution(
  host: AuthRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const identityAccess: IdentityAccessRuntimeProvider = {
    resolveDeployment(bindings) {
      const env = bindings as Record<string, string | undefined>
      const selectedAuthProvider = selectedAdminAuthProvider(host, bindings)
      if (selectedAuthProvider !== "better-auth" && selectedAuthProvider !== "voyant-cloud") {
        throw new Error(
          "Auth runtime requires deployment.providers.adminAuth to select better-auth or voyant-cloud.",
        )
      }
      const appUrl = (env.APP_URL || env.DASH_BASE_URL || "http://localhost:3300")
        .trim()
        .replace(/\/$/, "")
      const deploymentId = env.VOYANT_CLOUD_DEPLOYMENT_ID?.trim()
      const revalidateUrl = env.VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL?.trim()
      const clientToken = env.VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN?.trim()
      return {
        appUrl,
        authMode: selectedAuthProvider === "voyant-cloud" ? "voyant-cloud" : "local",
        cloudAdminMembers:
          deploymentId && revalidateUrl && clientToken
            ? cloudAdminMembersConfigFromRevalidate({ revalidateUrl, deploymentId, clientToken })
            : null,
      }
    },
    async sendInvitationEmail(bindings, message) {
      const resolver = host.primitives.config.read(bindings, "notificationProviders")
      const providers =
        typeof resolver === "function"
          ? (resolver(
              host.primitives.env(bindings),
            ) as ReadonlyArray<InvitationNotificationProvider>)
          : []
      const provider = providers.find((candidate) => candidate.channels.includes("email"))
      if (!provider) return false
      try {
        await provider.send({
          channel: "email",
          to: message.to,
          template: "auth.invitation",
          subject: "You've been invited to Voyant",
          html: `<p>You've been invited to join a Voyant workspace.</p><p><a href="${message.acceptUrl}">Accept invitation</a></p><p>The link expires in ${message.expiresInHours} hours.</p>`,
        })
        return true
      } catch (error) {
        console.error("[invitations] email send failed:", error)
        return false
      }
    },
  }

  const localTeamManagement = createLocalTeamManagementAdapter(identityAccess)
  const cloudTeamManagement = createCloudTeamManagementAdapter(identityAccess)
  const teamManagement = createGuardedTeamManagementProvider((context) => {
    const selectedAuthProvider = selectedAdminAuthProvider(host, context.bindings)
    if (selectedAuthProvider === "better-auth") return localTeamManagement
    if (selectedAuthProvider === "voyant-cloud") return cloudTeamManagement
    throw new Error(
      "Team management requires deployment.providers.adminAuth to select better-auth or voyant-cloud.",
    )
  })

  return {
    [identityAccessRuntimePort.id]: identityAccess,
    [teamManagementRuntimePort.id]: teamManagement,
  }
}
