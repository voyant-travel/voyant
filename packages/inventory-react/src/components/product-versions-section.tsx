"use client"

import { Button } from "@voyantjs/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components/card"
import { FileText, Loader2, Plus } from "lucide-react"
import * as React from "react"
import { useProductsUiI18nOrDefault, useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { useProductVersions } from "../index.js"
import { ProductVersionDialog } from "./product-version-dialog.js"

export interface ProductVersionsSectionProps {
  productId: string
  title?: string
  description?: string
}

export function ProductVersionsSection({
  productId,
  title,
  description,
}: ProductVersionsSectionProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const { data, isPending, isError } = useProductVersions(productId)
  const versions = data?.data ?? []
  const messages = useProductsUiMessagesOrDefault()
  const { formatDateTime } = useProductsUiI18nOrDefault()
  const resolvedTitle = title ?? messages.productVersionsSection.titles.default
  const resolvedDescription = description ?? messages.productVersionsSection.descriptions.default

  return (
    <Card data-slot="product-versions-section">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{resolvedTitle}</CardTitle>
          <CardDescription>{resolvedDescription}</CardDescription>
        </div>
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {messages.productVersionsSection.actions.createVersion}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">{messages.productVersionsSection.loadingError}</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.productVersionsSection.empty}</p>
        ) : (
          versions.map((version) => (
            <div key={version.id} className="flex items-center gap-4 rounded-md border p-3">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {messages.productVersionsSection.versionLabel} {version.versionNumber}
                </p>
                {version.notes ? (
                  <p className="mt-1 text-sm text-muted-foreground">{version.notes}</p>
                ) : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{formatDateTime(version.createdAt)}</div>
                <div>{version.authorId}</div>
              </div>
            </div>
          ))
        )}

        <ProductVersionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productId={productId}
        />
      </CardContent>
    </Card>
  )
}
