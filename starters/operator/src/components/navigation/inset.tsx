import { cn, SidebarInset, SidebarTrigger } from "@voyant-travel/ui/components"

export const AppSidebarInset = ({
  children,
  headerLeft,
  headerRight,
  className,
}: {
  children: React.ReactNode
  headerLeft?: React.ReactNode
  headerRight?: React.ReactNode
  className?: string
}) => {
  return (
    <SidebarInset>
      <header
        className={cn(
          "border-border flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-border/50" />
          {headerLeft}
        </div>
        <div className="flex items-center gap-4">{headerRight}</div>
      </header>
      {children}
    </SidebarInset>
  )
}
