import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { RedeemInvitationPage, type RedeemInvitationStatus } from "@voyant-travel/auth-react/ui"
import { z } from "zod"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { authClient } from "@/lib/auth"

export const Route = createFileRoute("/(auth)/accept-invite")({
  validateSearch: z.object({ token: z.string().min(1) }),
  component: AcceptInviteRoute,
})

function AcceptInviteRoute() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const messages = useAdminMessages().auth.acceptInvite
  const invitation = useQuery<RedeemInvitationStatus>({
    queryKey: ["invitation", token],
    queryFn: async () => {
      try {
        return await api.get<RedeemInvitationStatus>(
          `/v1/public/invitations/${encodeURIComponent(token)}`,
        )
      } catch (error) {
        if (
          error instanceof Error &&
          "status" in error &&
          (error.status === 404 || error.status === 410)
        ) {
          return { valid: false }
        }
        throw error
      }
    },
    retry: false,
  })
  const redeem = useMutation({
    mutationFn: async ({ name, password }: { name: string; password: string }) => {
      await api.post(`/v1/public/invitations/${encodeURIComponent(token)}/redeem`, {
        name,
        password,
      })
      const email = invitation.data?.valid ? invitation.data.email : ""
      const result = await authClient.signIn.email({ email, password })
      if (result.error) {
        throw new Error(result.error.message ?? messages.signInAfterRedeemFailed)
      }
    },
    onSuccess: () => void navigate({ to: "/" }),
  })

  return (
    <RedeemInvitationPage
      invitation={invitation.data}
      isLoading={invitation.isPending}
      isSubmitting={redeem.isPending}
      messages={messages}
      onRedeem={(input) => redeem.mutateAsync(input)}
    />
  )
}
