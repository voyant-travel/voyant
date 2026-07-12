import { createAdminHostDestinations } from "@voyant-travel/admin-host/destinations"

import { operatorAdminPresentation } from "@/lib/admin-presentation"

export const operatorAdminDestinations = createAdminHostDestinations(
  operatorAdminPresentation.extensions,
)
