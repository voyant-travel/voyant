export const CABIN_BED_CONFIGURATIONS = [
  "single",
  "twin",
  "double",
  "queen",
  "king",
  "convertible_twins",
  "sofa_bed",
  "pullman",
  "bunk",
  "murphy",
] as const

export type CabinBedConfiguration = (typeof CABIN_BED_CONFIGURATIONS)[number]

export const CABIN_ACCESSIBILITY_FEATURES = [
  "wheelchair_accessible",
  "step_free_access",
  "roll_in_shower",
  "grab_bars",
  "visual_alarm",
  "hearing_loop",
  "accessible_balcony",
  "accessible_bathroom",
] as const

export type CabinAccessibilityFeature = (typeof CABIN_ACCESSIBILITY_FEATURES)[number]

export const CABIN_VIEW_TYPES = [
  "none",
  "interior",
  "virtual",
  "porthole",
  "window",
  "oceanview",
  "river_view",
  "balcony",
  "french_balcony",
  "promenade",
  "obstructed",
] as const

export type CabinViewType = (typeof CABIN_VIEW_TYPES)[number]
