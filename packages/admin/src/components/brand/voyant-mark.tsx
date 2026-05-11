import type * as React from "react"

export function VoyantMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 834 834"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Voyant"
      role="img"
      data-slot="voyant-mark"
      className={className}
      {...props}
    >
      <path d="M323.896 798.828L14 35H177.677L369.725 519.485C393.731 580.591 401.37 620.965 401.37 688.618V695.165H436.288V689.709C436.288 624.238 443.926 583.865 469.023 521.667L664.345 35H819.293L514.853 798.828H323.896Z" />
    </svg>
  )
}
