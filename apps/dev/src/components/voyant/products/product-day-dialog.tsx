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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

const dayFormSchema = z.object({
  dayNumber: z.coerce.number().int().positive("Day number must be at least 1"),
  title: z.string().max(255).optional().nullable(),
  description: z.string().optional().nullable(),
  location: z.string().max(255).optional().nullable(),
})

type DayFormValues = z.input<typeof dayFormSchema>
type DayFormOutput = z.output<typeof dayFormSchema>

type DayData = {
  id: string
  dayNumber: number
  title: string | null
  description: string | null
  location: string | null
}

type DayDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  itineraryId: string
  day?: DayData
  nextDayNumber?: number
  onSuccess: () => void
}

export function DayDialog({
  open,
  onOpenChange,
  productId,
  itineraryId,
  day,
  nextDayNumber,
  onSuccess,
}: DayDialogProps) {
  const isEditing = !!day

  const form = useForm<DayFormValues, unknown, DayFormOutput>({
    resolver: zodResolver(dayFormSchema),
    defaultValues: {
      dayNumber: 1,
      title: "",
      description: "",
      location: "",
    },
  })

  useEffect(() => {
    if (open && day) {
      form.reset({
        dayNumber: day.dayNumber,
        title: day.title ?? "",
        description: day.description ?? "",
        location: day.location ?? "",
      })
    } else if (open) {
      form.reset({
        dayNumber: nextDayNumber ?? 1,
        title: "",
        description: "",
        location: "",
      })
    }
  }, [open, day, nextDayNumber, form])

  const onSubmit = async (values: DayFormOutput) => {
    const payload = {
      dayNumber: values.dayNumber,
      title: values.title || null,
      description: values.description || null,
      location: values.location || null,
    }

    if (isEditing) {
      await api.patch(`/v1/products/${productId}/days/${day.id}`, payload)
    } else {
      await api.post(`/v1/products/${productId}/itineraries/${itineraryId}/days`, payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Day" : "Add Day"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Day Number</Label>
                <Input {...form.register("dayNumber")} type="number" min="1" />
                {form.formState.errors.dayNumber && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.dayNumber.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Location</Label>
                <Input {...form.register("location")} placeholder="Dubrovnik" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input {...form.register("title")} placeholder="Arrival in Dubrovnik" />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea
                {...form.register("description")}
                placeholder="Day overview and activities..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Day"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
