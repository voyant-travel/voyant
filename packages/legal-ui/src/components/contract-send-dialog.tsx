import { type LegalContractRecord, useLegalContractMutation } from "@voyantjs/legal-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2, Mail, Paperclip } from "lucide-react"
import { useEffect, useState } from "react"

export interface ContractSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: LegalContractRecord
  /**
   * Recipient email — typically the linked person's primary email, resolved
   * by the caller (the operator template knows how to look it up via CRM).
   * The dialog uses this as the read-only "To" line; if absent the dialog
   * shows a warning and disables Send.
   */
  defaultRecipientEmail?: string | null
  /** Optional override for the prefilled subject. */
  defaultSubject?: string
  /** Optional override for the prefilled message body. */
  defaultMessage?: string
  /**
   * Optional list of attachment names that will accompany the email. The
   * dialog renders them as a paperclip-prefixed list so the operator sees
   * what's bundled (the contract PDF + any extras).
   */
  attachments?: ReadonlyArray<{ id: string; name: string }>
  onSent?: () => void
}

/**
 * Send-contract preview dialog. Renders an editable subject + message
 * over a read-only recipient line, so the operator can tweak the
 * customer-facing copy before flipping the contract to `sent`. The
 * actual `POST /:id/send` accepts the subject + message + recipient
 * overrides and forwards them on the lifecycle event for whichever
 * notification subscriber wires up email delivery downstream.
 */
export function ContractSendDialog({
  open,
  onOpenChange,
  contract,
  defaultRecipientEmail,
  defaultSubject,
  defaultMessage,
  attachments,
  onSent,
}: ContractSendDialogProps) {
  const { send } = useLegalContractMutation()

  const fallbackSubject =
    defaultSubject ?? `${contract.contractNumber ?? "Contract"} — please review and sign`
  const fallbackMessage =
    defaultMessage ??
    [
      "Hi,",
      "",
      `Please find attached the contract${
        contract.contractNumber ? ` ${contract.contractNumber}` : ""
      } for your booking.`,
      "",
      "Reply to this email if you have any questions before signing.",
      "",
      "Thanks,",
    ].join("\n")

  const [subject, setSubject] = useState(fallbackSubject)
  const [message, setMessage] = useState(fallbackMessage)

  // Reset the form when the dialog re-opens or the underlying contract /
  // defaults change — guarantees the operator never sees stale copy from
  // a previous Send attempt on a different contract.
  useEffect(() => {
    if (open) {
      setSubject(fallbackSubject)
      setMessage(fallbackMessage)
    }
  }, [open, fallbackSubject, fallbackMessage])

  const canSend = Boolean(defaultRecipientEmail) && !send.isPending
  const isAlreadySent = contract.status === "sent" || contract.status === "signed"

  const handleSend = async () => {
    await send.mutateAsync({
      id: contract.id,
      input: {
        recipientEmail: defaultRecipientEmail ?? null,
        subject: subject.trim() || null,
        message: message.trim() || null,
      },
    })
    onOpenChange(false)
    onSent?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Send contract</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {!defaultRecipientEmail ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              No recipient email on file for this contract. Link a person (or fill the billing
              contact's email) before sending.
            </div>
          ) : null}
          {isAlreadySent ? (
            <div
              role="status"
              className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
            >
              This contract has already been sent. Sending again will email the recipient another
              copy.
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label>To</Label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-mono">{defaultRecipientEmail ?? "—"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contract-send-subject">Subject</Label>
            <Input
              id="contract-send-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contract-send-message">Message</Label>
            <Textarea
              id="contract-send-message"
              rows={8}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The recipient will receive this message together with the contract PDF. Anything you
              change here is what gets delivered — this isn't a static preview.
            </p>
          </div>

          {attachments && attachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label>Attachments</Label>
              <ul className="flex flex-col gap-1 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-2">
                    <Paperclip className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{attachment.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={send.isPending}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSend} disabled={!canSend}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
