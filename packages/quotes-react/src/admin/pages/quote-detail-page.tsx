"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"
import { useAdminNavigate } from "@voyant-travel/admin"
import { formatMessage } from "@voyant-travel/i18n"
import { useActivities, useOrganization, usePerson } from "@voyant-travel/relationships-react"
// Type-only: binds the relationships-react `AdminDestinations` augmentation
// (`person.detail`, `organization.detail`) into this program so the
// participant rows can navigate through those shared keys.
import type {} from "@voyant-travel/relationships-react/admin"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { ArrowLeft, Ban, CheckCircle2, Loader2, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { formatCrmDate, formatCrmMoney, formatCrmRelative } from "../../components/crm-format.js"
import { useCrmUiI18nOrDefault } from "../../i18n/index.js"
import type { CrmQuoteVersionStatus } from "../../i18n/messages.js"
import {
  useQuote,
  useQuoteMutation,
  useQuoteParticipantMutation,
  useQuoteParticipants,
  useQuoteProductMutation,
  useQuoteProducts,
  useQuoteVersionMutation,
  useQuoteVersions,
  useStages,
} from "../../index.js"
import {
  QuoteClientCard,
  QuoteLineItemsCard,
  QuoteOwnershipCard,
  QuoteTravelersCard,
} from "../quote-content-sections.js"
import { QuoteActivitiesCard, QuoteDetailsCard, QuoteTagsCard } from "../quote-detail-sections.js"

/**
 * Packaged admin page for a single Quote (packaged-admin RFC Phase 3). The
 * quote workspace: editable deal fields, the linked client (person /
 * organization, resolved through relationships-react), the activity timeline,
 * tags, and the quote's VERSIONS nested inline (created in context, currency
 * inherited). Versions are never a top-level surface — they are revisions of a
 * quote. Status transitions (won/lost/reopen) move the quote to the matching
 * closed stage when the pipeline declares one. Cross-domain client data flows
 * through relationships-react (optional peer); links resolve via the shared
 * `person.detail` / `organization.detail` semantic destinations.
 */
export default function QuoteDetailPage({ params }: AdminRoutePageProps) {
  const id = params.id ?? ""
  const i18n = useCrmUiI18nOrDefault()
  const { messages } = i18n
  const t = messages.quoteDetailPage
  const navigate = useAdminNavigate()

  const [lostReasonDraft, setLostReasonDraft] = useState("")
  const [showLostDialog, setShowLostDialog] = useState(false)

  const quoteQuery = useQuote(id)
  const quote = quoteQuery.data
  const { update, remove } = useQuoteMutation()
  const versionMutation = useQuoteVersionMutation()
  const productMutation = useQuoteProductMutation()
  const participantMutation = useQuoteParticipantMutation()

  const stagesQuery = useStages({
    pipelineId: quote?.pipelineId,
    limit: 100,
    enabled: Boolean(quote?.pipelineId),
  })
  const versionsQuery = useQuoteVersions({ quoteId: id, limit: 50, enabled: Boolean(quote) })
  const personQuery = usePerson(quote?.personId ?? undefined, {
    enabled: Boolean(quote?.personId),
  })
  const organizationQuery = useOrganization(quote?.organizationId ?? undefined, {
    enabled: Boolean(quote?.organizationId),
  })
  const activitiesQuery = useActivities({
    entityType: "quote",
    entityId: id,
    limit: 50,
    enabled: Boolean(quote),
  })
  const productsQuery = useQuoteProducts(id, { enabled: Boolean(quote) })
  const participantsQuery = useQuoteParticipants(id, { enabled: Boolean(quote) })

  const stages = useMemo(
    () => [...(stagesQuery.data?.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [stagesQuery.data],
  )
  const versions = versionsQuery.data?.data ?? []
  // Number versions by creation order (v1 = first saved) and show newest first.
  // Ordering by createdAt is stable; updatedAt ties when a snapshot supersedes
  // its predecessor in the same instant.
  const versionNumberById = new Map<string, number>()
  ;[...versions]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .forEach((version, index) => {
      versionNumberById.set(version.id, index + 1)
    })
  const orderedVersions = [...versions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
  // The current/active version is the newest one still live (draft or sent);
  // once a newer proposal is saved the prior one is expired.
  const currentVersionId =
    orderedVersions.find((version) => version.status === "draft" || version.status === "sent")
      ?.id ?? null
  // Quote value is derived from its line items — the backend persists the same
  // sum on every product change; computing it here keeps the detail correct
  // immediately (even before a mutation lands).
  const itemsTotalCents = (productsQuery.data?.data ?? []).reduce(
    (sum, product) =>
      sum +
      product.quantity * (product.unitPriceAmountCents ?? 0) -
      (product.discountAmountCents ?? 0),
    0,
  )
  // The quote is "dirty" (a new proposal can be saved) when it has line items
  // and has changed since the last version snapshot was taken.
  const lastSnapshotAt = versions.reduce(
    (max, version) => Math.max(max, Date.parse(version.createdAt)),
    0,
  )
  const hasUnsavedChanges =
    (productsQuery.data?.data ?? []).length > 0 &&
    (quote ? Date.parse(quote.updatedAt) > lastSnapshotAt : false)

  const goToList = () => navigate("quote.list", {})

  const updateField = async (patch: Record<string, unknown>) => {
    await update.mutateAsync({ id, input: patch })
  }

  if (quoteQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{t.notFound}</p>
        <Button variant="outline" onClick={goToList}>
          {t.back}
        </Button>
      </div>
    )
  }

  async function markWon() {
    const wonStage = stages.find((stage) => stage.isWon)
    await updateField({ status: "won", ...(wonStage ? { stageId: wonStage.id } : {}) })
  }

  async function submitLost() {
    const lostStage = stages.find((stage) => stage.isLost)
    await updateField({
      status: "lost",
      lostReason: lostReasonDraft.trim() || null,
      ...(lostStage ? { stageId: lostStage.id } : {}),
    })
    setShowLostDialog(false)
    setLostReasonDraft("")
  }

  async function reopen() {
    await updateField({ status: "open", lostReason: null })
  }

  async function save() {
    await versionMutation.snapshot.mutateAsync({ quoteId: id })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
        <Button variant="ghost" size="icon" onClick={goToList} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <button type="button" onClick={goToList} className="hover:text-foreground">
            {t.breadcrumbRoot}
          </button>
          <span>/</span>
          <span className="truncate text-foreground">{quote.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!hasUnsavedChanges || versionMutation.snapshot.isPending}
          >
            {versionMutation.snapshot.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {t.save}
          </Button>
          {quote.status === "open" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void markWon()}
                disabled={update.isPending}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {t.markWon}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLostDialog(true)}
                disabled={update.isPending}
              >
                <Ban className="mr-1.5 h-4 w-4" />
                {t.markLost}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reopen()}
              disabled={update.isPending}
            >
              {t.reopen}
            </Button>
          )}
          <ConfirmActionButton
            buttonLabel={t.delete}
            confirmLabel={t.deleteConfirm.confirm}
            cancelLabel={messages.common.cancel}
            title={t.deleteConfirm.title}
            description={t.deleteConfirm.description}
            variant="destructive"
            confirmVariant="destructive"
            disabled={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync(id)
              goToList()
            }}
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-12 gap-4 p-4 lg:p-6">
        <aside className="col-span-12 flex flex-col gap-4 lg:col-span-4">
          <QuoteDetailsCard
            quote={{ ...quote, valueAmountCents: itemsTotalCents }}
            stages={stages}
            onUpdateField={updateField}
          />
          <QuoteClientCard
            person={personQuery.data}
            organization={organizationQuery.data}
            busy={update.isPending}
            onSetPerson={async (personId) => {
              await updateField({ personId })
            }}
            onSetOrganization={async (organizationId) => {
              await updateField({ organizationId })
            }}
            onOpenPerson={() => {
              if (quote.personId) navigate("person.detail", { personId: quote.personId })
            }}
            onOpenOrganization={() => {
              if (quote.organizationId) {
                navigate("organization.detail", { organizationId: quote.organizationId })
              }
            }}
          />
          <QuoteTravelersCard
            travelers={participantsQuery.data?.data ?? []}
            paxCount={quote.paxCount}
            isPending={participantsQuery.isPending}
            busy={participantMutation.create.isPending || participantMutation.remove.isPending}
            onPaxCountChange={async (paxCount) => {
              await updateField({ paxCount })
            }}
            onAdd={async (personId) => {
              await participantMutation.create.mutateAsync({ quoteId: id, input: { personId } })
            }}
            onRemove={async (participantId) => {
              await participantMutation.remove.mutateAsync({ id: participantId, quoteId: id })
            }}
          />
          <QuoteOwnershipCard
            ownerId={quote.ownerId}
            createdBy={quote.createdBy}
            updatedBy={quote.updatedBy}
            createdAt={quote.createdAt}
            updatedAt={quote.updatedAt}
            busy={update.isPending}
            onSetOwner={async (ownerId) => {
              await updateField({ ownerId })
            }}
          />
          <QuoteTagsCard tags={quote.tags} onChange={(tags) => updateField({ tags })} />
        </aside>

        <main className="col-span-12 flex flex-col gap-4 lg:col-span-8">
          <QuoteLineItemsCard
            products={productsQuery.data?.data ?? []}
            isPending={productsQuery.isPending}
            currency={quote.valueCurrency ?? "USD"}
            busy={
              productMutation.create.isPending ||
              productMutation.update.isPending ||
              productMutation.remove.isPending
            }
            onAdd={async (input) => {
              await productMutation.create.mutateAsync({ quoteId: id, input })
            }}
            onUpdate={async (productId, input) => {
              await productMutation.update.mutateAsync({ id: productId, quoteId: id, input })
            }}
            onRemove={async (productId) => {
              await productMutation.remove.mutateAsync({ id: productId, quoteId: id })
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle>{t.versionsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {versionsQuery.isError ? (
                <p className="py-6 text-center text-destructive text-sm">{t.versionsLoadFailed}</p>
              ) : versionsQuery.isPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground text-sm">{t.versionsEmpty}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{messages.quoteVersionsPage.columns.quoteVersion}</TableHead>
                      <TableHead>{messages.quoteVersionsPage.columns.status}</TableHead>
                      <TableHead>{messages.quoteVersionsPage.columns.total}</TableHead>
                      <TableHead>{messages.quoteVersionsPage.columns.validUntil}</TableHead>
                      <TableHead>{messages.quoteVersionsPage.columns.updated}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderedVersions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell className="font-medium">
                          {version.label ??
                            formatMessage(t.versionLabel, {
                              number: versionNumberById.get(version.id) ?? 0,
                            })}
                        </TableCell>
                        <TableCell>
                          {version.id === currentVersionId
                            ? t.versionActive
                            : (messages.common.quoteVersionStatusLabels[
                                version.status as CrmQuoteVersionStatus
                              ] ?? version.status)}
                        </TableCell>
                        <TableCell>
                          {formatCrmMoney(i18n, version.totalAmountCents, version.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {version.id === currentVersionId ? (
                            <DatePicker
                              value={version.validUntil}
                              onChange={(next) =>
                                void versionMutation.setValidUntil.mutateAsync({
                                  id: version.id,
                                  validUntil: next,
                                })
                              }
                              placeholder={messages.createQuoteVersionDialog.placeholders.pickDate}
                              clearable
                            />
                          ) : version.validUntil ? (
                            formatCrmDate(i18n, version.validUntil)
                          ) : (
                            messages.common.none
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatCrmRelative(i18n, version.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <QuoteActivitiesCard
            isPending={activitiesQuery.isPending}
            activities={activitiesQuery.data?.data ?? []}
          />
        </main>
      </div>

      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.lostDialog.title}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{t.lostDialog.description}</p>
          <Textarea
            value={lostReasonDraft}
            onChange={(event) => setLostReasonDraft(event.target.value)}
            placeholder={t.lostDialog.placeholder}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowLostDialog(false)}>
              {messages.common.cancel}
            </Button>
            <Button size="sm" onClick={() => void submitLost()} disabled={update.isPending}>
              {t.lostDialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
