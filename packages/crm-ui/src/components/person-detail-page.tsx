"use client"

import type {
  ActivityRecord,
  OpportunityRecord,
  OrganizationRecord,
  PersonDocumentRecord,
  PersonRecord,
  PersonRelationshipRecord,
  PersonTravelSnapshotRecord,
  UpdatePersonInput,
} from "@voyantjs/crm-react"
import {
  useActivities,
  useOpportunities,
  useOrganization,
  usePerson,
  usePersonDocuments,
  usePersonMutation,
  usePersonRelationships,
  usePersonTravelSnapshot,
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
  cn,
} from "@voyantjs/ui/components"
import { buttonVariants } from "@voyantjs/ui/components/button"
import { Separator } from "@voyantjs/ui/components/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import {
  ArrowLeft,
  BriefcaseBusiness,
  Calendar,
  CircleDot,
  FileText,
  Globe,
  Languages,
  Loader2,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Tag,
  TrendingUp,
  User,
  Users,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"

import { useCrmUiI18nOrDefault, useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { formatCrmDate, formatCrmMoney, formatCrmRelative } from "./crm-format.js"
import { InlineCurrencyField } from "./inline-currency-field.js"
import { InlineField } from "./inline-field.js"
import { InlineLanguageField } from "./inline-language-field.js"
import { InlineSelectField } from "./inline-select-field.js"
import { PersonDialog } from "./person-dialog.js"
import { TagsEditor } from "./tags-editor.js"

export type PersonDetailTab =
  | "overview"
  | "opportunities"
  | "activities"
  | "relationships"
  | "documents"
  | "bookings"
  | "invoices"
  | "payments"
  | "contracts"

export type PersonData = Pick<
  PersonRecord,
  | "birthday"
  | "createdAt"
  | "email"
  | "firstName"
  | "id"
  | "jobTitle"
  | "lastName"
  | "notes"
  | "organizationId"
  | "phone"
  | "preferredCurrency"
  | "preferredLanguage"
  | "relation"
  | "source"
  | "status"
  | "tags"
  | "updatedAt"
  | "website"
>

export type PersonOrganization = Pick<OrganizationRecord, "id" | "name" | "website">

export type PersonOpportunity = Pick<
  OpportunityRecord,
  | "expectedCloseDate"
  | "id"
  | "status"
  | "title"
  | "updatedAt"
  | "valueAmountCents"
  | "valueCurrency"
>

export type PersonActivity = Pick<
  ActivityRecord,
  "createdAt" | "description" | "dueAt" | "id" | "status" | "subject" | "type" | "updatedAt"
>

export type PersonRelationship = Pick<
  PersonRelationshipRecord,
  | "createdAt"
  | "endDate"
  | "fromPersonId"
  | "id"
  | "inverseKind"
  | "isPrimary"
  | "kind"
  | "notes"
  | "startDate"
  | "toPersonId"
  | "updatedAt"
>

export type PersonDocument = Pick<
  PersonDocumentRecord,
  | "expiryDate"
  | "id"
  | "isPrimary"
  | "issueDate"
  | "issuingAuthority"
  | "issuingCountry"
  | "notes"
  | "type"
  | "updatedAt"
>

export type PersonTravelSnapshot = PersonTravelSnapshotRecord

export interface PersonCommercialContextTabSlot {
  label?: string
  count?: number
  content: ReactNode
}

export interface PersonDetailPageSlots {
  afterTopBar?: ReactNode
  sidebarEnd?: ReactNode
  overviewEnd?: ReactNode
  opportunitiesEnd?: ReactNode
  activitiesEnd?: ReactNode
  relationshipsEnd?: ReactNode
  documentsEnd?: ReactNode
  bookingsTab?: PersonCommercialContextTabSlot
  invoicesTab?: PersonCommercialContextTabSlot
  paymentsTab?: PersonCommercialContextTabSlot
  contractsTab?: PersonCommercialContextTabSlot
}

export interface PersonDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onOrganizationOpen?: (organizationId: string) => void
  slots?: PersonDetailPageSlots
}

export function PersonDetailPage({
  id,
  className,
  onBack,
  onDeleted,
  onOrganizationOpen,
  slots,
}: PersonDetailPageProps) {
  const messages = useCrmUiMessagesOrDefault()
  const [activeTab, setActiveTab] = useState<PersonDetailTab>("overview")
  const [editOpen, setEditOpen] = useState(false)
  const personQuery = usePerson(id)
  const { remove, update } = usePersonMutation()
  const person = personQuery.data

  useEffect(() => {
    const activeCommercialTabIsAvailable =
      (activeTab === "bookings" && Boolean(slots?.bookingsTab)) ||
      (activeTab === "invoices" && Boolean(slots?.invoicesTab)) ||
      (activeTab === "payments" && Boolean(slots?.paymentsTab)) ||
      (activeTab === "contracts" && Boolean(slots?.contractsTab))

    if (isPersonCommercialTab(activeTab) && !activeCommercialTabIsAvailable) {
      setActiveTab("overview")
    }
  }, [activeTab, slots?.bookingsTab, slots?.invoicesTab, slots?.paymentsTab, slots?.contractsTab])

  const organizationQuery = useOrganization(person?.organizationId ?? undefined, {
    enabled: Boolean(person?.organizationId),
  })
  const opportunitiesQuery = useOpportunities({
    personId: id,
    limit: 50,
    enabled: Boolean(person),
  })
  const activitiesQuery = useActivities({
    entityType: "person",
    entityId: id,
    limit: 50,
    enabled: Boolean(person),
  })
  const relationshipsQuery = usePersonRelationships(id, {
    direction: "both",
    limit: 50,
    enabled: Boolean(person),
  })
  const documentsQuery = usePersonDocuments(id, {
    limit: 50,
    enabled: Boolean(person),
  })
  const travelSnapshotQuery = usePersonTravelSnapshot(id, {
    enabled: Boolean(person),
  })

  const updateField = async (patch: UpdatePersonInput) => {
    await update.mutateAsync({ id, input: patch })
  }

  if (personQuery.isPending) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!person) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4 py-12", className)}>
        <p className="text-muted-foreground">{messages.personDetailPage.notFound}</p>
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            {messages.personDetailPage.backToPeople}
          </Button>
        ) : null}
      </div>
    )
  }

  const opportunities = opportunitiesQuery.data?.data ?? []
  const activities = activitiesQuery.data?.data ?? []
  const relationships = relationshipsQuery.data?.data ?? []
  const documents = documentsQuery.data?.data ?? []
  const travelSnapshot = travelSnapshotQuery.data?.data ?? null
  const organization = organizationQuery.data ?? null
  const displayName = personDisplayName(person, messages.personCard.unnamed)
  const totalOpenValue = opportunities
    .filter((opportunity) => opportunity.status === "open")
    .reduce((sum, opportunity) => sum + (opportunity.valueAmountCents ?? 0), 0)
  const primaryCurrency =
    opportunities[0]?.valueCurrency ??
    person.preferredCurrency ??
    organization?.defaultCurrency ??
    null

  return (
    <div data-slot="person-detail-page" className={cn("flex min-h-screen flex-col", className)}>
      <PersonTopBar
        personName={displayName}
        onBack={() => onBack?.()}
        onEdit={() => setEditOpen(true)}
        deletePending={remove.isPending}
        onDelete={async () => {
          await remove.mutateAsync(id)
          onDeleted?.()
          onBack?.()
        }}
      />
      {slots?.afterTopBar}

      <div className="grid flex-1 grid-cols-12 gap-4 p-4 lg:p-6">
        <PersonSidebar
          person={person}
          organization={organization}
          onOrganizationOpen={onOrganizationOpen}
          onUpdateField={updateField}
        >
          {slots?.sidebarEnd}
        </PersonSidebar>
        <PersonMain
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          person={person}
          organization={organization}
          opportunities={opportunities}
          activities={activities}
          relationships={relationships}
          documents={documents}
          travelSnapshot={travelSnapshot}
          opportunitiesPending={opportunitiesQuery.isPending}
          activitiesPending={activitiesQuery.isPending}
          relationshipsPending={relationshipsQuery.isPending}
          documentsPending={documentsQuery.isPending}
          travelSnapshotPending={travelSnapshotQuery.isPending}
          totalOpenValue={totalOpenValue}
          primaryCurrency={primaryCurrency}
          onUpdateField={updateField}
          slots={slots}
        />
      </div>

      <PersonDialog open={editOpen} onOpenChange={setEditOpen} person={person} />
    </div>
  )
}

export interface PersonTopBarProps {
  personName: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  deletePending: boolean
}

export function PersonTopBar({
  personName,
  onBack,
  onEdit,
  onDelete,
  deletePending,
}: PersonTopBarProps) {
  const messages = useCrmUiMessagesOrDefault()

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="size-8">
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          {messages.personDetail.topBar.people}
        </button>
        <span>/</span>
        <span className="truncate text-foreground">{personName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
          {messages.personDetail.topBar.edit}
        </Button>
        <ConfirmActionButton
          buttonLabel={messages.personDetail.topBar.delete}
          confirmLabel={messages.personDetail.topBar.delete}
          title={messages.personDetail.topBar.deleteTitle}
          description={messages.personDetail.topBar.deleteDescription}
          variant="destructive"
          confirmVariant="destructive"
          disabled={deletePending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}

export interface PersonSidebarProps {
  person: PersonData
  organization: PersonOrganization | null
  onOrganizationOpen?: (organizationId: string) => void
  onUpdateField: (patch: UpdatePersonInput) => Promise<void>
  children?: ReactNode
}

export function PersonSidebar({
  person,
  organization,
  onOrganizationOpen,
  onUpdateField,
  children,
}: PersonSidebarProps) {
  const messages = useCrmUiMessagesOrDefault()
  const displayName = personDisplayName(person, messages.personCard.unnamed)
  const websiteHref = person.website
    ? person.website.startsWith("http")
      ? person.website
      : `https://${person.website}`
    : undefined
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
          <Avatar className="size-20">
            <AvatarFallback className="text-xl">{initialsFrom(displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex max-w-full flex-col gap-1">
            <h2 className="truncate text-lg font-semibold leading-tight">{displayName}</h2>
            {person.jobTitle ? (
              <p className="truncate text-sm text-muted-foreground">{person.jobTitle}</p>
            ) : null}
            {organization ? (
              <button
                type="button"
                onClick={() => onOrganizationOpen?.(organization.id)}
                className="truncate text-sm text-primary hover:underline"
              >
                {organization.name}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {person.relation ? (
              <Badge variant="secondary">
                {messages.common.relationTypeLabels[
                  person.relation as keyof typeof messages.common.relationTypeLabels
                ] ?? person.relation}
              </Badge>
            ) : null}
            <Badge variant="outline">
              {messages.common.recordStatusLabels[
                person.status as keyof typeof messages.common.recordStatusLabels
              ] ?? person.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {messages.personDetail.sidebar.about}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <InlineField
            icon={User}
            label={messages.personDetail.sidebar.fields.firstName}
            value={person.firstName}
            onSave={(next) => onUpdateField({ firstName: next ?? person.firstName })}
          />
          <InlineField
            icon={User}
            label={messages.personDetail.sidebar.fields.lastName}
            value={person.lastName}
            onSave={(next) => onUpdateField({ lastName: next ?? person.lastName })}
          />
          <InlineField
            icon={BriefcaseBusiness}
            label={messages.personDetail.sidebar.fields.jobTitle}
            value={person.jobTitle}
            onSave={(next) => onUpdateField({ jobTitle: next })}
          />
          <InlineField
            icon={Mail}
            label={messages.personDetail.sidebar.fields.email}
            kind="email"
            value={person.email}
            onSave={(next) => onUpdateField({ email: next })}
          />
          <InlineField
            icon={Phone}
            label={messages.personDetail.sidebar.fields.phone}
            value={person.phone}
            onSave={(next) => onUpdateField({ phone: next })}
          />
          <InlineField
            icon={Globe}
            label={messages.personDetail.sidebar.fields.website}
            kind="url"
            value={person.website}
            onSave={(next) => onUpdateField({ website: next })}
          />
          <InlineSelectField
            icon={Users}
            label={messages.personDetail.sidebar.fields.relation}
            value={person.relation}
            options={relationOptions}
            onSave={(next) => onUpdateField({ relation: next })}
          />
          <InlineSelectField
            icon={CircleDot}
            label={messages.personDetail.sidebar.fields.status}
            value={person.status}
            options={statusOptions}
            allowClear={false}
            onSave={(next) => onUpdateField({ status: next ?? "active" })}
          />
          <InlineCurrencyField
            label={messages.personDetail.sidebar.fields.preferredCurrency}
            value={person.preferredCurrency}
            onSave={(next) => onUpdateField({ preferredCurrency: next })}
          />
          <InlineLanguageField
            icon={Languages}
            label={messages.personDetail.sidebar.fields.preferredLanguage}
            value={person.preferredLanguage}
            onSave={(next) => onUpdateField({ preferredLanguage: next })}
          />
          <InlineField
            icon={Calendar}
            label={messages.personDetail.sidebar.fields.birthday}
            value={person.birthday}
            onSave={(next) => onUpdateField({ birthday: next })}
          />
          <InlineField
            icon={Tag}
            label={messages.personDetail.sidebar.fields.source}
            value={person.source}
            onSave={(next) => onUpdateField({ source: next })}
          />
        </CardContent>
      </Card>

      {websiteHref ? (
        <a
          href={websiteHref}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Globe className="size-4" aria-hidden="true" />
          {messages.personDetail.sidebar.openWebsite}
        </a>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {messages.personDetail.sidebar.tags}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TagsEditor tags={person.tags} onChange={(tags) => onUpdateField({ tags })} />
        </CardContent>
      </Card>

      {children}
    </aside>
  )
}

export interface PersonMainProps {
  activeTab: PersonDetailTab
  setActiveTab: (value: PersonDetailTab) => void
  person: PersonData
  organization: PersonOrganization | null
  opportunities: PersonOpportunity[]
  activities: PersonActivity[]
  relationships: PersonRelationship[]
  documents: PersonDocument[]
  travelSnapshot: PersonTravelSnapshot | null
  opportunitiesPending: boolean
  activitiesPending: boolean
  relationshipsPending: boolean
  documentsPending: boolean
  travelSnapshotPending: boolean
  totalOpenValue: number
  primaryCurrency: string | null
  onUpdateField: (patch: UpdatePersonInput) => Promise<void>
  slots?: PersonDetailPageSlots
}

export function PersonMain({
  activeTab,
  setActiveTab,
  person,
  organization,
  opportunities,
  activities,
  relationships,
  documents,
  travelSnapshot,
  opportunitiesPending,
  activitiesPending,
  relationshipsPending,
  documentsPending,
  travelSnapshotPending,
  totalOpenValue,
  primaryCurrency,
  onUpdateField,
  slots,
}: PersonMainProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()
  const openOpportunities = opportunities.filter((opportunity) => opportunity.status === "open")
  const primaryDocuments = documents.filter((document) => document.isPrimary)

  return (
    <main className="col-span-12 flex flex-col gap-4 lg:col-span-9">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard
          label={messages.personDetail.metrics.openOpportunities}
          value={openOpportunities.length}
        />
        <MetricCard
          label={messages.personDetail.metrics.pipelineValue}
          value={formatCrmMoney(i18n, totalOpenValue, primaryCurrency)}
        />
        <MetricCard label={messages.personDetail.metrics.documents} value={documents.length} />
        <MetricCard label={messages.personDetail.metrics.activities} value={activities.length} />
      </div>

      <Card>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PersonDetailTab)}>
          <CardHeader className="pb-0">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="overview">{messages.personDetail.tabs.overview}</TabsTrigger>
              <TabsTrigger value="opportunities">
                {messages.personDetail.tabs.opportunities} ({opportunities.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                {messages.personDetail.tabs.activities} ({activities.length})
              </TabsTrigger>
              <TabsTrigger value="relationships">
                {messages.personDetail.tabs.relationships} ({relationships.length})
              </TabsTrigger>
              <TabsTrigger value="documents">
                {messages.personDetail.tabs.documents} ({documents.length})
              </TabsTrigger>
              {slots?.bookingsTab ? (
                <TabsTrigger value="bookings">
                  {formatTabLabel(messages.personDetail.tabs.bookings, slots.bookingsTab)}
                </TabsTrigger>
              ) : null}
              {slots?.invoicesTab ? (
                <TabsTrigger value="invoices">
                  {formatTabLabel(messages.personDetail.tabs.invoices, slots.invoicesTab)}
                </TabsTrigger>
              ) : null}
              {slots?.paymentsTab ? (
                <TabsTrigger value="payments">
                  {formatTabLabel(messages.personDetail.tabs.payments, slots.paymentsTab)}
                </TabsTrigger>
              ) : null}
              {slots?.contractsTab ? (
                <TabsTrigger value="contracts">
                  {formatTabLabel(messages.personDetail.tabs.contracts, slots.contractsTab)}
                </TabsTrigger>
              ) : null}
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="overview" className="m-0">
              <PersonOverviewPanel
                person={person}
                organization={organization}
                travelSnapshot={travelSnapshot}
                travelSnapshotPending={travelSnapshotPending}
                onUpdateField={onUpdateField}
              />
              {slots?.overviewEnd}
            </TabsContent>
            <TabsContent value="opportunities" className="m-0">
              <PersonOpportunitiesPanel
                opportunities={opportunities}
                opportunitiesPending={opportunitiesPending}
              />
              {slots?.opportunitiesEnd}
            </TabsContent>
            <TabsContent value="activities" className="m-0">
              <PersonActivitiesPanel
                activities={activities}
                activitiesPending={activitiesPending}
              />
              {slots?.activitiesEnd}
            </TabsContent>
            <TabsContent value="relationships" className="m-0">
              <PersonRelationshipsPanel
                personId={person.id}
                relationships={relationships}
                relationshipsPending={relationshipsPending}
              />
              {slots?.relationshipsEnd}
            </TabsContent>
            <TabsContent value="documents" className="m-0">
              <PersonDocumentsPanel
                documents={documents}
                documentsPending={documentsPending}
                primaryCount={primaryDocuments.length}
              />
              {slots?.documentsEnd}
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
        <Pencil className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{messages.personDetail.hint}</span>
      </div>
    </main>
  )
}

function formatTabLabel(defaultLabel: string, slot: PersonCommercialContextTabSlot): ReactNode {
  const label = slot.label ?? defaultLabel
  return typeof slot.count === "number" ? `${label} (${slot.count})` : label
}

function isPersonCommercialTab(
  tab: PersonDetailTab,
): tab is "bookings" | "invoices" | "payments" | "contracts" {
  return tab === "bookings" || tab === "invoices" || tab === "payments" || tab === "contracts"
}

export interface MetricCardProps {
  label: string
  value: ReactNode
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

export interface PersonOverviewPanelProps {
  person: PersonData
  organization: PersonOrganization | null
  travelSnapshot: PersonTravelSnapshot | null
  travelSnapshotPending: boolean
  onUpdateField: (patch: UpdatePersonInput) => Promise<void>
}

export function PersonOverviewPanel({
  person,
  organization,
  travelSnapshot,
  travelSnapshotPending,
  onUpdateField,
}: PersonOverviewPanelProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()
  const snapshotRows = useMemo(
    () =>
      travelSnapshot
        ? [
            {
              label: messages.personDetail.sections.dateOfBirth,
              value: travelSnapshot.dateOfBirth
                ? formatCrmDate(i18n, travelSnapshot.dateOfBirth)
                : null,
            },
            {
              label: messages.personDetail.sections.dietaryRequirements,
              value: travelSnapshot.dietaryRequirements,
            },
            {
              label: messages.personDetail.sections.accessibilityNeeds,
              value: travelSnapshot.accessibilityNeeds,
            },
            {
              label: messages.personDetail.sections.passportExpiry,
              value: travelSnapshot.passportExpiry
                ? formatCrmDate(i18n, travelSnapshot.passportExpiry)
                : null,
            },
            {
              label: messages.personDetail.sections.passportIssuingCountry,
              value: travelSnapshot.passportIssuingCountry,
            },
            {
              label: messages.personDetail.sections.passportIssuingAuthority,
              value: travelSnapshot.passportIssuingAuthority,
            },
          ].filter((row) => Boolean(row.value))
        : [],
    [i18n, messages, travelSnapshot],
  )

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <OverviewTerm label={messages.personDetail.sections.created}>
          {formatCrmDate(i18n, person.createdAt)}
        </OverviewTerm>
        <OverviewTerm label={messages.personDetail.sections.updated}>
          {formatCrmRelative(i18n, person.updatedAt)}
        </OverviewTerm>
        {organization ? (
          <OverviewTerm label={messages.personDetail.sections.organization}>
            {organization.name}
          </OverviewTerm>
        ) : null}
        {person.birthday ? (
          <OverviewTerm label={messages.personDetail.sections.birthday}>
            {formatCrmDate(i18n, person.birthday)}
          </OverviewTerm>
        ) : null}
        {person.notes ? (
          <OverviewTerm label={messages.personDetail.sections.notes} className="sm:col-span-2">
            <span className="whitespace-pre-wrap">{person.notes}</span>
          </OverviewTerm>
        ) : null}
      </dl>

      <Separator />
      <InlineField
        label={messages.personDetail.sections.notes}
        kind="textarea"
        value={person.notes}
        onSave={(next) => onUpdateField({ notes: next })}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            {messages.personDetail.sections.travelProfile}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {travelSnapshotPending ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : snapshotRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {messages.personDetail.empty.noTravelProfile}
            </p>
          ) : (
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              {snapshotRows.map((row) => (
                <OverviewTerm key={row.label} label={row.label}>
                  {row.value}
                </OverviewTerm>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export interface OverviewTermProps {
  label: string
  children: ReactNode
  className?: string
}

export function OverviewTerm({ label, children, className }: OverviewTermProps) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

export interface PersonOpportunitiesPanelProps {
  opportunities: PersonOpportunity[]
  opportunitiesPending: boolean
}

export function PersonOpportunitiesPanel({
  opportunities,
  opportunitiesPending,
}: PersonOpportunitiesPanelProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()

  if (opportunitiesPending) {
    return <LoadingRow />
  }

  if (opportunities.length === 0) {
    return <EmptyRow>{messages.personDetail.empty.noOpportunities}</EmptyRow>
  }

  return (
    <ul className="divide-y">
      {opportunities.map((opportunity) => {
        const statusLabel =
          messages.common.opportunityStatusLabels[
            opportunity.status as keyof typeof messages.common.opportunityStatusLabels
          ] ?? opportunity.status
        return (
          <li key={opportunity.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{opportunity.title}</p>
              <p className="text-xs text-muted-foreground">
                {statusLabel} - {formatCrmDate(i18n, opportunity.expectedCloseDate)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm font-medium">
                <TrendingUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {formatCrmMoney(i18n, opportunity.valueAmountCents, opportunity.valueCurrency)}
              </span>
              <Badge variant="outline">{statusLabel}</Badge>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export interface PersonActivitiesPanelProps {
  activities: PersonActivity[]
  activitiesPending: boolean
}

export function PersonActivitiesPanel({
  activities,
  activitiesPending,
}: PersonActivitiesPanelProps) {
  const messages = useCrmUiMessagesOrDefault()
  const i18n = useCrmUiI18nOrDefault()

  if (activitiesPending) {
    return <LoadingRow />
  }

  if (activities.length === 0) {
    return <EmptyRow>{messages.personDetail.empty.noActivities}</EmptyRow>
  }

  return (
    <ul className="divide-y">
      {activities.map((activity) => (
        <li key={activity.id} className="py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{activity.subject}</p>
              {activity.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{activity.description}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline">
                {messages.common.activityTypeLabels[
                  (activity.type ?? "note") as keyof typeof messages.common.activityTypeLabels
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
  )
}

export interface PersonRelationshipsPanelProps {
  personId: string
  relationships: PersonRelationship[]
  relationshipsPending: boolean
}

export function PersonRelationshipsPanel({
  personId,
  relationships,
  relationshipsPending,
}: PersonRelationshipsPanelProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()

  if (relationshipsPending) {
    return <LoadingRow />
  }

  if (relationships.length === 0) {
    return <EmptyRow>{messages.personDetail.empty.noRelationships}</EmptyRow>
  }

  return (
    <ul className="divide-y">
      {relationships.map((relationship) => {
        const relatedPersonId =
          relationship.fromPersonId === personId
            ? relationship.toPersonId
            : relationship.fromPersonId
        const kindLabel =
          messages.personDetail.relationshipKindLabels[
            relationship.kind as keyof typeof messages.personDetail.relationshipKindLabels
          ] ?? relationship.kind
        return (
          <li key={relationship.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{relatedPersonId}</p>
              <p className="text-xs text-muted-foreground">
                {kindLabel}
                {relationship.startDate ? ` - ${formatCrmDate(i18n, relationship.startDate)}` : ""}
              </p>
              {relationship.notes ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{relationship.notes}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              {relationship.isPrimary ? (
                <Badge variant="secondary">{messages.personDetail.sections.primary}</Badge>
              ) : null}
              <Badge variant="outline">{kindLabel}</Badge>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export interface PersonDocumentsPanelProps {
  documents: PersonDocument[]
  documentsPending: boolean
  primaryCount: number
}

export function PersonDocumentsPanel({
  documents,
  documentsPending,
  primaryCount,
}: PersonDocumentsPanelProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()

  if (documentsPending) {
    return <LoadingRow />
  }

  if (documents.length === 0) {
    return <EmptyRow>{messages.personDetail.empty.noDocuments}</EmptyRow>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" aria-hidden="true" />
        <span>
          {primaryCount} {messages.personDetail.sections.primary}
        </span>
      </div>
      <ul className="divide-y">
        {documents.map((document) => {
          const typeLabel =
            messages.personDetail.documentTypeLabels[
              document.type as keyof typeof messages.personDetail.documentTypeLabels
            ] ?? document.type
          return (
            <li key={document.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{typeLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {document.issuingCountry ?? messages.common.none} -{" "}
                  {formatCrmDate(i18n, document.expiryDate)}
                </p>
                {document.issuingAuthority ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {document.issuingAuthority}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                {document.isPrimary ? (
                  <Badge variant="secondary">{messages.personDetail.sections.primary}</Badge>
                ) : null}
                <Badge variant="outline">{typeLabel}</Badge>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export interface EmptyRowProps {
  children: ReactNode
}

export function EmptyRow({ children }: EmptyRowProps) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function LoadingRow() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

export function personDisplayName(
  person: Pick<PersonRecord, "firstName" | "lastName">,
  fallback: string,
) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || fallback
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
