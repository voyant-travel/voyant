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
import { formatMessage, useBookingsUiMessagesOrDefault } from "../../i18n/index.js"

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
    /** Rendered HTML — the legal package returns a bare string. */
    rendered?: string
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
  const messages = useBookingsUiMessagesOrDefault()
  const [loadState, setLoadState] = React.useState<"idle" | "loading" | "ready" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [renderedHtml, setRenderedHtml] = React.useState<string>("")
  const [template, setTemplate] = React.useState<{ id: string; slug: string; name: string } | null>(
    null,
  )
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)
  // Marketing consent defaults to opted-in; the customer can untick
  // before accepting. Terms still require an explicit tick.
  const [acceptedMarketing, setAcceptedMarketing] = React.useState(true)

  // Stringify the variables once so the effect re-fetches only on
  // meaningful changes — equivalent to a deep-equality check, but
  // cheap enough to run every render.
  const variablesKey = React.useMemo(() => JSON.stringify(variables), [variables])
  const variablesRef = React.useRef(variables)
  variablesRef.current = variables

  // biome-ignore lint/correctness/useExhaustiveDependencies: variablesKey is the meaningful-change signal; the actual variables are read off variablesRef so the effect doesn't re-fire on every render -- owner: bookings-react; existing suppression is intentional pending typed cleanup.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadState("loading")
    setErrorMessage(null)
    setAcceptedTerms(false)
    setAcceptedMarketing(true)
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
          throw new Error(
            formatMessage(messages.bookingJourney.contract.previewRequestFailed, {
              status: res.status,
            }),
          )
        }
        const json = (await res.json()) as PreviewResponse
        if (cancelled) return
        const body = json.data?.rendered ?? ""
        const tmpl = json.data?.template
        if (!body || !tmpl) {
          throw new Error(messages.bookingJourney.contract.previewMissing)
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
          <DialogTitle>
            {template?.name ?? messages.bookingJourney.contract.defaultTitle}
          </DialogTitle>
          <p className="text-muted-foreground text-sm">
            {messages.bookingJourney.contract.description}
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
                {messages.bookingJourney.contract.errorPrefix} {errorMessage}
              </p>
            </div>
          ) : null}
          {loadState === "ready" ? (
            <iframe
              title={formatMessage(messages.bookingJourney.contract.iframeTitle, {
                name: template?.name ?? messages.bookingJourney.contract.defaultTitle,
              })}
              srcDoc={wrapPreviewHtml(renderedHtml)}
              sandbox=""
              className="h-full w-full border-0 bg-white"
            />
          ) : null}
        </div>

        <DialogFooter className="border-t p-6 sm:flex-col sm:items-stretch sm:gap-3">
          <div className="space-y-2 text-sm">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input element under the hood  -- owner: bookings-react; existing suppression is intentional pending typed cleanup. */}
            <label className="flex items-start gap-2">
              <Checkbox
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
                className="mt-0.5"
              />
              <span>{termsLabel ?? <>{messages.bookingJourney.contract.termsLabel}</>}</span>
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input element under the hood  -- owner: bookings-react; existing suppression is intentional pending typed cleanup. */}
            <label className="flex items-start gap-2">
              <Checkbox
                checked={acceptedMarketing}
                onCheckedChange={(v) => setAcceptedMarketing(v === true)}
                className="mt-0.5"
              />
              <span>{marketingLabel ?? messages.bookingJourney.contract.marketingLabel}</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {messages.bookingJourney.contract.cancel}
            </Button>
            <Button type="button" disabled={!canAccept} onClick={handleAccept}>
              {messages.bookingJourney.contract.acceptAndContinue}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Wrap the rendered template body in a self-contained light-theme HTML
 * document. Templates author their own typography but rarely set a
 * background, so without this the iframe inherits the browser default
 * (transparent) and we'd see whatever shows through — which on the
 * storefront's dark dialog reads as black-on-black.
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
