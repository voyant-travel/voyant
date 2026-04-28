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
import type {
  AvailabilityRuleRow,
  AvailabilityStartTimeRow,
  ProductOption,
} from "./availability-shared"
import { nullableNumber, nullableString } from "./availability-shared"

const ruleFormSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  timezone: z.string().min(1, "Timezone is required"),
  recurrenceRule: z.string().min(1, "Recurrence rule is required"),
  maxCapacity: z.coerce.number().int().min(0),
  maxPickupCapacity: z.string().optional(),
  minTotalPax: z.string().optional(),
  cutoffMinutes: z.string().optional(),
  earlyBookingLimitMinutes: z.string().optional(),
  active: z.boolean(),
})

type RuleFormValues = z.input<typeof ruleFormSchema>
type RuleFormOutput = z.output<typeof ruleFormSchema>

export function AvailabilityRuleDialog({
  open,
  onOpenChange,
  rule,
  products,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: AvailabilityRuleRow
  products: ProductOption[]
  onSuccess: () => void
}) {
  const form = useForm<RuleFormValues, unknown, RuleFormOutput>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      productId: "",
      timezone: "Europe/Bucharest",
      recurrenceRule: "FREQ=DAILY;INTERVAL=1",
      maxCapacity: 0,
      maxPickupCapacity: "",
      minTotalPax: "",
      cutoffMinutes: "",
      earlyBookingLimitMinutes: "",
      active: true,
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        productId: rule.productId,
        timezone: rule.timezone,
        recurrenceRule: rule.recurrenceRule,
        maxCapacity: rule.maxCapacity,
        maxPickupCapacity: rule.maxPickupCapacity?.toString() ?? "",
        minTotalPax: "",
        cutoffMinutes: rule.cutoffMinutes?.toString() ?? "",
        earlyBookingLimitMinutes: "",
        active: rule.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, rule])

  const isEditing = Boolean(rule)

  const onSubmit = async (values: RuleFormOutput) => {
    const payload = {
      productId: values.productId,
      timezone: values.timezone,
      recurrenceRule: values.recurrenceRule,
      maxCapacity: values.maxCapacity,
      maxPickupCapacity: nullableNumber(values.maxPickupCapacity),
      minTotalPax: nullableNumber(values.minTotalPax),
      cutoffMinutes: nullableNumber(values.cutoffMinutes),
      earlyBookingLimitMinutes: nullableNumber(values.earlyBookingLimitMinutes),
      active: values.active,
    }

    if (isEditing) {
      await api.patch(`/v1/availability/rules/${rule?.id}`, payload)
    } else {
      await api.post("/v1/availability/rules", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Availability Rule" : "New Availability Rule"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.productId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.productId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Timezone</Label>
                <Input {...form.register("timezone")} placeholder="Europe/Bucharest" />
              </div>
              <div className="grid gap-2">
                <Label>Max Capacity</Label>
                <Input {...form.register("maxCapacity")} type="number" min={0} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Recurrence Rule</Label>
              <Textarea
                {...form.register("recurrenceRule")}
                placeholder="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Max Pickup Capacity</Label>
                <Input {...form.register("maxPickupCapacity")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>Minimum Total Pax</Label>
                <Input {...form.register("minTotalPax")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>Cutoff Minutes</Label>
                <Input {...form.register("cutoffMinutes")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>Early Booking Limit Minutes</Label>
                <Input {...form.register("earlyBookingLimitMinutes")} type="number" min={0} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Use this rule when generating live slots.
                </p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const startTimeFormSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  label: z.string().optional(),
  startTimeLocal: z.string().min(1, "Start time is required"),
  durationMinutes: z.string().optional(),
  sortOrder: z.coerce.number().int(),
  active: z.boolean(),
})

type StartTimeFormValues = z.input<typeof startTimeFormSchema>
type StartTimeFormOutput = z.output<typeof startTimeFormSchema>

export function AvailabilityStartTimeDialog({
  open,
  onOpenChange,
  startTime,
  products,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime?: AvailabilityStartTimeRow
  products: ProductOption[]
  onSuccess: () => void
}) {
  const form = useForm<StartTimeFormValues, unknown, StartTimeFormOutput>({
    resolver: zodResolver(startTimeFormSchema),
    defaultValues: {
      productId: "",
      label: "",
      startTimeLocal: "09:00",
      durationMinutes: "",
      sortOrder: 0,
      active: true,
    },
  })

  useEffect(() => {
    if (open && startTime) {
      form.reset({
        productId: startTime.productId,
        label: startTime.label ?? "",
        startTimeLocal: startTime.startTimeLocal,
        durationMinutes: startTime.durationMinutes?.toString() ?? "",
        sortOrder: startTime.sortOrder,
        active: startTime.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, startTime])

  const isEditing = Boolean(startTime)

  const onSubmit = async (values: StartTimeFormOutput) => {
    const payload = {
      productId: values.productId,
      label: nullableString(values.label),
      startTimeLocal: values.startTimeLocal,
      durationMinutes: nullableNumber(values.durationMinutes),
      sortOrder: values.sortOrder,
      active: values.active,
    }

    if (isEditing) {
      await api.patch(`/v1/availability/start-times/${startTime?.id}`, payload)
    } else {
      await api.post("/v1/availability/start-times", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Start Time" : "New Start Time"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Label</Label>
                <Input {...form.register("label")} placeholder="Morning departure" />
              </div>
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input {...form.register("startTimeLocal")} type="time" />
              </div>
              <div className="grid gap-2">
                <Label>Duration Minutes</Label>
                <Input {...form.register("durationMinutes")} type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label>Sort Order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Expose this start time for operational planning.
                </p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Start Time" : "Create Start Time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
