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
import { Loader2, Plus, Search } from "lucide-react"
import * as React from "react"

import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { CrmRelationType } from "../i18n/messages.js"
import { PersonDialog } from "./person-dialog.js"

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
  const messages = useCrmUiMessagesOrDefault()
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
            placeholder={messages.personList.searchPlaceholder}
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
          {messages.personList.create}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.personList.columns.name}</TableHead>
              <TableHead>{messages.personList.columns.email}</TableHead>
              <TableHead>{messages.personList.columns.phone}</TableHead>
              <TableHead>{messages.personList.columns.relation}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2
                    className="mx-auto size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-destructive">
                  {messages.personList.loadFailed}
                </TableCell>
              </TableRow>
            ) : people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                  {messages.personList.empty}
                </TableCell>
              </TableRow>
            ) : (
              people.map((person) => {
                const fullName =
                  [person.firstName, person.lastName].filter(Boolean).join(" ") ||
                  messages.common.none
                return (
                  <TableRow
                    key={person.id}
                    onClick={() => handleEdit(person)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{person.email ?? messages.common.none}</TableCell>
                    <TableCell>{person.phone ?? messages.common.none}</TableCell>
                    <TableCell>
                      {person.relation ? (
                        <Badge variant="secondary" className="capitalize">
                          {messages.common.relationTypeLabels[person.relation as CrmRelationType] ??
                            person.relation}
                        </Badge>
                      ) : (
                        messages.common.none
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {messages.common.pageSummary
            .replace("{shown}", String(people.length))
            .replace("{total}", String(total))}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {messages.common.previous}
          </Button>
          <span>
            {messages.common.page} {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {messages.common.next}
          </Button>
        </div>
      </div>

      <PersonDialog open={dialogOpen} onOpenChange={setDialogOpen} person={editing} />
    </div>
  )
}
