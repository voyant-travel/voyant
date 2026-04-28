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
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import {
  type BookingQuestionData,
  QUESTION_FIELD_TYPES,
  QUESTION_TARGETS,
} from "./booking-requirements-shared"

const formSchema = z.object({
  label: z.string().min(1, "Label is required").max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  target: z.enum(["booking", "traveler", "lead_traveler", "booker", "extra", "service"]),
  fieldType: z.enum([
    "text",
    "textarea",
    "number",
    "email",
    "phone",
    "date",
    "datetime",
    "boolean",
    "single_select",
    "multi_select",
    "file",
    "country",
    "other",
  ]),
  placeholder: z.string().optional().nullable(),
  helpText: z.string().optional().nullable(),
  isRequired: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>
type Target = FormOutput["target"]
type FieldType = FormOutput["fieldType"]

export interface BookingQuestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  question?: BookingQuestionData
  nextSortOrder?: number
  onSuccess: () => void
}

export function BookingQuestionDialog({
  open,
  onOpenChange,
  productId,
  question,
  nextSortOrder,
  onSuccess,
}: BookingQuestionDialogProps) {
  const isEditing = !!question
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "",
      code: "",
      description: "",
      target: "booking",
      fieldType: "text",
      placeholder: "",
      helpText: "",
      isRequired: false,
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && question) {
      form.reset({
        label: question.label,
        code: question.code ?? "",
        description: question.description ?? "",
        target: question.target,
        fieldType: question.fieldType,
        placeholder: question.placeholder ?? "",
        helpText: question.helpText ?? "",
        isRequired: question.isRequired,
        active: question.active,
        sortOrder: question.sortOrder,
      })
    } else if (open) {
      form.reset({
        label: "",
        code: "",
        description: "",
        target: "booking",
        fieldType: "text",
        placeholder: "",
        helpText: "",
        isRequired: false,
        active: true,
        sortOrder: nextSortOrder ?? 0,
      })
    }
  }, [form, nextSortOrder, open, question])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      productId,
      label: values.label,
      code: values.code || null,
      description: values.description || null,
      target: values.target,
      fieldType: values.fieldType,
      placeholder: values.placeholder || null,
      helpText: values.helpText || null,
      isRequired: values.isRequired,
      active: values.active,
      sortOrder: values.sortOrder,
    }

    if (isEditing) {
      await api.patch(`/v1/booking-requirements/questions/${question.id}`, payload)
    } else {
      await api.post("/v1/booking-requirements/questions", payload)
    }

    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Question" : "Add Question"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Label</Label>
                <Input
                  {...form.register("label")}
                  placeholder="What dietary restrictions do you have?"
                />
                {form.formState.errors.label ? (
                  <p className="text-xs text-destructive">{form.formState.errors.label.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="dietary" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea
                {...form.register("description")}
                placeholder="Internal note for the operations team…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Target</Label>
                <Select
                  items={QUESTION_TARGETS}
                  value={form.watch("target")}
                  onValueChange={(value) => form.setValue("target", value as Target)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TARGETS.map((target) => (
                      <SelectItem key={target.value} value={target.value}>
                        {target.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Field type</Label>
                <Select
                  items={QUESTION_FIELD_TYPES}
                  value={form.watch("fieldType")}
                  onValueChange={(value) => form.setValue("fieldType", value as FieldType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_FIELD_TYPES.map((fieldType) => (
                      <SelectItem key={fieldType.value} value={fieldType.value}>
                        {fieldType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Placeholder</Label>
                <Input {...form.register("placeholder")} placeholder="Optional placeholder" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Help text</Label>
                <Input {...form.register("helpText")} placeholder="Shown below the field" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isRequired")}
                  onCheckedChange={(value) => form.setValue("isRequired", value)}
                />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>Active</Label>
              </div>
            </div>

            <div className="flex max-w-xs flex-col gap-2">
              <Label>Sort order</Label>
              <Input {...form.register("sortOrder")} type="number" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
