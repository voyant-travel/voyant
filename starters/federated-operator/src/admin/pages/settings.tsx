import { Badge } from "@voyant-travel/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components/card"

const rows = [
  ["Authentication", "Local Better Auth", "enabled"],
  ["Source connection secrets", "Encrypted references", "planned"],
  ["External writes", "Ledger and approval policy", "planned"],
  ["Native domain promotion", "Per-domain adoption decision", "manual"],
] as const

export function FederatedSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
          Deployment controls for the federated operating posture.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operating controls</CardTitle>
          <CardDescription>
            Keep authority and writeback policy explicit while domains remain external.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2">
            {rows.map(([label, value, status]) => (
              <div key={label} className="rounded-sm border p-4">
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-medium text-sm">{value}</span>
                  <Badge variant={status === "enabled" ? "default" : "secondary"}>{status}</Badge>
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
