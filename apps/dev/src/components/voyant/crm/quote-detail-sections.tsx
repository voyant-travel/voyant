import type { StageRecord } from "@voyantjs/crm-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  Calendar,
  CircleDot,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Tag,
  Target,
  TrendingUp,
  User,
} from "lucide-react"
import {
  formatDate,
  formatMoney,
  formatRelative,
  QUOTE_STATUS_OPTIONS,
} from "@/components/voyant/crm/crm-constants"
import { InlineCurrencyField } from "@/components/voyant/crm/inline-currency-field"
import { InlineField } from "@/components/voyant/crm/inline-field"
import { InlineNumberField } from "@/components/voyant/crm/inline-number-field"
import { InlineSelectField } from "@/components/voyant/crm/inline-select-field"
import { TagsEditor } from "@/components/voyant/crm/tags-editor"

export function QuoteSummaryCard({
  title,
  pipelineName,
  stageName,
  status,
  valueAmountCents,
  valueCurrency,
  expectedCloseDate,
}: {
  title: string
  pipelineName: string | null | undefined
  stageName: string | null | undefined
  status: string
  valueAmountCents: number | null | undefined
  valueCurrency: string | null
  expectedCloseDate: string | null | undefined
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pipelineName ?? "…"} · {stageName ?? "…"}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-semibold">
            {formatMoney(valueAmountCents, valueCurrency)}
          </span>
        </div>
        {expectedCloseDate ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Expected close: {formatDate(expectedCloseDate)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function QuoteDetailsCard({
  quote,
  stages,
  onUpdateField,
}: {
  quote: {
    title: string
    stageId: string
    status: string
    valueAmountCents: number | null
    valueCurrency: string | null
    expectedCloseDate: string | null
    source: string | null
    sourceRef: string | null
    lostReason: string | null
  }
  stages: StageRecord[]
  onUpdateField: (patch: Record<string, unknown>) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Deal details</CardTitle>
      </CardHeader>
      <CardContent className="divide-y text-sm">
        <InlineField
          icon={Target}
          label="Title"
          value={quote.title}
          onSave={(next) => onUpdateField({ title: next ?? "" })}
        />
        <InlineSelectField
          icon={CircleDot}
          label="Stage"
          value={quote.stageId}
          options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
          allowClear={false}
          onSave={(next) => onUpdateField({ stageId: next ?? quote.stageId })}
        />
        <InlineSelectField
          icon={CircleDot}
          label="Status"
          value={quote.status}
          options={QUOTE_STATUS_OPTIONS}
          allowClear={false}
          onSave={(next) => onUpdateField({ status: next ?? quote.status })}
        />
        <InlineNumberField
          icon={DollarSign}
          label="Value (cents)"
          value={quote.valueAmountCents}
          min={0}
          onSave={(next) => onUpdateField({ valueAmountCents: next })}
        />
        <InlineCurrencyField
          label="Currency"
          value={quote.valueCurrency}
          onSave={(next) => onUpdateField({ valueCurrency: next })}
        />
        <InlineField
          icon={Calendar}
          label="Expected close date"
          placeholder="YYYY-MM-DD"
          value={quote.expectedCloseDate}
          onSave={(next) => onUpdateField({ expectedCloseDate: next })}
        />
        <InlineField
          icon={Tag}
          label="Source"
          value={quote.source}
          onSave={(next) => onUpdateField({ source: next })}
        />
        <InlineField
          label="Source ref"
          value={quote.sourceRef}
          onSave={(next) => onUpdateField({ sourceRef: next })}
        />
        {quote.status === "lost" ? (
          <InlineField
            label="Lost reason"
            kind="textarea"
            value={quote.lostReason}
            onSave={(next) => onUpdateField({ lostReason: next })}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

export function QuoteTagsCard({
  tags,
  onChange,
}: {
  tags: string[] | null | undefined
  onChange: (tags: string[]) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Tags</CardTitle>
      </CardHeader>
      <CardContent>
        <TagsEditor tags={tags ?? []} onChange={onChange} />
      </CardContent>
    </Card>
  )
}

export function QuoteParticipantsCard({
  person,
  personName,
  organization,
  onOpenPerson,
  onOpenOrganization,
}: {
  person:
    | {
        id: string
        jobTitle?: string | null
      }
    | null
    | undefined
  personName: string | null
  organization:
    | {
        id: string
        name: string
        industry?: string | null
      }
    | null
    | undefined
  onOpenPerson: () => void
  onOpenOrganization: () => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Participants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {personName ? (
          <button
            type="button"
            onClick={onOpenPerson}
            className="flex w-full items-center gap-2 rounded border p-2 text-left hover:bg-muted/40"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{personName}</p>
              {person?.jobTitle ? (
                <p className="truncate text-xs text-muted-foreground">{person.jobTitle}</p>
              ) : null}
            </div>
          </button>
        ) : (
          <p className="text-muted-foreground italic">No person linked.</p>
        )}
        {organization ? (
          <button
            type="button"
            onClick={onOpenOrganization}
            className="flex w-full items-center gap-2 rounded border p-2 text-left hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{organization.name}</p>
              {organization.industry ? (
                <p className="truncate text-xs text-muted-foreground">{organization.industry}</p>
              ) : null}
            </div>
          </button>
        ) : (
          <p className="text-muted-foreground italic">No organization linked.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function QuoteVersionsCard({
  isPending,
  quoteVersions,
  isCreating,
  onCreateQuoteVersion,
  onOpenQuoteVersion,
}: {
  isPending: boolean
  quoteVersions: Array<{
    id: string
    validUntil: string | null
    status: string
    totalAmountCents: number | null
    currency: string | null
  }>
  isCreating: boolean
  onCreateQuoteVersion: () => void
  onOpenQuoteVersion: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Quote Versions</CardTitle>
        <Button size="sm" variant="ghost" onClick={onCreateQuoteVersion} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          New version
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : quoteVersions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No quote versions yet.</p>
        ) : (
          <ul className="divide-y">
            {quoteVersions.map((quoteVersion) => (
              <li key={quoteVersion.id}>
                <button
                  type="button"
                  onClick={() => onOpenQuoteVersion(quoteVersion.id)}
                  className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/40"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">{quoteVersion.id.slice(-8)}</p>
                    {quoteVersion.validUntil ? (
                      <p className="text-xs text-muted-foreground">
                        Valid until {formatDate(quoteVersion.validUntil)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="capitalize">
                      {quoteVersion.status}
                    </Badge>
                    <span className="text-xs font-medium">
                      {formatMoney(quoteVersion.totalAmountCents, quoteVersion.currency)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function QuoteActivitiesCard({
  isPending,
  activities,
}: {
  isPending: boolean
  activities: Array<{
    id: string
    subject: string
    description: string | null
    type: string
    createdAt: string
  }>
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Activities</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No activities yet.</p>
        ) : (
          <ul className="divide-y">
            {activities.map((activity) => (
              <li key={activity.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{activity.subject}</p>
                    {activity.description ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {activity.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p className="capitalize">{activity.type}</p>
                    <p>{formatRelative(activity.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
