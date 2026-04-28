"use client"

import { useProductVersions } from "@voyantjs/products-react"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { FileText, Loader2, Plus } from "lucide-react"
import * as React from "react"
import { VersionDialog } from "./product-version-dialog"

export function ProductVersionsSection({ productId }: { productId: string }) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const { data, isPending, isError } = useProductVersions(productId)
  const versions = data?.data ?? []

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Versions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create and browse immutable product snapshots.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Create version
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load product versions.</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No version snapshots created yet.</p>
        ) : (
          versions.map((version) => (
            <div key={version.id} className="flex items-center gap-4 rounded-md border p-3">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">Version {version.versionNumber}</p>
                {version.notes ? (
                  <p className="mt-1 text-sm text-muted-foreground">{version.notes}</p>
                ) : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{new Date(version.createdAt).toLocaleString()}</div>
                {"authorId" in version && version.authorId ? <div>{version.authorId}</div> : null}
              </div>
            </div>
          ))
        )}

        <VersionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productId={productId}
          onSuccess={() => {
            setDialogOpen(false)
          }}
        />
      </CardContent>
    </Card>
  )
}
