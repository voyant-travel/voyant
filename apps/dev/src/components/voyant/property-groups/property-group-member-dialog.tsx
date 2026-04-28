import {
  type CreatePropertyGroupMemberInput,
  type PropertyGroupMemberRecord,
  type UpdatePropertyGroupMemberInput,
  usePropertyGroupMemberMutation,
} from "@voyantjs/facilities-react"
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
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"
import { PropertyCombobox } from "./property-combobox"

const ROLES = ["member", "flagship", "managed", "franchise", "other"] as const
type Role = (typeof ROLES)[number]

const formSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  membershipRole: z.enum(ROLES),
  isPrimary: z.boolean(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  member?: PropertyGroupMemberRecord
  onSuccess: () => void
}

export function PropertyGroupMemberDialog({
  open,
  onOpenChange,
  groupId,
  member,
  onSuccess,
}: Props) {
  const isEditing = Boolean(member)
  const { create, update } = usePropertyGroupMemberMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyId: "",
      membershipRole: "member",
      isPrimary: false,
      validFrom: "",
      validTo: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && member) {
      form.reset({
        propertyId: member.propertyId,
        membershipRole: member.membershipRole as Role,
        isPrimary: member.isPrimary,
        validFrom: member.validFrom ?? "",
        validTo: member.validTo ?? "",
        notes: member.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        propertyId: "",
        membershipRole: "member",
        isPrimary: false,
        validFrom: "",
        validTo: "",
        notes: "",
      })
    }
  }, [form, member, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreatePropertyGroupMemberInput | UpdatePropertyGroupMemberInput = {
      groupId,
      propertyId: values.propertyId,
      membershipRole: values.membershipRole,
      isPrimary: values.isPrimary,
      validFrom: values.validFrom || null,
      validTo: values.validTo || null,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: member!.id, input: payload })
    } else {
      await create.mutateAsync(payload as CreatePropertyGroupMemberInput)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Member" : "Add Member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Property</Label>
              <PropertyCombobox
                value={form.watch("propertyId") || null}
                onChange={(value) =>
                  form.setValue("propertyId", value ?? "", { shouldValidate: true })
                }
                disabled={isEditing}
              />
              {form.formState.errors.propertyId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.propertyId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select
                  items={ROLES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("membershipRole")}
                  onValueChange={(value) => form.setValue("membershipRole", value as Role)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role} className="capitalize">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={form.watch("isPrimary")}
                  onCheckedChange={(value) => form.setValue("isPrimary", value)}
                />
                <Label>Primary</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Valid from</Label>
                <Input {...form.register("validFrom")} type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valid to</Label>
                <Input {...form.register("validTo")} type="date" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
