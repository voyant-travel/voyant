import {
  type LegalPolicyAssignmentRecord,
  useLegalPolicyAssignmentMutation,
} from "@voyantjs/legal-react"
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
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const assignmentFormSchema = z.object({
  policyId: z.string().min(1, "Policy ID is required"),
  scope: z.enum(["product", "channel", "supplier", "market", "organization", "global"]),
  productId: z.string().optional(),
  channelId: z.string().optional(),
  supplierId: z.string().optional(),
  marketId: z.string().optional(),
  organizationId: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  priority: z.coerce.number().int().optional(),
})

type FormValues = z.input<typeof assignmentFormSchema>
type FormOutput = z.output<typeof assignmentFormSchema>

export type AssignmentData = LegalPolicyAssignmentRecord

type PolicyAssignmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policyId: string
  assignment?: AssignmentData
  onSuccess: () => void
}

const SCOPES = [
  { value: "product", label: "Product" },
  { value: "channel", label: "Channel" },
  { value: "supplier", label: "Supplier" },
  { value: "market", label: "Market" },
  { value: "organization", label: "Organization" },
  { value: "global", label: "Global" },
] as const

export function PolicyAssignmentDialog({
  open,
  onOpenChange,
  policyId,
  assignment,
  onSuccess,
}: PolicyAssignmentDialogProps) {
  const isEditing = !!assignment
  const { create, update } = useLegalPolicyAssignmentMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      policyId,
      scope: "global",
      productId: "",
      channelId: "",
      supplierId: "",
      marketId: "",
      organizationId: "",
      validFrom: "",
      validTo: "",
      priority: 0,
    },
  })

  useEffect(() => {
    if (open && assignment) {
      form.reset({
        policyId: assignment.policyId,
        scope: assignment.scope as FormValues["scope"],
        productId: assignment.productId ?? "",
        channelId: assignment.channelId ?? "",
        supplierId: assignment.supplierId ?? "",
        marketId: assignment.marketId ?? "",
        organizationId: assignment.organizationId ?? "",
        validFrom: assignment.validFrom ?? "",
        validTo: assignment.validTo ?? "",
        priority: assignment.priority,
      })
    } else if (open) {
      form.reset({ policyId, scope: "global", priority: 0 })
    }
  }, [open, assignment, policyId, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      policyId: values.policyId,
      scope: values.scope,
      productId: values.productId || undefined,
      channelId: values.channelId || undefined,
      supplierId: values.supplierId || undefined,
      marketId: values.marketId || undefined,
      organizationId: values.organizationId || undefined,
      validFrom: values.validFrom || undefined,
      validTo: values.validTo || undefined,
      priority: values.priority ?? 0,
    }

    if (isEditing && assignment) {
      await update.mutateAsync({ id: assignment.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const watchedScope = form.watch("scope")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Assignment" : "New Assignment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Scope</Label>
                <Select
                  items={SCOPES}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Priority</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            {watchedScope === "product" && (
              <div className="flex flex-col gap-2">
                <Label>Product ID</Label>
                <Input {...form.register("productId")} placeholder="Product TypeID" />
              </div>
            )}
            {watchedScope === "channel" && (
              <div className="flex flex-col gap-2">
                <Label>Channel ID</Label>
                <Input {...form.register("channelId")} placeholder="Channel TypeID" />
              </div>
            )}
            {watchedScope === "supplier" && (
              <div className="flex flex-col gap-2">
                <Label>Supplier ID</Label>
                <Input {...form.register("supplierId")} placeholder="Supplier TypeID" />
              </div>
            )}
            {watchedScope === "market" && (
              <div className="flex flex-col gap-2">
                <Label>Market ID</Label>
                <Input {...form.register("marketId")} placeholder="Market TypeID" />
              </div>
            )}
            {watchedScope === "organization" && (
              <div className="flex flex-col gap-2">
                <Label>Organization ID</Label>
                <Input {...form.register("organizationId")} placeholder="Organization TypeID" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Valid From</Label>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(next) =>
                    form.setValue("validFrom", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select start date"
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valid To</Label>
                <DatePicker
                  value={form.watch("validTo") || null}
                  onChange={(next) =>
                    form.setValue("validTo", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select end date"
                  className="w-full"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Assignment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
