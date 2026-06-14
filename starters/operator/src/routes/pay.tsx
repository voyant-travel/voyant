import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { z } from "zod"

import { getApiUrl } from "@/lib/env"

/**
 * Public landing for processor redirects that don't carry our session id
 * in the path. Pay-by-link processors (Netopia, etc.) append the order
 * reference they were given when the session was started — that may be
 * the canonical session id, or it may be a `clientReference` /
 * `externalReference` chosen by the operator (e.g. flight order id,
 * booking number).
 *
 * Set `NETOPIA_REDIRECT_URL=${APP_URL}/pay`; this route resolves whichever
 * key the processor returned to the canonical session id via the
 * `/v1/public/payment-link/resolve` endpoint, then forwards to
 * `/pay/$sessionId` for the real status page.
 */
const searchSchema = z.object({
  orderID: z.string().optional(),
  orderId: z.string().optional(),
  sessionId: z.string().optional(),
})

export const Route = createFileRoute("/pay")({
  validateSearch: searchSchema,
  component: PayLandingResolver,
})

interface ResolveResponse {
  data?: { sessionId: string }
  error?: string
}

function PayLandingResolver() {
  const { orderID, orderId, sessionId } = Route.useSearch()
  const ref = orderID ?? orderId ?? sessionId ?? null

  const resolveQuery = useQuery({
    queryKey: ["payment-link-resolve", ref],
    enabled: Boolean(ref),
    retry: false,
    queryFn: async (): Promise<{ sessionId: string }> => {
      const res = await fetch(
        `${getApiUrl()}/v1/public/payment-link/resolve?ref=${encodeURIComponent(ref ?? "")}`,
        { headers: { Accept: "application/json" } },
      )
      const body = (await res.json()) as ResolveResponse
      if (!res.ok || !body.data) {
        throw new Error(body.error ?? `resolve failed: ${res.status}`)
      }
      return body.data
    },
  })

  if (!ref) {
    return (
      <FallbackPanel
        title="Payment link missing identifier"
        body="The link you followed didn't include a payment reference. Please contact your travel agent for a fresh link."
      />
    )
  }

  if (resolveQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <h1 className="font-semibold text-xl">Looking up your payment…</h1>
      </div>
    )
  }

  if (resolveQuery.error || !resolveQuery.data) {
    return (
      <FallbackPanel
        title="Payment link not found"
        body="This payment link is invalid or has been removed. Please contact your travel agent for a fresh link."
      />
    )
  }

  return (
    <Navigate to="/pay/$sessionId" params={{ sessionId: resolveQuery.data.sessionId }} replace />
  )
}

function FallbackPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <h1 className="font-semibold text-xl">{title}</h1>
      <p className="max-w-md text-muted-foreground text-sm">{body}</p>
    </div>
  )
}
