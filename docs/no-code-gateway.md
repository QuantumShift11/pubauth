# No-Code Gateway Mode

No-code gateway mode means the product backend does not write PubAuth-specific login, callback, token exchange, token validation, or session validation code.

## Request flow

```text
Browser
  -> PubAuth Gateway
  -> Product Backend
```

If the user is not authenticated, PubAuth Gateway redirects the browser to PubAuth login.

After login, PubAuth Gateway validates the session and forwards the request to the product backend.

## Backend responsibility

The backend does not implement authentication.

It may optionally read trusted identity headers injected by PubAuth Gateway.

Example:

```http
X-PubAuth-User-Id: user_123
X-PubAuth-Email: user@example.com
X-PubAuth-Workspace: acme-corp
X-PubAuth-Roles: admin,editor
X-PubAuth-Groups: security,platform
```

## Critical trust boundary

The backend must only be reachable through PubAuth Gateway or a trusted internal network path.

If the backend is reachable directly from the internet, a caller could spoof identity headers.

Required controls:

- private backend network exposure
- gateway-only ingress path
- strip inbound identity headers before injecting new ones
- signed internal headers for high-security deployments
- mTLS or network policy for gateway-to-backend path where possible

## Gateway policy examples

```yaml
app: dna
workspace: acme-corp
upstream: http://dna-backend:8080
rules:
  - path: /dashboard/**
    methods: [GET]
    roles: [viewer, editor, admin]
  - path: /api/reports/**
    methods: [GET]
    roles: [viewer, editor, admin]
  - path: /api/actions/**
    methods: [POST]
    roles: [editor, admin]
  - path: /admin/**
    methods: [GET, POST, PUT, DELETE]
    roles: [admin]
```

## What gateway mode can enforce

- user is authenticated
- workspace membership
- role membership
- group membership
- route/method access
- app access
- environment access

## What gateway mode should not own alone

- object-level ownership
- record-level permission checks
- workflow-state-specific approval rules
- product-specific business authorization

These checks remain inside the product backend unless the product externalizes its data permissions to PubAuth.

## Deployment models

### Central gateway

A shared PubAuth Gateway sits in front of multiple product apps.

Best for platform-managed environments.

### Sidecar gateway

Each product runs a gateway container beside its backend.

Best where teams manage their own deployments but still want no backend auth code.

### Existing proxy integration

PubAuth can integrate with an existing gateway layer using forward-auth or OIDC plugins.

Best where Kong, NGINX, Envoy, Traefik, or another proxy is already standard.
