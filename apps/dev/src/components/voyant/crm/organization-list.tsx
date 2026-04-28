"use client"

import { type OrganizationRecord, useOrganizations } from "@voyantjs/crm-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { Loader2, Plus, Search } from "lucide-react"
import * as React from "react"

import { OrganizationDialog } from "./organization-dialog"

export interface OrganizationListProps {
  pageSize?: number
  onSelectOrganization?: (organization: OrganizationRecord) => void
}

function formatRelative(value: string): string {
  const timestamp = new Date(value)
  const diff = Date.now() - timestamp.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days < 1) return "today"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function OrganizationList({
  pageSize = 25,
  onSelectOrganization,
}: OrganizationListProps = {}) {
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OrganizationRecord | undefined>(undefined)

  const { data, isPending, isError } = useOrganizations({
    search: search || undefined,
    limit: pageSize,
    offset,
  })

  const organizations = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const handleEdit = (organization: OrganizationRecord) => {
    if (onSelectOrganization) {
      onSelectOrganization(organization)
      return
    }
    setEditing(organization)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  return (
    <div data-slot="organization-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search organizations…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate} data-slot="organization-list-create">
          <Plus className="mr-2 size-4" aria-hidden="true" />
          New organization
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Relation</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2
                    className="mx-auto size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  Failed to load organizations.
                </TableCell>
              </TableRow>
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((organization) => (
                <TableRow
                  key={organization.id}
                  onClick={() => handleEdit(organization)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{organization.name}</TableCell>
                  <TableCell>{organization.industry ?? "—"}</TableCell>
                  <TableCell>
                    {organization.relation ? (
                      <Badge variant="secondary" className="capitalize">
                        {organization.relation}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {organization.website ? (
                      <a
                        href={organization.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {organization.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelative(organization.updatedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {organizations.length} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            Previous
          </Button>
          <span>
            Page {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            Next
          </Button>
        </div>
      </div>

      <OrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organization={editing}
        onSuccess={(organization) => {
          if (onSelectOrganization) {
            onSelectOrganization(organization)
          }
        }}
      />
    </div>
  )
}
