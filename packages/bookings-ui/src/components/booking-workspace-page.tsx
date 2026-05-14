"use client"

import { type BookingRecord, useBooking } from "@voyantjs/bookings-react"
import { Button, Card, CardContent, cn } from "@voyantjs/ui/components"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ArrowLeft, BriefcaseBusiness, FileText, Landmark, ListChecks, Users } from "lucide-react"
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useBookingsUiMessagesOrDefault } from "../i18n/index.js"
import { BookingDetailPage, type BookingDetailPageSlots } from "./booking-detail-page.js"

export type BookingWorkspaceSection = "booking" | "finance" | "legal" | "travelers" | "activity"

export interface BookingWorkspaceBulkActionContext {
  bookingId: string
  selectedTravelerIds: string[]
  selectedFinanceItemIds: string[]
  setSelectedTravelerIds: Dispatch<SetStateAction<string[]>>
  setSelectedFinanceItemIds: Dispatch<SetStateAction<string[]>>
  clearBulkSelection: () => void
}

export interface BookingWorkspaceSlotContext {
  booking: BookingRecord
  bookingId: string
  activeSection: BookingWorkspaceSection
  setActiveSection: (section: BookingWorkspaceSection) => void
  bulkActions: BookingWorkspaceBulkActionContext
}

export interface BookingWorkspaceNavigationItem {
  value: BookingWorkspaceSection
  label: string
  badge?: ReactNode
  disabled?: boolean
}

export interface BookingWorkspacePageSlots {
  actionBar?: (context: BookingWorkspaceSlotContext) => ReactNode
  bulkActionBar?: (context: BookingWorkspaceSlotContext) => ReactNode
  afterNavigation?: (context: BookingWorkspaceSlotContext) => ReactNode
  workspaceSidebar?: (context: BookingWorkspaceSlotContext) => ReactNode
  financeSidebar?: (context: BookingWorkspaceSlotContext) => ReactNode
  legalSidebar?: (context: BookingWorkspaceSlotContext) => ReactNode
  travelersSidebar?: (context: BookingWorkspaceSlotContext) => ReactNode
  activitySidebar?: (context: BookingWorkspaceSlotContext) => ReactNode
  financeTab?: (context: BookingWorkspaceSlotContext) => ReactNode
  legalTab?: (context: BookingWorkspaceSlotContext) => ReactNode
  travelersTabExtensions?: (context: BookingWorkspaceSlotContext) => ReactNode
  activityTab?: (context: BookingWorkspaceSlotContext) => ReactNode
}

export interface BookingWorkspacePageProps {
  id: string
  className?: string
  locale?: string
  defaultSection?: BookingWorkspaceSection
  navigationItems?: BookingWorkspaceNavigationItem[]
  onBack?: () => void
  onPersonOpen?: (personId: string) => void
  onOrganizationOpen?: (organizationId: string) => void
  onCollectPayment?: (booking: BookingRecord) => void
  bookingDetailSlots?: BookingDetailPageSlots
  slots?: BookingWorkspacePageSlots
}

export interface BookingWorkspaceShellProps extends BookingWorkspacePageProps {
  booking?: BookingRecord | null
  isLoading?: boolean
}

const BookingWorkspaceBulkActionsContext = createContext<BookingWorkspaceBulkActionContext | null>(
  null,
)

export function useBookingWorkspaceBulkActions() {
  const context = useContext(BookingWorkspaceBulkActionsContext)
  if (!context) {
    throw new Error("useBookingWorkspaceBulkActions must be used inside BookingWorkspacePage")
  }
  return context
}

export function BookingWorkspacePage(props: BookingWorkspacePageProps) {
  const bookingQuery = useBooking(props.id)

  return (
    <BookingWorkspaceShell
      {...props}
      booking={bookingQuery.data?.data ?? null}
      isLoading={bookingQuery.isPending}
    />
  )
}

export function BookingWorkspaceShell({
  id,
  className,
  locale,
  defaultSection = "booking",
  navigationItems,
  onBack,
  onPersonOpen,
  onOrganizationOpen,
  onCollectPayment,
  bookingDetailSlots,
  slots,
  booking,
  isLoading = false,
}: BookingWorkspaceShellProps) {
  const messages = useBookingsUiMessagesOrDefault()
  const workspaceMessages = messages.bookingWorkspacePage
  const [activeSection, setActiveSection] = useState<BookingWorkspaceSection>(defaultSection)
  const [selectedTravelerIds, setSelectedTravelerIds] = useState<string[]>([])
  const [selectedFinanceItemIds, setSelectedFinanceItemIds] = useState<string[]>([])
  const bookingId = booking?.id ?? id
  const previousBookingId = useRef(bookingId)

  useEffect(() => {
    if (previousBookingId.current === bookingId) return
    previousBookingId.current = bookingId
    setSelectedTravelerIds([])
    setSelectedFinanceItemIds([])
  }, [bookingId])

  const bulkActions = useMemo<BookingWorkspaceBulkActionContext>(
    () => ({
      bookingId,
      selectedTravelerIds,
      selectedFinanceItemIds,
      setSelectedTravelerIds,
      setSelectedFinanceItemIds,
      clearBulkSelection: () => {
        setSelectedTravelerIds([])
        setSelectedFinanceItemIds([])
      },
    }),
    [bookingId, selectedFinanceItemIds, selectedTravelerIds],
  )

  if (isLoading) {
    return (
      <div data-slot="booking-workspace-page" className={cn("flex flex-col gap-6 p-6", className)}>
        <WorkspaceHeader title={workspaceMessages.loadingTitle} onBack={onBack} />
        <Card className="border-dashed">
          <CardContent className="flex min-h-48 items-center justify-center py-10">
            <p className="text-sm text-muted-foreground">{messages.common.loading}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!booking) {
    return (
      <div data-slot="booking-workspace-page" className={cn("flex flex-col gap-6 p-6", className)}>
        <WorkspaceHeader title={workspaceMessages.notFoundTitle} onBack={onBack} />
        <Card className="border-dashed">
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 py-10">
            <p className="text-sm text-muted-foreground">{workspaceMessages.notFoundDescription}</p>
            {onBack ? (
              <Button type="button" variant="outline" onClick={onBack}>
                {messages.bookingDetailPage.backToBookings}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  const context: BookingWorkspaceSlotContext = {
    booking,
    bookingId,
    activeSection,
    setActiveSection,
    bulkActions,
  }
  const items = navigationItems ?? getDefaultNavigationItems(workspaceMessages.tabs)
  const sidebar = renderSidebar(activeSection, slots, context)
  const hasSidebar = Boolean(sidebar)

  return (
    <BookingWorkspaceBulkActionsContext.Provider value={bulkActions}>
      <div data-slot="booking-workspace-page" className={cn("flex flex-col gap-5 p-6", className)}>
        <WorkspaceHeader
          title={booking.bookingNumber}
          description={workspaceMessages.description}
          onBack={onBack}
          actions={slots?.actionBar?.(context)}
        />

        {slots?.bulkActionBar?.(context)}

        <Tabs
          value={activeSection}
          onValueChange={(value) => setActiveSection(value as BookingWorkspaceSection)}
          className="flex min-w-0 flex-col gap-5"
        >
          <div className="overflow-x-auto">
            <TabsList className="h-auto min-w-max justify-start">
              {items.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className="gap-2"
                >
                  <WorkspaceTabIcon section={item.value} />
                  <span>{item.label}</span>
                  {item.badge}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {slots?.afterNavigation?.(context)}

          <div
            className={cn(
              "grid min-w-0 gap-6",
              hasSidebar ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "xl:grid-cols-1",
            )}
          >
            <div className="min-w-0">
              <TabsContent value="booking" className="mt-0">
                <BookingDetailPage
                  id={bookingId}
                  className="p-0"
                  locale={locale}
                  onBack={onBack}
                  onPersonOpen={onPersonOpen}
                  onOrganizationOpen={onOrganizationOpen}
                  onCollectPayment={onCollectPayment}
                  slots={bookingDetailSlots}
                />
              </TabsContent>

              <TabsContent value="finance" className="mt-0">
                {renderTabSlot(slots?.financeTab, context, workspaceMessages.empty.finance)}
              </TabsContent>

              <TabsContent value="legal" className="mt-0">
                {renderTabSlot(slots?.legalTab, context, workspaceMessages.empty.legal)}
              </TabsContent>

              <TabsContent value="travelers" className="mt-0">
                {renderTabSlot(
                  slots?.travelersTabExtensions,
                  context,
                  workspaceMessages.empty.travelers,
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                {renderTabSlot(slots?.activityTab, context, workspaceMessages.empty.activity)}
              </TabsContent>
            </div>

            {hasSidebar ? (
              <aside data-slot="booking-workspace-sidebar" className="flex min-w-0 flex-col gap-4">
                {sidebar}
              </aside>
            ) : null}
          </div>
        </Tabs>
      </div>
    </BookingWorkspaceBulkActionsContext.Provider>
  )
}

function WorkspaceHeader({
  title,
  description,
  onBack,
  actions,
}: {
  title: string
  description?: string
  onBack?: () => void
  actions?: ReactNode
}) {
  return (
    <div
      data-slot="booking-workspace-header"
      className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onBack}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="sr-only">Back</span>
            </Button>
          ) : null}
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

function WorkspaceTabIcon({ section }: { section: BookingWorkspaceSection }) {
  const iconClassName = "size-4"
  switch (section) {
    case "booking":
      return <BriefcaseBusiness className={iconClassName} aria-hidden="true" />
    case "finance":
      return <Landmark className={iconClassName} aria-hidden="true" />
    case "legal":
      return <FileText className={iconClassName} aria-hidden="true" />
    case "travelers":
      return <Users className={iconClassName} aria-hidden="true" />
    case "activity":
      return <ListChecks className={iconClassName} aria-hidden="true" />
  }
}

function renderTabSlot(
  slot: ((context: BookingWorkspaceSlotContext) => ReactNode) | undefined,
  context: BookingWorkspaceSlotContext,
  emptyMessage: string,
) {
  const content = slot?.(context)
  if (content) return content

  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-48 items-center justify-center py-10">
        <p className="max-w-md text-center text-sm text-muted-foreground">{emptyMessage}</p>
      </CardContent>
    </Card>
  )
}

function renderSidebar(
  activeSection: BookingWorkspaceSection,
  slots: BookingWorkspacePageSlots | undefined,
  context: BookingWorkspaceSlotContext,
) {
  const sectionSidebar =
    activeSection === "finance"
      ? slots?.financeSidebar?.(context)
      : activeSection === "legal"
        ? slots?.legalSidebar?.(context)
        : activeSection === "travelers"
          ? slots?.travelersSidebar?.(context)
          : activeSection === "activity"
            ? slots?.activitySidebar?.(context)
            : null
  const workspaceSidebar = slots?.workspaceSidebar?.(context)

  if (!workspaceSidebar && !sectionSidebar) return null

  return (
    <>
      {sectionSidebar}
      {workspaceSidebar}
    </>
  )
}

function getDefaultNavigationItems(
  tabs: Record<BookingWorkspaceSection, string>,
): BookingWorkspaceNavigationItem[] {
  return [
    { value: "booking", label: tabs.booking },
    { value: "finance", label: tabs.finance },
    { value: "legal", label: tabs.legal },
    { value: "travelers", label: tabs.travelers },
    { value: "activity", label: tabs.activity },
  ]
}
