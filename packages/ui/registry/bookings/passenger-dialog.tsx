"use client"

import { type BookingPassengerRecord, usePassengerMutation } from "@voyantjs/bookings-react"
import { useBookingsUiMessagesOrDefault } from "@voyantjs/bookings-ui"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
  Textarea,
} from "@/components/ui"
import { zodResolver } from "@/lib/zod-resolver"
import { useRegistryBookingsMessagesOrDefault } from "./i18n"

function createPassengerFormSchema(
  messages: ReturnType<typeof useRegistryBookingsMessagesOrDefault>,
) {
  return z.object({
    firstName: z.string().min(1, messages.passengerDialog.validation.firstNameRequired),
    lastName: z.string().min(1, messages.passengerDialog.validation.lastNameRequired),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().optional().nullable(),
    specialRequests: z.string().optional().nullable(),
  })
}

type PassengerFormValues = z.input<ReturnType<typeof createPassengerFormSchema>>
type PassengerFormOutput = z.output<ReturnType<typeof createPassengerFormSchema>>

export interface PassengerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  passenger?: BookingPassengerRecord
  onSuccess?: () => void
}

export function PassengerDialog({
  open,
  onOpenChange,
  bookingId,
  passenger,
  onSuccess,
}: PassengerDialogProps) {
  const isEditing = Boolean(passenger)
  const { create, update } = usePassengerMutation(bookingId)
  const bookingMessages = useBookingsUiMessagesOrDefault()
  const messages = useRegistryBookingsMessagesOrDefault()
  const passengerFormSchema = createPassengerFormSchema(messages)

  const form = useForm<PassengerFormValues, unknown, PassengerFormOutput>({
    resolver: zodResolver(passengerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      specialRequests: "",
    },
  })

  useEffect(() => {
    if (open && passenger) {
      form.reset({
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        email: passenger.email ?? "",
        phone: passenger.phone ?? "",
        specialRequests: passenger.specialRequests ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, passenger])

  const onSubmit = async (values: PassengerFormOutput) => {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email || null,
      phone: values.phone || null,
      specialRequests: values.specialRequests || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: passenger!.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onOpenChange(false)
    onSuccess?.()
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.passengerDialog.titles.edit
              : messages.passengerDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.passengerDialog.fields.firstName}</Label>
                <Input
                  {...form.register("firstName")}
                  placeholder={messages.passengerDialog.placeholders.firstName}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.passengerDialog.fields.lastName}</Label>
                <Input
                  {...form.register("lastName")}
                  placeholder={messages.passengerDialog.placeholders.lastName}
                />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.passengerDialog.fields.email}</Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder={messages.passengerDialog.placeholders.email}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.passengerDialog.fields.phone}</Label>
                <Input
                  {...form.register("phone")}
                  placeholder={messages.passengerDialog.placeholders.phone}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.passengerDialog.fields.specialRequests}</Label>
              <Textarea
                {...form.register("specialRequests")}
                placeholder={messages.passengerDialog.placeholders.specialRequests}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {bookingMessages.common.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing
                ? bookingMessages.common.saveChanges
                : messages.passengerDialog.actions.addPassenger}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
