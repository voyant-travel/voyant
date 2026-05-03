"use client"

import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import * as React from "react"

/**
 * Contract preview dialog. Renders a contract template with the
 * draft variables prefilled and gates the journey on two
 * checkboxes — terms acceptance and an optional marketing opt-in.
 *
 * The dialog is template-driven: the storefront wires a
 * `templateSlug` plus a `resolveVariables(draft)` function that maps
 * the booking draft to the template's variable schema. The dialog
 * fetches the rendered HTML from
 * `POST /v1/public/legal/contracts/templates/by-slug/:slug/preview`
 * and renders it in an iframe (sandboxed — same-origin removed) so
 * inline styles in the contract HTML don't leak into the page.
 */
export interface ContractPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Variables to interpolate into the template body. */
  variables: Record<string, unknown>
  /**
   * URL of the public render endpoint. The storefront wraps the
   * journey and supplies an absolute URL so the dialog stays
   * agnostic about where the API base lives.
   */
  previewUrl: string
  /** Optional Accept-Language header for locale resolution. */
  acceptLanguage?: string
  /** Fired when the user clicks Accept after ticking the gates. */
  onAccept: (acceptance: ContractAcceptance) => void
  /** Optional marketing-opt-in label. When omitted, marketing
   *  consent isn't required to accept. */
  marketingLabel?: string
  termsLabel?: React.ReactNode
}

export interface ContractAcceptance {
  templateId: string
  templateSlug: string
  templateName: string
  acceptedTerms: true
  acceptedMarketing: boolean
  acceptedAt: string
  /** The exact rendered HTML the user accepted — captured for the
   *  audit trail so we can reproduce what they saw. */
  renderedHtml: string
}

interface PreviewResponse {
  data?: {
    template?: {
      id: string
      slug: string
      name: string
      language?: string
      scope?: string
    }
    rendered?: { body?: string; format?: string }
  }
}

export function ContractPreviewDialog({
  open,
  onOpenChange,
  variables,
  previewUrl,
  acceptLanguage,
  onAccept,
  marketingLabel,
  termsLabel,
}: ContractPreviewDialogProps): React.ReactElement {
  const [loadState, setLoadState] = React.useState<"idle" | "loading" | "ready" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [renderedHtml, setRenderedHtml] = React.useState<string>("")
  const [template, setTemplate] = React.useState<{ id: string; slug: string; name: string } | null>(
    null,
  )
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)
  const [acceptedMarketing, setAcceptedMarketing] = React.useState(false)

  // Stringify the variables once so the effect re-fetches only on
  // meaningful changes — equivalent to a deep-equality check, but
  // cheap enough to run every render.
  const variablesKey = React.useMemo(() => JSON.stringify(variables), [variables])
  const variablesRef = React.useRef(variables)
  variablesRef.current = variables

  // biome-ignore lint/correctness/useExhaustiveDependencies: variablesKey is the meaningful-change signal; the actual variables are read off variablesRef so the effect doesn't re-fire on every render
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadState("loading")
    setErrorMessage(null)
    setAcceptedTerms(false)
    setAcceptedMarketing(false)
    void fetch(previewUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(acceptLanguage ? { "accept-language": acceptLanguage } : {}),
      },
      body: JSON.stringify({ variables: variablesRef.current }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Preview request failed: ${res.status}`)
        }
        const json = (await res.json()) as PreviewResponse
        if (cancelled) return
        const body = json.data?.rendered?.body ?? ""
        const tmpl = json.data?.template
        if (!body || !tmpl) {
          throw new Error("Preview response missing rendered body or template metadata")
        }
        setRenderedHtml(body)
        setTemplate({ id: tmpl.id, slug: tmpl.slug, name: tmpl.name })
        setLoadState("ready")
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : String(err))
        setLoadState("error")
      })
    return () => {
      cancelled = true
    }
  }, [open, previewUrl, acceptLanguage, variablesKey])

  const canAccept = loadState === "ready" && acceptedTerms && Boolean(template)

  const handleAccept = () => {
    if (!canAccept || !template) return
    onAccept({
      templateId: template.id,
      templateSlug: template.slug,
      templateName: template.name,
      acceptedTerms: true,
      acceptedMarketing,
      acceptedAt: new Date().toISOString(),
      renderedHtml,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[95vw] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle>{template?.name ?? "Booking contract"}</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Please review the contract below. You can scroll through the document, then tick the
            boxes and click Accept to continue.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/30">
          {loadState === "loading" ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : null}
          {loadState === "error" ? (
            <div className="p-6">
              <p className="text-destructive text-sm">
                Couldn't load the contract preview: {errorMessage}
              </p>
            </div>
          ) : null}
          {loadState === "ready" ? (
            <iframe
              title={`${template?.name ?? "Contract"} preview`}
              srcDoc={renderedHtml}
              sandbox=""
              className="h-full w-full border-0 bg-background"
            />
          ) : null}
        </div>

        <DialogFooter className="border-t p-6 sm:flex-col sm:items-stretch sm:gap-3">
          <div className="space-y-2 text-sm">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input element under the hood */}
            <label className="flex items-start gap-2">
              <Checkbox
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
                className="mt-0.5"
              />
              <span>
                {termsLabel ?? (
                  <>
                    I have read and agree to the terms of this contract. I understand that this
                    booking is binding once accepted.
                  </>
                )}
              </span>
            </label>
            {marketingLabel ? (
              // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input element under the hood
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={acceptedMarketing}
                  onCheckedChange={(v) => setAcceptedMarketing(v === true)}
                  className="mt-0.5"
                />
                <span>{marketingLabel}</span>
              </label>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canAccept} onClick={handleAccept}>
              Accept and continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
