"use client"

import { Card, CardContent } from "@voyant-travel/ui/components"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Field, FieldLabel } from "@voyant-travel/ui/components/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useNotificationsUiI18nOrDefault } from "../i18n/index.js"
import { useRemindersPreview } from "../index.js"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export interface RemindersPreviewListProps {
  ruleId?: string
  targetId?: string
}

export function RemindersPreviewList({ ruleId, targetId }: RemindersPreviewListProps) {
  const { formatDateTime, messages } = useNotificationsUiI18nOrDefault()
  const [date, setDate] = useState<string>(todayIso())
  const { data, isFetching } = useRemindersPreview({ date, ruleId, targetId })

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Field className="max-w-xs">
            <FieldLabel htmlFor="preview-date">{messages.preview.dateLabel}</FieldLabel>
            <DatePicker
              value={date}
              onChange={(next) => setDate(next ?? todayIso())}
              clearable={false}
            />
          </Field>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>

        {data && data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.preview.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.preview.columns.rule}</TableHead>
                <TableHead>{messages.preview.columns.stage}</TableHead>
                <TableHead>{messages.preview.columns.target}</TableHead>
                <TableHead>{messages.preview.columns.anchor}</TableHead>
                <TableHead>{messages.preview.columns.scheduledAt}</TableHead>
                <TableHead>{messages.preview.columns.reasoning}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((row) => (
                <TableRow key={`${row.ruleId}:${row.targetId}:${row.stageId}`}>
                  <TableCell className="font-medium">{row.ruleName}</TableCell>
                  <TableCell>
                    #{row.stageOrderIndex} {row.stageName ?? ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.targetId}</TableCell>
                  <TableCell>{row.anchor}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatDateTime(row.scheduledAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.reasoning}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
