"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components/card"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import { Label } from "@voyant-travel/ui/components/label"
import { Separator } from "@voyant-travel/ui/components/separator"
import { Textarea } from "@voyant-travel/ui/components/textarea"
import { useBookingsUiMessagesOrDefault } from "../../../i18n/index.js"
import type { Draft } from "../../lib/draft-state.js"

/**
 * Operator-only finalization that isn't about payment: an internal note and the
 * document-generation settings (proforma vs invoice+contract, notify). Split
 * out of the Payment block since these don't affect the amount due.
 */
export function DocumentsStep({
  draft,
  setDraft,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.steps.documents}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4">
        {/* Booking status: draft, or live (confirmed when paid / awaiting
            payment otherwise — decided at commit). */}
        <div className="flex items-start gap-2 text-sm">
          <Checkbox
            id="bj-save-as-draft"
            checked={draft.saveAsDraft === true}
            onCheckedChange={(v) => setDraft({ ...draft, saveAsDraft: v === true })}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="bj-save-as-draft" className="cursor-pointer">
              {messages.bookingJourney.documents.saveAsDraft}
            </Label>
            <p className="text-muted-foreground text-xs">
              {messages.bookingJourney.documents.saveAsDraftHint}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bj-internal-notes">{messages.bookingJourney.review.internalNotes}</Label>
          <Textarea
            id="bj-internal-notes"
            value={draft.internalNotes ?? ""}
            onChange={(e) => setDraft({ ...draft, internalNotes: e.target.value })}
          />
        </div>
        {/* Document generation — proforma vs invoice+contract are mutually
            exclusive; both off = no documents generated on commit. */}
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <Label>{messages.bookingCreateDialog.labels.documentGenerationHeading}</Label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="bj-doc-proforma"
                checked={draft.documentGeneration?.invoiceType === "proforma"}
                onCheckedChange={(v) =>
                  setDraft({
                    ...draft,
                    documentGeneration:
                      v === true
                        ? {
                            contractDocument: false,
                            invoiceDocument: true,
                            invoiceType: "proforma",
                          }
                        : undefined,
                  })
                }
              />
              <Label htmlFor="bj-doc-proforma" className="cursor-pointer">
                {messages.bookingCreateDialog.labels.generateProforma}
              </Label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="bj-doc-invoice-contract"
                checked={
                  draft.documentGeneration?.contractDocument === true &&
                  draft.documentGeneration?.invoiceType !== "proforma"
                }
                onCheckedChange={(v) =>
                  setDraft({
                    ...draft,
                    documentGeneration:
                      v === true
                        ? {
                            contractDocument: true,
                            invoiceDocument: true,
                            invoiceType: "invoice",
                          }
                        : undefined,
                  })
                }
              />
              <Label htmlFor="bj-doc-invoice-contract" className="cursor-pointer">
                {messages.bookingCreateDialog.labels.generateInvoiceAndContract}
              </Label>
            </div>
            {/* Notification suppression — uncheck to skip the post-commit
                confirmation email. */}
            <div className="flex items-start gap-2 border-t pt-2 text-sm">
              <Checkbox
                id="bj-notify-traveler"
                checked={draft.suppressNotifications !== true}
                onCheckedChange={(v) => setDraft({ ...draft, suppressNotifications: v !== true })}
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="bj-notify-traveler" className="cursor-pointer">
                  {messages.bookingCreateDialog.fields.notifyTraveler}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {messages.bookingCreateDialog.fields.notifyTravelerHint}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
