# OIDC Provider Plan

PubAuth should expose a standard OIDC Provider interface so product teams do not integrate with custom authentication APIs.

## Required endpoints

```text
GET  /.well-known/openid-configuration
GET  /oauth2/authorize
POST /oauth2/token
GET  /oauth2/jwks
GET  /oauth2/userinfo
GET  /oauth2/logout
POST /oauth2/logout
```

## Required flows

### Authorization Code + PKCE

Default flow for browser-based login.

Required checks:

- exact redirect URI match
- client is active
- requested scopes are allowed
- workspace or tenant context is valid
- PKCE verifier matches challenge
- authorization code is single use
- authorization code expires quickly

### Client credentials

Optional future flow for machine-to-machine service authentication.

This should be introduced separately from user login.

## Tokens

Initial token model:

- ID token: JWT signed by PubAuth
- Access token: JWT or opaque token depending on resource server strategy
- Refresh token: opaque, stored hashed, rotatable

## Claims

Recommended core claims:

```json
{
  "iss": "https://auth.example.com",
  "sub": "user_123",
  "aud": "client_123",
  "email": "user@example.com",
  "email_verified": true,
  "workspace": "acme-corp",
  "roles": ["viewer", "admin"],
  "groups": ["security", "platform"],
  "iat": 1710000000,
  "exp": 1710003600
}
```

## Discovery document

The discovery endpoint allows clients and SDKs to configure themselves from the issuer URL.

Minimum metadata:

- issuer
- authorization_endpoint
- token_endpoint
- jwks_uri
- userinfo_endpoint
- end_session_endpoint
- response_types_supported
- grant_types_supported
- scopes_supported
- claims_supported
- token_endpoint_auth_methods_supported
- code_challenge_methods_supported

## JWKS

JWKS must expose public signing keys only.

Key rotation should support:

- active signing key
- previous verification keys
- key ID in JWT header
- safe overlap window
- emergency key disablement

## Client model

Each product integration should have an OIDC client.

Client fields:

- client ID
- client secret hash for confidential clients
- allowed redirect URIs
- allowed logout redirect URIs
- allowed scopes
- allowed workspaces
- integration mode
- environment
- status

## Security requirements

- deny by default
- exact redirect URI match
- no wildcard production redirects
- no secrets in frontend clients
- no implicit flow
- no password grant
- short authorization code TTL
- one-time authorization code use
- hashed refresh tokens
- structured audit logs for token events
