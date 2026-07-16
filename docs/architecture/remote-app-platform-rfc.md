# RFC/PRD: Remote App Platform And App-Owned Custom Fields

- **Status:** Proposed
- **Tracking:** `voyant#3395`
- **Audience:** framework, Operator, Cloud, security, finance, and integration maintainers
- **Decision type:** product architecture and platform contract
- **Target:** one remote app runtime model with managed-catalog and npm release
  delivery, separate from deployment-time modules and adapters

## Executive Decision

Voyant will treat an **app** as a separately deployed service activated for a
deployment through OAuth. App backend code never executes inside the Operator
process and an app never contributes database migrations to a Voyant
deployment.

There will be two creation and discovery paths:

1. **Marketplace discovery:** an operator selects a reviewed listing and grants
   its requested permissions.
2. **Custom app creation:** a developer or authorized operator creates a private
   app registration directly in Voyant, supplies its manifest and endpoints,
   and grants permissions through the same flow.

Both paths create the same durable app installation, grants, extension
descriptors, webhook subscriptions, and app-owned custom-field definitions.
A custom app does not require a marketplace listing, marketplace review, or
publication. Marketplace submission is an optional later distribution choice,
not a prerequisite for app creation or installation.

Each app release is an immutable, signed release artifact. The Voyant catalog
is the canonical registry for marketplace releases; a restricted managed or
deployment-local registry is canonical for a private custom app. The same
release artifact can be acquired through two deployment channels:

1. **Self-hosted Voyant:** a developer installs an exact app-package version
   through npm or a compatible registry and pins it in the project lockfile.
2. **Voyant managed runtime:** the platform acquires the catalog release and
   applies compatible updates according to installation policy.

The npm package is a declarative integration capsule, not a local app backend.
It may contain the manifest, sandboxed admin UI assets, localization catalogs,
custom-field definitions, permissions, event subscriptions, protocol versions,
and integrity metadata. It may not contain Operator runtime factories, routes,
migrations, providers, subscribers, or app server implementation.

Acquisition and activation are separate. Acquiring a release makes it available
to a deployment. OAuth consent and activation create or upgrade the same
durable app installation aggregate regardless of delivery channel. There is no
hybrid app split between local and remote behavior.

Npm also remains a deployment mechanism for trusted executable code selected by
the developer: Voyant modules, project modules, infrastructure providers, and
deeply integrated adapters. Executable deployment components and declarative
app release packages use different manifests, validation, and runtime
authority.

Payment processing stays on the deployment side of this boundary. Netopia,
Voyant Payments, and future processors implement one payment adapter contract,
following the same provider-selection shape as search engines. Accounting
integrations, including SmartBill, move to the remote app model because they can
integrate through scoped finance APIs, events, webhooks, app-owned custom fields,
and remote admin UI.

Deployment-local TypeScript custom-field declarations will be retired. The
database becomes the only runtime authority for custom-field definitions:
operator-owned definitions are created in Settings, while app-owned definitions
are reconciled from the installed app manifest or app API and displayed in the
same Settings surface.

Every app receives a platform-assigned reserved namespace. Apps address their
own namespace through an alias; they cannot submit, claim, or write another
app's physical namespace. Custom-field identity is `(target, namespace, key)`,
so two apps can safely use the same key on the same entity type.

Each app owns its sandboxed UI and localization resources. An app release may
carry immutable static UI and locale assets that Voyant stores and serves from
an isolated app origin without compiling or executing them in the admin origin.
Voyant passes the active locale to app extensions, while app releases provide
validated localized metadata for the small amount of app text rendered by the
Voyant host, such as navigation labels and extension titles.

## Problem Statement

Voyant currently uses “plugin” for several different concepts:

- a reusable npm distribution bundle;
- a deployment-selected provider or adapter;
- code and migrations loaded into the Operator process;
- an admin UI contribution;
- and, prospectively, something an operator installs from a marketplace.

Those concepts have incompatible trust, versioning, lifecycle, and data
ownership models. Executable npm code is selected and pinned by a developer,
while an operator must be able to activate, pause, and remove an app without
executing ecosystem code or migrations. Self-hosters additionally need
lockfile-controlled app releases, while managed deployments need safe,
policy-driven updates from the same release lineage.

The existing custom-fields system compounds the problem. Definitions may come
from deployment-local TypeScript or the database, code wins collisions, the
runtime table and UI are owned by Relationships, and the database target enum
supports only a small fixed entity set. Definitions have no durable app owner
or collision-proof namespace.

Without a clearer boundary, remote apps would either need unsafe access to the
Voyant runtime and schema or would invent disconnected storage that the admin,
search, export, invoice, and workflow surfaces cannot understand.

## Goals

1. Let an operator activate, pause, or uninstall an acquired app without
   executing ecosystem code, migrations, or graph changes.
2. Use the same runtime contract for marketplace and custom apps.
3. Keep all app execution outside the Operator process.
4. Give apps least-privilege access through versioned APIs and OAuth grants.
5. Support secure remote admin pages and targeted UI extensions.
6. Deliver versioned events reliably to remote app webhooks.
7. Let apps attach typed values to Voyant entities without schema migrations.
8. Prevent custom-field collisions and cross-app reads or writes by
   construction.
9. Keep complex app-owned records in the app's own database.
10. Preserve deployment-time packages for capabilities that require deep,
    synchronous, or infrastructure-level integration.
11. Establish payment processing as a conformance-tested deployment adapter
    role, with Voyant Payments as a first-party implementation and Netopia as an
    alternative implementation.
12. Move accounting integrations toward remote apps rather than package-owned
    Operator schema and runtime code.
13. Make installation, grants, calls, deliveries, and custom-field mutations
    auditable.
14. Let developers and authorized operators create and install custom apps
    without marketplace publication.
15. Let every app own its UI, translations, supported locales, and fallback
    locale without adding app strings to Voyant translation catalogs.
16. Publish one immutable app release artifact through both managed and npm
    delivery channels.
17. Give self-hosters explicit package and lockfile control over app upgrades.
18. Let managed deployments automatically apply compatible app updates without
    silently granting scopes or crossing compatibility boundaries.
19. Make the installed app release visible to the remote backend on every
    authenticated request.

## Non-Goals

- Runtime package-manager execution, dynamic imports, or mutable
  `install(app)` hooks inside the Operator.
- Allowing remote apps to contribute Drizzle schemas or migrations.
- Running remote app callbacks inside a Voyant database transaction.
- Providing a general-purpose hosted relational database for apps.
- Replacing Voyant modules with apps.
- Making storage, cache, search, payment, or other deployment infrastructure
  operator-installable marketplace apps.
- Supporting arbitrary remote JavaScript or React in the admin origin.
- Requiring a custom app to be listed, reviewed, or published in a marketplace.
- Compiling, modifying, or executing app UI in the admin origin. Voyant may
  store and serve immutable app-provided assets from an isolated app origin.
- Guaranteeing ordered or exactly-once webhook delivery.
- Allowing custom validation functions in custom-field definitions.
- Migrating every existing integration in the first implementation phase.

## Terminology

| Term | Meaning |
| --- | --- |
| **App** | A separately deployed service activated for a Voyant deployment through OAuth. |
| **App registration** | The stable global identity, credentials, redirect URIs, ownership, and distribution policy of an app. |
| **App release** | An immutable, validated snapshot of an app manifest and its declared capabilities. |
| **App release artifact** | The signed, content-addressed package for one app release, containing declarative integration metadata and optional sandboxed static UI assets, but no app backend or Operator runtime code. |
| **Release acquisition** | Making an app release artifact available to one deployment through its npm lockfile or the managed catalog. |
| **App installation** | The deployment-local relationship between one app registration and one Voyant deployment. |
| **Marketplace app** | An app discovered through a reviewed marketplace listing. |
| **Custom app** | A private app created directly by an authorized developer or operator and installed without marketplace publication. |
| **Admin extension** | A remote page or slot contribution rendered through the sandboxed admin extension host. |
| **App locale catalog** | App-owned translations for the app's remote UI and validated localized metadata for host-rendered app labels. |
| **Deployment component** | Trusted executable npm-selected module, adapter, or provider included in the resolved deployment graph. |
| **Payment adapter** | A deployment component implementing the canonical payment processor contract. |
| **Custom-field target** | A Voyant entity type whose owning module supports namespaced custom fields. |
| **Operator-owned field** | A definition created and structurally controlled by an operator in Settings. |
| **App-owned field** | A definition structurally controlled by one registered app. |
| **Reserved app namespace** | An immutable physical namespace assigned by Voyant to one app registration. |

The word **plugin** should not be used for a runtime-installed product. Existing
executable npm plugin bundles should be reclassified by their actual deployment
role: module, extension, adapter, or provider. A declarative app release package
is an app distribution artifact, not a plugin or graph unit.

## Product Classification

| Capability | Delivery | Reason |
| --- | --- | --- |
| Core and vertical domain behavior | Voyant or project module | Owns native behavior and often native schema. |
| Search engine implementation | Deployment provider/adapter | Infrastructure selection used throughout request and indexing paths. |
| Payment processor implementation | Deployment payment adapter | Participates in security-sensitive checkout, callbacks, finance state, and capability routing. |
| Object storage, cache, workflow runtime | Deployment provider | Process and infrastructure authority. |
| Accounting synchronization | Remote app | Can operate through finance APIs, events, webhooks, and remote UI. |
| CRM/accounting/document export integration | Remote app | External service owns its runtime and integration state. |
| Dashboard card or entity-side panel | Remote admin extension | UI contribution does not require host code execution. |
| Small app-specific attribute on a Voyant entity | App-owned custom field | Typed, namespaced attachment to native data. |
| Complex app-specific records | App database | Independent lifecycle and query model remain outside Voyant. |

## User Stories

1. As an operator, I want to activate an app release already available to my
   deployment, so that consent and lifecycle do not execute ecosystem code.
2. As an operator, I want to review requested permissions before installation,
   so that I understand which data and actions the app can access.
3. As an operator, I want to deny optional permissions, so that an app receives
   only the access needed for enabled features.
4. As an operator, I want to see every installed app and its health, grants,
   extensions, and recent activity, so that I can govern integrations.
5. As an operator, I want to uninstall or pause an app immediately, so that I
   can stop access without waiting for a deployment.
6. As an operator, I want app-owned data retained by default on uninstall, so
   that accidental removal does not destroy operational history.
7. As an operator, I want an explicit purge flow, so that retained app-owned
   fields can be removed when policy requires it.
8. As an operator, I want marketplace and custom apps to use the same consent
   and lifecycle model, so that security does not depend on discovery source.
9. As a self-hosted developer, I want to register a privately deployed app, so
   that I can build operator-specific integrations without publishing them.
10. As an app developer, I want a stable app identity across all installations,
    so that namespaces and lifecycle events remain predictable.
11. As an app developer, I want versioned OAuth scopes and APIs, so that I can
    evolve my service without depending on Operator internals.
12. As an app developer, I want an offline installation credential for webhooks
    and background synchronization, so that work does not require an active
    staff session.
13. As an app developer, I want a short-lived online credential bounded by the
    current viewer's permissions, so that interactive actions preserve staff
    authorization.
14. As an app developer, I want signed, short-lived admin session tokens, so
    that my embedded UI can authenticate without third-party cookies.
15. As an app developer, I want to contribute full pages and selected UI slots,
    so that my app feels integrated without executing code in the admin origin.
16. As an app developer, I want entity context in an admin extension, so that I
    can render the relevant remote information for a booking, person, or
    invoice.
17. As an app developer, I want versioned webhook events with delivery IDs, so
    that my handlers can be idempotent.
18. As an app developer, I want replay and reconciliation support, so that a
    temporary outage does not permanently desynchronize data.
19. As an app developer, I want to declare typed custom fields in my app
    manifest, so that required attachments appear consistently after install.
20. As an app developer, I want a reserved namespace assigned by Voyant, so
    that another app cannot collide with or impersonate my data.
21. As an app developer, I want to use a stable `$app` alias rather than know a
    physical namespace, so that every request is constrained to my app.
22. As an app developer, I want optional logical sub-namespaces, so that I can
    group fields without acquiring additional global namespaces.
23. As an app developer, I want declarative validation and visibility controls,
    so that Voyant can safely render, search, export, and expose field values.
24. As an operator, I want app-owned fields visible in Settings with clear
    ownership, so that I can understand why they exist.
25. As an operator, I want app-controlled schema to be read-only in Settings,
    so that an edit cannot silently break the app.
26. As an operator, I want field-value edit permissions declared separately
    from definition ownership, so that staff can edit values when appropriate.
27. As an operator, I want two apps to use the same field key safely, so that
    installation order cannot create collisions.
28. As a Voyant module owner, I want to register supported custom-field targets,
    so that apps cannot attach data to unsupported or unknown tables.
29. As a finance maintainer, I want accounting apps to consume stable finance
    events and APIs, so that accounting behavior does not run in-process.
30. As an accounting app developer, I want to store sync cursors, mappings, and
    reconciliation state in my own service, so that I control their lifecycle.
31. As an accounting app developer, I want to attach an external reference or
    summarized status to a Voyant invoice, so that staff can see integration
    context without joining my database.
32. As a deployment owner, I want to select one payment adapter explicitly, so
    that environment variables cannot silently select a processor.
33. As a deployment owner, I want Netopia, Voyant Payments, and future
    processors to pass the same conformance suite, so that checkout does not
    depend on provider-specific assumptions.
34. As a finance maintainer, I want payment callbacks verified and normalized by
    the selected adapter, so that native payment state remains trustworthy.
35. As an operator, I want app API calls, field writes, permission changes, and
    lifecycle actions in the audit trail, so that app activity is accountable.
36. As a security administrator, I want immediate token revocation and key
    rotation, so that compromised credentials can be contained.
37. As a platform operator, I want manifest and API compatibility checks before
    activation, so that incompatible apps fail before their UI is mounted.
38. As a platform operator, I want per-app rate limits and delivery telemetry,
    so that one unhealthy app cannot degrade the Operator.
39. As an app reviewer, I want declared endpoints, scopes, data classes, and
    retention behavior, so that marketplace review is evidence-based.
40. As a user, I want a failed app extension to fail softly, so that the native
    admin remains usable.
41. As an authorized operator or developer, I want to create a custom app
    directly in Voyant, so that private and operator-specific integrations do
    not require marketplace publication.
42. As a custom app developer, I want the same manifest, OAuth, UI, webhook, and
    custom-field capabilities as a marketplace app, so that private
    distribution is not a reduced app model.
43. As an app developer, I want to own my app's UI and translation bundles, so
    that I can release localized experiences on my own cadence.
44. As a staff user, I want an app extension and its host-rendered labels to use
    my active locale with deterministic fallbacks, so that the embedded
    experience is linguistically consistent with the admin.
45. As a self-hosted developer, I want to install an exact app release through
    npm and commit the lockfile, so that publishing a newer release cannot
    silently change my deployment.
46. As a managed-runtime operator, I want compatible app updates applied
    automatically according to policy, so that I receive fixes without
    redeploying Voyant.
47. As an operator, I want new scopes, incompatible protocol changes, and major
    releases to require approval, so that automatic updates cannot expand
    access or break an installation.
48. As an app developer, I want one validated release artifact to serve
    self-hosted and managed deployments, so that I do not maintain two app
    architectures.
49. As a custom app developer, I want to publish through a private registry or
    upload the same release artifact privately, so that npm delivery does not
    require public marketplace publication.
50. As an app backend developer, I want each request to identify the installed
    app release and protocol versions, so that I can honor compatibility for
    deployments that upgrade on different schedules.

## Architecture

### 1. Trust Boundary

The Operator graph remains immutable at runtime. Activating or upgrading an app
installation changes database state and sandboxed asset registrations only; it
does not add graph units, routes, migrations, imports, providers, or executable
server code.

On self-hosted deployments, acquiring a release through npm is a normal
developer-controlled build and deployment change. The package is validated and
lowered into a release catalog artifact during the build; it is never imported
as executable runtime code. On managed deployments, the control plane performs
the equivalent acquisition without mutating the Operator graph.

Remote apps interact with Voyant through five public contract families:

1. OAuth authorization and token endpoints.
2. Versioned resource APIs.
3. Versioned outbound events and webhooks.
4. Sandboxed admin extensions.
5. Namespaced custom-field definition and value APIs.

All app traffic is treated as external network traffic even when the app is
deployed by the same organization or on the same infrastructure.

### 2. App Registration And Distribution

An app registration has one immutable platform ID. Human-readable names and
slugs may change and are never authorization or namespace identity.

The registration records:

- immutable app ID;
- developer or owning organization;
- display metadata and listing state;
- marketplace or custom distribution policy;
- exact redirect URI allowlist;
- launch and lifecycle URLs;
- client authentication material;
- signing keys and rotation state;
- requested and optional scopes;
- supported Voyant API range;
- current released manifest version;
- release signing identity and allowed distribution channels;
- review and suspension state.

A marketplace listing references an approved app registration but is not the
source of app identity. A custom app is created from an Apps developer or
Settings surface by an authorized actor. Creation assigns the immutable app ID,
reserved namespace, distribution policy, and initial credential generation
before installation.

Custom app creation must support at least:

1. Create a private app registration for one operator organization or
   deployment.
2. Record developer ownership, redirect URIs, lifecycle URLs, and a signed
   manifest source or uploaded manifest snapshot.
3. Validate requested scopes and manifest compatibility.
4. Create an immutable app release.
5. Issue or register client authentication material.
6. Start installation directly or generate a restricted installation link.

None of these steps creates a marketplace listing or requires marketplace
review. A custom app may remain private indefinitely. If its owner later submits
it for marketplace distribution, the listing references the existing app
identity; publication must not replace its app ID, namespace, releases, or
existing installations.

Accepting an arbitrary URL must never let the URL choose its app ID or reserved
namespace. The actor creating a custom app must hold a dedicated app-development
or app-administration permission. Managed deployments may store the registration
in a managed control plane and self-hosted deployments may store it locally, but
both must expose the same app and installation semantics.

### 3. App Manifest, Artifact, And Releases

The manifest is closed, versioned, declarative data. It may declare:

- manifest schema version and release version;
- Voyant API compatibility range;
- requested and optional scopes;
- admin pages and slot extensions;
- default locale, supported locales, and localized host-rendered metadata;
- webhook event subscriptions and event versions;
- app-owned custom-field definitions;
- setup and configuration descriptors;
- health, launch, privacy, and support URLs;
- data classification and retention declarations.

It may not declare schemas, migrations, host routes, runtime factories,
subscribers, infrastructure providers, or arbitrary executable hooks.

Releasing a manifest creates an immutable app release artifact. The artifact is
content-addressed, signed, and includes:

- the canonical manifest snapshot;
- host-rendered localized metadata;
- optional static iframe UI and in-frame locale assets;
- integrity hashes and provenance;
- declared API, event, extension-protocol, and Voyant compatibility ranges;
- generated metadata needed for deterministic reconciliation.

The artifact may reference app backend endpoints, but it may not contain or
install the backend implementation. Any included JavaScript, CSS, fonts, images,
or locale catalogs are treated as untrusted static iframe assets. They are
served only from a sandbox-compatible isolated origin and never imported by the
Operator or admin bundle.

An npm artifact exposes a closed `voyant.app-release.v1` envelope in package
metadata. The build reads that envelope and declared artifact files as data; it
does not resolve a runtime export or execute a package lifecycle hook. Direct
app-release dependencies are discoverable without adding them to the executable
deployment graph.

The Voyant app catalog is the canonical release registry for marketplace apps.
A managed private registry or the self-hosted deployment's app registry performs
the same role for a custom app. Publication validates and signs the release
once, then exposes the identical artifact through:

- the managed-runtime installer;
- an authenticated npm-compatible registry for self-hosted deployments;
- a private registry or restricted artifact upload for custom apps.

Public npm may be a mirror, but package name or registry state is not app
identity or release authority. A catalog release cannot be replaced in place.
Yanking a release prevents new acquisition where policy permits, but does not
invalidate an already pinned and verified installation artifact.

A self-hosted project installs an exact package version and commits its
lockfile. Its build verifies the catalog signature, package identity, release
digest, and compatibility metadata, then emits the same normalized release
record used by managed deployments. Package publication alone never upgrades a
self-hosted deployment.

Managed deployments acquire releases from the catalog and may advance active
installations automatically only when release and tenant update policy allow
it. New required scopes always require renewed operator consent. Incompatible
protocol changes, unsupported Voyant ranges, and releases outside the accepted
update policy remain pending rather than activating.

Existing installations move to a new release only after compatibility,
integrity, consent, and custom-field reconciliation checks. The app's remote
backend deployment remains the app developer's responsibility, but the backend
must honor the installed release contract for its declared support period.

Marketplace manifests are read from the reviewed registry. Custom manifests
must be fetched over HTTPS with response-size, redirect, DNS-rebinding, timeout,
content-type, and signature protections. Voyant stores the validated snapshot
used for each installation; it never executes content from a manifest response.

Direct HTTPS manifest submission is a development and private-publication
ingress, not a mutable runtime source of truth. Once released, both managed and
self-hosted installations consume the immutable artifact and digest.

### 4. App Installation Lifecycle

An app installation is a deployment-local aggregate with these states:

`pending`, `authorizing`, `active`, `paused`, `degraded`, `revoked`, and
`uninstalled`.

Release acquisition precedes installation:

- self-hosted deployments acquire the release through their package manifest
  and lockfile, then redeploy;
- managed deployments acquire it from the catalog automatically or on operator
  request.

Acquisition makes a release available but grants no data access. Installation
or upgrade is idempotent and follows this order:

1. Resolve an approved app release.
2. Verify release signature, digest, provenance, and deployment availability.
3. Validate Voyant, API, event, extension, and custom-field compatibility.
4. Present required and optional grants.
5. Complete OAuth authorization.
6. Create or upgrade the installation and credentials atomically.
7. Reconcile safe manifest declarations and immutable assets.
8. Activate webhook subscriptions and admin extensions.
9. Emit an auditable installation or upgrade event.

Pausing disables API credentials, webhook delivery, and extension mounting but
retains installation state. Uninstall additionally removes active webhook and
UI registrations and marks app-owned definitions inactive. Values remain by
default. Purge is a distinct privileged operation with a preview and retention
checks.

Reinstalling the same app registration reuses its reserved namespace. Whether
it reactivates the prior installation row or creates a new generation is an
implementation detail, but old and new credentials must never overlap silently.

### 5. OAuth, Grants, And Tokens

Voyant acts as the authorization server for app access. Authorization uses the
authorization-code flow with PKCE, exact redirect matching, state validation,
short-lived codes, and confidential-client authentication where applicable.

Two access modes are required:

- **Offline installation access:** for webhooks, scheduled work, and background
  synchronization. It is bounded to the app installation and granted scopes.
- **Online actor access:** short-lived access for an interactive admin session.
  Effective permissions are the intersection of app grants, viewer grants, and
  contextual restrictions.

Refresh and rotation behavior must support immediate revocation. Access tokens
must include or resolve to the app ID, installation ID, deployment audience,
installed app release ID, negotiated API and extension-protocol versions,
grants, issue time, expiry, and credential generation.

The app cannot request a scope merely because it appears in its manifest. The
scope must exist in the selected Voyant access catalog, be valid for remote
apps, and be granted by an authorized operator.

### 6. Remote Admin Extensions

App UI uses the existing sandboxed iframe and versioned message protocol. The
runtime installation store replaces the static self-hosted descriptor list as
the source for activated extensions.

The app owns all UI rendered inside its iframe: framework, components, styling,
content, accessibility, and localization. Voyant does not compile or modify app
UI and does not require app strings to be added to a Voyant package. A release
may include immutable static UI assets that Voyant stores and serves byte-for-
byte from an isolated app asset origin. Alternatively, a release may declare an
immutable, integrity-bound app-owned asset origin when deployment policy allows
it. This is equally true for marketplace and custom apps.

The installed release, not the app's mutable default URL, determines which UI
artifact is mounted. Rollback selects a previous compatible app release; it
never mutates an existing release in place.

Extensions may contribute:

- full app pages under an app-owned admin route;
- navigation entries pointing to those pages;
- explicitly supported dashboard and entity-detail slots;
- configuration and setup pages.

The host never enables `allow-same-origin`, never injects an installation access
token, and never trusts frame-provided entity or viewer context.

The reserved token request becomes a short-lived admin session token. Its
claims include issuer, app audience, installation, deployment, viewer, current
entity and slot, issued/expiry times, and a unique token ID. The iframe sends
that token to its own backend. The backend may exchange it for online actor
access; the session token itself is not a general Voyant API credential.

Session tokens must be short enough to make replay low value and must be
reissued for current context. Third-party cookies are not part of the design.

#### 6.1 App UI Internationalization

The host sends the active canonical locale in the initial extension context and
on every locale change. Locale identifiers use canonical BCP 47 language tags.
The context also includes resolved text direction, `ltr` or `rtl`, so the app
can render correctly without inferring direction from an incomplete language
list.

The app manifest declares:

- one required default locale;
- supported locale tags;
- localized app name, navigation labels, extension titles, setup labels, and
  other text rendered by the Voyant host;
- optional localized custom-field labels and descriptions;
- the location or release digest of app-owned in-frame locale catalogs.

The iframe fetches and renders its own release-pinned locale catalog from the
isolated release assets or an integrity-bound app origin. Voyant may store and
serve the bytes, but it does not merge, compile, or become the authoring source
of truth for in-frame translations. The manifest's localized host metadata is
different: Voyant validates and pins it with the app release because the host
renders those strings outside the iframe.

Locale resolution is deterministic:

1. exact active locale match;
2. progressively less specific language match where declared, such as
   `pt-BR` to `pt`;
3. the app's declared default locale.

The app receives both the requested active locale and the resolved app locale.
It may choose a more sophisticated in-frame fallback, but host-rendered labels
always use the platform algorithm above. Missing translations do not prevent an
app from loading when the default locale is complete; they produce release
validation warnings. A missing or incomplete default locale is a release error.

Localized host metadata is plain text with field-specific length limits. It
cannot contain HTML, scripts, message-format code, or executable expressions.
Variable interpolation for host-rendered strings is limited to platform-defined
placeholders with validated types. App-owned iframe catalogs may use the app's
chosen localization library because they execute only inside the sandboxed app
origin.

Locale changes remount or notify the extension through the versioned protocol
without requiring a new OAuth grant or installation. An app release may add
translations without changing scopes; removing the default locale or a locale
required by an installation's policy is a compatibility change.

### 7. App APIs

Remote app APIs are versioned public contracts, distinct from internal package
routes. They use the existing access catalog but expose only scopes explicitly
marked safe for remote apps.

The first contract families should cover:

- installation introspection and optional grant status;
- supported core entity reads;
- narrowly authorized mutations;
- finance documents and accounting export actions;
- custom-field definitions and values;
- webhook subscription health and replay requests;
- app-owned audit history;
- admin session token exchange.

Resource APIs must enforce installation status and ownership at the service
boundary, not only in HTTP middleware. Local API defaults that bypass access
control must not be reachable through app routes.

### 8. Events And Webhook Delivery

Apps consume externally visible, schema-versioned Voyant events. Package-owned
event declarations remain the authority for event shape and redaction.

Each delivery includes:

- globally unique delivery ID;
- installation and app identity;
- event type and schema version;
- event occurrence time and delivery attempt time;
- subject identity and permitted payload;
- signature and key identifier;
- retry attempt metadata.

Delivery is at least once and ordering is not guaranteed. Apps must deduplicate
by delivery ID and process idempotently. Voyant signs the exact bytes sent,
applies bounded exponential retry, records every attempt, exposes health, and
supports replay from retained event history where policy permits.

Repeated failures degrade and eventually pause the subscription, not the
Operator. A periodic reconciliation API is required for integrations where a
missed event would cause durable drift.

### 9. Custom-Field Ownership And Namespaces

Custom fields are typed values attached to native Voyant entities. They are not
a general remote database and do not introduce app-defined tables.

There are three namespace classes:

| Owner | Namespace | Definition control | Default value control |
| --- | --- | --- | --- |
| Voyant | platform-reserved | Owning Voyant module | Owning module/policy |
| Operator | `custom` | Operator in Settings | Operator and explicitly granted apps |
| App | platform-assigned `app--<opaque-id>` | Owning app only | Definition policy |

Apps never submit the physical `app--<opaque-id>` namespace. App-facing APIs
accept `$app` or `$app:<subnamespace>` and resolve it from the authenticated app
registration. The resulting physical namespace is immutable and cannot be
claimed by another registration, including a custom app with the same display
name or URL.

The unique definition identity is:

`(target_type, physical_namespace, key)`.

This permits two apps to define `status`, `external_id`, or any other common key
on the same target without collision. Duplicate identity within one app is a
manifest or API error.

#### 9.1 Target Registry

Custom-field targets are declared by the Voyant module that owns the entity.
The selected deployment graph lowers these declarations into a read-only target
registry containing:

- stable target type;
- owning graph unit;
- supported storage and API capabilities;
- allowed custom-field types;
- read, write, search, export, and presentation support;
- limits and PII posture.

Apps select from this registry. They cannot create new target types or point at
arbitrary tables. The target registry replaces the Relationships-owned Postgres
enum and hard-coded UI entity list.

#### 9.2 Definitions

A definition contains:

- target, namespace, and key;
- owner kind and owner ID;
- label and description;
- canonical type and declarative validations;
- required/default behavior where the target supports it;
- staff, app, public, export, invoice, and search visibility;
- value write policy;
- PII/data classification;
- lifecycle status and manifest release provenance;
- created and updated audit metadata.

Operator-owned definitions are created and structurally edited in Settings.
App-owned definitions are reconciled from an active app release or created
through an owner-constrained app API. They appear in Settings, but structural
properties are read-only to staff. Staff may manage explicitly supported
presentation overrides without changing the app-owned schema.

Only declarative validations are supported: length, numeric bounds, choices,
patterns from an approved safe subset, reference target, and list cardinality.
Arbitrary TypeScript validators are not supported.

#### 9.3 Values

Values remain with the owning entity in its `custom_fields` JSONB column. The
logical shape is namespaced rather than flat:

`custom_fields[namespace][key] = value`.

Readers and writers use the custom-fields service; callers do not build JSONB
paths directly. Validation resolves the definition by full identity and rejects
unknown namespaces, unknown keys, invalid types, and unauthorized writes.

Legacy flat values migrate into the operator-owned `custom` namespace unless a
specific migration proves another owner. The migration must detect ambiguous
keys and preserve the original value before changing shape.

#### 9.4 Access Policies

Definition ownership and value access are separate. App-owned definitions may
select one supported value policy:

- app read/write, staff read-only;
- app read/write, staff read/write;
- app write, staff hidden except privileged diagnostics;
- app read, staff write;
- read-only projection after creation.

Policy is bounded by target capability and OAuth grants. An app's generic
entity write scope does not grant writes to another app namespace. Operator
fields require an explicit operator-field scope and never become app-owned.

Search, export, invoice, storefront, and customer-account visibility are
independent, conservative, and opt-in where data may leave the admin. PII fields
must not become externally visible merely because an app asks for it.

#### 9.5 Reconciliation And Compatibility

Manifest reconciliation is deterministic and owner-scoped:

- additive definitions are allowed;
- labels and descriptions may change;
- validation may be widened automatically;
- validation tightening requires existing-value validation and an explicit
  migration posture;
- target, namespace, key, and type are immutable after values exist;
- removal deprecates and hides a definition before any purge;
- newly requested visibility or write access may require operator consent.

No app release may shadow, replace, or modify an operator, platform, or other
app definition.

#### 9.6 Limits

Voyant must enforce configurable per-installation and per-target limits for
definition count, value size, JSON depth, list cardinality, indexed fields, and
publicly exposed fields. Limits protect entity-row size, search fan-out, admin
usability, and export cost.

### 10. App Data Ownership

Remote apps own their complex records in their own database. Voyant stores only
the platform-side integration state needed to govern access and make native
entities useful:

- app registration and installation;
- grants and credential metadata;
- validated manifest snapshot;
- extension and webhook registrations;
- delivery and audit history;
- app-owned custom-field definitions and values;
- explicit source connections or projections where a Voyant capability owns
  that contract.

Sync cursors, app job state, accounting-specific mappings, and app business
records stay remote unless Voyant defines a narrow interoperable projection.
Secrets never belong in custom fields or manifest configuration JSON.

### 11. Payment Adapter Boundary

Payments are not marketplace apps. A processor participates in checkout,
payment-session state, callback verification, idempotency, capture/refund
semantics, and finance reconciliation. Its adapter is trusted deployment code
selected in the resolved graph.

Voyant will expose a canonical payment adapter port with:

- declared processor capabilities;
- create/initiate payment;
- hosted checkout or redirect details;
- authorize, capture, void, refund, and status operations as capabilities;
- callback signature verification and canonical event mapping;
- idempotency and retry contract;
- health and diagnostics;
- sandbox/test-mode declaration;
- conformance tests for money, state transitions, replay, and failure behavior.

The deployment selects the adapter explicitly through a payment provider role.
Environment variables configure the selected adapter and never select one by
their presence. The initial first-party choices are Voyant Payments and Netopia;
future processors implement the same port. A custom selection is available for
operator-owned adapters that pass the public conformance suite.

V1 should select one active payment adapter per deployment. Multi-processor
routing is deferred until concrete regional or method-routing requirements
justify a router contract.

### 12. Accounting App Boundary

Accounting integrations are remote apps. They receive finance events, read
authorized invoices and payments, perform remote synchronization, and write
back only through scoped APIs and owned custom fields.

For SmartBill, the target model is:

- OAuth app installation and finance scopes;
- invoice and credit-note event webhooks;
- remote synchronization and reconciliation state;
- remote configuration/admin pages mounted through the iframe host;
- app-owned invoice fields for small external references or summarized status;
- app API actions for explicit issue, retry, or reconcile operations where
  finance policy permits them;
- audit records for every remote mutation.

Voyant remains authoritative for native finance records. The accounting app is
authoritative for its remote job state and the external accounting system
remains authoritative for its own issued identifiers and status. Any mirrored
field must state its authority and freshness semantics.

## Data Model

The following aggregates are required. Exact SQL belongs to implementation
design, but ownership and uniqueness are decisions of this RFC.

### App registry

- `apps`: immutable app identity and developer ownership.
- `app_redirect_uris`: exact authorized redirects.
- `app_credentials`: client and signing-key generations, never raw public API
  tokens.
- `app_releases`: immutable validated manifest snapshots, default locale, and
  supported locales, compatibility ranges, support window, and lifecycle state.
- `app_release_artifacts`: immutable digest, signature, provenance, registry
  coordinates, asset inventory, and availability state.
- `app_release_localizations`: validated host-rendered strings keyed by release,
  locale, surface, and message key.
- `app_release_channels`: managed, npm-compatible, and private distribution
  coordinates for the same artifact digest.
- `app_listings`: marketplace metadata and review state.

### Installation

- `app_installations`: app, deployment, release, status, namespace assignment,
  installed actor, update policy, last compatible release check, and lifecycle
  timestamps.
- `app_release_acquisitions`: deployment, app release, delivery channel,
  verified digest, package or catalog provenance, acquisition time, and
  availability state.
- `app_grants`: requested, granted, optional, and revoked scopes.
- `app_access_credentials`: hashed or encrypted credential metadata and
  generations.
- `app_extension_installations`: resolved page and slot descriptors.
- `app_webhook_subscriptions`: resolved event/version/endpoints and status.
- `app_installation_settings`: non-secret validated configuration.
- `app_secret_references`: references to a secret store, not secret values.

### Delivery and governance

- `app_webhook_deliveries`: payload reference/hash, attempts, response posture,
  next retry, and terminal state.
- `app_audit_events`: installation, grants, tokens, API actions, definition
  reconciliation, value writes, and lifecycle events.
- `app_health`: derived or sampled health posture without making health checks a
  source of truth for installation state.

### Custom fields

- `custom_field_targets`: generated or projected read-only selected-graph
  targets.
- `custom_field_definitions`: namespaced definition and owner.
- `custom_field_definition_overrides`: operator-owned presentation overrides for
  app definitions.
- entity-local namespaced `custom_fields` JSONB values.

The definition uniqueness constraint is exactly `(target_type, namespace,
key)`. Ownership checks additionally require `owner_app_id` to match the app
registration resolved from the authenticated installation.

## API And Scope Decisions

Scope names must describe resources and actions rather than app categories. The
initial set should distinguish:

- app installation self-read;
- entity read scopes;
- finance document read and authorized action scopes;
- event subscription scopes;
- own custom-field definition read/write;
- own custom-field value read/write per target;
- operator-owned custom-field access when separately granted;
- online token exchange;
- audit self-read.

There is no broad `custom-fields:write` grant that permits cross-namespace
writes. “Own namespace” is derived from the authenticated app and cannot be
supplied as request data.

High-impact finance actions use the existing action/approval policy. OAuth
scope alone does not bypass approval or action-ledger requirements.

## Versioning And Compatibility

The platform versions these surfaces independently:

- app release artifact format and signature profile;
- app manifest schema;
- Voyant App API;
- event payload schema per event type;
- admin extension protocol;
- app manifest localization and host-label schema;
- payment adapter contract and conformance version.

An app release declares compatible ranges. Install and upgrade fail closed when
there is no overlap. Breaking API versions have an announced support window and
an installation-visible deadline. Event subscriptions pin a supported event
version rather than silently receiving a new shape.

Remote app backend deployments do not automatically change the stored manifest.
Capabilities visible to Voyant change only through an app release, preserving
reviewability and rollback.

#### Release Delivery And Update Policy

One app release has one identity and digest across every delivery channel.
Managed and npm delivery must never produce semantically different artifacts
for the same release ID.

Self-hosted deployments control acquisition through the project package
manifest and lockfile:

```json
{
  "dependencies": {
    "@smartbill/voyant-app": "2.3.1"
  }
}
```

The app package is an exact release input to the build. Publishing `2.3.2`
changes nothing until the developer updates the dependency, verifies the
lockfile diff, and redeploys. Voyant must expose installed, available, and
incompatible release state without performing package-manager operations at
runtime.

Managed installations have an explicit update policy:

- `manual`: never advance without operator approval;
- `compatible`: automatically advance releases within the current major version
  that require no new consent and remain within all declared compatibility
  ranges;
- `patch`: a stricter compatible policy limited to patch releases;
- `pinned`: remain on one release until explicitly unpinned.

The managed default should be `compatible`, subject to platform rollback and
release suspension controls. An organization may choose a stricter policy.
Semantic version alone is insufficient evidence of compatibility; manifest
diffing and platform contract checks are authoritative.

An update cannot activate automatically when it:

- requests a new required scope or expands sensitive data access;
- crosses the installed app release's major-version boundary;
- changes an immutable custom-field identity or tightens validation without an
  accepted migration posture;
- requires unsupported Voyant, API, event, artifact, or extension versions;
- changes a reviewed high-risk endpoint or data-retention declaration;
- has been suspended, revoked, or fails integrity verification.

Such a release remains available but pending, with a human-readable explanation
and required action. Compatible release rollback follows the same artifact and
consent checks; rollback never rewrites release history.

#### Remote Backend Compatibility

The immutable artifact controls Voyant-visible capabilities and UI, but the app
developer still deploys the remote backend. Every authenticated API request,
session-token exchange, webhook, and lifecycle callback therefore includes or
cryptographically binds:

- app ID;
- installation ID;
- installed app release ID and digest;
- negotiated Voyant App API version;
- event schema version where applicable;
- admin extension protocol version where applicable.

The app provider must honor each release for its declared support period.
Marketplace publication requires a minimum support policy and a declared
end-of-support date or rolling support rule. Backend changes must remain
compatible with every supported installed release.

Voyant cannot technically prevent a remote provider from breaking its backend.
It can detect incompatible responses or explicit unsupported-release signals,
mark the installation degraded, stop mounting unsafe extensions, pause failing
subscriptions, and preserve native admin operation. Managed catalog governance
may suspend new installs or updates when a provider violates its support
contract.

## Security And Privacy Requirements

1. Exact OAuth redirect matching; no wildcard production redirects.
2. Authorization code PKCE, state validation, one-time codes, and short expiry.
3. Immediate pause, uninstall, grant revocation, and credential-generation
   revocation.
4. App credentials stored or represented through the secret system; never in
   custom fields, manifests, logs, or iframe context.
5. Short-lived, audience-bound admin session tokens with replay-resistant IDs.
6. No installation access token delivered to an iframe.
7. Service-boundary scope, installation, target, and namespace checks.
8. Webhook signatures over exact bytes, timestamp tolerance, rotation, and
   unique delivery IDs.
9. Outbound endpoint SSRF protections and HTTPS requirements.
10. Per-app and per-installation rate, concurrency, payload, and retry limits.
11. Data classification and PII redaction derived from platform event and field
    declarations, not app preference alone.
12. Audit coverage for grants, credentials, remote mutations, exports, and
    app-owned field access.
13. Marketplace review for high-risk scopes and sensitive extension points.
14. App suspension that disables every installation without deleting data.
15. Explicit uninstall and privacy callbacks with bounded completion and
    evidence.
16. Tenant identity derived from the deployment and installation, never from an
    app-supplied tenant parameter.
17. Localized host metadata treated as untrusted plain text with strict schema
    and length validation.
18. Release artifacts require signature, digest, provenance, and package-to-app
    identity verification before acquisition or activation.
19. Static app assets are served from an isolated origin with restrictive
    content security policy and cannot become admin-origin code.
20. Package lifecycle events such as yanking or deprecation never silently
    replace or invalidate an already verified artifact.

## Reliability And Operational Requirements

- App API calls have explicit deadlines and cancellation.
- Native Operator requests do not synchronously depend on a remote app unless a
  dedicated contract defines timeout and failure posture.
- UI extensions fail soft and cannot block native pages.
- Webhook queues isolate destinations and installations.
- Retries are bounded and observable; poison deliveries reach a terminal state.
- Delivery replay is privileged, audited, and idempotency-preserving.
- App status pages show grant drift, release compatibility, webhook health,
  recent errors, and paused subscriptions.
- App status pages show delivery channel, pinned or active release, available
  updates, update policy, backend support deadline, and why an update is
  blocked.
- Managed compatible updates are reversible to the previous verified release.
- Self-hosted deployments remain operational when their package registry is
  unavailable after a release has been built and acquired.
- Remote app outages do not prevent Operator boot, migration, or native finance
  operations.
- Payment adapter failures use the finance/payment state machine and are not
  handled through generic app webhook infrastructure.

## Deep Modules And Ownership

Implementation should prefer these independently testable modules:

1. **App Registry:** registration, releases, review, support policy, and
   immutable app identity.
2. **Release Distribution:** signing, content addressing, managed acquisition,
   npm-compatible publication, private artifacts, provenance, and rollback.
3. **Installation Service:** consent, state machine, grants, update policy,
   upgrade, pause, uninstall, reinstall, and purge planning.
4. **Manifest Compiler:** closed-schema validation and deterministic
   reconciliation into installation capabilities and localized host metadata.
5. **App Authorization Server:** OAuth codes, offline credentials, online token
   exchange, rotation, revocation, and scope intersection.
6. **Remote App Gateway:** release-aware version negotiation, rate limits,
   authenticated service context, and app-safe resource APIs.
7. **Admin Extension Broker:** installed release assets and descriptors, iframe
   session tokens, token exchange, locale context, host-label resolution, and
   fail-soft hosting.
8. **Webhook Delivery Service:** subscription resolution, signing, durable
   attempts, retry, replay, and health.
9. **Custom Fields Module:** targets, namespaces, definitions, values,
   validation, visibility, reconciliation, and migration.
10. **Payment Adapter Contract:** provider selection, capability contract,
   conformance suite, and canonical callback mapping.
11. **App Governance UI:** listings, acquisitions, installs, update policy,
    grants, health, audit, Settings integration, and data-retention actions.

No generic module should import a specific accounting app, payment processor,
or marketplace listing.

## Migration Plan

### Phase 0: Accept vocabulary and authority

- Accept this RFC and update the module/provider/adapter/app taxonomy.
- Reserve **app** for remote OAuth installations.
- Stop presenting npm packages as operator-installable plugins.
- Record the payment-versus-accounting boundary as normative architecture.

### Phase 1: Namespace-ready custom fields

- Extract definition ownership, API, and Settings UI from Relationships into a
  generic custom-fields module.
- Replace the fixed Relationships entity enum with selected-graph targets.
- Add owner kind, owner ID, namespace, access, visibility, and lifecycle fields.
- Change uniqueness to `(target, namespace, key)`.
- Introduce the server-resolved `$app` alias.
- Migrate flat entity values into namespaced JSONB.
- Remove project TypeScript discovery and code/database merge precedence.
- Preserve compatibility reads during a time-bounded migration window.

### Phase 2: App registry and OAuth installation

- Add app registration, release, installation, grants, and lifecycle services.
- Define and sign the immutable app release artifact.
- Publish identical release digests through managed, npm-compatible, and
  private distribution channels.
- Add the self-hosted build step that verifies installed app packages and
  lowers them into non-executable release records.
- Add managed acquisition, update-policy evaluation, rollback, and blocked-
  update explanations.
- Build custom app creation in Apps developer or Settings UI without a
  marketplace dependency.
- Implement optional marketplace discovery over the same release model.
- Implement offline credentials, rotation, pause, revoke, and uninstall.
- Build Installed Apps and consent UI.
- Add audit and health surfaces.

### Phase 3: Remote UI and token broker

- Source admin extension descriptors from active installations.
- Add app pages, navigation contributions, and selected slots.
- Add manifest localization validation, release-pinned host labels, locale
  negotiation, and locale/direction extension context.
- Implement short-lived iframe session tokens and online token exchange.
- Keep the existing sandbox posture and compatibility checks.

### Phase 4: App API and webhooks

- Publish the initial App API and remote-safe access scopes.
- Lower externally visible event declarations into app subscriptions.
- Add signing, durable delivery, retry, replay, and reconciliation contracts.
- Add app developer SDK helpers without making them runtime authority.

### Phase 5: Accounting app migration

- Define the finance event and API coverage required by accounting apps.
- Build SmartBill as the first remote accounting app reference.
- Migrate configuration, external references, and operational state with an
  explicit authority map.
- Run package and remote implementations in comparison mode if necessary, but
  permit only one write authority.
- Remove the embedded SmartBill runtime after parity and migration evidence.

### Phase 6: Payment adapters

- Extract and publish the canonical payment adapter port.
- Add the payment provider selection role and conformance kit.
- Adapt Netopia to the contract and harden callback verification.
- Implement Voyant Payments as the first-party default where available.
- Update checkout and finance runtime composition to depend on the selected
  payment adapter rather than plugin identity.
- Defer multiple simultaneous processors until a routing requirement is
  accepted.

### Phase 7: Retire legacy plugin and custom-field seams

- Remove deployment-local TypeScript custom-field support and documentation.
- Reclassify remaining npm plugin bundles by module/adapter/provider role.
- Remove static installed-app lists once the installation service owns them.
- Add mechanical checks that prevent app release packages from appearing as
  executable deployment graph units and prevent executable deployment packages
  from registering as apps.

## Testing Decisions

Tests should assert public behavior and durable invariants rather than internal
function shape.

### Contract and unit tests

- Manifest schema acceptance, rejection, canonicalization, and deterministic
  reconciliation.
- Installation state-machine transitions and idempotency.
- Scope intersection for offline and online access.
- Credential rotation, pause, revoke, and expiry.
- Namespace allocation, `$app` substitution, and rejection of physical or
  foreign namespaces.
- Cross-app collision tests using identical target and key.
- Definition ownership and value-policy matrices.
- Declarative custom-field validation and visibility.
- App-release compatibility and renewed-consent rules.
- Artifact signature, digest, provenance, channel-equivalence, and yanking
  behavior.
- Managed `manual`, `compatible`, `patch`, and `pinned` update policies.
- Self-hosted exact-version and lockfile behavior.
- Release-aware token and request context.
- Webhook signing, duplicate delivery IDs, retry scheduling, and terminal
  failure.
- Admin session token audience, context, expiry, and replay posture.
- Locale canonicalization, exact and language fallback, default-locale
  completeness, and host-label validation.
- Payment adapter conformance for every implementation.

### Integration tests

- Directly created custom apps and marketplace-discovered apps produce
  equivalent installation aggregates.
- The same release delivered through npm and managed acquisition produces the
  same release ID, digest, manifest, assets, and reconciliation result.
- Publishing a new app package does not change a self-hosted installation until
  its dependency and lockfile are updated and the deployment is rebuilt.
- A managed compatible update activates automatically, while new scopes or
  incompatible contracts leave the update pending.
- Creating and installing a custom app never creates or requires a marketplace
  listing.
- OAuth install, API call, token refresh/rotation, pause, and uninstall.
- Iframe handshake, session token, backend exchange, contextual API call, and
  revocation.
- Iframe UI receives requested locale, resolved app locale, direction, and live
  locale changes; host labels use the same pinned app release.
- Event emission through durable signed webhook delivery and replay.
- App-owned definition install, value write, search/export visibility, uninstall,
  and reinstall.
- Two installed apps define and write the same key without collision.
- An app cannot read or write another app's private definition or value.
- Legacy flat custom-field data migrates without loss.
- Accounting invoice event, remote synchronization, reference writeback, and
  audit history.
- Payment initiation, callback verification, duplicate callback, capture,
  refund, and reconciliation against both Netopia and Voyant Payments adapters.

### End-to-end and security tests

- Consent accurately displays effective required and optional grants.
- Native admin remains usable when the app origin is slow, invalid, or down.
- Tampered, unsigned, mismatched, or replaced release artifacts fail before
  activation.
- App static assets cannot execute in the admin origin or escape iframe sandbox
  policy.
- An app backend receives and honors the installed release context; an explicit
  unsupported-release response degrades only that installation.
- Missing non-default app translations fall back deterministically, while an
  incomplete default locale fails release validation.
- Third-party cookie blocking does not break embedded app authentication.
- OAuth redirect, state, code replay, token audience, and confused-deputy tests.
- Manifest-fetch SSRF, redirect, oversized body, invalid signature, and timeout
  tests.
- Webhook HMAC/JWS, timestamp, body mutation, endpoint isolation, and replay
  tests.
- Rate-limit and queue-isolation tests demonstrating one app cannot starve
  another or the Operator.
- Purge preview and execution tests proving retained data is not silently
  destroyed.

The repository's existing deployment graph, access catalog, admin extension,
event catalog, action ledger, custom-field, and provider conformance tests are
the prior art. New tests should use the same package-owned contract style.

## Acceptance Criteria

1. Activating or upgrading an app never adds executable code, graph units,
   routes, providers, schemas, migrations, or app backend code to the Operator.
2. Self-hosted acquisition may change the project package manifest and lockfile,
   but the acquired app artifact is declarative and lowered without executable
   imports.
3. An authorized actor can create, release, and install a custom app without a
   marketplace listing, publication, or review.
4. Marketplace-discovered and directly created custom apps use one installation
   aggregate and OAuth flow.
5. No remote app manifest can declare schema, migrations, providers, or runtime
   code.
6. One immutable release ID and digest is used across managed, npm-compatible,
   and private delivery channels.
7. A self-hosted app release is controlled by an exact dependency and lockfile;
   publishing a newer release does not silently update it.
8. Managed releases update only according to explicit policy, compatibility,
   integrity, and consent checks.
9. New required scopes always require operator consent, including on managed
   deployments with automatic compatible updates.
10. Installed app UI is always app-owned, release-pinned, and sandboxed.
11. Every app can declare its default locale, supported locales, and localized
   host-rendered metadata without adding strings to Voyant packages.
12. The iframe receives the active locale, resolved app locale, and text
   direction, and the app remains authoritative for its in-frame translations.
13. Host-rendered app labels use deterministic locale fallback and a
   release-pinned, complete default locale.
14. The iframe receives no installation credential and can authenticate through
   a short-lived session-token flow.
15. Every app API request resolves an active installation, installed release,
   negotiated contract versions, and effective scopes.
16. Every app has an immutable platform-assigned namespace.
17. An app cannot name, claim, read, define, or write another app namespace.
18. Two apps can define the same key on the same target without collision.
19. Operator-owned fields and app-owned fields have distinct definition and
    value controls.
20. Custom-field definitions have one database authority; project TypeScript
    declarations are unsupported.
21. Custom-field targets come from selected entity-owning modules rather than a
    Relationships-owned enum.
22. Uninstall revokes access and extensions immediately while retaining values
    by default.
23. Webhook delivery is signed, durable, at-least-once, idempotency-friendly,
    observable, and replayable.
24. Remote app outages or unsupported backend releases cannot block Operator
    boot or native admin pages.
25. Accounting integrations can operate through the App API and event surface
    without in-process code.
26. Netopia and Voyant Payments implement the same selected payment adapter
    contract and pass its conformance suite.
27. Environment variables never implicitly select a payment adapter.
28. High-impact app actions remain subject to Voyant approval and action-ledger
    policy.
29. Architecture checks prevent vocabulary and authority from drifting back to
    runtime-installed npm plugins.

## Consequences

### Benefits

- Clear trust and ownership boundary.
- Runtime OAuth activation, pause, and uninstall without executable deployment
  mutation.
- One model for managed and self-hosted operators.
- Deterministic lockfile-controlled releases for self-hosters.
- Safe policy-driven updates and rollback for managed deployments.
- One signed app artifact and compatibility contract across both channels.
- App failures isolated from the Operator process.
- App developers own their runtime, database, and release cadence.
- Collision-proof extensible entity data.
- Smaller and more stable public extension surface.
- Payment processing receives the stronger integration contract it requires.
- Accounting integrations become independently deployable and upgradeable.

### Costs

- Voyant must operate an authorization server, app registry, installation
  service, signed release registry, npm-compatible distribution channel, token
  broker, webhook delivery plane, and review process.
- Managed update policy, rollback, artifact retention, signing, and provenance
  add operational complexity.
- Remote app providers must support multiple installed releases concurrently
  for their declared support window.
- Remote calls add latency and failure modes.
- Apps cannot participate in native transactions.
- App APIs and event schemas require long-term compatibility discipline.
- Custom-field storage and APIs require a namespace migration.
- SmartBill and other existing embedded integrations require deliberate remote
  migration rather than mechanical package renaming.

These costs are preferred to executing ecosystem code and migrations inside the
Operator. Managed and npm acquisition are two delivery channels for one app
release and runtime architecture, not two app models.

## Resolved Decisions

- App backends are remote-only; release artifacts are declarative.
- Custom apps can be created and installed without marketplace listing,
  publication, or review.
- Marketplace and custom discovery converge on one OAuth installation model.
- Every app release is an immutable signed artifact with one identity and digest
  across delivery channels.
- Self-hosted deployments acquire app releases through exact npm-compatible
  packages and lockfiles.
- Managed deployments acquire the same releases from the catalog and may apply
  compatible updates according to explicit installation policy.
- The Voyant catalog is canonical for marketplace releases; a restricted
  managed or deployment-local app registry is canonical for private custom
  releases. Npm-compatible registries and private uploads are delivery
  channels, not release identity.
- An app release package is declarative and may contain sandboxed static UI
  assets, but never backend implementation or executable Operator code.
- Acquisition and OAuth activation are separate operations.
- There is no hybrid app mode.
- New required scopes always require renewed consent.
- Every app request and callback is bound to the installed release and
  negotiated contract versions.
- App providers must honor installed releases for their declared support
  periods; unsupported backends degrade the app rather than the Operator.
- Remote apps own complex records in their own database.
- Custom fields are the native attachment seam, not a replacement for an app
  database.
- Physical app namespaces are assigned by Voyant and immutable.
- App APIs resolve `$app` server-side and never trust a submitted physical
  namespace.
- Definition identity includes target, namespace, and key.
- Database definitions are the sole runtime custom-field authority.
- Payment processors are deployment adapters.
- Netopia and Voyant Payments implement the same payment adapter contract.
- Accounting integrations are remote apps.
- V1 selects one active payment adapter per deployment.
- Uninstall retains app-owned values by default; purge is explicit.
- Each app owns its iframe UI and in-frame localization catalogs.
- Voyant stores only validated, release-pinned localization used for
  host-rendered app labels.
- Locale resolution uses exact match, declared language fallback, then the
  app's complete default locale.

## Deferred Decisions

- Marketplace commercial terms, billing, revenue share, and payouts.
- Exact App API transport shape beyond HTTP/JSON and webhook contracts.
- Public-key versus confidential-secret client authentication defaults.
- Fine-grained limits per custom-field target and deployment plan.
- A future platform-native custom-object facility for interoperable standalone
  records. Remote app databases remain the v1 answer.
- Multi-processor payment routing.
- Cross-deployment app installations for managed multi-deployment operator
  organizations.
