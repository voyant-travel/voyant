import { Button, Checkbox, Input, Label } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useProductDetailMessages } from "./host.js"
import { zodResolver } from "./zod-resolver.js"

type ItineraryMessages = ReturnType<
  typeof useProductDetailMessages
>["products"]["operations"]["itineraries"]

const buildItineraryFormSchema = (messages: ItineraryMessages) =>
  z.object({
    name: z.string().min(1, messages.validationNameRequired).max(255),
    isDefault: z.boolean(),
  })

type ItineraryFormSchema = ReturnType<typeof buildItineraryFormSchema>
type ItineraryFormValues = z.input<ItineraryFormSchema>
type ItineraryFormOutput = z.output<ItineraryFormSchema>

export type ItineraryData = {
  id: string
  name: string
  isDefault: boolean
}

export interface ProductItineraryFormProps {
  itinerary?: ItineraryData
  isFirstItinerary?: boolean
  onSubmit: (values: { name: string; isDefault: boolean }) => Promise<void> | void
  onCancel?: () => void
}

export function ProductItineraryForm({
  itinerary,
  isFirstItinerary = false,
  onSubmit,
  onCancel,
}: ProductItineraryFormProps) {
  const messages = useProductDetailMessages()
  const itineraryMessages = messages.products.operations.itineraries
  const isEditing = !!itinerary
  const schema = buildItineraryFormSchema(itineraryMessages)

  const form = useForm<ItineraryFormValues, unknown, ItineraryFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: itinerary
      ? { name: itinerary.name, isDefault: itinerary.isDefault }
      : { name: "", isDefault: isFirstItinerary },
  })

  useEffect(() => {
    if (itinerary) {
      form.reset({ name: itinerary.name, isDefault: itinerary.isDefault })
    } else {
      form.reset({ name: "", isDefault: isFirstItinerary })
    }
  }, [itinerary, isFirstItinerary, form])

  const isDefault = form.watch("isDefault")
  const defaultLocked = isEditing && itinerary?.isDefault === true

  const handleSubmit = async (values: ItineraryFormOutput) => {
    await onSubmit(values)
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="product-itinerary-name">{itineraryMessages.nameLabel}</Label>
          <Input
            id="product-itinerary-name"
            autoFocus
            placeholder={itineraryMessages.namePlaceholder}
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="product-itinerary-default"
            checked={isDefault}
            disabled={defaultLocked || isFirstItinerary}
            onCheckedChange={(checked) =>
              form.setValue("isDefault", checked === true, { shouldDirty: true })
            }
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="product-itinerary-default" className="text-sm font-normal">
              {itineraryMessages.setDefaultLabel}
            </Label>
            {defaultLocked ? (
              <p className="text-xs text-muted-foreground">{itineraryMessages.defaultLockHint}</p>
            ) : isFirstItinerary ? (
              <p className="text-xs text-muted-foreground">{itineraryMessages.firstDefaultHint}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {itineraryMessages.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? itineraryMessages.save : itineraryMessages.create}
        </Button>
      </div>
    </form>
  )
}
