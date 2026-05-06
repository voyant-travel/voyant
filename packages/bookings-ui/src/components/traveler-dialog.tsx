"use client"

import { type BookingTravelerRecord, useTravelerMutation } from "@voyantjs/bookings-react"
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
} from "@voyantjs/ui/components"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

function createTravelerFormSchema(messages: ReturnType<typeof useBookingsUiMessagesOrDefault>) {
  return z.object({
    firstName: z.string().min(1, messages.travelerDialog.validation.firstNameRequired),
    lastName: z.string().min(1, messages.travelerDialog.validation.lastNameRequired),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().optional().nullable(),
    specialRequests: z.string().optional().nullable(),
  })
}

type TravelerFormValues = z.input<ReturnType<typeof createTravelerFormSchema>>
type TravelerFormOutput = z.output<ReturnType<typeof createTravelerFormSchema>>

export interface TravelerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  traveler?: BookingTravelerRecord
  onSuccess?: () => void
}

export function TravelerDialog({
  open,
  onOpenChange,
  bookingId,
  traveler,
  onSuccess,
}: TravelerDialogProps) {
  const isEditing = Boolean(traveler)
  const { create, update } = useTravelerMutation(bookingId)
  const messages = useBookingsUiMessagesOrDefault()
  const travelerFormSchema = createTravelerFormSchema(messages)

  const form = useForm<TravelerFormValues, unknown, TravelerFormOutput>({
    resolver: zodResolver(travelerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      specialRequests: "",
    },
  })

  useEffect(() => {
    if (open && traveler) {
      form.reset({
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        email: traveler.email ?? "",
        phone: traveler.phone ?? "",
        specialRequests: traveler.specialRequests ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, traveler])

  const onSubmit = async (values: TravelerFormOutput) => {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email || null,
      phone: values.phone || null,
      specialRequests: values.specialRequests || null,
      isPrimary: traveler?.isPrimary ?? false,
    }

    if (isEditing) {
      await update.mutateAsync({ id: traveler!.id, input: payload })
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
              ? messages.travelerDialog.titles.edit
              : messages.travelerDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.travelerDialog.fields.firstName}</Label>
                <Input
                  {...form.register("firstName")}
                  placeholder={messages.travelerDialog.placeholders.firstName}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.travelerDialog.fields.lastName}</Label>
                <Input
                  {...form.register("lastName")}
                  placeholder={messages.travelerDialog.placeholders.lastName}
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
                <Label>{messages.travelerDialog.fields.email}</Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder={messages.travelerDialog.placeholders.email}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.travelerDialog.fields.phone}</Label>
                <Input
                  {...form.register("phone")}
                  placeholder={messages.travelerDialog.placeholders.phone}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.travelerDialog.fields.specialRequests}</Label>
              <Textarea
                {...form.register("specialRequests")}
                placeholder={messages.travelerDialog.placeholders.specialRequests}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing
                ? messages.common.saveChanges
                : messages.travelerDialog.actions.addTraveler}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
