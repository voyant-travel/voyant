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
} from "@voyantjs/ui/components"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useHospitalityUiMessagesOrDefault } from "../i18n"

function createFormSchema(messages: ReturnType<typeof useHospitalityUiMessagesOrDefault>) {
  return z.object({
    code: z.string().min(1, messages.mealPlanDialog.validation.codeRequired).max(50),
    name: z.string().min(1, messages.mealPlanDialog.validation.nameRequired).max(255),
    description: z.string().optional().nullable(),
    includesBreakfast: z.boolean(),
    includesLunch: z.boolean(),
    includesDinner: z.boolean(),
    includesDrinks: z.boolean(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

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
  const messages = useHospitalityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

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
          <DialogTitle>
            {isEditing
              ? messages.mealPlanDialog.titles.edit
              : messages.mealPlanDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.mealPlanDialog.fields.code}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.mealPlanDialog.placeholders.code}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.mealPlanDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.mealPlanDialog.placeholders.name}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{messages.mealPlanDialog.fields.description}</Label>
              <Textarea {...form.register("description")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{messages.mealPlanDialog.fields.sortOrder}</Label>
              <Input {...form.register("sortOrder")} type="number" className="w-32" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesBreakfast")}
                  onCheckedChange={(checked) => form.setValue("includesBreakfast", checked)}
                />
                <Label>{messages.mealPlanDialog.fields.breakfast}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesLunch")}
                  onCheckedChange={(checked) => form.setValue("includesLunch", checked)}
                />
                <Label>{messages.mealPlanDialog.fields.lunch}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesDinner")}
                  onCheckedChange={(checked) => form.setValue("includesDinner", checked)}
                />
                <Label>{messages.mealPlanDialog.fields.dinner}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("includesDrinks")}
                  onCheckedChange={(checked) => form.setValue("includesDrinks", checked)}
                />
                <Label>{messages.mealPlanDialog.fields.drinks}</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>{messages.mealPlanDialog.fields.active}</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : messages.mealPlanDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
