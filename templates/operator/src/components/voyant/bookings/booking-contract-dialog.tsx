"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useLegalContractAttachmentMutation, useLegalContractMutation } from "@voyantjs/legal-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from "@voyantjs/ui/components"
import { FileText, Loader2, Paperclip, X } from "lucide-react"
import { useEffect, useState } from "react"

import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"

type ContractDialogMode = "generate" | "upload"

export interface BookingContractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  bookingNumber?: string | null
  onSuccess?: () => void
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error"
  html: string
  templateName: string
  errorMessage: string | null
}

/**
 * "Add contract" dialog for a booking. Two modes:
 *
 *   - **Generate** (default): hits the server-side preview branch of
 *     `/v1/admin/bookings/:id/generate-contract` (which runs the same
 *     template + variable build the customer would see at checkout)
 *     and renders the HTML in a sandboxed iframe. Confirm fires the
 *     full generate, which creates the contract row + persists the PDF.
 *
 *   - **Upload**: operator picks a pre-signed PDF (e.g. countersigned
 *     copy). The dialog creates a `signed`-status contract row and
 *     attaches the uploaded file via the legal attachment upload route.
 */
export function BookingContractDialog({
  open,
  onOpenChange,
  bookingId,
  bookingNumber,
  onSuccess,
}: BookingContractDialogProps) {
  const t = useAdminMessages().bookings.detail.contractDialog
  const queryClient = useQueryClient()
  const { create: createContract } = useLegalContractMutation()
  const { upload: uploadAttachment } = useLegalContractAttachmentMutation()

  const [mode, setMode] = useState<ContractDialogMode>("generate")
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upload form state
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)

  // Preview state
  const [preview, setPreview] = useState<PreviewState>({
    status: "idle",
    html: "",
    templateName: "",
    errorMessage: null,
  })

  // Reset on open. Generate is the leading mode so the preview fetch
  // kicks off immediately.
  useEffect(() => {
    if (!open) return
    setMode("generate")
    setTitle("")
    setFile(null)
    setError(null)
    setGenerating(false)
    setUploading(false)
    setPreview({ status: "idle", html: "", templateName: "", errorMessage: null })
  }, [open])

  // Fetch preview HTML every time the dialog opens (or the mode flips
  // back to Generate). The preview reflects current booking + template
  // state so re-fetching is intentional.
  useEffect(() => {
    if (!open || mode !== "generate") return
    let cancelled = false
    setPreview({ status: "loading", html: "", templateName: "", errorMessage: null })
    void fetch(`${getApiUrl()}/v1/admin/bookings/${bookingId}/generate-contract`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preview: true }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: { html?: string; templateName?: string }
          error?: string
        }
        if (cancelled) return
        if (!res.ok || !json.data?.html) {
          throw new Error(json.error ?? t.previewFailed)
        }
        setPreview({
          status: "ready",
          html: json.data.html,
          templateName: json.data.templateName ?? "",
          errorMessage: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setPreview({
          status: "error",
          html: "",
          templateName: "",
          errorMessage: err instanceof Error ? err.message : String(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [open, mode, bookingId, t.previewFailed])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch(
        `${getApiUrl()}/v1/admin/bookings/${bookingId}/generate-contract`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
      }
      await queryClient.invalidateQueries({ queryKey: ["legal", "contracts"] })
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError(t.uploadFileRequired)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const fallbackTitle =
        title.trim() ||
        (bookingNumber
          ? `Contract ${bookingNumber}`
          : `Contract for booking ${bookingId.slice(-8)}`)
      const created = await createContract.mutateAsync({
        scope: "customer",
        status: "signed",
        title: fallbackTitle,
        bookingId,
        metadata: { uploadedByOperator: true },
      })
      await uploadAttachment.mutateAsync({
        contractId: created.id,
        input: { file, kind: "document", name: file.name },
      })
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  const submitting = generating || uploading
  const canSubmit =
    mode === "generate" ? preview.status === "ready" && !submitting : file != null && !submitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full! max-w-4xl! gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-col gap-2">
              <Label>{t.modeLabel}</Label>
              <SegmentedChoice
                value={mode}
                onChange={setMode}
                options={[
                  { value: "generate", label: t.modeGenerate },
                  { value: "upload", label: t.modeUpload },
                ]}
              />
            </div>

            {mode === "generate" ? (
              <div className="flex flex-col gap-2">
                <Label>{t.previewLabel}</Label>
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  {preview.status === "loading" ? (
                    <div className="flex flex-col gap-3 p-6">
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : preview.status === "error" ? (
                    <p className="p-6 text-destructive text-sm">
                      {t.previewErrorPrefix} {preview.errorMessage ?? t.previewFailed}
                    </p>
                  ) : preview.status === "ready" ? (
                    <iframe
                      title={preview.templateName || t.previewIframeFallback}
                      srcDoc={wrapPreviewHtml(preview.html)}
                      sandbox=""
                      className="h-[60vh] w-full border-0 bg-white"
                    />
                  ) : null}
                </div>
                {preview.templateName ? (
                  <p className="text-muted-foreground text-xs">
                    {t.previewTemplateLabel} {preview.templateName}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{t.uploadTitleLabel}</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      bookingNumber ? `Contract ${bookingNumber}` : t.uploadTitlePlaceholder
                    }
                  />
                  <p className="text-muted-foreground text-xs">{t.uploadTitleHint}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t.uploadFileLabel}</Label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const next = e.target.files?.[0] ?? null
                      setFile(next)
                    }}
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/70"
                  />
                  {file ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.name}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setFile(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (mode === "generate") {
                void handleGenerate()
              } else {
                void handleUpload()
              }
            }}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "generate" ? (
              <>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {t.generateAction}
              </>
            ) : (
              t.uploadAction
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SegmentedChoice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
}) {
  return (
    <div className="flex w-full rounded-md border bg-background p-0.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors " +
              (active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Wrap the rendered template body in a light-theme HTML document so
 * the iframe doesn't inherit the dark dashboard background. Mirrors
 * the storefront's contract-preview wrapper to keep the WYSIWYG
 * promise honest.
 */
function wrapPreviewHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; background: #ffffff; color: #111827; }
  body {
    padding: 1.5rem 2rem;
    font-family: ui-serif, Georgia, "Times New Roman", serif;
    font-size: 15px;
    line-height: 1.6;
  }
  h1, h2, h3 { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; }
  h2 { font-size: 1.15rem; margin: 1.5rem 0 0.5rem; }
  p { margin: 0.5rem 0; }
  ul, ol { padding-left: 1.5rem; }
  strong { color: #0f172a; }
  a { color: #2563eb; }
  table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
  th, td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f9fafb; }
</style>
</head>
<body>${body}</body>
</html>`
}
