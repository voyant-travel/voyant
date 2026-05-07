"use client"

import {
  type BookingTravelerRecord,
  useRevealTraveler,
  useTravelerWithTravelDetailsMutation,
} from "@voyantjs/bookings-react"
import {
  type CreatePersonDocumentFromPlaintextInput,
  usePersonDocumentMutation,
  usePersonDocuments,
  usePersonMutation,
  usePersonTravelSnapshot,
} from "@voyantjs/crm-react"
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
import { Loader2, Sparkles, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
    passportNumber: z.string().optional().nullable(),
    passportExpiry: z.string().optional().nullable(),
    passportIssuingCountry: z.string().optional().nullable(),
    passportIssuingAuthority: z.string().optional().nullable(),
    dateOfBirth: z.string().optional().nullable(),
    dietaryRequirements: z.string().optional().nullable(),
    accessibilityNeeds: z.string().optional().nullable(),
  })
}

type TravelerFormValues = z.input<ReturnType<typeof createTravelerFormSchema>>
type TravelerFormOutput = z.output<ReturnType<typeof createTravelerFormSchema>>

const EMPTY_PII_FORM = {
  passportNumber: "",
  passportExpiry: "",
  passportIssuingCountry: "",
  passportIssuingAuthority: "",
  dateOfBirth: "",
  dietaryRequirements: "",
  accessibilityNeeds: "",
}

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
  const personId = traveler?.personId ?? null
  const messages = useBookingsUiMessagesOrDefault()
  const travelerFormSchema = createTravelerFormSchema(messages)

  const travelerMutation = useTravelerWithTravelDetailsMutation(bookingId)
  const personMutation = usePersonMutation()
  const documentMutation = usePersonDocumentMutation(personId ?? undefined)

  const reveal = useRevealTraveler(bookingId, traveler?.id ?? null, {
    enabled: Boolean(open && isEditing && traveler?.id),
  })
  const snapshotQuery = usePersonTravelSnapshot(personId ?? undefined, {
    enabled: open && Boolean(personId),
  })
  const documentsQuery = usePersonDocuments(personId ?? undefined, {
    enabled: open && Boolean(personId),
  })

  const snapshot = snapshotQuery.data?.data ?? null
  const revealedTravelDetails = reveal.data?.data.travelDetails ?? null
  const primaryPassport = useMemo(
    () => documentsQuery.data?.data.find((row) => row.type === "passport" && row.isPrimary) ?? null,
    [documentsQuery.data],
  )

  const form = useForm<TravelerFormValues, unknown, TravelerFormOutput>({
    resolver: zodResolver(travelerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      specialRequests: "",
      ...EMPTY_PII_FORM,
    },
  })

  const [savedToProfileMessage, setSavedToProfileMessage] = useState(false)
  const [prefilledNotice, setPrefilledNotice] = useState(false)

  useEffect(() => {
    setSavedToProfileMessage(false)
    setPrefilledNotice(false)
    if (!open) return
    if (traveler) {
      form.reset({
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        email: traveler.email ?? "",
        phone: traveler.phone ?? "",
        specialRequests: traveler.specialRequests ?? "",
        passportNumber: revealedTravelDetails?.passportNumber ?? "",
        passportExpiry: revealedTravelDetails?.passportExpiry ?? "",
        passportIssuingCountry: revealedTravelDetails?.passportIssuingCountry ?? "",
        passportIssuingAuthority: revealedTravelDetails?.passportIssuingAuthority ?? "",
        dateOfBirth: revealedTravelDetails?.dateOfBirth ?? "",
        dietaryRequirements: revealedTravelDetails?.dietaryRequirements ?? "",
        accessibilityNeeds: revealedTravelDetails?.accessibilityNeeds ?? "",
      })
    } else {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        specialRequests: "",
        ...EMPTY_PII_FORM,
      })
    }
  }, [form, open, traveler, revealedTravelDetails])

  const prefillFromProfile = () => {
    if (!snapshot) return
    form.setValue("passportNumber", snapshot.passportNumber ?? "")
    form.setValue("passportExpiry", snapshot.passportExpiry ?? "")
    form.setValue("passportIssuingCountry", snapshot.passportIssuingCountry ?? "")
    form.setValue("passportIssuingAuthority", snapshot.passportIssuingAuthority ?? "")
    form.setValue("dateOfBirth", snapshot.dateOfBirth ?? "")
    form.setValue("dietaryRequirements", snapshot.dietaryRequirements ?? "")
    form.setValue("accessibilityNeeds", snapshot.accessibilityNeeds ?? "")
    setPrefilledNotice(true)
    setSavedToProfileMessage(false)
  }

  const onSubmit = async (values: TravelerFormOutput) => {
    const trimOrNull = (value: string | null | undefined) => {
      if (value === null || value === undefined) return null
      const trimmed = value.trim()
      return trimmed === "" ? null : trimmed
    }

    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email || null,
      phone: values.phone || null,
      specialRequests: values.specialRequests || null,
      isPrimary: traveler?.isPrimary ?? false,
      participantType: "traveler",
      passportNumber: trimOrNull(values.passportNumber),
      passportExpiry: trimOrNull(values.passportExpiry),
      passportIssuingCountry: trimOrNull(values.passportIssuingCountry),
      passportIssuingAuthority: trimOrNull(values.passportIssuingAuthority),
      dateOfBirth: trimOrNull(values.dateOfBirth),
      dietaryRequirements: trimOrNull(values.dietaryRequirements),
      accessibilityNeeds: trimOrNull(values.accessibilityNeeds),
    }

    if (isEditing) {
      await travelerMutation.update.mutateAsync({ travelerId: traveler!.id, input: payload })
    } else {
      await travelerMutation.create.mutateAsync(payload)
    }

    onOpenChange(false)
    onSuccess?.()
  }

  /**
   * Pushes diverging dietary / accessibility / passport values from
   * the form back to the linked person record. Dietary + accessibility
   * land on `crm.people` via the profile-pii endpoint. Passport
   * diffs update the existing primary passport if there is one,
   * otherwise create a new primary passport doc.
   */
  const saveBackToProfile = async () => {
    if (!personId) return
    const values = form.getValues()
    const trim = (value: string | null | undefined) => {
      if (value === null || value === undefined) return null
      const trimmed = value.trim()
      return trimmed === "" ? null : trimmed
    }
    const formDietary = trim(values.dietaryRequirements)
    const formAccessibility = trim(values.accessibilityNeeds)
    const formPassportNumber = trim(values.passportNumber)
    const formPassportExpiry = trim(values.passportExpiry)
    const formPassportCountry = trim(values.passportIssuingCountry)
    const formPassportAuthority = trim(values.passportIssuingAuthority)

    const piiUpdate: Record<string, string | null> = {}
    if (formDietary !== (snapshot?.dietaryRequirements ?? null)) {
      piiUpdate.dietary = formDietary
    }
    if (formAccessibility !== (snapshot?.accessibilityNeeds ?? null)) {
      piiUpdate.accessibility = formAccessibility
    }
    if (Object.keys(piiUpdate).length > 0) {
      await personMutation.updateProfilePii.mutateAsync({ personId, input: piiUpdate })
    }

    const passportDiverged =
      formPassportNumber !== (snapshot?.passportNumber ?? null) ||
      formPassportExpiry !== (snapshot?.passportExpiry ?? null) ||
      formPassportCountry !== (snapshot?.passportIssuingCountry ?? null) ||
      formPassportAuthority !== (snapshot?.passportIssuingAuthority ?? null)
    if (passportDiverged) {
      const passportPayload: CreatePersonDocumentFromPlaintextInput = {
        type: "passport",
        number: formPassportNumber,
        issuingCountry: formPassportCountry,
        issuingAuthority: formPassportAuthority,
        expiryDate: formPassportExpiry,
        isPrimary: true,
      }
      if (primaryPassport) {
        await documentMutation.updateFromPlaintext.mutateAsync({
          id: primaryPassport.id,
          input: passportPayload,
        })
      } else {
        await documentMutation.createFromPlaintext.mutateAsync(passportPayload)
      }
    }

    setSavedToProfileMessage(true)
    setPrefilledNotice(false)
  }

  const isSubmitting = travelerMutation.create.isPending || travelerMutation.update.isPending
  const isSavingProfile =
    personMutation.updateProfilePii.isPending ||
    documentMutation.updateFromPlaintext.isPending ||
    documentMutation.createFromPlaintext.isPending

  const watched = form.watch()
  const hasDivergence =
    Boolean(personId) &&
    snapshot &&
    [
      ["dietaryRequirements", "dietaryRequirements"],
      ["accessibilityNeeds", "accessibilityNeeds"],
      ["passportNumber", "passportNumber"],
      ["passportExpiry", "passportExpiry"],
      ["passportIssuingCountry", "passportIssuingCountry"],
      ["passportIssuingAuthority", "passportIssuingAuthority"],
    ].some(([formKey, snapKey]) => {
      const formValue = (watched as Record<string, unknown>)[formKey as string] ?? ""
      const snapValue = (snapshot as Record<string, unknown>)[snapKey as string] ?? ""
      return String(formValue ?? "").trim() !== String(snapValue ?? "").trim()
    })

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

            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {messages.travelerDialog.fields.travelDetailsHeading}
                </h3>
                {personId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!snapshot || snapshotQuery.isLoading}
                    onClick={prefillFromProfile}
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    {messages.travelerDialog.actions.prefillFromProfile}
                  </Button>
                ) : null}
              </div>
              {prefilledNotice ? (
                <p className="text-xs text-muted-foreground">
                  {messages.travelerDialog.hints.prefilledFromProfile}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{messages.travelerDialog.fields.passportNumber}</Label>
                  <Input
                    {...form.register("passportNumber")}
                    placeholder={messages.travelerDialog.placeholders.passportNumber}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{messages.travelerDialog.fields.passportExpiry}</Label>
                  <Input
                    {...form.register("passportExpiry")}
                    type="date"
                    placeholder={messages.travelerDialog.placeholders.passportExpiry}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{messages.travelerDialog.fields.passportIssuingCountry}</Label>
                  <Input
                    {...form.register("passportIssuingCountry")}
                    placeholder={messages.travelerDialog.placeholders.passportIssuingCountry}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{messages.travelerDialog.fields.passportIssuingAuthority}</Label>
                  <Input
                    {...form.register("passportIssuingAuthority")}
                    placeholder={messages.travelerDialog.placeholders.passportIssuingAuthority}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.travelerDialog.fields.dateOfBirth}</Label>
                <Input
                  {...form.register("dateOfBirth")}
                  type="date"
                  placeholder={messages.travelerDialog.placeholders.dateOfBirth}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{messages.travelerDialog.fields.dietaryRequirements}</Label>
                  <Textarea
                    {...form.register("dietaryRequirements")}
                    placeholder={messages.travelerDialog.placeholders.dietaryRequirements}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{messages.travelerDialog.fields.accessibilityNeeds}</Label>
                  <Textarea
                    {...form.register("accessibilityNeeds")}
                    placeholder={messages.travelerDialog.placeholders.accessibilityNeeds}
                  />
                </div>
              </div>

              {personId && hasDivergence ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {savedToProfileMessage ? messages.travelerDialog.hints.savedToProfile : null}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSavingProfile}
                    onClick={saveBackToProfile}
                  >
                    {isSavingProfile ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-3.5 w-3.5" />
                    )}
                    {messages.travelerDialog.actions.saveToProfile}
                  </Button>
                </div>
              ) : null}
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
