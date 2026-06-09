# Migration Plan

PubAuth is independent from existing TitanCore runtime code.

The migration strategy is additive and loosely coupled.

## Phase 0: Design baseline

Create standalone architecture documents and module boundaries.

No dependency on existing product code.

Deliverables:

- architecture document
- module design
- OIDC provider plan
- no-code gateway plan
- RBAC model
- implementation backlog

## Phase 1: Core platform foundation

Create skeletal services and shared contracts.

Deliverables:

- API service shell
- Gateway service shell
- Worker service shell
- shared config module
- shared logger module
- shared HTTP error model
- shared domain contracts

## Phase 2: OIDC Provider MVP

Implement standard OIDC endpoints.

Deliverables:

- discovery document
- JWKS endpoint
- authorization endpoint shell
- token endpoint shell
- UserInfo endpoint shell
- client repository interface
- authorization code repository interface
- signing key interface

## Phase 3: Identity broker

Add provider abstraction.

Deliverables:

- provider adapter interface
- Google adapter placeholder
- Entra adapter placeholder
- external identity normalization
- account linking model

## Phase 4: No-code gateway MVP

Implement gateway mode for one protected upstream.

Deliverables:

- route policy loader
- session validator
- RBAC decision call
- trusted header builder
- upstream forwarder
- deny response handling

## Phase 5: RBAC and Admin APIs

Add product, tenant, role, group, and route-rule management APIs.

Deliverables:

- product registry
- workspace registry
- role assignment APIs
- gateway policy APIs
- audit events for admin changes

## Phase 6: Production hardening

Deliverables:

- structured audit logs
- rate limiting
- key rotation
- token revocation
- refresh token rotation
- health checks
- metrics
- tracing
- deployment manifests
- security test suite

## Migration principle

Do not force all products to move at once.

Support three paths:

1. Existing custom integrations continue unchanged.
2. New products use PubAuth Gateway mode.
3. Advanced teams use raw OIDC or SDK mode.

## Cutover strategy

For each product:

1. Register product and workspace in PubAuth.
2. Configure OIDC client or gateway upstream.
3. Add route-level policies.
4. Test login and deny cases.
5. Place backend behind gateway.
6. Remove direct public backend exposure.
7. Enable audit monitoring.
8. Retire old product-specific auth code only after stable operation.
