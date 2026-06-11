"use client"

import { useAdminNavigate } from "@voyantjs/admin"
import { lazy, Suspense } from "react"

import { TemplatesPage } from "../components/templates-page.js"

// Lazy-load: the template dialog pulls tiptap + prosemirror (~600 KB raw).
// Keeping it out of the page chunk means the dialog modules + their
// dependencies only download when the user opens the dialog.
const TemplateDialog = lazy(() =>
  import("./template-dialog.js").then((m) => ({ default: m.TemplateDialog })),
)

/**
 * Packaged admin host for the operator-grade contract templates list page
 * (packaged-admin RFC Phase 3). Zero-prop: list state stays
 * component-local, opening a row resolves through the
 * `contractTemplate.detail` semantic destination, and the create/edit
 * dialog (rich-text editor) stays lazily loaded inside the package.
 */
export function TemplatesHost() {
  const navigateTo = useAdminNavigate()

  return (
    <TemplatesPage
      onOpenTemplate={(id) => navigateTo("contractTemplate.detail", { templateId: id })}
      renderTemplateDialog={(props) => (
        <Suspense fallback={null}>
          <TemplateDialog {...props} />
        </Suspense>
      )}
    />
  )
}
