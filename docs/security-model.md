# Security Model

PubAuth is security infrastructure. The default posture must be deny-by-default and fail-closed.

## Trust boundaries

### Browser to PubAuth

Untrusted public traffic.

Controls:

- HTTPS only outside local development
- secure cookies in production
- CSRF protection for browser state-changing flows
- authorization code flow with PKCE
- exact redirect URI matching

### PubAuth Gateway to product backend

Trusted internal path only.

Controls:

- backend is not publicly reachable
- gateway strips caller-supplied PubAuth headers
- gateway injects fresh identity context after validation
- network policy or mTLS should protect the internal hop where possible

### PubAuth to identity provider

Outbound integration boundary.

Controls:

- provider state validation
- nonce validation where applicable
- provider token validation
- account linking rules
- provider secret encryption

## Default deny rules

Deny when:

- no session exists
- session is expired
- session is revoked
- workspace cannot be resolved
- product is disabled
- client is disabled
- route rule is missing
- role requirement is not met
- group requirement is not met
- redirect URI does not exactly match

## Secrets

Secrets must not be stored in source control.

Secret categories:

- client secrets
- signing private keys
- provider credentials
- database credentials
- cookie signing keys

All long-lived secrets should support rotation.

## Audit events

Audit should capture:

- login start
- login success
- login failure
- token issuance
- policy allow
- policy deny
- client secret rotation
- route policy changes
- role assignment changes

Audit logs must avoid raw tokens and secrets.
