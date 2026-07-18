# Document rendering

Voyant modules own document content and storage; deployments own the rendering engine. Contracts and product brochures both consume the optional `documents.renderer` runtime port from `@voyant-travel/core/document-rendering`. The port accepts rendered HTML plus portable PDF page/navigation options and returns PDF bytes.

Managed Voyant binds this seam to a deployment-credential-authenticated private platform endpoint. Cloudflare Browser Rendering remains behind the Cloud service binding and is not part of the developer PDF API surface.

## Self-hosted configuration

The quickest self-hosted swap requires no workflow or module changes. Point the runtime at any service implementing the Voyant HTTP contract:

```dotenv
VOYANT_DOCUMENT_RENDERER_URL=https://renderer.example/v1/pdf
VOYANT_DOCUMENT_RENDERER_TOKEN=optional-bearer-token
VOYANT_DOCUMENT_RENDERER_NAME=self-hosted-playwright
```

The endpoint receives a JSON `PdfRenderRequest` and returns `application/pdf`. It may be backed by Playwright, Puppeteer, Gotenberg, or another HTML-to-PDF service.

For an in-process adapter, a deployment plugin can provide `documentRendererPort` with a `DocumentRenderer` implementation:

```ts
import {
  type DocumentRenderer,
  documentRendererPort,
} from "@voyant-travel/core/document-rendering"

const renderer: DocumentRenderer = {
  name: "company-playwright",
  async renderPdf(request) {
    // Invoke the self-hoster's renderer and return Uint8Array PDF bytes.
  },
}
```

When no port or HTTP endpoint is configured, the standard contract and brochure paths retain their basic local PDF fallback. Template authoring, numbering, storage, and generation triggers remain unchanged when the renderer is replaced.
