"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Check, Copy, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { useAccountantShareMutation, useAccountantShares } from "../index.js"

export interface AccountantShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountantShareDialog({ open, onOpenChange }: AccountantShareDialogProps) {
  const t = useFinanceUiMessagesOrDefault().profitability.share
  const shares = useAccountantShares()
  const { create, revoke } = useAccountantShareMutation()

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [baseCurrency, setBaseCurrency] = useState("")
  const [ttlDays, setTtlDays] = useState("30")
  // The token is only known at creation (only its hash is stored), so the link
  // is shown once here; the list below can't reconstruct it.
  const [created, setCreated] = useState<{ url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = () => {
    create.mutate(
      {
        from: from || undefined,
        to: to || undefined,
        baseCurrency: baseCurrency || undefined,
        ttlDays: ttlDays ? Number(ttlDays) : undefined,
      },
      {
        onSuccess: (share) => {
          if (!share?.url) return
          setCreated({ url: share.url })
          setCopied(false)
          if (navigator.clipboard) {
            void navigator.clipboard.writeText(share.url).then(() => setCopied(true))
          }
        },
      },
    )
  }

  const copyCreated = () => {
    if (!created || !navigator.clipboard) return
    void navigator.clipboard.writeText(created.url).then(() => setCopied(true))
  }

  const rows = shares.data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t.from}</Label>
              <DatePicker
                value={from || null}
                onChange={(v) => setFrom(v ?? "")}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.to}</Label>
              <DatePicker value={to || null} onChange={(v) => setTo(v ?? "")} className="w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.baseCurrency}</Label>
              <CurrencyCombobox
                value={baseCurrency || null}
                onChange={(v) => setBaseCurrency(v ?? "")}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.ttlDays}</Label>
              <Input
                inputMode="numeric"
                value={ttlDays}
                onChange={(e) => setTtlDays(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>
          <Button type="button" onClick={submit} disabled={create.isPending} className="self-start">
            <Plus className="size-4" />
            {create.isPending ? t.creating : t.create}
          </Button>

          {created ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{created.url}</code>
              <Button variant="outline" size="sm" onClick={copyCreated}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t.copied : t.copy}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t.active}</span>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.none}</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-md border">
                {rows.map((share) => {
                  const period =
                    share.from || share.to ? `${share.from ?? "…"} – ${share.to ?? "…"}` : t.allTime
                  return (
                    <li
                      key={share.id}
                      className="flex items-center justify-between gap-2 p-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {period}
                          {share.baseCurrency ? ` · ${share.baseCurrency}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMessage(t.expires, { date: share.expiresAt.slice(0, 10) })} ·{" "}
                          {share.accessCount > 0
                            ? formatMessage(t.opened, { count: share.accessCount })
                            : t.neverOpened}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => revoke.mutate(share.id)}
                        disabled={revoke.isPending}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
