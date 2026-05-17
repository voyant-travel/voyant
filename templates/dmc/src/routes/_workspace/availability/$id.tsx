import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SlotAllocationPage } from "@voyantjs/allocation-ui"
import { useVoyantAvailabilityContext } from "@voyantjs/availability-react"
import {
  AvailabilitySlotDetailPage,
  getAvailabilitySlotDetailQueryOptions,
  getAvailabilitySlotProductQueryOptions,
  loadAvailabilitySlotDetailPage,
} from "@voyantjs/availability-ui"
import { defaultFetcher } from "@voyantjs/react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@voyantjs/ui/components"
import { AppSidebarInset } from "@/components/navigation/inset"
import { getApiUrl } from "@/lib/env"

const availabilityClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/availability/$id")({
  loader: ({ context, params }) =>
    loadAvailabilitySlotDetailPage(context.queryClient, availabilityClient, params.id),
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const client = useVoyantAvailabilityContext()
  const { data: slotData } = useQuery(getAvailabilitySlotDetailQueryOptions(client, id))
  const slot = slotData?.data
  const { data: productData } = useQuery({
    ...getAvailabilitySlotProductQueryOptions(client, slot?.productId ?? ""),
    enabled: Boolean(slot?.productId),
  })
  const productName = productData?.data.name ?? null

  const breadcrumb = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={
              <button
                type="button"
                onClick={() => void navigate({ to: "/availability" })}
                className="cursor-pointer"
              />
            }
          >
            Availability
          </BreadcrumbLink>
        </BreadcrumbItem>
        {slot?.productId && productName ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <button
                    type="button"
                    onClick={() =>
                      void navigate({ to: "/products/$id", params: { id: slot.productId } })
                    }
                    className="cursor-pointer"
                  />
                }
              >
                {productName}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        ) : null}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{slot?.dateLocal ?? id}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )

  return (
    <AppSidebarInset headerLeft={breadcrumb}>
      <AvailabilitySlotDetailPage
        id={id}
        onDeleted={() => void navigate({ to: "/availability" })}
        onOpenProduct={(productId) =>
          void navigate({ to: "/products/$id", params: { id: productId } })
        }
        onOpenStartTime={(startTimeId) =>
          void navigate({ to: "/availability/start-times/$id", params: { id: startTimeId } })
        }
        renderAllocation={(context) => <SlotAllocationPage slotId={context.slotId} embed />}
      />
    </AppSidebarInset>
  )
}
