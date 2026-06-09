# PubAuth Architecture

PubAuth is designed as a standalone identity platform that can act as an OIDC Provider, identity broker, and authentication gateway for product applications.

## Goal

Make product authentication easy and reusable.

Product backends should not repeatedly implement login, callback handling, token exchange, token validation, session validation, or common RBAC checks.

## High-level architecture

```text
Browser
  -> PubAuth Gateway
  -> Product Backend

Identity Providers
  -> Google
  -> Entra ID
  -> Future SAML / OIDC providers

PubAuth Core
  -> OIDC Provider
  -> Identity Broker
  -> Policy Engine
  -> Tenant / Product Registry
  -> Session Service
  -> Audit Service
```

## Integration modes

### 1. No-code gateway mode

The product backend sits behind PubAuth Gateway.

PubAuth Gateway performs authentication and gateway-level authorization before forwarding requests to the backend.

The backend receives trusted identity headers and does not implement PubAuth-specific authentication code.

### 2. SDK / middleware mode

For APIs that need tighter integration, PubAuth provides small framework adapters.

Examples:

- Express middleware
- FastAPI middleware
- Spring Boot starter
- Django middleware

These adapters should call stable PubAuth contracts and avoid duplicating auth logic.

### 3. Raw OIDC mode

Mature product teams can integrate using standard OIDC directly.

They use:

- issuer URL
- client ID
- client secret
- redirect URI
- JWKS URL
- scopes
- claims

## Module boundary rule

Each module must own one clear responsibility.

A module may depend on shared contracts, logger, config, and storage interfaces, but must not directly reach into another module's internal implementation.

## Runtime services

Initial service split:

- `api`: Admin and public OIDC APIs
- `gateway`: reverse proxy / forward auth service
- `worker`: async jobs, audit processing, cleanup, key rotation support

## Storage boundary

Business logic must depend on repository interfaces, not database clients directly.

This allows MongoDB, PostgreSQL, or another store to be used later without rewriting core logic.

## Security boundary

The gateway must be the only internet-facing path to protected backend apps in no-code mode.

Backends must not trust identity headers from public clients. Header trust is valid only when traffic comes from the PubAuth Gateway or a trusted internal network path.
