# Testing Strategy

PubAuth testing must cover protocol correctness, gateway decisions, and security boundaries.

## Unit tests

Required areas:

- scope parsing
- redirect URI matching
- route rule matching
- RBAC allow and deny decisions
- session expiry checks
- discovery document generation
- token request validation

## Integration tests

Required areas:

- OIDC discovery endpoint
- authorization code lifecycle
- token endpoint behavior
- JWKS response
- UserInfo response
- logout behavior
- gateway allow and deny paths

## Security tests

Required areas:

- exact redirect URI matching
- authorization code replay rejection
- expired code rejection
- missing PKCE rejection
- invalid client rejection
- disabled product rejection
- disabled workspace rejection
- missing role denial
- missing route rule denial
- direct backend exposure assumptions
- spoofed identity header stripping

## Load and reliability tests

Required areas:

- login redirect throughput
- token endpoint rate limiting
- JWKS cache behavior
- gateway forwarding latency
- policy decision latency
- session store degradation
- identity provider timeout handling

## Regression suite

Every auth change must run protocol, RBAC, and gateway deny-case tests.

Deny cases are as important as allow cases.
