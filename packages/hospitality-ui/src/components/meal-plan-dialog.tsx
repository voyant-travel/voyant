import { type MealPlanRecord, useMealPlanMutation } from "@voyantjs/hospitality-react"
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
  Switch,
  Textarea,
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const formSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional().nullable(),
  includesBreakfast: z.boolean(),
  includesLunch: z.boolean(),
  includesDinner: z.boolean(),
  includesDrinks: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface MealPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  mealPlan?: MealPlanRecord
  onSuccess?: (mealPlan: MealPlanRecord) => void
}

export function MealPlanDialog({
  open,
  onOpenChange,
  propertyId,
  mealPlan,
  onSuccess,
}: MealPlanDialogProps) {
  const isEditing = Boolean(mealPlan)
  const { create, update } = useMealPlanMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      includesBreakfast: false,
      includesLunch: false,
      includesDinner: false,
      includesDrinks: false,
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && mealPlan) {
      form.reset({
        code: mealPlan.code,
        name: mealPlan.name,
        description: mealPlan.description ?? "",
        includesBreakfast: mealPlan.includesBreakfast,
        includesLunch: mealPlan.includesLunch,
        includesDinner: mealPlan.includesDinner,
        includesDrinks: mealPlan.includesDrinks,
        active: mealPlan.active,
        sortOrder: mealPlan.sortOrder,
      })
    } else if (open) {
      form.reset({
        code: "",
        name: "",
        description: "",
        includesBreakfast: false,
        includesLunch: false,
        includesDinner: false,
        includesDrinks: false,
        active: true,
        sortOrder: 0,
      })
    }
  }, [form, mealPlan, open])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      propertyId,
      code: values.code,
      name: values.name,
      description: values.description || null,
      includesBreakfast: values.includesBreakfast,
      includesLunch: values.includesLunch,
      includesDinner: values.includesDinner,
      includesDrinks: values.includesDrinks,
      active: values.active,
      sortOrder: values.sortOrder,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: mealPlan!.id, input: payload })
      : await create.mutateAsync(payload)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Meal Plan" : "Add Meal Plan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="BB" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Bed & Breakfast" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Sort order</Label>
              <Input {...form.register("sortOrder")} type="number" className="w-32" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesBreakfast")}
                  onCheckedChange={(checked) => form.setValue("includesBreakfast", checked)}
                />
                <Label>Breakfast</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesLunch")}
                  onCheckedChange={(checked) => form.setValue("includesLunch", checked)}
                />
                <Label>Lunch</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesDinner")}
                  onCheckedChange={(checked) => form.setValue("includesDinner", checked)}
                />
                <Label>Dinner</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesDrinks")}
                  onCheckedChange={(checked) => form.setValue("includesDrinks", checked)}
                />
                <Label>Drinks</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>Active</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Meal Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
