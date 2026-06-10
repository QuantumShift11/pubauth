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

Run Web UI:

```bash
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PUBAUTH_API_BASE=http://localhost:8080 PORT=3000 npm run start:web
```

Docker Compose:

```bash
docker compose up --build
```

Storage integration services:

```bash
docker compose -f docker-compose.integration.yml up -d
PUBAUTH_TEST_MONGO_URI=mongodb://127.0.0.1:27018 \
PUBAUTH_TEST_REDIS_URL=redis://127.0.0.1:6380 \
npm run test:integration
```

Local bootstrap accounts are seeded only when `PUBAUTH_ENV=local`. In `dev`, `qa`, and `prod`, bootstrap local accounts are not seeded, any persisted bootstrap account causes startup failure, and `PUBAUTH_ENABLE_BOOTSTRAP_ACCOUNTS=true` is rejected at startup.

Google and Entra broker flows are configured only through environment variables:

```bash
PUBAUTH_GOOGLE_OIDC_ISSUER=...
PUBAUTH_GOOGLE_CLIENT_ID=...
PUBAUTH_GOOGLE_CLIENT_SECRET=...
PUBAUTH_GOOGLE_REDIRECT_URI=...
PUBAUTH_ENTRA_OIDC_ISSUER=...
PUBAUTH_ENTRA_CLIENT_ID=...
PUBAUTH_ENTRA_CLIENT_SECRET=...
PUBAUTH_ENTRA_REDIRECT_URI=...
```

## Current status

This repo includes a React control-plane UI, signed RS256 OIDC issuance, JWKS exposure, session-backed admin APIs, tenant-scoped admin authorization, and broker flows for Google and Entra wired through provider discovery, token exchange, JWKS-backed ID token verification, state, nonce, and account linking. Mongo and Redis adapters have runnable integration tests when the Docker-backed services above are available.
