import {
  type CreateFacilityFeatureInput,
  type FacilityFeatureRecord,
  type UpdateFacilityFeatureInput,
  useFacilityFeatureMutation,
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

const CATEGORIES = ["amenity", "accessibility", "security", "service", "policy", "other"] as const
type Category = (typeof CATEGORIES)[number]

const formSchema = z.object({
  category: z.enum(CATEGORIES),
  code: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional().nullable(),
  valueText: z.string().optional().nullable(),
  highlighted: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  facilityId: string
  feature?: FacilityFeatureRecord
  onSuccess: () => void
}

export function FacilityFeatureDialog({
  open,
  onOpenChange,
  facilityId,
  feature,
  onSuccess,
}: Props) {
  const isEditing = Boolean(feature)
  const { create, update } = useFacilityFeatureMutation()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "amenity",
      code: "",
      name: "",
      description: "",
      valueText: "",
      highlighted: false,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && feature) {
      form.reset({
        category: feature.category as Category,
        code: feature.code ?? "",
        name: feature.name,
        description: feature.description ?? "",
        valueText: feature.valueText ?? "",
        highlighted: feature.highlighted,
        sortOrder: feature.sortOrder,
      })
      return
    }
    if (open) {
      form.reset({
        category: "amenity",
        code: "",
        name: "",
        description: "",
        valueText: "",
        highlighted: false,
        sortOrder: 0,
      })
    }
  }, [feature, form, open])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      category: values.category,
      code: values.code || null,
      name: values.name,
      description: values.description || null,
      valueText: values.valueText || null,
      highlighted: values.highlighted,
      sortOrder: values.sortOrder,
    }

    if (isEditing) {
      await update.mutateAsync({ id: feature!.id, input: payload as UpdateFacilityFeatureInput })
    } else {
      await create.mutateAsync({
        facilityId,
        ...(payload as Omit<CreateFacilityFeatureInput, "facilityId">),
      })
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Feature" : "Add Feature"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select
                  items={CATEGORIES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("category")}
                  onValueChange={(value) => form.setValue("category", value as Category)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category} className="capitalize">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="wifi" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Free Wi-Fi" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Value text</Label>
              <Input {...form.register("valueText")} placeholder="100 Mbps, all areas" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("highlighted")}
                  onCheckedChange={(value) => form.setValue("highlighted", value)}
                />
                <Label>Highlighted</Label>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Feature"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
