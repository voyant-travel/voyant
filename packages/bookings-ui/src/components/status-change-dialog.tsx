"use client"

import {
  type BookingRecord,
  bookingStatusOptions,
  bookingStatusSchema,
  useBookingStatusMutation,
} from "@voyantjs/bookings-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const statusChangeFormSchema = z.object({
  status: bookingStatusSchema,
  note: z.string().optional().nullable(),
})

type StatusChangeFormValues = z.input<typeof statusChangeFormSchema>
type StatusChangeFormOutput = z.output<typeof statusChangeFormSchema>

export interface StatusChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  currentStatus: BookingRecord["status"]
  onSuccess?: () => void
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  bookingId,
  currentStatus,
  onSuccess,
}: StatusChangeDialogProps) {
  const mutation = useBookingStatusMutation(bookingId)

  const form = useForm<StatusChangeFormValues, unknown, StatusChangeFormOutput>({
    resolver: zodResolver(statusChangeFormSchema),
    defaultValues: {
      status: "draft",
      note: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        status: currentStatus,
        note: "",
      })
    }
  }, [currentStatus, form, open])

  const onSubmit = async (values: StatusChangeFormOutput) => {
    await mutation.mutateAsync({
      currentStatus,
      status: values.status,
      note: values.note || null,
    })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Booking Status</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>New Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) =>
                  form.setValue("status", value as StatusChangeFormValues["status"])
                }
                items={bookingStatusOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bookingStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Note (optional)</Label>
              <Textarea {...form.register("note")} placeholder="Reason for status change..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
