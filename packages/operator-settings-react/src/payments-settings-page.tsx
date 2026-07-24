"use client"

/**
 * Settings → Payments (source-free, package-delivered).
 *
 * Lists the first-party payment processors an operator can connect and lets
 * them connect/disconnect one (single active provider per org). Talks to the
 * `@voyant-travel/operator-settings` routes at `/v1/admin/settings/payments/*`.
 *
 * Managed deployments connect in-app (credentials are brokered to the
 * voyant-cloud control plane, never stored in the Operator). Self-host
 * deployments pin their processor via environment variables, so the page
 * renders a read-only status. See
 * `docs/adr/0015-payment-adapter-transports-and-managed-connect.md`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useOperatorAdminMessages } from "@voyant-travel/admin/providers/operator-admin-messages"
import { useVoyantReactContext } from "@voyant-travel/react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from "@voyant-travel/ui/components"
import { CreditCard, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type ProviderMode = "sandbox" | "test" | "live"

interface CredentialField {
  key: string
  label: string
  kind: "text" | "secret" | "boolean" | "select"
  required: boolean
  placeholder?: string
  helpText?: string
  options?: { value: string; label: string }[]
}

interface ProviderDescriptor {
  id: string
  displayName: string
  description: string
  credentialFieldSchema: CredentialField[]
  availability: "available" | "coming_soon"
  modes: ProviderMode[]
}

interface ConnectionStatus {
  activeProviderId: string | null
  status: "disconnected" | "connected" | "error"
  mode: ProviderMode | null
  lastError?: string | null
  readOnly?: boolean
}

interface ConnectResult {
  ok: boolean
  status: ConnectionStatus
  error?: string
}

const PROVIDERS_KEY = ["payment-providers"]
const CONNECTION_KEY = ["payment-connection"]

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown
    message?: unknown
  } | null
  if (typeof body?.error === "string" && body.error.trim()) return body.error
  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message
  }
  return fallback
}

export function PaymentsSettingsPage() {
  const queryClient = useQueryClient()
  const { baseUrl, fetcher } = useVoyantReactContext()
  const t = useOperatorAdminMessages().settings.paymentsPage

  const providersQuery = useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: async (): Promise<ProviderDescriptor[]> => {
      const res = await fetcher(`${baseUrl}/v1/admin/settings/payments/providers`)
      if (!res.ok) throw new Error(t.loadFailed)
      return ((await res.json()) as { data: ProviderDescriptor[] }).data
    },
  })

  const connectionQuery = useQuery({
    queryKey: CONNECTION_KEY,
    queryFn: async (): Promise<ConnectionStatus> => {
      const res = await fetcher(`${baseUrl}/v1/admin/settings/payments`)
      if (!res.ok) throw new Error(t.loadFailed)
      return ((await res.json()) as { data: ConnectionStatus }).data
    },
  })

  const [dialogProvider, setDialogProvider] = useState<ProviderDescriptor | null>(null)
  const [credentials, setCredentials] = useState<Record<string, unknown>>({})
  const [mode, setMode] = useState<ProviderMode>("sandbox")

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: CONNECTION_KEY })
  }

  const connect = useMutation({
    mutationFn: async (provider: ProviderDescriptor): Promise<ConnectResult> => {
      const res = await fetcher(`${baseUrl}/v1/admin/settings/payments/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: provider.id, mode, credentials }),
      })
      if (!res.ok) throw new Error(await responseError(res, t.connectFailed))
      return ((await res.json()) as { data: ConnectResult }).data
    },
    onSuccess: (result, provider) => {
      if (result.ok) {
        toast.success(t.connectedToast.replace("{provider}", provider.displayName))
        setDialogProvider(null)
        setCredentials({})
        invalidate()
      } else {
        toast.error(result.error ?? t.connectFailed)
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t.connectFailed),
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetcher(`${baseUrl}/v1/admin/settings/payments/disconnect`, {
        method: "POST",
      })
      if (!res.ok) throw new Error(await responseError(res, t.connectFailed))
    },
    onSuccess: () => {
      toast.success(t.disconnectedToast)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t.connectFailed),
  })

  if (providersQuery.isPending || connectionQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const connection = connectionQuery.data
  const providers = providersQuery.data ?? []
  const activeId = connection?.activeProviderId ?? null

  const openConnect = (provider: ProviderDescriptor) => {
    setDialogProvider(provider)
    setCredentials({})
    setMode(provider.modes.includes("sandbox") ? "sandbox" : (provider.modes[0] ?? "live"))
  }

  const statusLabel =
    connection?.status === "connected"
      ? t.connected
      : connection?.status === "error"
        ? t.connectionError
        : t.disconnected

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </header>

      {connection?.readOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.activeProvider}</CardTitle>
            <CardDescription>{t.configuredViaEnv}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">
                {providers.find((p) => p.id === activeId)?.displayName ?? activeId ?? statusLabel}
              </span>
              {activeId ? <Badge variant="secondary">{statusLabel}</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">{t.configuredViaEnvHint}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {connection?.status === "connected" && activeId ? (
            <Card>
              <CardHeader>
                <CardTitle>{t.activeProvider}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">
                    {providers.find((p) => p.id === activeId)?.displayName ?? activeId}
                  </span>
                  <Badge>{t.connected}</Badge>
                  {connection.mode ? (
                    <Badge variant="outline">
                      {connection.mode === "live" ? t.modeLive : t.modeSandbox}
                    </Badge>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  {disconnect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t.disconnect}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t.availableProviders}</h2>
            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.empty}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((provider) => {
                  const isActive = provider.id === activeId
                  const isComingSoon = provider.availability === "coming_soon"
                  return (
                    <Card key={provider.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{provider.displayName}</CardTitle>
                          {isComingSoon ? (
                            <Badge variant="secondary">{t.comingSoon}</Badge>
                          ) : isActive ? (
                            <Badge>{t.connected}</Badge>
                          ) : null}
                        </div>
                        <CardDescription>{provider.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          size="sm"
                          variant={isActive ? "outline" : "default"}
                          disabled={isComingSoon || isActive}
                          onClick={() => openConnect(provider)}
                        >
                          {t.connect}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      <Dialog
        open={dialogProvider !== null}
        onOpenChange={(open) => {
          if (!open) setDialogProvider(null)
        }}
      >
        <DialogContent>
          {dialogProvider ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t.credentialsTitle.replace("{provider}", dialogProvider.displayName)}
                </DialogTitle>
                <DialogDescription>
                  {t.credentialsDescription.replace("{provider}", dialogProvider.displayName)}
                </DialogDescription>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  connect.mutate(dialogProvider)
                }}
              >
                {dialogProvider.modes.length > 1 ? (
                  <div className="space-y-1">
                    <Label htmlFor="pay-mode">{t.modeLabel}</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{t.modeSandbox}</span>
                      <Switch
                        id="pay-mode"
                        checked={mode === "live"}
                        onCheckedChange={(checked) => setMode(checked ? "live" : "sandbox")}
                      />
                      <span className="text-sm">{t.modeLive}</span>
                    </div>
                  </div>
                ) : null}

                {dialogProvider.credentialFieldSchema.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`pay-${field.key}`}>{field.label}</Label>
                    {field.kind === "boolean" ? (
                      <Switch
                        id={`pay-${field.key}`}
                        checked={Boolean(credentials[field.key])}
                        onCheckedChange={(checked) =>
                          setCredentials((prev) => ({ ...prev, [field.key]: checked }))
                        }
                      />
                    ) : field.kind === "select" ? (
                      <select
                        id={`pay-${field.key}`}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={String(credentials[field.key] ?? "")}
                        onChange={(e) =>
                          setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      >
                        <option value="" />
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`pay-${field.key}`}
                        type={field.kind === "secret" ? "password" : "text"}
                        autoComplete="off"
                        placeholder={field.placeholder}
                        value={String(credentials[field.key] ?? "")}
                        onChange={(e) =>
                          setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                    )}
                    {field.helpText ? (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    ) : null}
                  </div>
                ))}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogProvider(null)}>
                    {t.cancel}
                  </Button>
                  <Button type="submit" disabled={connect.isPending}>
                    {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t.connect}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
