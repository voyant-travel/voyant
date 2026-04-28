import {
  type CreatePropertyGroupInput,
  type UpdatePropertyGroupInput,
  usePropertyGroupMutation,
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
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"
import {
  PROPERTY_GROUP_STATUSES,
  PROPERTY_GROUP_TYPES,
  type PropertyGroupData,
} from "./property-group-shared"

type GroupType = (typeof PROPERTY_GROUP_TYPES)[number]
type Status = (typeof PROPERTY_GROUP_STATUSES)[number]

const formSchema = z.object({
  groupType: z.enum(PROPERTY_GROUP_TYPES),
  status: z.enum(PROPERTY_GROUP_STATUSES),
  parentGroupId: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().optional().nullable(),
  brandName: z.string().optional().nullable(),
  legalName: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: PropertyGroupData
  onSuccess: () => void
}

export function PropertyGroupDialog({ open, onOpenChange, group, onSuccess }: Props) {
  const isEditing = Boolean(group)
  const { create, update } = usePropertyGroupMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      groupType: "chain",
      status: "active",
      parentGroupId: "",
      name: "",
      code: "",
      brandName: "",
      legalName: "",
      website: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && group) {
      form.reset({
        groupType: group.groupType as GroupType,
        status: group.status as Status,
        parentGroupId: group.parentGroupId ?? "",
        name: group.name,
        code: group.code ?? "",
        brandName: group.brandName ?? "",
        legalName: group.legalName ?? "",
        website: group.website ?? "",
        notes: group.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        groupType: "chain",
        status: "active",
        parentGroupId: "",
        name: "",
        code: "",
        brandName: "",
        legalName: "",
        website: "",
        notes: "",
      })
    }
  }, [form, group, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreatePropertyGroupInput | UpdatePropertyGroupInput = {
      groupType: values.groupType,
      status: values.status,
      parentGroupId: values.parentGroupId || null,
      name: values.name,
      code: values.code || null,
      brandName: values.brandName || null,
      legalName: values.legalName || null,
      website: values.website || null,
      notes: values.notes || null,
    }
    if (isEditing) {
      await update.mutateAsync({ id: group!.id, input: payload })
    } else {
      await create.mutateAsync(payload as CreatePropertyGroupInput)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Property Group" : "Add Property Group"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Hilton Worldwide" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="hilton" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Group type</Label>
                <Select
                  items={PROPERTY_GROUP_TYPES.map((x) => ({
                    label: x.replace(/_/g, " "),
                    value: x,
                  }))}
                  value={form.watch("groupType")}
                  onValueChange={(value) => form.setValue("groupType", value as GroupType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_GROUP_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={PROPERTY_GROUP_STATUSES.map((x) => ({
                    label: x.replace(/_/g, " "),
                    value: x,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as Status)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_GROUP_STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Brand name</Label>
                <Input {...form.register("brandName")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Legal name</Label>
                <Input {...form.register("legalName")} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Website</Label>
              <Input {...form.register("website")} placeholder="https://example.com" />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Parent group ID</Label>
              <Input {...form.register("parentGroupId")} />
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
              {isEditing ? "Save Changes" : "Add Property Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
