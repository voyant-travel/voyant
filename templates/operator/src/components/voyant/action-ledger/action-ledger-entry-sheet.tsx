"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  ActionLedgerEntryDetailResponse,
  ActionLedgerEntryResponse,
  ActionLedgerGetResponse,
} from "@voyantjs/action-ledger"
import { Badge } from "@voyantjs/ui/components/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components/sheet"
import { Eye, KeyRound, ScrollText, ShieldCheck } from "lucide-react"
import type { ReactNode } from "react"

import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

type LedgerBadgeVariant = "default" | "secondary" | "outline" | "destructive"

const STATUS_VARIANT: Partial<Record<ActionLedgerEntryResponse["status"], LedgerBadgeVariant>> = {
  succeeded: "default",
  approved: "default",
  awaiting_approval: "secondary",
  requested: "secondary",
  denied: "destructive",
  failed: "destructive",
  expired: "destructive",
  cancelled: "destructive",
  superseded: "outline",
  reversed: "outline",
  compensated: "outline",
}

const RISK_VARIANT: Partial<
  Record<ActionLedgerEntryResponse["evaluatedRisk"], LedgerBadgeVariant>
> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
}

export function ActionLedgerEntrySheet({
  open,
  onOpenChange,
  entryId,
  locale,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entryId: string | null
  locale: string
}) {
  const entryDetailQuery = useQuery({
    queryKey: queryKeys.actionLedger.entry(entryId ?? ""),
    queryFn: () => getActionLedgerEntry(entryId ?? ""),
    enabled: open && Boolean(entryId),
  })
  const entry = entryDetailQuery.data?.data ?? null
  const isLoading = entryDetailQuery.isLoading || entryDetailQuery.isFetching

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Action details</SheetTitle>
          <SheetDescription>
            Ledger context, idempotency, mutation detail, sensitive-read detail, and relay state.
          </SheetDescription>
          {entry ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={RISK_VARIANT[entry.evaluatedRisk] ?? "outline"}>
                {entry.evaluatedRisk}
              </Badge>
              <Badge variant={STATUS_VARIANT[entry.status] ?? "outline"}>{entry.status}</Badge>
              <span className="font-mono text-muted-foreground text-xs">{entry.id}</span>
            </div>
          ) : null}
        </SheetHeader>
        <div className="h-[calc(100vh-9rem)] overflow-auto px-6 py-5">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading action details...</p>
          ) : entry ? (
            <ActionLedgerEntryDetail entry={entry} locale={locale} />
          ) : (
            <p className="text-muted-foreground text-sm">Action ledger entry not found.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ActionLedgerEntryDetail({
  entry,
  locale,
}: {
  entry: ActionLedgerEntryDetailResponse
  locale: string
}) {
  return (
    <div className="space-y-6">
      <DetailGrid>
        <DetailField label="When" value={formatDateTime(entry.occurredAt, locale)} />
        <DetailField label="Action" value={entry.actionName} />
        <DetailField label="Version" value={entry.actionVersion} />
        <DetailField label="Kind" value={entry.actionKind} />
        <DetailField label="Route or tool" value={entry.routeOrToolName} />
        <DetailField label="Authorization" value={entry.authorizationSource} />
      </DetailGrid>

      <DetailSection title="Actor" icon={<ShieldCheck className="h-4 w-4" />}>
        <DetailGrid>
          <DetailField label="Principal type" value={entry.principalType} />
          <DetailField label="Principal ID" value={entry.principalId} mono />
          <DetailField label="Actor type" value={entry.actorType} />
          <DetailField label="Caller type" value={entry.callerType} />
          <DetailField label="Session ID" value={entry.sessionId} mono />
          <DetailField label="API token" value={entry.apiTokenId} mono />
          <DetailField label="Organization" value={entry.organizationId} mono />
          <DetailField label="Internal" value={entry.internalRequest ? "yes" : "no"} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Target And Flow" icon={<ScrollText className="h-4 w-4" />}>
        <DetailGrid>
          <DetailField label="Target type" value={entry.targetType} />
          <DetailField label="Target ID" value={entry.targetId} mono />
          <DetailField label="Workflow run" value={entry.workflowRunId} mono />
          <DetailField label="Workflow step" value={entry.workflowStepId} mono />
          <DetailField label="Correlation" value={entry.correlationId} mono />
          <DetailField label="Causation action" value={entry.causationActionId} mono />
          <DetailField label="Capability" value={entry.capabilityId} mono />
          <DetailField label="Capability version" value={entry.capabilityVersion} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Idempotency" icon={<KeyRound className="h-4 w-4" />}>
        <DetailGrid>
          <DetailField label="Scope" value={entry.idempotencyScope} mono />
          <DetailField label="Key" value={entry.idempotencyKey} mono />
          <DetailField label="Fingerprint" value={entry.idempotencyFingerprint} mono />
        </DetailGrid>
      </DetailSection>

      {entry.mutationDetail ? <MutationDetail entry={entry} /> : null}
      {entry.sensitiveReadDetail ? <SensitiveReadDetail entry={entry} /> : null}
      <PayloadRefs entry={entry} />
      <RelayRows entry={entry} />
    </div>
  )
}

function MutationDetail({ entry }: { entry: ActionLedgerEntryDetailResponse }) {
  const detail = entry.mutationDetail
  if (!detail) return null

  return (
    <DetailSection title="Mutation" icon={<ScrollText className="h-4 w-4" />}>
      <DetailGrid>
        <DetailField label="Summary" value={detail.summary} />
        <DetailField label="Input ref" value={detail.commandInputRef} mono />
        <DetailField label="Result ref" value={detail.commandResultRef} mono />
        <DetailField label="Reversal kind" value={detail.reversalKind} />
        <DetailField label="Reversal state" value={detail.reversalStateProjection} />
        <DetailField label="Reverses" value={detail.reversesActionId} mono />
      </DetailGrid>
    </DetailSection>
  )
}

function SensitiveReadDetail({ entry }: { entry: ActionLedgerEntryDetailResponse }) {
  const detail = entry.sensitiveReadDetail
  if (!detail) return null

  return (
    <DetailSection title="Sensitive Read" icon={<Eye className="h-4 w-4" />}>
      <DetailGrid>
        <DetailField label="Reason" value={detail.reasonCode} />
        <DetailField label="Decision policy" value={detail.decisionPolicy} />
        <DetailField label="Disclosure" value={detail.disclosureSummary} />
        <DetailField label="Fields" value={detail.disclosedFieldSet?.join(", ")} />
      </DetailGrid>
    </DetailSection>
  )
}

function PayloadRefs({ entry }: { entry: ActionLedgerEntryDetailResponse }) {
  return (
    <DetailSection title="Payloads" icon={<ScrollText className="h-4 w-4" />}>
      {entry.payloads.length === 0 ? (
        <p className="text-muted-foreground text-sm">No payload refs recorded.</p>
      ) : (
        <div className="space-y-3">
          {entry.payloads.map((payload) => (
            <DetailGrid key={payload.id}>
              <DetailField label="Kind" value={payload.payloadKind} />
              <DetailField label="Schema" value={payload.schemaTag} />
              <DetailField label="Storage ref" value={payload.storageRef} mono />
              <DetailField label="Redaction" value={payload.redactionStatus} />
              <DetailField label="Retention" value={payload.retentionPolicy} />
              <DetailField label="Hash" value={payload.hash} mono />
            </DetailGrid>
          ))}
        </div>
      )}
    </DetailSection>
  )
}

function RelayRows({ entry }: { entry: ActionLedgerEntryDetailResponse }) {
  return (
    <DetailSection title="Relay Outbox" icon={<ScrollText className="h-4 w-4" />}>
      {entry.relayOutbox.length === 0 ? (
        <p className="text-muted-foreground text-sm">No relay rows recorded.</p>
      ) : (
        <div className="space-y-3">
          {entry.relayOutbox.map((row) => (
            <DetailGrid key={row.id}>
              <DetailField label="Status" value={row.relayStatus} />
              <DetailField label="Payload ref" value={row.payloadRef} mono />
              <DetailField label="Attempts" value={String(row.attemptCount)} />
              <DetailField label="Next retry" value={row.nextRetryAt} />
              <DetailField label="Processed" value={row.processedAt} />
              <DetailField label="Last error" value={row.lastError} />
            </DetailGrid>
          ))}
        </div>
      )}
    </DetailSection>
  )
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-medium text-sm">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={`mt-1 min-h-5 truncate text-sm ${mono ? "font-mono text-xs" : "font-medium"}`}
        title={value ?? "-"}
      >
        {value || "-"}
      </div>
    </div>
  )
}

async function getActionLedgerEntry(id: string): Promise<ActionLedgerGetResponse> {
  return api.get<ActionLedgerGetResponse>(`/v1/admin/action-ledger/entries/${id}`)
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
