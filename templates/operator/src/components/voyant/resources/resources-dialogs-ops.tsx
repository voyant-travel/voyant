import {
  Button,
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
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import type {
  BookingOption,
  ResourceCloseoutRow,
  ResourcePoolRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  SlotOption,
} from "./resources-shared"
import {
  assignmentStatusOptions,
  NONE_VALUE,
  nullableString,
  slotLabel,
  toIsoDateTime,
  toLocalDateTimeInput,
} from "./resources-shared"

const getAssignmentFormSchema = (messages: ReturnType<typeof useAdminMessages>) =>
  z.object({
    slotId: z.string().min(1, messages.resources.dialogs.assignment.validationSlotRequired),
    poolId: z.string().optional(),
    resourceId: z.string().optional(),
    bookingId: z.string().optional(),
    status: z.enum(["reserved", "assigned", "released", "cancelled", "completed"]),
    assignedBy: z.string().optional(),
    releasedAt: z.string().optional(),
    notes: z.string().optional(),
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
  const messages = useAdminMessages()
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
      await api.patch(`/v1/resources/slot-assignments/${assignment?.id}`, payload)
    } else {
      await api.post("/v1/resources/slot-assignments", payload)
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
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
                  onValueChange={(value) => form.setValue("poolId", value ?? NONE_VALUE)}
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
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.resourceLabel}</Label>
                <Select
                  value={form.watch("resourceId")}
                  onValueChange={(value) => form.setValue("resourceId", value ?? NONE_VALUE)}
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
                <Input {...form.register("releasedAt")} type="datetime-local" />
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

const getCloseoutFormSchema = (messages: ReturnType<typeof useAdminMessages>) =>
  z.object({
    resourceId: z.string().min(1, messages.resources.dialogs.closeout.validationResourceRequired),
    dateLocal: z.string().min(1, messages.resources.dialogs.closeout.validationDateRequired),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    reason: z.string().optional(),
    createdBy: z.string().optional(),
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
  const messages = useAdminMessages()
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
      await api.patch(`/v1/resources/closeouts/${closeout?.id}`, payload)
    } else {
      await api.post("/v1/resources/closeouts", payload)
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
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
                <Input {...form.register("dateLocal")} type="date" />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.startsAtLabel}</Label>
                <Input {...form.register("startsAt")} type="datetime-local" />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.endsAtLabel}</Label>
                <Input {...form.register("endsAt")} type="datetime-local" />
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
