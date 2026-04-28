import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components"
import { useAdminMessages } from "@/lib/admin-i18n"

import { type ItineraryData, ProductItineraryForm } from "./product-itinerary-form"

export type { ItineraryData }

export type ProductItineraryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  itinerary?: ItineraryData
  isFirstItinerary?: boolean
  onSubmit: (values: { name: string; isDefault: boolean }) => Promise<void> | void
}

export function ProductItineraryDialog({
  open,
  onOpenChange,
  itinerary,
  isFirstItinerary,
  onSubmit,
}: ProductItineraryDialogProps) {
  const messages = useAdminMessages()
  const itineraryMessages = messages.products.operations.itineraries
  const isEditing = !!itinerary

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? itineraryMessages.editTitle : itineraryMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ProductItineraryForm
            itinerary={itinerary}
            isFirstItinerary={isFirstItinerary}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
