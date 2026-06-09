# Deployment Model

PubAuth should support three deployment shapes.

## 1. Central platform deployment

A centrally operated PubAuth deployment protects multiple product applications.

```text
Internet
  -> Load Balancer
  -> PubAuth Gateway
  -> Product Backends on private network
```

Best for:

- internal platforms
- shared company apps
- consistent security control
- no-code onboarding

## 2. Sidecar gateway deployment

Each product deploys a PubAuth Gateway container beside its backend.

```text
Internet
  -> Product ingress
  -> PubAuth Gateway sidecar
  -> Product backend
```

Best for:

- teams that own their own deployments
- apps with unique network constraints
- gradual adoption

## 3. Existing proxy integration

PubAuth integrates with a gateway already used by the organization.

Examples:

- NGINX
- Envoy
- Kong
- Traefik
- cloud load balancer with auth extension

Best for:

- mature infrastructure teams
- standardized ingress
- environments where another proxy is mandatory

## Production baseline

Production deployment should include:

- HTTPS termination
- private backend network
- Redis or equivalent cache for session acceleration
- durable database for clients, tenants, roles, sessions, keys, and audit metadata
- key management integration
- metrics
- tracing
- centralized logs
- rate limiting
- health checks
- backup and restore procedures

## Network rule

In no-code gateway mode, product backends must not be directly reachable from the public internet.
