"use client"

import { useOperatorAdminMessages } from "@voyant-travel/admin"
import {
  Button,
  DatePicker,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  assignmentStatusOptions,
  type BookingOption,
  NONE_VALUE,
  nullableString,
  type ResourceCloseoutRow,
  type ResourcePoolRow,
  type ResourceRow,
  type ResourceSlotAssignmentRow,
  type SlotOption,
  slotLabel,
  toIsoDateTime,
  toLocalDateTimeInput,
  useVoyantResourcesContext,
} from "../index.js"

import { sendResourcesMutation } from "./resources-admin-api.js"

const getAssignmentFormSchema = (messages: ReturnType<typeof useOperatorAdminMessages>) =>
  z
    .object({
      slotId: z.string().min(1, messages.resources.dialogs.assignment.validationSlotRequired),
      poolId: z.string().optional(),
      resourceId: z.string().optional(),
      bookingId: z.string().optional(),
      status: z.enum(["reserved", "assigned", "released", "cancelled", "completed"]),
      assignedBy: z.string().optional(),
      releasedAt: z.string().optional(),
      notes: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (
        (!values.poolId || values.poolId === NONE_VALUE) &&
        (!values.resourceId || values.resourceId === NONE_VALUE)
      ) {
        const issue = {
          code: "custom" as const,
          message: messages.resources.dialogs.assignment.validationTargetRequired,
        }

        ctx.addIssue({ ...issue, path: ["poolId"] })
        ctx.addIssue({ ...issue, path: ["resourceId"] })
      }
    })

export function ResourceSlotAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  slots,
  pools,
  resources,
  bookings,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment?: ResourceSlotAssignmentRow
  slots: SlotOption[]
  pools: ResourcePoolRow[]
  resources: ResourceRow[]
  bookings: BookingOption[]
  onSuccess: () => void
}) {
  const client = useVoyantResourcesContext()
  const messages = useOperatorAdminMessages()
  const dialogMessages = messages.resources.dialogs.assignment
  const assignmentFormSchema = getAssignmentFormSchema(messages)
  const form = useForm({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      slotId: "",
      poolId: NONE_VALUE,
      resourceId: NONE_VALUE,
      bookingId: NONE_VALUE,
      status: "reserved" as const,
      assignedBy: "",
      releasedAt: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && assignment) {
      form.reset({
        slotId: assignment.slotId,
        poolId: assignment.poolId ?? NONE_VALUE,
        resourceId: assignment.resourceId ?? NONE_VALUE,
        bookingId: assignment.bookingId ?? NONE_VALUE,
        status: assignment.status,
        assignedBy: assignment.assignedBy ?? "",
        releasedAt: toLocalDateTimeInput(assignment.releasedAt),
        notes: assignment.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [assignment, form, open])

  const isEditing = Boolean(assignment)

  const onSubmit = async (values: z.output<typeof assignmentFormSchema>) => {
    const payload = {
      slotId: values.slotId,
      poolId: values.poolId === NONE_VALUE ? null : values.poolId,
      resourceId: values.resourceId === NONE_VALUE ? null : values.resourceId,
      bookingId: values.bookingId === NONE_VALUE ? null : values.bookingId,
      status: values.status,
      assignedBy: nullableString(values.assignedBy),
      releasedAt: toIsoDateTime(values.releasedAt),
      notes: nullableString(values.notes),
    }

    if (isEditing) {
      await sendResourcesMutation(
        client,
        "PATCH",
        `/v1/admin/operations/slot-assignments/${assignment?.id}`,
        payload,
      )
    } else {
      await sendResourcesMutation(client, "POST", "/v1/admin/operations/slot-assignments", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialogMessages.slotLabel}</Label>
              <Select
                items={slots.map((slot) => ({ label: slotLabel(slot), value: slot.id }))}
                value={form.watch("slotId")}
                onValueChange={(value) => form.setValue("slotId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.selectSlotPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {slotLabel(slot)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.poolLabel}</Label>
                <Select
                  value={form.watch("poolId")}
                  onValueChange={(value) =>
                    form.setValue("poolId", value ?? NONE_VALUE, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{dialogMessages.noPool}</SelectItem>
                    {pools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.poolId ? (
                  <p className="text-destructive text-xs">{form.formState.errors.poolId.message}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.resourceLabel}</Label>
                <Select
                  value={form.watch("resourceId")}
                  onValueChange={(value) =>
                    form.setValue("resourceId", value ?? NONE_VALUE, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{dialogMessages.noResource}</SelectItem>
                    {resources.map((resource) => (
                      <SelectItem key={resource.id} value={resource.id}>
                        {resource.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.resourceId ? (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.resourceId.message}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.bookingLabel}</Label>
                <Select
                  value={form.watch("bookingId")}
                  onValueChange={(value) => form.setValue("bookingId", value ?? NONE_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{dialogMessages.noBooking}</SelectItem>
                    {bookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.bookingNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.statusLabel}</Label>
                <Select
                  items={assignmentStatusOptions}
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ResourceSlotAssignmentRow["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {messages.resources.assignmentStatusLabels[option.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.assignedByLabel}</Label>
                <Input
                  {...form.register("assignedBy")}
                  placeholder={dialogMessages.assignedByPlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.releasedAtLabel}</Label>
                <DateTimePicker
                  value={form.watch("releasedAt") || null}
                  onChange={(value) =>
                    form.setValue("releasedAt", value ?? "", { shouldDirty: true })
                  }
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.notesLabel}</Label>
              <Textarea {...form.register("notes")} placeholder={dialogMessages.notesPlaceholder} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.save : dialogMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const getCloseoutFormSchema = (messages: ReturnType<typeof useOperatorAdminMessages>) =>
  z
    .object({
      resourceId: z.string().min(1, messages.resources.dialogs.closeout.validationResourceRequired),
      dateLocal: z.string().min(1, messages.resources.dialogs.closeout.validationDateRequired),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      reason: z.string().optional(),
      createdBy: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (!values.startsAt || !values.endsAt) return
      if (new Date(values.startsAt).getTime() < new Date(values.endsAt).getTime()) return

      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: messages.resources.dialogs.closeout.validationWindowOrder,
      })
    })

export function ResourceCloseoutDialog({
  open,
  onOpenChange,
  closeout,
  resources,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  closeout?: ResourceCloseoutRow
  resources: ResourceRow[]
  onSuccess: () => void
}) {
  const client = useVoyantResourcesContext()
  const messages = useOperatorAdminMessages()
  const dialogMessages = messages.resources.dialogs.closeout
  const closeoutFormSchema = getCloseoutFormSchema(messages)
  const form = useForm({
    resolver: zodResolver(closeoutFormSchema),
    defaultValues: {
      resourceId: "",
      dateLocal: "",
      startsAt: "",
      endsAt: "",
      reason: "",
      createdBy: "",
    },
  })

  useEffect(() => {
    if (open && closeout) {
      form.reset({
        resourceId: closeout.resourceId,
        dateLocal: closeout.dateLocal,
        startsAt: toLocalDateTimeInput(closeout.startsAt),
        endsAt: toLocalDateTimeInput(closeout.endsAt),
        reason: closeout.reason ?? "",
        createdBy: closeout.createdBy ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [closeout, form, open])

  const isEditing = Boolean(closeout)

  const onSubmit = async (values: z.output<typeof closeoutFormSchema>) => {
    const payload = {
      resourceId: values.resourceId,
      dateLocal: values.dateLocal,
      startsAt: toIsoDateTime(values.startsAt),
      endsAt: toIsoDateTime(values.endsAt),
      reason: nullableString(values.reason),
      createdBy: nullableString(values.createdBy),
    }

    if (isEditing) {
      await sendResourcesMutation(
        client,
        "PATCH",
        `/v1/admin/operations/closeouts/${closeout?.id}`,
        payload,
      )
    } else {
      await sendResourcesMutation(client, "POST", "/v1/admin/operations/closeouts", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialogMessages.resourceLabel}</Label>
              <Select
                items={resources.map((resource) => ({ label: resource.name, value: resource.id }))}
                value={form.watch("resourceId")}
                onValueChange={(value) => form.setValue("resourceId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.selectResourcePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((resource) => (
                    <SelectItem key={resource.id} value={resource.id}>
                      {resource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.dateLabel}</Label>
                <DatePicker
                  value={form.watch("dateLocal") || null}
                  onChange={(value) =>
                    form.setValue("dateLocal", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.startsAtLabel}</Label>
                <DateTimePicker
                  value={form.watch("startsAt") || null}
                  onChange={(value) =>
                    form.setValue("startsAt", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.endsAtLabel}</Label>
                <DateTimePicker
                  value={form.watch("endsAt") || null}
                  onChange={(value) =>
                    form.setValue("endsAt", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="w-full"
                />
                {form.formState.errors.endsAt ? (
                  <p className="text-xs text-destructive">{form.formState.errors.endsAt.message}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.createdByLabel}</Label>
                <Input
                  {...form.register("createdBy")}
                  placeholder={dialogMessages.createdByPlaceholder}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.reasonLabel}</Label>
              <Textarea
                {...form.register("reason")}
                placeholder={dialogMessages.reasonPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.save : dialogMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
