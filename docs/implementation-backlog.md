# Implementation Backlog

## Epic 1: Repository foundation

- [ ] Add TypeScript workspace
- [ ] Add strict compiler settings
- [ ] Add linting and formatting
- [ ] Add Docker development baseline
- [ ] Add CI pipeline
- [ ] Add environment example

## Epic 2: Shared platform modules

- [ ] Config module
- [ ] Logger module
- [ ] HTTP error model
- [ ] Request context model
- [ ] Domain contracts
- [ ] Repository interfaces

## Epic 3: OIDC Provider

- [ ] Discovery endpoint
- [ ] JWKS endpoint
- [ ] Authorization endpoint
- [ ] Token endpoint
- [ ] UserInfo endpoint
- [ ] Logout endpoint
- [ ] Client authentication
- [ ] Authorization code lifecycle
- [ ] Token service
- [ ] Signing key service

## Epic 4: Identity broker

- [ ] Provider adapter contract
- [ ] Google adapter
- [ ] Entra adapter
- [ ] External identity normalization
- [ ] Account linking
- [ ] Provider callback security checks

## Epic 5: Gateway

- [ ] Gateway route config
- [ ] Session validation
- [ ] RBAC enforcement
- [ ] Trusted header injection
- [ ] Upstream forwarding
- [ ] Header spoofing protection
- [ ] Deny response model

## Epic 6: RBAC

- [ ] Role model
- [ ] Permission model
- [ ] Route rule model
- [ ] Policy decision engine
- [ ] Deny reason taxonomy
- [ ] ABAC-ready context model

## Epic 7: Admin API

- [ ] Product management APIs
- [ ] Workspace management APIs
- [ ] OIDC client management APIs
- [ ] Gateway policy management APIs
- [ ] Role assignment APIs
- [ ] Secret rotation APIs

## Epic 8: Production hardening

- [ ] Rate limiting
- [ ] Audit logging
- [ ] Metrics
- [ ] OpenTelemetry tracing
- [ ] Key rotation
- [ ] Token revocation
- [ ] Security test cases
- [ ] Deployment manifests
