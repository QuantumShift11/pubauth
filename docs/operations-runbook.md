# Operations Runbook

This runbook defines the operational expectations for PubAuth.

## Health checks

Each service must expose a health response.

Required services:

- API service
- Gateway service
- Worker service

Health checks should distinguish:

- process is alive
- database is reachable
- cache is reachable
- signing key provider is reachable
- identity provider metadata is reachable when needed

## Logs

Logs must be structured JSON.

Required common fields:

- timestamp
- level
- service
- request ID
- route
- decision reason where applicable

Logs must never include:

- access tokens
- ID tokens
- refresh tokens
- client secrets
- private keys
- raw provider secrets

## Metrics

Recommended metrics:

- login attempts
- login success
- login failure
- token issuance count
- policy allow count
- policy deny count
- gateway request latency
- token endpoint latency
- provider callback latency
- JWKS response latency
- session store failures

## Tracing

Trace spans should cover:

- browser callback handling
- provider exchange
- policy evaluation
- session lookup
- token issuance
- gateway upstream forwarding

## Incident checks

When authentication is failing:

1. Check API service health.
2. Check gateway service health.
3. Check database and cache availability.
4. Check signing key availability.
5. Check client configuration.
6. Check redirect URI configuration.
7. Check identity provider availability.
8. Check policy deny logs.

When a user gets forbidden:

1. Check workspace membership.
2. Check product status.
3. Check route rule match.
4. Check required roles.
5. Check required groups.
6. Check whether the product backend is bypassing gateway assumptions.
