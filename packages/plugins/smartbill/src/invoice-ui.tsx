"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchWithValidation, useVoyantFinanceContext } from "@voyantjs/finance-react"
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import { ArrowRightLeft, ExternalLink, FileText, Loader2, RefreshCw, Send } from "lucide-react"
import type { ReactNode } from "react"
import { z } from "zod"

import {
  getSmartbillInvoiceDocumentLinks,
  resolveSmartbillInvoiceReferenceParts,
  type SmartbillInvoiceExternalRef,
  selectSmartbillInvoiceRef,
  smartbillInvoiceExternalRefsResponseSchema,
} from "./invoice-ui-data.js"

const actionResponseSchema = z.object({ data: z.unknown().optional() })

export {
  getSmartbillInvoiceDocumentLinks,
  resolveSmartbillInvoiceReferenceParts,
  type SmartbillInvoiceDocumentLink,
  type SmartbillInvoiceExternalRef,
  type SmartbillInvoiceReferenceParts,
  selectSmartbillInvoiceRef,
} from "./invoice-ui-data.js"

export interface UseSmartbillInvoiceRefsOptions {
  enabled?: boolean
}

export interface SmartbillInvoiceAction {
  label?: string
  pending?: boolean
  disabled?: boolean
  onClick: () => void | Promise<void>
}

export interface SmartbillInvoicePanelProps {
  invoiceId: string
  externalRef?: SmartbillInvoiceExternalRef | null
  title?: ReactNode
  className?: string
  hideWhenEmpty?: boolean
  sendAction?: SmartbillInvoiceAction
  retryAction?: SmartbillInvoiceAction
  convertProformaAction?: SmartbillInvoiceAction
  extraActions?: ReactNode
}

export function useSmartbillInvoiceRefs(
  invoiceId: string | null | undefined,
  options: UseSmartbillInvoiceRefsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: ["voyant", "smartbill", "invoice", invoiceId, "external-refs"],
    queryFn: async () => {
      const response = await fetchWithValidation(
        `/v1/finance/invoices/${encodeURIComponent(invoiceId ?? "")}/external-refs`,
        smartbillInvoiceExternalRefsResponseSchema,
        { baseUrl, fetcher },
      )
      return response.data.filter((ref) => ref.provider === "smartbill")
    },
    enabled: enabled && Boolean(invoiceId),
  })
}

export function useSmartbillInvoiceRef(
  invoiceId: string | null | undefined,
  options: UseSmartbillInvoiceRefsOptions = {},
) {
  const query = useSmartbillInvoiceRefs(invoiceId, options)
  return {
    ...query,
    data: query.data ? selectSmartbillInvoiceRef(query.data) : undefined,
  }
}

export function SmartbillInvoicePanel({
  invoiceId,
  externalRef,
  title = "SmartBill",
  className,
  hideWhenEmpty = false,
  sendAction,
  retryAction,
  convertProformaAction,
  extraActions,
}: SmartbillInvoicePanelProps) {
  const query = useSmartbillInvoiceRef(invoiceId, { enabled: externalRef === undefined })
  const defaultSyncAction = useSmartbillInvoiceSyncAction(invoiceId)
  const defaultConvertProformaAction = useSmartbillConvertProformaAction(invoiceId)
  const ref = externalRef === undefined ? query.data : externalRef
  const isLoading = externalRef === undefined && query.isPending
  const isError = externalRef === undefined && query.isError

  if (hideWhenEmpty && !isLoading && !isError && !ref) {
    return null
  }

  const reference = resolveSmartbillInvoiceReferenceParts(ref)
  const documentLinks = getSmartbillInvoiceDocumentLinks(ref)
  const status = ref?.syncError ? "error" : (ref?.status ?? null)
  const effectiveSendAction = sendAction ?? defaultSyncAction
  const effectiveRetryAction = retryAction ?? (ref ? defaultSyncAction : undefined)
  const effectiveConvertProformaAction = convertProformaAction ?? defaultConvertProformaAction
  const canConvertProforma =
    reference.documentType === "proforma" && Boolean(effectiveConvertProformaAction)

  return (
    <Card data-slot="smartbill-invoice-panel" size="sm" className={className}>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </CardTitle>
        <CardAction>
          {status ? (
            <Badge variant={status === "error" ? "destructive" : "outline"}>{status}</Badge>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading SmartBill state
          </div>
        ) : isError ? (
          <p className="text-destructive text-sm">SmartBill state could not be loaded.</p>
        ) : ref ? (
          <div className="grid gap-3 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <SmartbillField label="Series">{reference.seriesName ?? "-"}</SmartbillField>
              <SmartbillField label="Number">{reference.number ?? "-"}</SmartbillField>
              <SmartbillField label="Type">{reference.documentType ?? "-"}</SmartbillField>
              <SmartbillField label="Synced">{formatDateTime(ref.syncedAt) ?? "-"}</SmartbillField>
            </dl>
            {ref.syncError ? (
              <p className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-destructive">
                {ref.syncError}
              </p>
            ) : null}
            {documentLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {documentLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No SmartBill reference is linked yet.</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!ref && !isLoading && !isError ? (
            <SmartbillActionButton action={effectiveSendAction} icon={<Send className="size-4" />}>
              {effectiveSendAction.label ?? "Send to SmartBill"}
            </SmartbillActionButton>
          ) : null}
          {effectiveRetryAction ? (
            <SmartbillActionButton
              action={effectiveRetryAction}
              icon={<RefreshCw className="size-4" />}
            >
              {effectiveRetryAction.label ?? "Retry sync"}
            </SmartbillActionButton>
          ) : null}
          {canConvertProforma && effectiveConvertProformaAction ? (
            <SmartbillActionButton
              action={effectiveConvertProformaAction}
              icon={<ArrowRightLeft className="size-4" />}
            >
              {effectiveConvertProformaAction.label ?? "Convert proforma"}
            </SmartbillActionButton>
          ) : null}
          {extraActions}
        </div>
      </CardContent>
    </Card>
  )
}

export function useSmartbillInvoiceSyncAction(invoiceId: string): SmartbillInvoiceAction {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () =>
      fetchWithValidation(
        `/v1/admin/smartbill/invoices/${encodeURIComponent(invoiceId)}/sync`,
        actionResponseSchema,
        { baseUrl, fetcher },
        { method: "POST" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["voyant"] })
    },
  })

  return {
    pending: mutation.isPending,
    disabled: !invoiceId,
    onClick: async () => {
      await mutation.mutateAsync()
    },
  }
}

export function useSmartbillConvertProformaAction(invoiceId: string): SmartbillInvoiceAction {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () =>
      fetchWithValidation(
        `/v1/finance/invoices/${encodeURIComponent(invoiceId)}/convert-to-invoice`,
        actionResponseSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({}) },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["voyant"] })
    },
  })

  return {
    pending: mutation.isPending,
    disabled: !invoiceId,
    onClick: async () => {
      await mutation.mutateAsync()
    },
  }
}

function SmartbillField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs uppercase">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  )
}

function SmartbillActionButton({
  action,
  icon,
  children,
}: {
  action: SmartbillInvoiceAction
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={action.disabled || action.pending}
      onClick={() => void action.onClick()}
    >
      <span className={cn(action.pending && "animate-spin")}>
        {action.pending ? <Loader2 className="size-4" aria-hidden="true" /> : icon}
      </span>
      {children}
    </Button>
  )
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  )
}
