import { cloudAdminMembersConfigFromRevalidate } from "./cloud-broker.js"
import {
  type IdentityAccessRuntimeProvider,
  identityAccessRuntimePort,
} from "./identity-access-runtime-port.js"

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
  capabilities: {
    resolveNotificationProviders(
      bindings: Record<string, unknown>,
    ): ReadonlyArray<InvitationNotificationProvider>
  }
}

/** Package-owned registration map for Auth deployment adapters. */
export function createAuthRuntimePortContribution(
  host: AuthRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const identityAccess: IdentityAccessRuntimeProvider = {
    resolveDeployment(bindings) {
      const env = bindings as Record<string, string | undefined>
      const appUrl = (env.APP_URL || env.DASH_BASE_URL || "http://localhost:3300")
        .trim()
        .replace(/\/$/, "")
      const deploymentId = env.VOYANT_CLOUD_DEPLOYMENT_ID?.trim()
      const revalidateUrl = env.VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL?.trim()
      const clientToken = env.VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN?.trim()
      return {
        appUrl,
        authMode: env.VOYANT_ADMIN_AUTH_MODE?.trim() === "voyant-cloud" ? "voyant-cloud" : "local",
        cloudAdminMembers:
          deploymentId && revalidateUrl && clientToken
            ? cloudAdminMembersConfigFromRevalidate({ revalidateUrl, deploymentId, clientToken })
            : null,
      }
    },
    async sendInvitationEmail(bindings, message) {
      const provider = host.capabilities
        .resolveNotificationProviders(bindings)
        .find((candidate) => candidate.channels.includes("email"))
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

  return { [identityAccessRuntimePort.id]: identityAccess }
}
