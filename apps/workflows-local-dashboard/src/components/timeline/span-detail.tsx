// Right-pane detail view for the selected span. Phase 4 layout:
//   - compact header (icon + label + Esc)
//   - tabs: Overview (milestones + summary) / Detail (kind-specific) /
//     Metadata (run-level metadata, shared across spans)
//
// The pane itself is a shadcn `Card`-like shell; the parent
// `RunDetailPanel` wraps it in a `ResizablePanel`.

import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Kbd } from "@voyant-travel/ui/components/kbd"
import { Separator } from "@voyant-travel/ui/components/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Clock, Code2, FileText, type LucideIcon, RotateCcw, Waves, X, Zap } from "lucide-react"

import type { StoredRun } from "@/lib/api"
import { formatDuration } from "@/lib/utils"
import { type Milestone, SpanMilestones } from "./span-milestones"
import type { Span, SpanKind } from "./timeline-types"

const ICON: Record<SpanKind, LucideIcon> = {
  run: Zap,
  step: Code2,
  waitpoint: Clock,
  log: FileText,
  stream: Waves,
  compensation: RotateCcw,
}

export function SpanDetailPane({
  span,
  run,
  onClose,
  showCloseButton,
}: {
  span: Span
  run: StoredRun
  onClose: () => void
  showCloseButton: boolean
}): React.ReactElement {
  const Icon = ICON[span.kind]
  const hasMetadata =
    run.result.metadata !== undefined && Object.keys(run.result.metadata).length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Icon className="size-4 shrink-0" />
        <span className="truncate font-mono text-xs">{span.label}</span>
        {span.sublabel && (
          <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
            {span.sublabel}
          </Badge>
        )}
        {showCloseButton && (
          <div className="ml-auto flex items-center gap-2">
            <Kbd className="text-[10px]">Esc</Kbd>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-7"
              aria-label="Close detail"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </header>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 h-8 self-start" variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detail">Detail</TabsTrigger>
          <TabsTrigger value="metadata" disabled={!hasMetadata}>
            Metadata
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <TabsContent value="overview" className="mt-0 space-y-5">
            <Overview span={span} run={run} />
          </TabsContent>

          <TabsContent value="detail" className="mt-0 space-y-4">
            <DetailBody span={span} run={run} />
          </TabsContent>

          <TabsContent value="metadata" className="mt-0">
            {hasMetadata ? (
              <JsonBlock value={run.result.metadata} />
            ) : (
              <EmptyTabMessage message="This run has no metadata." />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// ---- Overview tab ----

function Overview({ span, run }: { span: Span; run: StoredRun }): React.ReactElement {
  const milestones = overviewMilestones(span, run)
  const endAt = span.endAt ?? Date.now()
  const duration = endAt - span.at
  const isInstant = span.at === span.endAt || span.kind === "log" || span.kind === "stream"

  return (
    <>
      <section>
        <SectionLabel>Timeline</SectionLabel>
        <SpanMilestones milestones={milestones} />
        {!isInstant && (
          <div className="text-muted-foreground mt-2 font-mono text-[11px]">
            {span.endAt === undefined ? "running · " : "total · "}
            <span className="text-foreground tabular-nums">{formatDuration(duration)}</span>
          </div>
        )}
      </section>

      <Separator />

      <section>
        <OverviewSummary span={span} run={run} />
      </section>
    </>
  )
}

function overviewMilestones(span: Span, run: StoredRun): Milestone[] {
  if (span.detail.kind === "run") {
    const completed = run.completedAt !== undefined
    return [
      { label: "Triggered", at: run.startedAt, tone: "ok" },
      {
        label: "Finished",
        at: run.completedAt,
        tone: completed
          ? run.status === "failed" || run.status === "compensation_failed"
            ? "err"
            : "ok"
          : "pending",
      },
    ]
  }
  if (span.detail.kind === "step") {
    return [
      { label: "Started", at: span.at, tone: "ok" },
      {
        label: span.status === "err" ? "Failed" : "Finished",
        at: span.endAt,
        tone: span.status === "err" ? "err" : span.endAt ? "ok" : "pending",
      },
    ]
  }
  if (span.detail.kind === "waitpoint") {
    return [
      { label: "Registered", at: span.at, tone: "ok" },
      {
        label:
          span.status === "resolved" ? "Resolved" : span.status === "err" ? "Errored" : "Pending",
        at: span.endAt,
        tone: span.status === "resolved" ? "ok" : span.status === "err" ? "err" : "pending",
      },
    ]
  }
  // log / stream / compensation — a single instant
  return [{ label: "Emitted", at: span.at, tone: "ok" }]
}

function OverviewSummary({ span, run }: { span: Span; run: StoredRun }): React.ReactElement {
  const d = span.detail
  if (d.kind === "run") {
    return <InputOutput input={run.input} output={d.output} error={d.error} />
  }
  if (d.kind === "step") {
    return <InputOutput input={undefined} output={d.output} error={d.error} />
  }
  if (d.kind === "waitpoint") {
    return (
      <div className="space-y-3">
        <KeyVals
          rows={[
            ["Kind", d.waitpointKind],
            ["ID", d.waitpointId],
          ]}
        />
        {d.payload !== undefined && (
          <Field label="Resolution payload">
            <JsonBlock value={d.payload} />
          </Field>
        )}
      </div>
    )
  }
  if (d.kind === "log") {
    return (
      <div className="space-y-3">
        <KeyVals rows={[["Level", d.level], ...(d.stepId ? [["Step", d.stepId] as const] : [])]} />
        <Field label="Message">
          <TextBlock>{d.message}</TextBlock>
        </Field>
      </div>
    )
  }
  if (d.kind === "stream") {
    return (
      <div className="space-y-3">
        <KeyVals
          rows={[
            ["Stream", d.streamId],
            ["Seq", String(d.seq)],
            ["Encoding", d.encoding],
          ]}
        />
        <Field label="Chunk">
          {d.encoding === "json" ? (
            <JsonBlock value={d.chunk} />
          ) : (
            <TextBlock>{String(d.chunk)}</TextBlock>
          )}
        </Field>
      </div>
    )
  }
  // compensation
  return (
    <KeyVals
      rows={[
        ["Step", d.stepId],
        ["Status", d.status],
        ...(d.error ? [["Error", d.error.message] as const] : []),
      ]}
    />
  )
}

// ---- Detail tab ----

function DetailBody({ span, run }: { span: Span; run: StoredRun }): React.ReactElement {
  const d = span.detail
  if (d.kind === "run") {
    return (
      <>
        <Field label="Run">
          <KeyVals
            rows={[
              ["id", run.id],
              ["workflow", run.workflowId],
              ["status", run.status],
              ...(run.tags && run.tags.length > 0 ? [["tags", run.tags.join(", ")] as const] : []),
            ]}
          />
        </Field>
        <Field label="Input">
          <JsonBlock value={run.input} />
        </Field>
        {d.output !== undefined && (
          <Field label="Output">
            <JsonBlock value={d.output} />
          </Field>
        )}
        {d.error && (
          <Field label="Error">
            <ErrorBlock code={d.error.code} message={d.error.message} />
          </Field>
        )}
      </>
    )
  }
  if (d.kind === "step") {
    return (
      <>
        <KeyVals
          rows={[
            ["stepId", d.stepId],
            ["attempt", String(d.attempt)],
            ["status", span.status],
          ]}
        />
        {d.output !== undefined && (
          <Field label="Output">
            <JsonBlock value={d.output} />
          </Field>
        )}
        {d.error && (
          <Field label="Error">
            <ErrorBlock code={d.error.code} message={d.error.message} />
          </Field>
        )}
      </>
    )
  }
  if (d.kind === "waitpoint") {
    return (
      <>
        <KeyVals
          rows={[
            ["kind", d.waitpointKind],
            ["id", d.waitpointId],
            ["status", span.status],
          ]}
        />
        {d.meta && Object.keys(d.meta).length > 0 && (
          <Field label="Meta">
            <JsonBlock value={d.meta} />
          </Field>
        )}
        {d.payload !== undefined && (
          <Field label="Resolution payload">
            <JsonBlock value={d.payload} />
          </Field>
        )}
        {d.error && (
          <Field label="Error">
            <ErrorBlock code={d.error.code} message={d.error.message} />
          </Field>
        )}
      </>
    )
  }
  if (d.kind === "log") {
    return (
      <>
        <KeyVals
          rows={[["level", d.level], ...(d.stepId ? [["stepId", d.stepId] as const] : [])]}
        />
        <Field label="Message">
          <TextBlock>{d.message}</TextBlock>
        </Field>
      </>
    )
  }
  if (d.kind === "stream") {
    return (
      <>
        <KeyVals
          rows={[
            ["streamId", d.streamId],
            ["seq", String(d.seq)],
            ["encoding", d.encoding],
            ["final", d.final ? "true" : "false"],
          ]}
        />
        <Field label="Chunk">
          {d.encoding === "json" ? (
            <JsonBlock value={d.chunk} />
          ) : (
            <TextBlock>{String(d.chunk)}</TextBlock>
          )}
        </Field>
      </>
    )
  }
  // compensation
  return (
    <>
      <KeyVals
        rows={[
          ["stepId", d.stepId],
          ["status", d.status],
        ]}
      />
      {d.error && (
        <Field label="Error">
          <ErrorBlock code="COMPENSATION_FAILED" message={d.error.message} />
        </Field>
      )}
    </>
  )
}

// ---- Small pieces ----

function InputOutput({
  input,
  output,
  error,
}: {
  input: unknown
  output: unknown
  error?: { code: string; message: string }
}): React.ReactElement {
  return (
    <div className="space-y-3">
      {input !== undefined && (
        <Field label="Input">
          <JsonBlock value={input} />
        </Field>
      )}
      {output !== undefined && (
        <Field label="Output">
          <JsonBlock value={output} />
        </Field>
      )}
      {error && (
        <Field label="Error">
          <ErrorBlock code={error.code} message={error.message} />
        </Field>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-wide">
      {children}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {label}
      </div>
      {children}
    </div>
  )
}

function KeyVals({ rows }: { rows: readonly (readonly [string, string])[] }): React.ReactElement {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
            {k}
          </dt>
          <dd className="truncate font-mono text-xs">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function JsonBlock({ value }: { value: unknown }): React.ReactElement {
  let pretty: string
  try {
    pretty = JSON.stringify(value, null, 2)
  } catch {
    pretty = String(value)
  }
  return (
    <pre className="bg-muted/50 max-h-96 overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed">
      {pretty}
    </pre>
  )
}

function TextBlock({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <pre className="bg-muted/50 max-h-96 overflow-auto whitespace-pre-wrap rounded-md p-3 font-mono text-[11px] leading-relaxed">
      {children}
    </pre>
  )
}

function ErrorBlock({ code, message }: { code: string; message: string }): React.ReactElement {
  return (
    <div className={cn("border-destructive/30 bg-destructive/5 rounded-md border p-3")}>
      <div className="text-destructive font-mono text-[10px] uppercase tracking-wide">{code}</div>
      <div className="mt-1 font-mono text-xs">{message}</div>
    </div>
  )
}

function EmptyTabMessage({ message }: { message: string }): React.ReactElement {
  return <div className="text-muted-foreground py-8 text-center text-xs">{message}</div>
}
