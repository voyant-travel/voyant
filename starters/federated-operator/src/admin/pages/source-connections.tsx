import { useQuery } from "@tanstack/react-query"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { RefreshCw } from "lucide-react"
import { getApiUrl } from "@/lib/env"
import { federatedOperatorFetcher } from "@/lib/voyant-fetcher"

interface SourceHealthResponse {
  data: {
    status: string
    checkedAt: string
    connections: Array<unknown>
  }
}

async function fetchSourceHealth(): Promise<SourceHealthResponse["data"]> {
  const res = await federatedOperatorFetcher(`${getApiUrl()}/v1/admin/source-connections/health`)
  if (!res.ok) throw new Error(`source health failed: ${res.status}`)
  const body = (await res.json()) as SourceHealthResponse
  return body.data
}

export function SourceConnectionsPage() {
  const health = useQuery({
    queryKey: ["source-connections", "health"],
    queryFn: fetchSourceHealth,
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Source connections</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Register external systems, sync cursors, rate-limit state, and provenance.
          </p>
        </div>
        <Button variant="outline" onClick={() => void health.refetch()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection health</CardTitle>
          <CardDescription>
            The shared source-connection store is intentionally deferred to the next slice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">{health.data?.status ?? "loading"}</Badge>
            {health.data?.checkedAt ? (
              <span className="text-muted-foreground">
                Checked {new Date(health.data.checkedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Freshness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">No connections</TableCell>
                <TableCell>Mirrored</TableCell>
                <TableCell>Upstream</TableCell>
                <TableCell>Not configured</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
