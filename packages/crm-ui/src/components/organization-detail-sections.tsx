"use client"

import type {
  ActivityRecord,
  OpportunityRecord,
  OrganizationRecord,
  PersonRecord,
  UpdateOrganizationInput,
} from "@voyantjs/crm-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
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
import type { ReactNode } from "react"

import { useCrmUiI18nOrDefault, useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { formatCrmDate, formatCrmMoney, formatCrmRelative } from "./crm-format.js"
import { InlineCurrencyField } from "./inline-currency-field.js"
import { InlineField } from "./inline-field.js"
import { InlineLanguageField } from "./inline-language-field.js"
import { InlineNumberField } from "./inline-number-field.js"
import { InlineSelectField } from "./inline-select-field.js"
import { TagsEditor } from "./tags-editor.js"

export type OrganizationDetailTab =
  | "overview"
  | "people"
  | "opportunities"
  | "activities"
  | "bookings"
  | "invoices"
  | "payments"
  | "contracts"

export type OrganizationData = Pick<
  OrganizationRecord,
  | "createdAt"
  | "defaultCurrency"
  | "industry"
  | "legalName"
  | "name"
  | "notes"
  | "paymentTerms"
  | "preferredLanguage"
  | "relation"
  | "source"
  | "status"
  | "tags"
  | "updatedAt"
  | "website"
>

export type OrganizationPerson = Pick<
  PersonRecord,
  "email" | "firstName" | "id" | "jobTitle" | "lastName" | "status"
>

export type OrganizationOpportunity = Pick<
  OpportunityRecord,
  | "expectedCloseDate"
  | "id"
  | "status"
  | "title"
  | "updatedAt"
  | "valueAmountCents"
  | "valueCurrency"
>

export type OrganizationActivity = Pick<
  ActivityRecord,
  "createdAt" | "description" | "dueAt" | "id" | "status" | "subject" | "type" | "updatedAt"
>

export interface OrganizationCommercialContextTabSlot {
  label?: string
  count?: number
  content: ReactNode
}

export interface OrganizationDetailPageSlots {
  afterTopBar?: ReactNode
  sidebarEnd?: ReactNode
  overviewEnd?: ReactNode
  peopleEnd?: ReactNode
  opportunitiesEnd?: ReactNode
  activitiesEnd?: ReactNode
  bookingsTab?: OrganizationCommercialContextTabSlot
  invoicesTab?: OrganizationCommercialContextTabSlot
  paymentsTab?: OrganizationCommercialContextTabSlot
  contractsTab?: OrganizationCommercialContextTabSlot
}

export interface OrganizationTopBarProps {
  orgName: string
  onBack: () => void
  onDelete: () => Promise<void>
  deletePending: boolean
}

export function OrganizationTopBar({
  orgName,
  onBack,
  onDelete,
  deletePending,
}: OrganizationTopBarProps) {
  const messages = useCrmUiMessagesOrDefault()

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          {messages.organizationDetail.topBar.organizations}
        </button>
        <span>/</span>
        <span className="text-foreground">{orgName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ConfirmActionButton
          buttonLabel={messages.organizationDetail.topBar.delete}
          confirmLabel={messages.organizationDetail.topBar.delete}
          title={messages.organizationDetail.topBar.deleteTitle}
          description={messages.organizationDetail.topBar.deleteDescription}
          variant="destructive"
          confirmVariant="destructive"
          disabled={deletePending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}

export interface OrganizationSidebarProps {
  org: OrganizationData
  websiteHref?: string
  onUpdateField: (patch: UpdateOrganizationInput) => Promise<void>
  children?: ReactNode
}

export function OrganizationSidebar({
  org,
  websiteHref,
  onUpdateField,
  children,
}: OrganizationSidebarProps) {
  const messages = useCrmUiMessagesOrDefault()
  const relationOptions = [
    { value: "client", label: messages.common.relationTypeLabels.client },
    { value: "partner", label: messages.common.relationTypeLabels.partner },
    { value: "supplier", label: messages.common.relationTypeLabels.supplier },
    { value: "other", label: messages.common.relationTypeLabels.other },
  ]
  const statusOptions = [
    { value: "active", label: messages.common.recordStatusLabels.active },
    { value: "inactive", label: messages.common.recordStatusLabels.inactive },
    { value: "archived", label: messages.common.recordStatusLabels.archived },
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
                {messages.common.relationTypeLabels[
                  org.relation as keyof typeof messages.common.relationTypeLabels
                ] ?? org.relation}
              </Badge>
            )}
            <Badge variant="outline">
              {messages.common.recordStatusLabels[
                org.status as keyof typeof messages.common.recordStatusLabels
              ] ?? org.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {messages.organizationDetail.sidebar.about}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <InlineField
            icon={Building}
            label={messages.organizationDetail.sidebar.fields.name}
            value={org.name}
            onSave={(next) => onUpdateField({ name: next ?? org.name })}
          />
          <InlineField
            icon={Building}
            label={messages.organizationDetail.sidebar.fields.legalName}
            value={org.legalName}
            onSave={(next) => onUpdateField({ legalName: next })}
          />
          <InlineField
            icon={Globe}
            label={messages.organizationDetail.sidebar.fields.website}
            kind="url"
            value={org.website}
            onSave={(next) => onUpdateField({ website: next })}
          />
          <InlineField
            icon={Hash}
            label={messages.organizationDetail.sidebar.fields.industry}
            value={org.industry}
            onSave={(next) => onUpdateField({ industry: next })}
          />
          <InlineSelectField
            icon={Users}
            label={messages.organizationDetail.sidebar.fields.relation}
            value={org.relation}
            options={relationOptions}
            onSave={(next) => onUpdateField({ relation: next })}
          />
          <InlineSelectField
            icon={CircleDot}
            label={messages.organizationDetail.sidebar.fields.status}
            value={org.status}
            options={statusOptions}
            allowClear={false}
            onSave={(next) => onUpdateField({ status: next ?? "active" })}
          />
          <InlineCurrencyField
            label={messages.organizationDetail.sidebar.fields.defaultCurrency}
            value={org.defaultCurrency}
            onSave={(next) => onUpdateField({ defaultCurrency: next })}
          />
          <InlineLanguageField
            icon={Languages}
            label={messages.organizationDetail.sidebar.fields.preferredLanguage}
            value={org.preferredLanguage}
            onSave={(next) => onUpdateField({ preferredLanguage: next })}
          />
          <InlineNumberField
            icon={Calendar}
            label={messages.organizationDetail.sidebar.fields.paymentTerms}
            value={org.paymentTerms}
            min={0}
            max={365}
            onSave={(next) => onUpdateField({ paymentTerms: next })}
          />
          <InlineField
            icon={Tag}
            label={messages.organizationDetail.sidebar.fields.source}
            value={org.source}
            onSave={(next) => onUpdateField({ source: next })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {messages.organizationDetail.sidebar.tags}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TagsEditor tags={org.tags} onChange={(tags) => onUpdateField({ tags })} />
        </CardContent>
      </Card>

      {children}
    </aside>
  )
}

export interface OrganizationMainProps {
  activeTab: OrganizationDetailTab
  setActiveTab: (value: OrganizationDetailTab) => void
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
  slots?: OrganizationDetailPageSlots
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
  slots,
}: OrganizationMainProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()
  const openOpportunities = opportunities.filter((opportunity) => opportunity.status === "open")
  const wonOpportunities = opportunities.filter((opportunity) => opportunity.status === "won")

  return (
    <main className="col-span-12 flex flex-col gap-4 lg:col-span-9">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.organizationDetail.metrics.people}
            </p>
            <p className="mt-1 text-2xl font-semibold">{people.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.organizationDetail.metrics.openOpportunities}
            </p>
            <p className="mt-1 text-2xl font-semibold">{openOpportunities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.organizationDetail.metrics.pipelineValue}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {formatCrmMoney(i18n, totalOpenValue, primaryCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.organizationDetail.metrics.won}
            </p>
            <p className="mt-1 text-2xl font-semibold">{wonOpportunities.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as OrganizationDetailTab)}
        >
          <CardHeader className="pb-0">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="overview">
                {messages.organizationDetail.tabs.overview}
              </TabsTrigger>
              <TabsTrigger value="people">
                {messages.organizationDetail.tabs.people} ({people.length})
              </TabsTrigger>
              <TabsTrigger value="opportunities">
                {messages.organizationDetail.tabs.opportunities} ({opportunities.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                {messages.organizationDetail.tabs.activities} ({activities.length})
              </TabsTrigger>
              {slots?.bookingsTab ? (
                <TabsTrigger value="bookings">
                  {formatTabLabel(messages.organizationDetail.tabs.bookings, slots.bookingsTab)}
                </TabsTrigger>
              ) : null}
              {slots?.invoicesTab ? (
                <TabsTrigger value="invoices">
                  {formatTabLabel(messages.organizationDetail.tabs.invoices, slots.invoicesTab)}
                </TabsTrigger>
              ) : null}
              {slots?.paymentsTab ? (
                <TabsTrigger value="payments">
                  {formatTabLabel(messages.organizationDetail.tabs.payments, slots.paymentsTab)}
                </TabsTrigger>
              ) : null}
              {slots?.contractsTab ? (
                <TabsTrigger value="contracts">
                  {formatTabLabel(messages.organizationDetail.tabs.contracts, slots.contractsTab)}
                </TabsTrigger>
              ) : null}
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="overview" className="m-0">
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    {messages.organizationDetail.sections.created}
                  </dt>
                  <dd className="mt-0.5">{formatCrmDate(i18n, org.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    {messages.organizationDetail.sections.updated}
                  </dt>
                  <dd className="mt-0.5">{formatCrmRelative(i18n, org.updatedAt)}</dd>
                </div>
                {org.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      {messages.organizationDetail.sections.notes}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{org.notes}</dd>
                  </div>
                )}
              </dl>
              <Separator className="my-4" />
              <InlineField
                label={messages.organizationDetail.sections.notes}
                kind="textarea"
                value={org.notes}
                onSave={(next) => onUpdateField({ notes: next })}
              />
              {slots?.overviewEnd}
            </TabsContent>

            <TabsContent value="people" className="m-0">
              {peoplePending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : people.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.organizationDetail.empty.noPeople}
                </p>
              ) : (
                <ul className="divide-y">
                  {people.map((person) => {
                    const name =
                      [person.firstName, person.lastName].filter(Boolean).join(" ") ||
                      messages.organizationDetail.empty.unnamed
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
              {slots?.peopleEnd}
            </TabsContent>

            <TabsContent value="opportunities" className="m-0">
              {opportunitiesPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : opportunities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.organizationDetail.empty.noOpportunities}
                </p>
              ) : (
                <ul className="divide-y">
                  {opportunities.map((opportunity) => {
                    const statusLabel =
                      messages.common.opportunityStatusLabels[
                        opportunity.status as keyof typeof messages.common.opportunityStatusLabels
                      ] ?? opportunity.status
                    return (
                      <li
                        key={opportunity.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{opportunity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {statusLabel} - {formatCrmDate(i18n, opportunity.expectedCloseDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-sm font-medium">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatCrmMoney(
                              i18n,
                              opportunity.valueAmountCents,
                              opportunity.valueCurrency,
                            )}
                          </span>
                          <Badge variant="outline">{statusLabel}</Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {slots?.opportunitiesEnd}
            </TabsContent>

            <TabsContent value="activities" className="m-0">
              {activitiesPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.organizationDetail.empty.noActivities}
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
                            {messages.common.activityTypeLabels[
                              (activity.type ??
                                "note") as keyof typeof messages.common.activityTypeLabels
                            ] ?? activity.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatCrmRelative(i18n, activity.createdAt)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {slots?.activitiesEnd}
            </TabsContent>
            {slots?.bookingsTab ? (
              <TabsContent value="bookings" className="m-0">
                {slots.bookingsTab.content}
              </TabsContent>
            ) : null}
            {slots?.invoicesTab ? (
              <TabsContent value="invoices" className="m-0">
                {slots.invoicesTab.content}
              </TabsContent>
            ) : null}
            {slots?.paymentsTab ? (
              <TabsContent value="payments" className="m-0">
                {slots.paymentsTab.content}
              </TabsContent>
            ) : null}
            {slots?.contractsTab ? (
              <TabsContent value="contracts" className="m-0">
                {slots.contractsTab.content}
              </TabsContent>
            ) : null}
          </CardContent>
        </Tabs>
      </Card>

      <div className="flex items-center gap-2">
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{messages.organizationDetail.hint}</span>
      </div>
    </main>
  )
}

function formatTabLabel(
  defaultLabel: string,
  slot: OrganizationCommercialContextTabSlot,
): ReactNode {
  const label = slot.label ?? defaultLabel
  return typeof slot.count === "number" ? `${label} (${slot.count})` : label
}

export function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}
