import { formatMessage, useAdminBreadcrumbs, useLocale } from "@voyantjs/admin"
import type { UpdateOrganizationInput } from "@voyantjs/crm-react"
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
} from "@voyantjs/ui/components"
import { Separator } from "@voyantjs/ui/components/separator"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import {
  ArrowLeft,
  Building,
  Calendar,
  CircleDot,
  Globe,
  Hash,
  Languages,
  Pencil,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react"
import { formatMoney, initialsFrom } from "@/components/voyant/crm/crm-constants"
import { InlineCurrencyField } from "@/components/voyant/crm/inline-currency-field"
import { InlineField } from "@/components/voyant/crm/inline-field"
import { InlineLanguageField } from "@/components/voyant/crm/inline-language-field"
import { InlineNumberField } from "@/components/voyant/crm/inline-number-field"
import { InlineSelectField } from "@/components/voyant/crm/inline-select-field"
import { TagsEditor } from "@/components/voyant/crm/tags-editor"
import { useAdminMessages } from "@/lib/admin-i18n"

function formatOrganizationDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatOrganizationRelative(
  value: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["organizationDetail"],
): string {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 1) return messages.relativeToday
  if (days < 7) return formatMessage(messages.relativeDaysAgo, { count: String(days) })
  if (days < 30) {
    return formatMessage(messages.relativeWeeksAgo, {
      count: String(Math.floor(days / 7)),
    })
  }
  if (days < 365) {
    return formatMessage(messages.relativeMonthsAgo, {
      count: String(Math.floor(days / 30)),
    })
  }
  return formatMessage(messages.relativeYearsAgo, {
    count: String(Math.floor(days / 365)),
  })
}

function relationLabel(
  relation: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["organizationDetail"],
): string {
  switch (relation) {
    case "client":
      return messages.relationClient
    case "partner":
      return messages.relationPartner
    case "supplier":
      return messages.relationSupplier
    case "other":
      return messages.relationOther
    default:
      return relation
  }
}

function statusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["organizationDetail"],
): string {
  switch (status) {
    case "active":
      return messages.statusActive
    case "inactive":
      return messages.statusInactive
    case "archived":
      return messages.statusArchived
    default:
      return status
  }
}

function opportunityStatusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["organizationDetail"],
): string {
  switch (status) {
    case "open":
      return messages.opportunityOpen
    case "won":
      return messages.opportunityWon
    case "lost":
      return messages.opportunityLost
    case "archived":
      return messages.opportunityArchived
    default:
      return status
  }
}

function activityTypeLabel(
  type: string | null | undefined,
  messages: ReturnType<typeof useAdminMessages>["crm"]["organizationDetail"],
): string | null | undefined {
  switch (type) {
    case "note":
      return messages.activityTypeNote
    case "call":
      return messages.activityTypeCall
    case "email":
      return messages.activityTypeEmail
    case "meeting":
      return messages.activityTypeMeeting
    case "task":
      return messages.activityTypeTask
    case "follow_up":
      return messages.activityTypeFollowUp
    default:
      return type
  }
}

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

type OrganizationOpportunity = {
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
  onDelete: () => Promise<void>
  deletePending: boolean
}) {
  const messages = useAdminMessages().crm.organizationDetail
  useAdminBreadcrumbs([
    { label: messages.breadcrumbRoot, href: "/organizations" },
    { label: orgName },
  ])

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <ConfirmActionButton
          buttonLabel={messages.deleteButton}
          confirmLabel={messages.deleteButton}
          title={messages.deleteConfirmTitle}
          description={messages.deleteConfirmDescription}
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
  onUpdateField: (patch: UpdateOrganizationInput) => Promise<void>
}) {
  const messages = useAdminMessages().crm.organizationDetail
  const relationOptions = [
    { value: "client", label: messages.relationClient },
    { value: "partner", label: messages.relationPartner },
    { value: "supplier", label: messages.relationSupplier },
    { value: "other", label: messages.relationOther },
  ] as const
  const statusOptions = [
    { value: "active", label: messages.statusActive },
    { value: "inactive", label: messages.statusInactive },
    { value: "archived", label: messages.statusArchived },
  ] as const

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
              <Badge variant="secondary" className="capitalize">
                {relationLabel(org.relation, messages)}
              </Badge>
            )}
            <Badge variant="outline" className="capitalize">
              {statusLabel(org.status, messages)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{messages.aboutTitle}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <InlineField
            icon={Building}
            label={messages.labelName}
            value={org.name}
            onSave={(next) => onUpdateField({ name: next ?? org.name })}
          />
          <InlineField
            icon={Building}
            label={messages.labelLegalName}
            value={org.legalName}
            onSave={(next) => onUpdateField({ legalName: next })}
          />
          <InlineField
            icon={Globe}
            label={messages.labelWebsite}
            kind="url"
            value={org.website}
            onSave={(next) => onUpdateField({ website: next })}
          />
          <InlineField
            icon={Hash}
            label={messages.labelIndustry}
            value={org.industry}
            onSave={(next) => onUpdateField({ industry: next })}
          />
          <InlineSelectField
            icon={Users}
            label={messages.labelRelation}
            value={org.relation}
            options={relationOptions}
            onSave={(next) => onUpdateField({ relation: next })}
          />
          <InlineSelectField
            icon={CircleDot}
            label={messages.labelStatus}
            value={org.status}
            options={statusOptions}
            allowClear={false}
            onSave={(next) => onUpdateField({ status: next ?? "active" })}
          />
          <InlineCurrencyField
            label={messages.labelDefaultCurrency}
            value={org.defaultCurrency}
            onSave={(next) => onUpdateField({ defaultCurrency: next })}
          />
          <InlineLanguageField
            icon={Languages}
            label={messages.labelPreferredLanguage}
            value={org.preferredLanguage}
            onSave={(next) => onUpdateField({ preferredLanguage: next })}
          />
          <InlineNumberField
            icon={Calendar}
            label={messages.labelPaymentTerms}
            value={org.paymentTerms}
            min={0}
            max={365}
            onSave={(next) => onUpdateField({ paymentTerms: next })}
          />
          <InlineField
            icon={Tag}
            label={messages.labelSource}
            value={org.source}
            onSave={(next) => onUpdateField({ source: next })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{messages.tagsTitle}</CardTitle>
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
  opportunities,
  activities,
  peoplePending,
  opportunitiesPending,
  activitiesPending,
  totalOpenValue,
  primaryCurrency,
  onOpenPerson,
  onUpdateField,
}: {
  activeTab: "overview" | "people" | "opportunities" | "activities"
  setActiveTab: (value: "overview" | "people" | "opportunities" | "activities") => void
  org: OrganizationData
  people: OrganizationPerson[]
  opportunities: OrganizationOpportunity[]
  activities: OrganizationActivity[]
  peoplePending: boolean
  opportunitiesPending: boolean
  activitiesPending: boolean
  totalOpenValue: number
  primaryCurrency: string | null
  onOpenPerson: (id: string) => void
  onUpdateField: (patch: UpdateOrganizationInput) => Promise<void>
}) {
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages().crm.organizationDetail
  const openOpportunities = opportunities.filter((opportunity) => opportunity.status === "open")
  const wonOpportunities = opportunities.filter((opportunity) => opportunity.status === "won")

  return (
    <main className="col-span-12 flex flex-col gap-4 lg:col-span-9">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.statPeople}
            </p>
            <p className="mt-1 text-2xl font-semibold">{people.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.statOpenOpportunities}
            </p>
            <p className="mt-1 text-2xl font-semibold">{openOpportunities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.statPipelineValue}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {formatMoney(totalOpenValue, primaryCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.statWon}
            </p>
            <p className="mt-1 text-2xl font-semibold">{wonOpportunities.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "overview" | "people" | "opportunities" | "activities")
          }
        >
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="overview">{messages.tabOverview}</TabsTrigger>
              <TabsTrigger value="people">
                {messages.tabPeople} ({people.length})
              </TabsTrigger>
              <TabsTrigger value="opportunities">
                {messages.tabOpportunities} ({opportunities.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                {messages.tabActivities} ({activities.length})
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="overview" className="m-0">
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    {messages.overviewCreated}
                  </dt>
                  <dd className="mt-0.5">
                    {formatOrganizationDate(org.createdAt, resolvedLocale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    {messages.overviewUpdated}
                  </dt>
                  <dd className="mt-0.5">{formatOrganizationRelative(org.updatedAt, messages)}</dd>
                </div>
                {org.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      {messages.overviewNotes}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{org.notes}</dd>
                  </div>
                )}
              </dl>
              <Separator className="my-4" />
              <InlineField
                label={messages.overviewNotes}
                kind="textarea"
                value={org.notes}
                onSave={(next) => onUpdateField({ notes: next })}
              />
            </TabsContent>

            <TabsContent value="people" className="m-0">
              {peoplePending ? (
                <ul className="divide-y">
                  {Array.from({ length: 4 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
                    <li key={i} className="flex items-center gap-3 py-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-3 w-40" />
                    </li>
                  ))}
                </ul>
              ) : people.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.peopleEmpty}
                </p>
              ) : (
                <ul className="divide-y">
                  {people.map((person) => {
                    const name =
                      [person.firstName, person.lastName].filter(Boolean).join(" ") ||
                      messages.personUnnamed
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

            <TabsContent value="opportunities" className="m-0">
              {opportunitiesPending ? (
                <ul className="divide-y">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
                    <li key={i} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </li>
                  ))}
                </ul>
              ) : opportunities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.opportunitiesEmpty}
                </p>
              ) : (
                <ul className="divide-y">
                  {opportunities.map((opportunity) => {
                    return (
                      <li
                        key={opportunity.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{opportunity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {opportunityStatusLabel(opportunity.status, messages)} ·{" "}
                            {formatOrganizationDate(opportunity.expectedCloseDate, resolvedLocale)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-sm font-medium">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatMoney(opportunity.valueAmountCents, opportunity.valueCurrency)}
                          </span>
                          <Badge variant="outline" className="capitalize">
                            {opportunityStatusLabel(opportunity.status, messages)}
                          </Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="activities" className="m-0">
              {activitiesPending ? (
                <ul className="divide-y">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
                    <li key={i} className="py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-3 w-5/6" />
                    </li>
                  ))}
                </ul>
              ) : activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.activitiesEmpty}
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
                          <Badge variant="outline" className="capitalize">
                            {activityTypeLabel(activity.type, messages)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatOrganizationRelative(activity.createdAt, messages)}
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
        <span className="text-xs text-muted-foreground">{messages.footerHint}</span>
      </div>
    </main>
  )
}
