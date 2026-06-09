import type { UpdateOrganizationInput } from "@voyantjs/crm-react"
import {
  ArrowLeft,
  Building,
  Calendar,
  CircleDot,
  Globe,
  Hash,
  Languages,
  Loader2,
  Pencil,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
} from "@/components/ui"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { initialsFrom } from "@/components/voyant/crm/crm-constants"
import { InlineCurrencyField } from "@/components/voyant/crm/inline-currency-field"
import { InlineField } from "@/components/voyant/crm/inline-field"
import { InlineLanguageField } from "@/components/voyant/crm/inline-language-field"
import { InlineNumberField } from "@/components/voyant/crm/inline-number-field"
import { InlineSelectField } from "@/components/voyant/crm/inline-select-field"
import { TagsEditor } from "@/components/voyant/crm/tags-editor"

import { useRegistryCrmI18nOrDefault, useRegistryCrmMessagesOrDefault } from "./i18n"
import {
  formatRegistryCrmDate,
  formatRegistryCrmMoney,
  formatRegistryCrmRelative,
} from "./i18n/utils"

type OrganizationData = {
  name: string
  legalName: string | null
  website: string | null
  relation: string | null
  status: string
  industry: string | null
  defaultCurrency: string | null
  preferredLanguage: string | null
  paymentTerms: number | null
  source: string | null
  tags: string[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

type OrganizationPerson = {
  id: string
  firstName: string | null
  lastName: string | null
  email?: string | null
  jobTitle?: string | null
  status?: string | null
}

type OrganizationQuote = {
  id: string
  title: string
  status: string
  valueAmountCents: number | null
  valueCurrency: string | null
  expectedCloseDate?: string | null
  updatedAt?: string
}

type OrganizationActivity = {
  id: string
  subject: string
  description?: string | null
  createdAt: string
  type?: string | null
  status?: string | null
  dueAt?: string | null
  updatedAt?: string
}

export function OrganizationTopBar({
  orgName,
  onBack,
  onDelete,
  deletePending,
}: {
  orgName: string
  onBack: () => void
  onDelete: () => Promise<void> // i18n-literal-ok local callback type alias
  deletePending: boolean
}) {
  const m = useRegistryCrmMessagesOrDefault()

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          {m.organizationDetail.topBar.organizations}
        </button>
        <span>/</span>
        <span className="text-foreground">{orgName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ConfirmActionButton
          buttonLabel={m.organizationDetail.topBar.delete}
          confirmLabel={m.organizationDetail.topBar.delete}
          title={m.organizationDetail.topBar.deleteTitle}
          description={m.organizationDetail.topBar.deleteDescription}
          variant="destructive"
          confirmVariant="destructive"
          disabled={deletePending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}

export function OrganizationSidebar({
  org,
  websiteHref,
  onUpdateField,
}: {
  org: OrganizationData
  websiteHref?: string
  onUpdateField: (patch: UpdateOrganizationInput) => Promise<void> // i18n-literal-ok local callback type alias
}) {
  const m = useRegistryCrmMessagesOrDefault()
  const relationOptions = [
    { value: "client", label: m.common.relationTypeLabels.client },
    { value: "partner", label: m.common.relationTypeLabels.partner },
    { value: "supplier", label: m.common.relationTypeLabels.supplier },
    { value: "other", label: m.common.relationTypeLabels.other },
  ]
  const statusOptions = [
    { value: "active", label: m.common.recordStatusLabels.active },
    { value: "inactive", label: m.common.recordStatusLabels.inactive },
    { value: "archived", label: m.common.recordStatusLabels.archived },
  ]

  return (
    <aside className="col-span-12 flex flex-col gap-4 lg:col-span-3">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-xl">{initialsFrom(org.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-tight">{org.name}</h2>
            {org.legalName && <p className="text-sm text-muted-foreground">{org.legalName}</p>}
            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {org.website}
              </a>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {org.relation && (
              <Badge variant="secondary">
                {m.common.relationTypeLabels[
                  org.relation as keyof typeof m.common.relationTypeLabels
                ] ?? org.relation}
              </Badge>
            )}
            <Badge variant="outline">
              {m.common.recordStatusLabels[
                org.status as keyof typeof m.common.recordStatusLabels
              ] ?? org.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {m.organizationDetail.sidebar.about}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <InlineField
            icon={Building}
            label={m.organizationDetail.sidebar.fields.name}
            value={org.name}
            onSave={(next) => onUpdateField({ name: next ?? org.name })}
          />
          <InlineField
            icon={Building}
            label={m.organizationDetail.sidebar.fields.legalName}
            value={org.legalName}
            onSave={(next) => onUpdateField({ legalName: next })}
          />
          <InlineField
            icon={Globe}
            label={m.organizationDetail.sidebar.fields.website}
            kind="url"
            value={org.website}
            onSave={(next) => onUpdateField({ website: next })}
          />
          <InlineField
            icon={Hash}
            label={m.organizationDetail.sidebar.fields.industry}
            value={org.industry}
            onSave={(next) => onUpdateField({ industry: next })}
          />
          <InlineSelectField
            icon={Users}
            label={m.organizationDetail.sidebar.fields.relation}
            value={org.relation}
            options={relationOptions}
            onSave={(next) => onUpdateField({ relation: next })}
          />
          <InlineSelectField
            icon={CircleDot}
            label={m.organizationDetail.sidebar.fields.status}
            value={org.status}
            options={statusOptions}
            allowClear={false}
            onSave={(next) => onUpdateField({ status: next ?? "active" })}
          />
          <InlineCurrencyField
            label={m.organizationDetail.sidebar.fields.defaultCurrency}
            value={org.defaultCurrency}
            onSave={(next) => onUpdateField({ defaultCurrency: next })}
          />
          <InlineLanguageField
            icon={Languages}
            label={m.organizationDetail.sidebar.fields.preferredLanguage}
            value={org.preferredLanguage}
            onSave={(next) => onUpdateField({ preferredLanguage: next })}
          />
          <InlineNumberField
            icon={Calendar}
            label={m.organizationDetail.sidebar.fields.paymentTerms}
            value={org.paymentTerms}
            min={0}
            max={365}
            onSave={(next) => onUpdateField({ paymentTerms: next })}
          />
          <InlineField
            icon={Tag}
            label={m.organizationDetail.sidebar.fields.source}
            value={org.source}
            onSave={(next) => onUpdateField({ source: next })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {m.organizationDetail.sidebar.tags}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TagsEditor tags={org.tags} onChange={(tags) => onUpdateField({ tags })} />
        </CardContent>
      </Card>
    </aside>
  )
}

export function OrganizationMain({
  activeTab,
  setActiveTab,
  org,
  people,
  quotes,
  activities,
  peoplePending,
  quotesPending,
  activitiesPending,
  totalOpenValue,
  primaryCurrency,
  onOpenPerson,
  onUpdateField,
}: {
  activeTab: "overview" | "people" | "quotes" | "activities"
  setActiveTab: (value: "overview" | "people" | "quotes" | "activities") => void
  org: OrganizationData
  people: OrganizationPerson[]
  quotes: OrganizationQuote[]
  activities: OrganizationActivity[]
  peoplePending: boolean
  quotesPending: boolean
  activitiesPending: boolean
  totalOpenValue: number
  primaryCurrency: string | null
  onOpenPerson: (id: string) => void
  onUpdateField: (patch: UpdateOrganizationInput) => Promise<void> // i18n-literal-ok local callback type alias
}) {
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()
  const openQuotes = quotes.filter((quote) => quote.status === "open")
  const wonQuotes = quotes.filter((quote) => quote.status === "won")

  return (
    <main className="col-span-12 flex flex-col gap-4 lg:col-span-9">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.organizationDetail.metrics.people}
            </p>
            <p className="mt-1 text-2xl font-semibold">{people.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.organizationDetail.metrics.openQuotes}
            </p>
            <p className="mt-1 text-2xl font-semibold">{openQuotes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.organizationDetail.metrics.pipelineValue}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {formatRegistryCrmMoney(i18n, totalOpenValue, primaryCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.organizationDetail.metrics.won}
            </p>
            <p className="mt-1 text-2xl font-semibold">{wonQuotes.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "overview" | "people" | "quotes" | "activities")
          }
        >
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="overview">{m.organizationDetail.tabs.overview}</TabsTrigger>
              <TabsTrigger value="people">
                {m.organizationDetail.tabs.people} ({people.length})
              </TabsTrigger>
              <TabsTrigger value="quotes">
                {m.organizationDetail.tabs.quotes} ({quotes.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                {m.organizationDetail.tabs.activities} ({activities.length})
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="overview" className="m-0">
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    {m.organizationDetail.sections.created}
                  </dt>
                  <dd className="mt-0.5">{formatRegistryCrmDate(i18n, org.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    {m.organizationDetail.sections.updated}
                  </dt>
                  <dd className="mt-0.5">{formatRegistryCrmRelative(i18n, org.updatedAt)}</dd>
                </div>
                {org.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      {m.organizationDetail.sections.notes}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{org.notes}</dd>
                  </div>
                )}
              </dl>
              <Separator className="my-4" />
              <InlineField
                label={m.organizationDetail.sections.notes}
                kind="textarea"
                value={org.notes}
                onSave={(next) => onUpdateField({ notes: next })}
              />
            </TabsContent>

            <TabsContent value="people" className="m-0">
              {peoplePending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : people.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {m.organizationDetail.empty.noPeople}
                </p>
              ) : (
                <ul className="divide-y">
                  {people.map((person) => {
                    const name =
                      [person.firstName, person.lastName].filter(Boolean).join(" ") ||
                      m.organizationDetail.empty.unnamed
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => onOpenPerson(person.id)}
                          className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted/40"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initialsFrom(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{name}</p>
                            {person.jobTitle && (
                              <p className="truncate text-xs text-muted-foreground">
                                {person.jobTitle}
                              </p>
                            )}
                          </div>
                          {person.email && (
                            <span className="truncate text-xs text-muted-foreground">
                              {person.email}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="quotes" className="m-0">
              {quotesPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : quotes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {m.organizationDetail.empty.noQuotes}
                </p>
              ) : (
                <ul className="divide-y">
                  {quotes.map((quote) => {
                    const statusLabel =
                      m.common.quoteStatusLabels[
                        quote.status as keyof typeof m.common.quoteStatusLabels
                      ] ?? quote.status
                    return (
                      <li key={quote.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{quote.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {statusLabel} - {formatRegistryCrmDate(i18n, quote.expectedCloseDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-sm font-medium">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatRegistryCrmMoney(
                              i18n,
                              quote.valueAmountCents,
                              quote.valueCurrency,
                            )}
                          </span>
                          <Badge variant="outline">{statusLabel}</Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="activities" className="m-0">
              {activitiesPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {m.organizationDetail.empty.noActivities}
                </p>
              ) : (
                <ul className="divide-y">
                  {activities.map((activity) => (
                    <li key={activity.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{activity.subject}</p>
                          {activity.description && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {activity.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline">
                            {m.common.activityTypeLabels[
                              (activity.type ?? "note") as keyof typeof m.common.activityTypeLabels
                            ] ?? activity.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRegistryCrmRelative(i18n, activity.createdAt)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <div className="flex items-center gap-2">
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{m.organizationDetail.hint}</span>
      </div>
    </main>
  )
}
