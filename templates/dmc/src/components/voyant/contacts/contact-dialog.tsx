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
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import type { Contact } from "./contact-shared"

const contactFormSchema = z.object({
  type: z.enum(["individual", "company"]),
  relation: z.enum(["client", "partner", "supplier", "other"]),
  companyName: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().or(z.literal("")).nullable(),
  preferredLanguage: z.string().optional().nullable(),
  preferredCurrency: z.string().optional().nullable(),
})

type ContactFormValues = z.input<typeof contactFormSchema>
type ContactFormOutput = z.output<typeof contactFormSchema>

type ContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  onSuccess: () => void
}

export function ContactDialog({ open, onOpenChange, contact, onSuccess }: ContactDialogProps) {
  const dialogMessages = useAdminMessages().contacts.dialog
  const formMessages = useAdminMessages().contacts.form
  const isEditing = !!contact

  const form = useForm<ContactFormValues, unknown, ContactFormOutput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      type: "individual",
      relation: "client",
      companyName: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      website: "",
      preferredLanguage: "",
      preferredCurrency: "",
    },
  })

  useEffect(() => {
    if (open && contact) {
      form.reset({
        type: contact.type,
        relation: contact.relation,
        companyName: contact.companyName ?? "",
        firstName: contact.firstName ?? "",
        lastName: contact.lastName ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        website: contact.website ?? "",
        preferredLanguage: contact.preferredLanguage ?? "",
        preferredCurrency: contact.preferredCurrency ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, contact, form])

  const contactType = form.watch("type")

  const onSubmit = async (values: ContactFormOutput) => {
    const payload = {
      ...values,
      email: values.email || null,
      website: values.website || null,
      companyName: values.companyName || null,
      firstName: values.firstName || null,
      lastName: values.lastName || null,
      phone: values.phone || null,
      preferredLanguage: values.preferredLanguage || null,
      preferredCurrency: values.preferredCurrency || null,
    }

    if (isEditing) {
      await api.patch(`/v1/contacts/${contact.id}`, payload)
    } else {
      await api.post("/v1/contacts", payload)
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
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{formMessages.typeLabel}</Label>
                <Select
                  items={[
                    { label: formMessages.typeIndividual, value: "individual" },
                    { label: formMessages.typeCompany, value: "company" },
                  ]}
                  value={contactType}
                  onValueChange={(v) => form.setValue("type", v as "individual" | "company")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">{formMessages.typeIndividual}</SelectItem>
                    <SelectItem value="company">{formMessages.typeCompany}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{formMessages.relationLabel}</Label>
                <Select
                  items={[
                    { label: formMessages.relationClient, value: "client" },
                    { label: formMessages.relationPartner, value: "partner" },
                    { label: formMessages.relationSupplier, value: "supplier" },
                    { label: formMessages.relationOther, value: "other" },
                  ]}
                  value={form.watch("relation")}
                  onValueChange={(v) =>
                    form.setValue("relation", v as "client" | "partner" | "supplier" | "other")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">{formMessages.relationClient}</SelectItem>
                    <SelectItem value="partner">{formMessages.relationPartner}</SelectItem>
                    <SelectItem value="supplier">{formMessages.relationSupplier}</SelectItem>
                    <SelectItem value="other">{formMessages.relationOther}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {contactType === "company" ? (
              <div className="flex flex-col gap-2">
                <Label>{formMessages.companyNameLabel}</Label>
                <Input
                  {...form.register("companyName")}
                  placeholder={formMessages.companyNamePlaceholder}
                />
                {form.formState.errors.companyName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{formMessages.firstNameLabel}</Label>
                  <Input
                    {...form.register("firstName")}
                    placeholder={formMessages.firstNamePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{formMessages.lastNameLabel}</Label>
                  <Input
                    {...form.register("lastName")}
                    placeholder={formMessages.lastNamePlaceholder}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{formMessages.emailLabel}</Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder={formMessages.emailPlaceholder}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{formMessages.phoneLabel}</Label>
                <Input {...form.register("phone")} placeholder={formMessages.phonePlaceholder} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{formMessages.websiteLabel}</Label>
              <Input {...form.register("website")} placeholder={formMessages.websitePlaceholder} />
              {form.formState.errors.website && (
                <p className="text-xs text-destructive">{form.formState.errors.website.message}</p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {formMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? formMessages.saveChanges : formMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
