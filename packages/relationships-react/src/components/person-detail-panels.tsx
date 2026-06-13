"use client"

import { Badge, Card, CardContent, ConfirmActionButton } from "@voyantjs/ui/components"
import { Separator } from "@voyantjs/ui/components/separator"
import { Eye, EyeOff, FileText, Loader2, Pencil } from "lucide-react"
import { type ReactNode, useState } from "react"

import { useCrmUiI18nOrDefault, useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { PersonRecord, UpdatePersonInput } from "../index.js"
import { usePerson, usePersonDocumentMutation, useRevealPersonDocument } from "../index.js"
import { formatCrmDate, formatCrmRelative } from "./crm-format.js"
import { InlineField } from "./inline-field.js"
import type {
  PersonActivity,
  PersonData,
  PersonDocument,
  PersonOrganization,
  PersonRelationship,
} from "./person-detail-types.js"
import { PersonDocumentDialog } from "./person-document-dialog.js"

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
  onUpdateField: (patch: UpdatePersonInput) => Promise<void>
}

export function PersonOverviewPanel({
  person,
  organization,
  onUpdateField,
}: PersonOverviewPanelProps) {
  const i18n = useCrmUiI18nOrDefault()
  const messages = useCrmUiMessagesOrDefault()

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
        {person.dateOfBirth ? (
          <OverviewTerm label={messages.personDetail.sections.dateOfBirth}>
            {formatCrmDate(i18n, person.dateOfBirth)}
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
  onPersonOpen?: (personId: string) => void
}

export function PersonRelationshipsPanel({
  personId,
  relationships,
  relationshipsPending,
  onPersonOpen,
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
              <RelatedPersonName personId={relatedPersonId} onPersonOpen={onPersonOpen} />
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

function RelatedPersonName({
  personId,
  onPersonOpen,
}: {
  personId: string
  onPersonOpen?: (personId: string) => void
}) {
  const messages = useCrmUiMessagesOrDefault()
  const personQuery = usePerson(personId)
  const person = personQuery.data
  const label = person
    ? personDisplayName(person, messages.personCard.unnamed)
    : personQuery.isPending
      ? "…"
      : personId

  if (!onPersonOpen) {
    return <p className="truncate text-sm font-medium">{label}</p>
  }

  return (
    <button
      type="button"
      onClick={() => onPersonOpen(personId)}
      className="truncate text-left text-sm font-medium text-foreground hover:underline"
    >
      {label}
    </button>
  )
}

export interface PersonDocumentsPanelProps {
  documents: PersonDocument[]
  documentsPending: boolean
  primaryCount: number
  personId?: string
}

export function PersonDocumentsPanel({
  documents,
  documentsPending,
  primaryCount,
  personId,
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
        {documents.map((document) => (
          <PersonDocumentRow
            key={document.id}
            document={document}
            personId={personId}
            typeLabel={
              messages.personDetail.documentTypeLabels[
                document.type as keyof typeof messages.personDetail.documentTypeLabels
              ] ?? document.type
            }
            formattedExpiry={formatCrmDate(i18n, document.expiryDate)}
            noneLabel={messages.common.none}
            primaryLabel={messages.personDetail.sections.primary}
          />
        ))}
      </ul>
    </div>
  )
}

function PersonDocumentRow({
  document,
  personId,
  typeLabel,
  formattedExpiry,
  noneLabel,
  primaryLabel,
}: {
  document: PersonDocument
  personId?: string
  typeLabel: string
  formattedExpiry: string
  noneLabel: string
  primaryLabel: string
}) {
  const [revealed, setRevealed] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const revealQuery = useRevealPersonDocument(document.id, { enabled: revealed })
  const mutation = usePersonDocumentMutation(personId)
  const docMessages = useCrmUiMessagesOrDefault().personDocument
  const editable = Boolean(personId)
  const revealError = revealed && revealQuery.error
  const revealedNumber = revealQuery.data?.data.number ?? null

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{typeLabel}</p>
        <p className="text-xs text-muted-foreground">
          {document.issuingCountry ?? noneLabel} - {formattedExpiry}
        </p>
        {document.issuingAuthority ? (
          <p className="truncate text-xs text-muted-foreground">{document.issuingAuthority}</p>
        ) : null}
        {revealed ? (
          <p className="mt-1 font-mono text-xs">
            {revealQuery.isLoading
              ? docMessages.row.decrypting
              : (revealedNumber ?? docMessages.row.noNumberOnFile)}
          </p>
        ) : null}
        {revealError ? (
          <p className="mt-1 text-[10px] text-destructive">
            {revealError instanceof Error ? revealError.message : docMessages.row.revealFailed}
          </p>
        ) : null}
      </div>
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-end gap-1">
          {document.isPrimary ? <Badge variant="secondary">{primaryLabel}</Badge> : null}
          <Badge variant="outline">{typeLabel}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={revealed ? docMessages.row.hideAria : docMessages.row.revealAria}
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          {editable ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={docMessages.row.editAria}
            >
              <Pencil className="size-3.5" />
            </button>
          ) : null}
          {editable ? (
            <ConfirmActionButton
              buttonLabel={docMessages.row.deleteButton}
              title={docMessages.row.deleteTitle}
              description={docMessages.row.deleteDescription}
              confirmLabel={docMessages.row.deleteConfirm}
              variant="ghost"
              confirmVariant="destructive"
              disabled={mutation.remove.isPending}
              onConfirm={async () => {
                await mutation.remove.mutateAsync(document.id)
              }}
            />
          ) : null}
        </div>
      </div>
      {editable && personId ? (
        <PersonDocumentDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          personId={personId}
          document={document}
        />
      ) : null}
    </li>
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
