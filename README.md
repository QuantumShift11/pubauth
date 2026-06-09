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

## Documentation

- `docs/architecture.md`
- `docs/modules.md`
- `docs/oidc-provider.md`
- `docs/no-code-gateway.md`
- `docs/rbac.md`
- `docs/migration-plan.md`

## Initial code layout

This repository starts with a TypeScript monorepo-style backend foundation. Runtime behavior is intentionally skeletal but structured for production implementation.
