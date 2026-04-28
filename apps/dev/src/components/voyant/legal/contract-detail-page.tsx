import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  defaultFetcher,
  getLegalContractAttachmentsQueryOptions,
  getLegalContractQueryOptions,
  getLegalContractSignaturesQueryOptions,
  type LegalContractAttachmentRecord,
  useLegalContract,
  useLegalContractAttachmentMutation,
  useLegalContractAttachments,
  useLegalContractMutation,
  useLegalContractSignatures,
} from "@voyantjs/legal-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { AttachmentDialog } from "./attachment-dialog"
import { ContractDialog } from "./contract-dialog"
import { SignatureDialog } from "./signature-dialog"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  signed: "default",
  executed: "default",
  expired: "destructive",
  void: "destructive",
}

type EnsureQueryData = QueryClient["ensureQueryData"]

export function loadContractDetailPage(id: string, ensureQueryData: EnsureQueryData) {
  return Promise.all([
    ensureQueryData(getLegalContractQueryOptions({ baseUrl: "", fetcher: defaultFetcher }, id)),
    ensureQueryData(
      getLegalContractSignaturesQueryOptions(
        { baseUrl: "", fetcher: defaultFetcher },
        { contractId: id },
      ),
    ),
    ensureQueryData(
      getLegalContractAttachmentsQueryOptions(
        { baseUrl: "", fetcher: defaultFetcher },
        { contractId: id },
      ),
    ),
  ])
}

export function ContractDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { remove, issue, send, execute, voidContract } = useLegalContractMutation()
  const { remove: removeAttachment } = useLegalContractAttachmentMutation()

  const [editOpen, setEditOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [editingAttachment, setEditingAttachment] = useState<
    LegalContractAttachmentRecord | undefined
  >()

  const { data: contract, isPending } = useLegalContract(id)
  const { data: signatures, refetch: refetchSignatures } = useLegalContractSignatures({
    contractId: id,
  })
  const { data: attachments, refetch: refetchAttachments } = useLegalContractAttachments({
    contractId: id,
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Contract not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/legal/contracts" })}>
          Back to Contracts
        </Button>
      </div>
    )
  }

  const status = contract.status

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/legal/contracts" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{contract.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {contract.scope}
            </Badge>
            <Badge variant={statusVariant[status] ?? "secondary"} className="capitalize">
              {status}
            </Badge>
            {contract.contractNumber ? (
              <span className="font-mono text-xs text-muted-foreground">
                {contract.contractNumber}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "draft" ? (
            <Button size="sm" onClick={() => issue.mutate(id)} disabled={issue.isPending}>
              Issue
            </Button>
          ) : null}
          {status === "issued" ? (
            <Button size="sm" onClick={() => send.mutate(id)} disabled={send.isPending}>
              Send
            </Button>
          ) : null}
          {status === "issued" || status === "sent" ? (
            <Button size="sm" onClick={() => setSignOpen(true)}>
              Sign
            </Button>
          ) : null}
          {status === "signed" ? (
            <Button size="sm" onClick={() => execute.mutate(id)} disabled={execute.isPending}>
              Execute
            </Button>
          ) : null}
          {status !== "void" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm("Void this contract?")) {
                  voidContract.mutate(id)
                }
              }}
              disabled={voidContract.isPending}
            >
              Void
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {status === "draft" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Delete this contract?")) {
                  remove.mutate(id, { onSuccess: () => void navigate({ to: "/legal/contracts" }) })
                }
              }}
              disabled={remove.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contract Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Language:</span>{" "}
              <span>{contract.language}</span>
            </div>
            {contract.templateVersionId ? (
              <div>
                <span className="text-muted-foreground">Template Version:</span>{" "}
                <span className="font-mono text-xs">{contract.templateVersionId}</span>
              </div>
            ) : null}
            {contract.seriesId ? (
              <div>
                <span className="text-muted-foreground">Series:</span>{" "}
                <span className="font-mono text-xs">{contract.seriesId}</span>
              </div>
            ) : null}
            {contract.expiresAt ? (
              <div>
                <span className="text-muted-foreground">Expires:</span>{" "}
                <span>{new Date(contract.expiresAt).toLocaleDateString()}</span>
              </div>
            ) : null}
            <div className="mt-2 border-t pt-3">
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                <span>{new Date(contract.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>{" "}
                <span>{new Date(contract.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parties</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {contract.personId ? (
              <div>
                <span className="text-muted-foreground">Person:</span>{" "}
                <span className="font-mono text-xs">{contract.personId}</span>
              </div>
            ) : null}
            {contract.organizationId ? (
              <div>
                <span className="text-muted-foreground">Organization:</span>{" "}
                <span className="font-mono text-xs">{contract.organizationId}</span>
              </div>
            ) : null}
            {contract.supplierId ? (
              <div>
                <span className="text-muted-foreground">Supplier:</span>{" "}
                <span className="font-mono text-xs">{contract.supplierId}</span>
              </div>
            ) : null}
            {contract.channelId ? (
              <div>
                <span className="text-muted-foreground">Channel:</span>{" "}
                <span className="font-mono text-xs">{contract.channelId}</span>
              </div>
            ) : null}
            {!contract.personId &&
            !contract.organizationId &&
            !contract.supplierId &&
            !contract.channelId ? (
              <p className="text-muted-foreground">No parties assigned.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {contract.renderedBody ? (
        <Card>
          <CardHeader>
            <CardTitle>Rendered Body</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none rounded-md border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap text-sm">{contract.renderedBody}</pre>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Signatures</CardTitle>
          {status === "issued" || status === "sent" || status === "signed" ? (
            <Button size="sm" onClick={() => setSignOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Signature
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {!signatures || signatures.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No signatures yet.</p>
          ) : (
            <div className="rounded border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">Name</th>
                    <th className="p-2 text-left font-medium">Email</th>
                    <th className="p-2 text-left font-medium">Role</th>
                    <th className="p-2 text-left font-medium">Method</th>
                    <th className="p-2 text-left font-medium">Signed At</th>
                  </tr>
                </thead>
                <tbody>
                  {signatures.map((signature) => (
                    <tr key={signature.id} className="border-b last:border-b-0">
                      <td className="p-2">{signature.signerName}</td>
                      <td className="p-2">{signature.signerEmail ?? "-"}</td>
                      <td className="p-2">{signature.signerRole ?? "-"}</td>
                      <td className="p-2 capitalize">{signature.method}</td>
                      <td className="p-2">{new Date(signature.signedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attachments</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingAttachment(undefined)
              setAttachOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Attachment
          </Button>
        </CardHeader>
        <CardContent>
          {!attachments || attachments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No attachments yet.</p>
          ) : (
            <div className="rounded border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">Name</th>
                    <th className="p-2 text-left font-medium">Kind</th>
                    <th className="p-2 text-left font-medium">MIME Type</th>
                    <th className="p-2 text-left font-medium">Size</th>
                    <th className="w-16 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((attachment) => (
                    <tr key={attachment.id} className="border-b last:border-b-0">
                      <td className="p-2">{attachment.name}</td>
                      <td className="p-2">{attachment.kind}</td>
                      <td className="p-2">{attachment.mimeType ?? "-"}</td>
                      <td className="p-2">
                        {attachment.fileSize ? `${attachment.fileSize} B` : "-"}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAttachment(attachment)
                              setAttachOpen(true)
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Delete this attachment?")) {
                                removeAttachment.mutate({ contractId: id, id: attachment.id })
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ContractDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contract={contract}
        onSuccess={() => {
          setEditOpen(false)
          void queryClient.invalidateQueries()
        }}
      />

      <SignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        contractId={id}
        onSuccess={() => {
          setSignOpen(false)
          void refetchSignatures()
          void queryClient.invalidateQueries()
        }}
      />

      <AttachmentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        contractId={id}
        attachment={editingAttachment}
        onSuccess={() => {
          setAttachOpen(false)
          setEditingAttachment(undefined)
          void refetchAttachments()
        }}
      />
    </div>
  )
}
