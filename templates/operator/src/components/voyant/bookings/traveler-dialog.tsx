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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

type TravelerDialogMessages = ReturnType<
  typeof useAdminMessages
>["bookings"]["detail"]["travelerDialog"]

const buildTravelerFormSchema = (messages: TravelerDialogMessages) =>
  z.object({
    firstName: z.string().min(1, messages.validationFirstNameRequired),
    lastName: z.string().min(1, messages.validationLastNameRequired),
    email: z
      .string()
      .email(messages.validationEmailInvalid)
      .optional()
      .or(z.literal(""))
      .nullable(),
    phone: z.string().optional().nullable(),
    specialRequests: z.string().optional().nullable(),
  })

type TravelerFormSchema = ReturnType<typeof buildTravelerFormSchema>
type TravelerFormValues = z.input<TravelerFormSchema>
type TravelerFormOutput = z.output<TravelerFormSchema>

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
  const travelerDialogMessages = useAdminMessages().bookings.detail.travelerDialog
  const isEditing = Boolean(traveler)
  const { create, update } = useTravelerMutation(bookingId)
  const travelerFormSchema = buildTravelerFormSchema(travelerDialogMessages)

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
            {isEditing ? travelerDialogMessages.editTitle : travelerDialogMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{travelerDialogMessages.firstNameLabel}</Label>
                <Input
                  {...form.register("firstName")}
                  placeholder={travelerDialogMessages.firstNamePlaceholder}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{travelerDialogMessages.lastNameLabel}</Label>
                <Input
                  {...form.register("lastName")}
                  placeholder={travelerDialogMessages.lastNamePlaceholder}
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
                <Label>{travelerDialogMessages.emailLabel}</Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder={travelerDialogMessages.emailPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{travelerDialogMessages.phoneLabel}</Label>
                <Input
                  {...form.register("phone")}
                  placeholder={travelerDialogMessages.phonePlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{travelerDialogMessages.specialRequestsLabel}</Label>
              <Textarea
                {...form.register("specialRequests")}
                placeholder={travelerDialogMessages.specialRequestsPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {travelerDialogMessages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? travelerDialogMessages.saveChanges : travelerDialogMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
