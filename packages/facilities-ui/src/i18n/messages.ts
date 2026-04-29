export type FacilitiesUiMessages = {
  common: {
    loading: string
    none: string
  }
  facilityCombobox: {
    placeholder: string
    empty: string
  }
  facilityBadge: {
    /** Fallback label when the facility id can be looked up but the row is missing/deleted. */
    missing: string
  }
}
