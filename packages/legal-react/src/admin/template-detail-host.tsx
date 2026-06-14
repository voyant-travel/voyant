"use client"

import { useAdminNavigate } from "@voyant-travel/admin"
import { lazy, Suspense } from "react"

import { TemplateDetailPage } from "../components/template-detail-page.js"

// Lazy: both dialogs use the RichTextEditor (tiptap + prosemirror).
const TemplateDialog = lazy(() =>
  import("./template-dialog.js").then((m) => ({ default: m.TemplateDialog })),
)
const TemplateVersionDialog = lazy(() =>
  import("./template-version-dialog.js").then((m) => ({
    default: m.TemplateVersionDialog,
  })),
)

export interface TemplateDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the operator-grade contract template detail page
 * (packaged-admin RFC Phase 3). Back-navigation resolves through the
 * `contractTemplate.list` semantic destination; the edit/version dialogs
 * (rich-text editor) stay lazily loaded inside the package.
 */
export function TemplateDetailHost({ id }: TemplateDetailHostProps) {
  const navigateTo = useAdminNavigate()

  return (
    <TemplateDetailPage
      id={id}
      onBackToTemplates={() => navigateTo("contractTemplate.list", {})}
      renderTemplateDialog={(props) => (
        <Suspense fallback={null}>
          <TemplateDialog {...props} />
        </Suspense>
      )}
      renderTemplateVersionDialog={(props) => (
        <Suspense fallback={null}>
          <TemplateVersionDialog {...props} />
        </Suspense>
      )}
    />
  )
}
