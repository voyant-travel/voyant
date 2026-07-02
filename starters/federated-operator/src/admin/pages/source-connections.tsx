import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components/card"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@voyant-travel/ui/components/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { Textarea } from "@voyant-travel/ui/components/textarea"
import { Pause, Play, Plus, RefreshCw, Unplug } from "lucide-react"
import { type FormEvent, useMemo, useState } from "react"
import {
  emptyToNull,
  fetchSourceConnections,
  initialDraft,
  postJson,
  type SourceConnectionDetailResponse,
  type SourceConnectionHealth,
  type SourceConnectionMode,
  type SourceConnectionStatus,
  sourceConnectionsKey,
  splitList,
} from "./source-connections-api"

function statusVariant(status: SourceConnectionStatus) {
  if (status === "active") return "default"
  if (status === "degraded" || status === "disconnecting") return "destructive"
  if (status === "disconnected") return "outline"
  return "secondary"
}

function healthVariant(status: SourceConnectionHealth) {
  if (status === "healthy") return "default"
  if (status === "degraded" || status === "failing") return "destructive"
  return "secondary"
}

function formatDate(value: string | null) {
  if (!value) return "Unknown"
  return new Date(value).toLocaleString()
}

function JsonSummary({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">None</span>
  return (
    <pre className="max-h-44 overflow-auto rounded-sm border bg-muted/40 p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function SourceConnectionsPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(initialDraft)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const connections = useQuery({
    queryKey: sourceConnectionsKey,
    queryFn: fetchSourceConnections,
  })

  const selectedConnection = useMemo(() => {
    const rows = connections.data?.data ?? []
    return rows.find((row) => row.id === selectedId) ?? rows[0] ?? null
  }, [connections.data, selectedId])

  const createConnection = useMutation({
    mutationFn: async () =>
      postJson<SourceConnectionDetailResponse>("/v1/admin/source-connections", {
        displayName: draft.displayName,
        sourceKind: draft.sourceKind,
        capabilityScope: draft.capabilityScope,
        sourceOfTruthMode: draft.sourceOfTruthMode,
        credentialRef: emptyToNull(draft.credentialRef),
        sourceAccountId: emptyToNull(draft.sourceAccountId),
        grantedScopes: splitList(draft.grantedScopes),
        capabilities: splitList(draft.capabilities).map((capability) => ({
          capability,
          state: "supported",
        })),
      }),
    onSuccess: async (result) => {
      setSelectedId(result.data.id)
      setDraft(initialDraft)
      await queryClient.invalidateQueries({ queryKey: sourceConnectionsKey })
    },
  })

  const transitionConnection = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string
      action: "pause" | "resume" | "disconnect"
    }) => {
      const body =
        action === "pause"
          ? { reason: "Paused from federated operator" }
          : action === "disconnect"
            ? {
                reason: "Disconnected from federated operator",
                disconnectBehavior: [
                  "stop future sync only",
                  "preserve published projections as stale",
                ],
              }
            : {}
      return postJson<SourceConnectionDetailResponse>(
        `/v1/admin/source-connections/${id}/${action}`,
        body,
      )
    },
    onSuccess: async (result) => {
      setSelectedId(result.data.id)
      await queryClient.invalidateQueries({ queryKey: sourceConnectionsKey })
    },
  })

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createConnection.mutate()
  }

  const pending = createConnection.isPending || transitionConnection.isPending

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Source connections</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            External systems connected to the federated operating layer.
          </p>
        </div>
        <Button variant="outline" onClick={() => void connections.refetch()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create draft connection</CardTitle>
          <CardDescription>
            Register the source before wiring a sync daemon or adapter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-4" onSubmit={submitDraft}>
            <div className="space-y-2">
              <Label htmlFor="source-display-name">Name</Label>
              <Input
                id="source-display-name"
                value={draft.displayName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="HubSpot production"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-kind">Source kind</Label>
              <Input
                id="source-kind"
                value={draft.sourceKind}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sourceKind: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capability-scope">Capability scope</Label>
              <Input
                id="capability-scope"
                value={draft.capabilityScope}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, capabilityScope: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="truth-mode">Truth mode</Label>
              <NativeSelect
                id="truth-mode"
                className="w-full"
                value={draft.sourceOfTruthMode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sourceOfTruthMode: event.target.value as SourceConnectionMode,
                  }))
                }
              >
                <NativeSelectOption value="mirrored">Mirrored</NativeSelectOption>
                <NativeSelectOption value="external-live">External live</NativeSelectOption>
                <NativeSelectOption value="hybrid">Hybrid</NativeSelectOption>
                <NativeSelectOption value="native">Native</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="credential-ref">Credential reference</Label>
              <Input
                id="credential-ref"
                value={draft.credentialRef}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, credentialRef: event.target.value }))
                }
                placeholder="secret://source-connections/hubspot-prod"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-account-id">Source account</Label>
              <Input
                id="source-account-id"
                value={draft.sourceAccountId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sourceAccountId: event.target.value }))
                }
                placeholder="portal or tenant id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="granted-scopes">Granted scopes</Label>
              <Input
                id="granted-scopes"
                value={draft.grantedScopes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, grantedScopes: event.target.value }))
                }
                placeholder="crm.objects.contacts.read"
              />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="capabilities">Supported capabilities</Label>
              <Textarea
                id="capabilities"
                value={draft.capabilities}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, capabilities: event.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-3 lg:col-span-4">
              <Button type="submit" disabled={pending}>
                <Plus className="size-4" aria-hidden="true" />
                Create draft
              </Button>
              {createConnection.error ? (
                <span className="text-destructive text-sm">{createConnection.error.message}</span>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connections</CardTitle>
            <CardDescription>
              {connections.data ? `${connections.data.total} registered` : "Loading connections"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Freshness</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(connections.data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No source connections registered.
                    </TableCell>
                  </TableRow>
                ) : (
                  connections.data?.data.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left font-medium underline-offset-4 hover:underline"
                          onClick={() => setSelectedId(connection.id)}
                        >
                          {connection.displayName}
                        </button>
                        <div className="text-muted-foreground text-xs">
                          {connection.sourceKind} · {connection.capabilityScope}
                        </div>
                      </TableCell>
                      <TableCell>{connection.sourceOfTruthMode}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(connection.status)}>
                          {connection.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={healthVariant(connection.healthStatus)}>
                          {connection.healthStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(connection.lastCheckedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              pending ||
                              connection.status === "paused" ||
                              connection.status === "disconnected"
                            }
                            onClick={() =>
                              transitionConnection.mutate({ id: connection.id, action: "pause" })
                            }
                          >
                            <Pause className="size-4" aria-hidden="true" />
                            Pause
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              pending ||
                              connection.status === "active" ||
                              connection.status === "disconnected"
                            }
                            onClick={() =>
                              transitionConnection.mutate({ id: connection.id, action: "resume" })
                            }
                          >
                            <Play className="size-4" aria-hidden="true" />
                            Resume
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={pending || connection.status === "disconnected"}
                            onClick={() =>
                              transitionConnection.mutate({
                                id: connection.id,
                                action: "disconnect",
                              })
                            }
                          >
                            <Unplug className="size-4" aria-hidden="true" />
                            Disconnect
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {transitionConnection.error ? (
              <p className="mt-3 text-destructive text-sm">{transitionConnection.error.message}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedConnection?.displayName ?? "Connection detail"}
            </CardTitle>
            <CardDescription>
              {selectedConnection
                ? `${selectedConnection.sourceKind} · ${selectedConnection.capabilityScope}`
                : "Select a connection"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {selectedConnection ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Detail label="Credential" value={selectedConnection.credentialRef ?? "None"} />
                  <Detail
                    label="Source account"
                    value={selectedConnection.sourceAccountId ?? "None"}
                  />
                  <Detail label="Updated" value={formatDate(selectedConnection.updatedAt)} />
                  <Detail
                    label="Last healthy"
                    value={formatDate(selectedConnection.lastHealthyAt)}
                  />
                </div>
                <Detail
                  label="Scopes"
                  value={selectedConnection.grantedScopes.join(", ") || "None"}
                />
                <Detail
                  label="Capabilities"
                  value={
                    selectedConnection.capabilities
                      .map((item) => `${item.capability}: ${item.state}`)
                      .join(", ") || "None"
                  }
                />
                <div className="space-y-2">
                  <div className="font-medium">Cursor state</div>
                  <JsonSummary value={selectedConnection.cursorState} />
                </div>
                <div className="space-y-2">
                  <div className="font-medium">Rate limits</div>
                  <JsonSummary value={selectedConnection.rateLimitState} />
                </div>
                {selectedConnection.disconnectReason ? (
                  <Detail label="Disconnect reason" value={selectedConnection.disconnectReason} />
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">No connection selected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="break-words">{value}</div>
    </div>
  )
}
