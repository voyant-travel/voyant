"use client"

import { useRemindersPreview } from "@voyantjs/notifications-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { RefreshCcw } from "lucide-react"
import { useState } from "react"

import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export interface RemindersPreviewListProps {
  ruleId?: string
  targetId?: string
}

export function RemindersPreviewList({ ruleId, targetId }: RemindersPreviewListProps) {
  const messages = useNotificationsUiMessagesOrDefault()
  const [date, setDate] = useState(todayIso())
  const { data, isFetching, refetch } = useRemindersPreview({ date, ruleId, targetId })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.preview.heading}</CardTitle>
        <CardDescription>{messages.preview.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Label>{messages.preview.dateLabel}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={isFetching ? "size-4 animate-spin" : "size-4"} />
            {messages.preview.refresh}
          </Button>
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
                    {new Date(row.scheduledAt).toLocaleString()}
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
