import { createAdminHostPresentation } from "@voyant-travel/admin-host/presentation"
import { accessCatalog } from "../../.voyant/access/selected-access-catalog.generated"
import { createSelectedGraphAdminExtensions } from "../../.voyant/admin/selected-graph-admin.generated"

export const operatorAdminPresentation = createAdminHostPresentation({
  accessCatalog,
  selected: createSelectedGraphAdminExtensions,
  project: import.meta.glob("../admin/*/index.tsx", { eager: true }),
})
