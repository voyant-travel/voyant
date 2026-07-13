# Voyant Storage Architecture

This guide defines how Voyant should treat uploaded assets and generated
documents.

The goal is simple:

- keep public media and private documents clearly separated
- avoid storing expiring access URLs as durable metadata
- support signed access for sensitive files
- keep storage backends replaceable behind a small shared contract

Storage should stay simple, but not at the expense of privacy or correctness.

## Core Rules

### 1. Separate public media from private documents

Voyant should treat storage as at least two classes of asset:

- `media`
- `documents`

Media includes things like:

- product imagery
- editorial assets
- brochures
- public-facing uploads

Documents include things like:

- invoices
- proformas
- contracts
- signed attachments
- sensitive generated PDFs

Rule:

Do not store public media and private documents as if they were the same asset
class.

### 2. Public media can use stable public URLs

Public/editorial media can be served with stable public URLs.

That fits things like:

- image rendering
- brochures
- CMS/editor uploads
- storefront-facing assets

Rule:

Public media may use durable public URLs when the asset is intentionally public.

### 3. Private documents should use signed or authenticated access

Sensitive documents should not depend on public bucket access.

Private documents should be accessed through:

- fresh signed URLs
- or authenticated download routes that proxy/resolved the underlying asset

That applies especially to:

- invoices
- proformas
- contracts
- customer-linked identity or compliance documents

Rule:

Sensitive documents should be private by default and resolved per-request.

## Storage Metadata

### 4. Persist storage keys, not expiring download URLs

Voyant should store durable storage metadata such as:

- bucket or storage class
- key/path
- filename
- content type

It should not persist temporary signed URLs as the primary durable reference to
the document.

Signed URLs expire. The durable record should be the storage key, and access
URLs should be derived at read time.

Rule:

Store `storageKey`-style durable metadata, not expiring access URLs.

### 5. Resolve document access at read time

When a route, notification, or UI surface needs document access, it should
derive that access from the durable storage metadata at read time.

That lets the system:

- generate a fresh signed URL
- choose a different access strategy later
- avoid stale metadata bugs

Rule:

Document access should be resolved when needed, not precomputed permanently.

## Backends And Adapters

### 6. Keep the storage provider surface small

Voyant should keep the shared storage contract narrow:

- put/upload
- get/read
- delete
- optionally generate signed access when supported

Different backends may implement public and private access differently, but the
framework surface should stay small.

Rule:

Use a narrow shared storage contract and keep backend differences inside the
adapter.

### 7. Resolve logical media and document stores

Application code should not consume vendor bucket bindings. The host resolves
two logical stores:

- `media` for public/editorial assets
- `documents` for private generated or uploaded documents

The selected `s3-compatible` provider maps those names to
`STORAGE_MEDIA_BUCKET` and `STORAGE_DOCUMENTS_BUCKET`. A package-selected custom
`storage.object` provider can map them to any backend without changing
application modules. Custom adapters own their config and secret declarations
and return the shared `StorageProviderResolver` contract.

Rule:

Storage consumers should request logical stores, never vendor bindings.

## Access Patterns

### 8. `/media/*` should stay for public assets

Public upload and media routes should remain clearly public-media surfaces.

They should not quietly become the download path for private documents.

Rule:

Keep public media serving separate from private document delivery.

### 9. Private document delivery should be explicit

Private document access should happen through routes or service helpers that
clearly express:

- who may access the document
- what document class it belongs to
- whether the result is a redirect, signed URL, or proxied file response

Rule:

Private document delivery should be an explicit contract, not a side effect of
generic media serving.

### 10. Notifications should resolve attachments at send time

If a notification needs to include or reference a sensitive document, it should
derive attachment access from durable storage metadata at send time.

Do not rely on old persisted `downloadUrl` metadata for sensitive attachments.

Rule:

Attachment delivery should resolve fresh access when the notification is built.

## Practical Checklist

When adding a new stored asset in Voyant:

1. Decide whether it is public media or a private document.
2. If it is private, store durable key metadata instead of a temporary access
   URL.
3. If it is public, it may use a stable public URL.
4. Keep media serving and private document delivery as separate surfaces.
5. Resolve private access at read/send time through signed or authenticated
   access.

## Non-Goals

This guide does not introduce:

- a complex document-management subsystem
- a requirement that every backend use the same signing mechanism
- a rule that every file must be private

The point is clear storage classes and safe access patterns, not extra
ceremony.
