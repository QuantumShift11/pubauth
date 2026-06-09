# Module Design

PubAuth uses loosely coupled modules with explicit contracts.

## Core modules

### config

Loads and validates runtime configuration.

Responsibilities:

- environment parsing
- required secret validation
- deployment mode validation
- safe defaults for local development

### logger

Provides structured logging.

Responsibilities:

- request correlation ID
- security event logging
- audit-friendly metadata
- no secret leakage

### http

Common HTTP utilities.

Responsibilities:

- error response model
- request context
- async handler wrapper
- health endpoints

### oidc

OIDC Provider implementation.

Responsibilities:

- discovery document
- authorization endpoint
- token endpoint
- JWKS endpoint
- UserInfo endpoint
- logout endpoint
- client authentication
- authorization code lifecycle
- refresh token lifecycle

### broker

Identity provider broker.

Responsibilities:

- Google login adapter
- Entra login adapter
- future provider adapters
- provider callback normalization
- mapping external identity to PubAuth identity

### gateway

No-code authentication and authorization gateway.

Responsibilities:

- protect upstream apps
- redirect unauthenticated users
- validate PubAuth sessions or tokens
- enforce gateway-level policies
- inject trusted identity headers
- forward requests to upstream backends

### rbac

Policy and authorization module.

Responsibilities:

- role model
- group mapping
- route/method policy checks
- workspace policy checks
- deny-by-default decisions

### tenant

Tenant and workspace module.

Responsibilities:

- organizations
- workspaces
- environments
- identity connections
- user memberships

### product

Product application registry.

Responsibilities:

- product apps
- OIDC clients
- callback URLs
- gateway upstreams
- allowed origins
- integration mode selection

### session

Session module.

Responsibilities:

- browser session lifecycle
- gateway session lookup
- token-backed session state
- revocation
- idle and absolute expiry

### crypto

Cryptography boundary.

Responsibilities:

- signing key management
- JWKS generation
- token signing
- token verification
- key rotation interface

### audit

Security and compliance audit log.

Responsibilities:

- login success/failure
- token issuance
- policy deny
- admin changes
- client secret rotation
- gateway access decisions

## Dependency rule

Allowed:

```text
module -> shared contracts
module -> config/logger/http
module -> repository interface
```

Avoid:

```text
module -> another module's database model
module -> another module's private helper
module -> direct env access everywhere
module -> direct database client everywhere
```

## Reusability rule

Any function likely needed by more than one integration must live behind a service or contract.

Examples:

- token validation
- role checks
- route policy checks
- client lookup
- workspace resolution
- identity header building
- audit event writing
