import { bookingsExtrasService } from "@voyantjs/bookings/extras"
import { inventoryExtrasService } from "@voyantjs/inventory/extras"

export const extrasService: typeof inventoryExtrasService & typeof bookingsExtrasService = {
  ...inventoryExtrasService,
  ...bookingsExtrasService,
}
