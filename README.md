# PubAuth

PubAuth is a standalone identity platform for OIDC provider, no-code gateway authentication, and gateway-level RBAC.

The main objective is simple: product teams should not write custom authentication code in every backend.

## Integration modes

1. No-code gateway mode
2. SDK or middleware mode
3. Raw OIDC mode

## Design principles

- Loosely coupled modules
- Clear boundaries between authentication, authorization, gateway, tenants, clients, and audit
- Production-scale architecture from the beginning
- No dependency on existing TitanCore runtime code
- Reusable contracts and interfaces
- Additive migration path for existing platforms

## Runtime services

- `apps/api`: OIDC and admin-facing API service
- `apps/gateway`: no-code gateway / policy decision service
- `apps/worker`: background jobs, cleanup, rotation, and async operations

## Core packages

- `packages/oidc`: OIDC provider contracts and endpoint helpers
- `packages/gateway`: gateway policy, route, decision, and forwarding helpers
- `packages/rbac`: reusable policy decision engine
- `packages/session`: session contracts
- `packages/product`: product and OIDC client registration contracts
- `packages/tenant`: workspace / tenant contracts
- `packages/broker`: identity provider adapter contracts
- `packages/crypto`: signing key contracts
- `packages/audit`: security event contracts
- `packages/events`: generic platform event contracts
- `packages/http`: framework-neutral HTTP route/server utilities
- `packages/config`: runtime configuration
- `packages/logger`: structured logger
- `packages/storage`: storage abstraction
- `packages/jobs`: worker job registry
- `packages/shared`: shared result and error primitives

## Documentation

- `docs/architecture.md`
- `docs/modules.md`
- `docs/oidc-provider.md`
- `docs/no-code-gateway.md`
- `docs/rbac.md`
- `docs/migration-plan.md`
- `docs/security-model.md`
- `docs/testing-strategy.md`
- `docs/deployment-model.md`
- `docs/operations-runbook.md`
- `docs/development.md`

## Local development

```bash
npm install
npm run typecheck
npm run build
```

Run API:

```bash
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PORT=8080 npm run start:api
```

Run Gateway:

```bash
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PORT=8081 npm run start:gateway
```

Run Worker:

```bash
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PORT=8082 npm run start:worker
```

Docker Compose:

```bash
docker compose up --build
```

## Current status

This repo is now an implementation-ready skeleton. Some OIDC endpoints intentionally return `501` until storage, login, token issuance, and provider adapters are implemented.
