"use client"

import { describeRRule } from "@voyantjs/availability/rrule"
import {
  type AvailabilityRuleRecord,
  type AvailabilitySlotRecord,
  useAvailabilityRuleMutation,
  useAvailabilitySlotMutation,
  useRules,
  useSlots,
} from "@voyantjs/availability-react"
import { CalendarClock, Loader2, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { formatMessage, useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import {
  formatCapacity,
  formatDuration,
  formatSlotDate,
  formatSlotTime,
  slotStatusVariant,
} from "./product-availability-shared"
import { ProductDepartureDialog } from "./product-departure-dialog"
import { ProductScheduleDialog } from "./product-schedule-dialog"

export interface ProductAvailabilitySectionProps {
  productId: string
  pageSize?: number
  title?: string
  description?: string
}

export function ProductAvailabilitySection({
  productId,
  pageSize = 100,
  title,
  description,
}: ProductAvailabilitySectionProps) {
  const [departureDialogOpen, setDepartureDialogOpen] = React.useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = React.useState(false)
  const [editingSlot, setEditingSlot] = React.useState<AvailabilitySlotRecord | undefined>()
  const [editingRule, setEditingRule] = React.useState<AvailabilityRuleRecord | undefined>()
  const messages = useRegistryProductsMessagesOrDefault()

  const {
    data: slotsData,
    isPending: isSlotsPending,
    isError: isSlotsError,
  } = useSlots({ productId, limit: pageSize })
  const {
    data: rulesData,
    isPending: isRulesPending,
    isError: isRulesError,
  } = useRules({ productId, limit: pageSize })
  const { remove: removeSlot } = useAvailabilitySlotMutation()
  const { remove: removeRule } = useAvailabilityRuleMutation()

  const slots = React.useMemo(
    () =>
      (slotsData?.data ?? [])
        .slice()
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    [slotsData?.data],
  )
  const rules = React.useMemo(
    () => (rulesData?.data ?? []).slice().sort((left, right) => right.id.localeCompare(left.id)),
    [rulesData?.data],
  )

  return (
    <div data-slot="product-availability-section" className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{title ?? messages.productAvailability.title}</CardTitle>
            <CardDescription>
              {description ?? messages.productAvailability.description}
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setEditingSlot(undefined)
              setDepartureDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {messages.productAvailability.createDeparture}
          </Button>
        </CardHeader>
        <CardContent>
          {isSlotsPending ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : isSlotsError ? (
            <p className="text-sm text-destructive">
              {messages.productAvailability.loadingDeparturesError}
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {messages.productAvailability.emptyDepartures}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messages.productAvailability.columns.start}</TableHead>
                    <TableHead>{messages.productAvailability.columns.end}</TableHead>
                    <TableHead>{messages.productAvailability.columns.duration}</TableHead>
                    <TableHead>{messages.productAvailability.columns.status}</TableHead>
                    <TableHead>{messages.productAvailability.columns.capacity}</TableHead>
                    <TableHead>{messages.productAvailability.columns.timezone}</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{slot.dateLocal}</div>
                        <div className="text-xs text-muted-foreground">{formatSlotTime(slot)}</div>
                      </TableCell>
                      <TableCell>
                        {slot.endsAt ? (
                          <>
                            <div className="font-mono text-xs">{formatSlotDate(slot, "end")}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatSlotTime(slot, "end")}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{messages.common.none}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDuration(slot, messages.productAvailability)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={slotStatusVariant[slot.status] ?? "outline"}>
                          {messages.productAvailability.statusLabels[slot.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatCapacity(slot, messages.productAvailability)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {slot.timezone}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditingSlot(slot)
                              setDepartureDialogOpen(true)
                            }}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              if (confirm(messages.productAvailability.deleteDepartureConfirm)) {
                                removeSlot.mutate(slot.id)
                              }
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="size-4" aria-hidden="true" />
              {messages.productAvailability.titleSchedules}
            </CardTitle>
            <CardDescription>{messages.productAvailability.descriptionSchedules}</CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setEditingRule(undefined)
              setScheduleDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {messages.productAvailability.createSchedule}
          </Button>
        </CardHeader>
        <CardContent>
          {isRulesPending ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : isRulesError ? (
            <p className="text-sm text-destructive">
              {messages.productAvailability.loadingSchedulesError}
            </p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {messages.productAvailability.emptySchedules}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">{describeRRule(rule.recurrenceRule)}</span>
                      {!rule.active ? (
                        <Badge variant="outline">
                          {messages.productAvailability.inactiveBadge}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMessage(messages.productAvailability.scheduleSummary, {
                        maxCapacity: rule.maxCapacity,
                        timezone: rule.timezone,
                        cutoffSuffix:
                          rule.cutoffMinutes != null
                            ? formatMessage(messages.productAvailability.cutoffSummary, {
                                minutes: rule.cutoffMinutes,
                              })
                            : "",
                        minPaxSuffix:
                          rule.minTotalPax != null
                            ? formatMessage(messages.productAvailability.minPaxSummary, {
                                count: rule.minTotalPax,
                              })
                            : "",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingRule(rule)
                        setScheduleDialogOpen(true)
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm(messages.productAvailability.deleteScheduleConfirm)) {
                          removeRule.mutate(rule.id)
                        }
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductDepartureDialog
        open={departureDialogOpen}
        onOpenChange={setDepartureDialogOpen}
        productId={productId}
        slot={editingSlot}
        onSuccess={() => {
          setEditingSlot(undefined)
        }}
      />
      <ProductScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        productId={productId}
        rule={editingRule}
        onSuccess={() => {
          setEditingRule(undefined)
        }}
      />
    </div>
  )
}
