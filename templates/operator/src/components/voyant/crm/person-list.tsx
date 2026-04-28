"use client"

import { type PersonRecord, usePeople } from "@voyantjs/crm-react"
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
import { formatMessage } from "@voyantjs/voyant-admin"
import { Plus, Search } from "lucide-react"
import * as React from "react"
import { SkeletonTableRows } from "@/components/ui/skeletons"
import { useAdminMessages } from "@/lib/admin-i18n"

import { PersonDialog } from "./person-dialog"

export interface PersonListProps {
  pageSize?: number
  onSelectPerson?: (person: PersonRecord) => void
}

/**
 * Paginated list of people with search + create/edit dialog. Wires directly
 * to the CRM API via `usePeople()`, so dropping this into a page gives you a
 * full working contacts view with zero additional code.
 */
export function PersonList({ pageSize = 25, onSelectPerson }: PersonListProps = {}) {
  const messages = useAdminMessages()
  const listMessages = messages.crm.personList
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PersonRecord | undefined>(undefined)

  const { data, isPending, isError } = usePeople({
    search: search || undefined,
    limit: pageSize,
    offset,
  })

  const people = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const handleEdit = (person: PersonRecord) => {
    if (onSelectPerson) {
      onSelectPerson(person)
      return
    }
    setEditing(person)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  return (
    <div data-slot="person-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={listMessages.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate} data-slot="person-list-create">
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {listMessages.newAction}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{listMessages.columnName}</TableHead>
              <TableHead>{listMessages.columnEmail}</TableHead>
              <TableHead>{listMessages.columnPhone}</TableHead>
              <TableHead>{listMessages.columnRelation}</TableHead>
            </TableRow>
          </TableHeader>
          {isPending ? (
            <SkeletonTableRows
              rows={8}
              columns={4}
              columnWidths={["w-40", "w-48", "w-32", "w-16"]}
            />
          ) : isError ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-destructive">
                  {listMessages.loadFailed}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : people.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                  {listMessages.empty}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {people.map((person) => {
                const fullName =
                  [person.firstName, person.lastName].filter(Boolean).join(" ") || "—"
                return (
                  <TableRow
                    key={person.id}
                    onClick={() => handleEdit(person)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{person.email ?? "—"}</TableCell>
                    <TableCell>{person.phone ?? "—"}</TableCell>
                    <TableCell>
                      {person.relation ? (
                        <Badge variant="secondary" className="capitalize">
                          {person.relation}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          )}
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {people.length} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {listMessages.previous}
          </Button>
          <span>{formatMessage(messages.settings.paginationPage, { page, pageCount })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {listMessages.next}
          </Button>
        </div>
      </div>

      <PersonDialog open={dialogOpen} onOpenChange={setDialogOpen} person={editing} />
    </div>
  )
}
