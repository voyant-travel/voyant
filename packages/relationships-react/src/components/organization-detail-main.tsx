"use client"

import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardHeader,
} from "@voyant-travel/ui/components"
import { Separator } from "@voyant-travel/ui/components/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { Loader2, Pencil } from "lucide-react"

import { useCrmUiI18nOrDefault, useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { UpdateOrganizationInput } from "../index.js"
import { formatCrmDate, formatCrmRelative } from "./crm-format.js"
import { InlineField } from "./inline-field.js"
import {
  formatTabLabel,
  initialsFrom,
  type OrganizationActivity,
  type OrganizationData,
  type OrganizationDetailPageSlots,
  type OrganizationDetailTab,
  type OrganizationPerson,
} from "./organization-detail-types.js"

export interface OrganizationMainProps {
  activeTab: OrganizationDetailTab
  setActiveTab: (value: OrganizationDetailTab) => void
  org: OrganizationData
  people: OrganizationPerson[]
  activities: OrganizationActivity[]
  peoplePending: boolean
  activitiesPending: boolean
  onOpenPerson: (id: string) => void
  onUpdateField: (patch: UpdateOrganizationInput) => Promise<void>
  slots?: OrganizationDetailPageSlots
}

export function OrganizationMain({
  activeTab,
  setActiveTab,
  org,
  people,
  activities,
  peoplePending,
  activitiesPending,
  onOpenPerson,
  onUpdateField,
  slots,
}: OrganizationMainProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()
  const hasQuotesSlot = slots?.quotesContent !== undefined || slots?.quotesEnd !== undefined

  return (
    <main className="col-span-12 flex flex-col gap-4 lg:col-span-9">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              {messages.organizationDetail.tabs.activities}
            </p>
            <p className="mt-1 text-2xl font-semibold">{activities.length}</p>
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
              {hasQuotesSlot ? (
                <TabsTrigger value="quotes">{messages.organizationDetail.tabs.quotes}</TabsTrigger>
              ) : null}
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
              {slots?.overviewContent !== undefined ? (
                slots.overviewContent
              ) : (
                <>
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
                </>
              )}
              {slots?.overviewEnd}
            </TabsContent>

            <TabsContent value="people" className="m-0">
              {slots?.peopleContent !== undefined ? (
                slots.peopleContent
              ) : peoplePending ? (
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

            {hasQuotesSlot ? (
              <TabsContent value="quotes" className="m-0">
                {slots?.quotesContent}
                {slots?.quotesEnd}
              </TabsContent>
            ) : null}

            <TabsContent value="activities" className="m-0">
              {slots?.activitiesContent !== undefined ? (
                slots.activitiesContent
              ) : activitiesPending ? (
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
