import { Badge } from "@voyant-travel/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components/card"
import { Activity, DatabaseZap, PlugZap, ScrollText, Workflow } from "lucide-react"

const posture = [
  { label: "Source posture", value: "Federated", tone: "default" },
  { label: "Native inventory", value: "Excluded", tone: "secondary" },
  { label: "Native bookings", value: "Excluded", tone: "secondary" },
  { label: "Native finance", value: "Excluded", tone: "secondary" },
] as const

const surfaces = [
  {
    title: "Source connections",
    description: "Connection registry and sync-health placeholder.",
    icon: PlugZap,
  },
  {
    title: "Mirrored CRM",
    description: "People and organizations from external systems.",
    icon: DatabaseZap,
  },
  {
    title: "Workflow runs",
    description: "Visibility for daemons, schedules, and workflows.",
    icon: Workflow,
  },
  {
    title: "Action ledger",
    description: "Audit, idempotency, approval, and external-write control.",
    icon: ScrollText,
  },
] as const

export function FederatedDashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Federated operator</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
          Voyant is running as the operating layer around external systems.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {posture.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={item.tone}>{item.value}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {surfaces.map((surface) => {
          const Icon = surface.icon
          return (
            <Card key={surface.title}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-sm border bg-muted">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <CardTitle className="text-base">{surface.title}</CardTitle>
                <CardDescription>{surface.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" aria-hidden="true" />
            Runtime scope
          </CardTitle>
          <CardDescription>
            This starter boots only the surfaces needed for mirrored CRM and source-sync planning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            <li>Mounted: action ledger, relationships, identity, workflow run routes.</li>
            <li>Deferred: source connection persistence and HubSpot adapter slices.</li>
            <li>Excluded: storefront, native inventory, native bookings, native finance.</li>
            <li>Authority: external systems remain authoritative until a domain is promoted.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
