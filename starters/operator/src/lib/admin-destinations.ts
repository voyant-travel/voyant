import type { AdminDestinationResolvers } from "@voyant-travel/admin"
import { createAdminHostDestinations } from "@voyant-travel/admin-host/destinations"
import type {} from "@voyant-travel/bookings-react/admin"
import type {} from "@voyant-travel/catalog-react/admin"
import type {} from "@voyant-travel/flights-react/admin"
import type {} from "@voyant-travel/legal-react/admin"

import { generatedAdminDestinations } from "@/admin.destinations.generated"

export const operatorAdminDestinations = createAdminHostDestinations(
  generatedAdminDestinations,
) satisfies AdminDestinationResolvers
