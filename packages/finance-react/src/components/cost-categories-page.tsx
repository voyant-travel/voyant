"use client"

import { Badge, Button, Checkbox, Input, Label } from "@voyant-travel/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { useCostCategories, useCostCategoryMutation } from "../index.js"

export interface CostCategoriesPageProps {
  className?: string
}

export function CostCategoriesPage({ className }: CostCategoriesPageProps = {}) {
  const t = useFinanceUiMessagesOrDefault().costCategories
  const [showArchived, setShowArchived] = useState(false)
  const [name, setName] = useState("")
  const categories = useCostCategories({ includeArchived: showArchived })
  const { create, update } = useCostCategoryMutation()

  const rows = categories.data?.data ?? []

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    create.mutate({ name: trimmed }, { onSuccess: () => setName("") })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>

      <div className="flex max-w-md items-end gap-2">
        <Input
          placeholder={t.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add()
          }}
        />
        <Button onClick={add} disabled={create.isPending || !name.trim()}>
          <Plus className="size-4" />
          {create.isPending ? t.adding : t.add}
        </Button>
      </div>

      <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
        <Checkbox
          checked={showArchived}
          onCheckedChange={(checked) => setShowArchived(checked === true)}
        />
        {t.showArchived}
      </Label>

      <div className="max-w-2xl rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.namePlaceholder}</TableHead>
              <TableHead className="w-32 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  {t.empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    {category.name}
                    {category.archived ? (
                      <Badge variant="outline" className="ml-2">
                        {t.archivedBadge}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({
                          id: category.id,
                          input: { archived: !category.archived },
                        })
                      }
                    >
                      {category.archived ? t.restore : t.archive}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
