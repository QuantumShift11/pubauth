# Local OIDC Flow

This document describes the local bootstrap flow for the signed OIDC provider.

The implementation is file-backed in local mode and mirrors the production flow.

## Bootstrap client

The API service registers a default client:

```text
client_id: pubauth-client
redirect_uri: http://localhost:3000/callback
scopes: openid profile email groups
```

## Generate PKCE values

Example using Node.js:

```bash
node - <<'NODE'
const crypto = require('node:crypto');
const verifier = crypto.randomBytes(48).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
console.log({ verifier, challenge });
NODE
```

## Start API

```bash
npm install
npm run build
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PORT=8080 npm run start:api
```

## Discovery

```bash
curl http://localhost:8080/.well-known/openid-configuration
```

## Authorize

```bash
curl -i "http://localhost:8080/oauth2/authorize?client_id=pubauth-client&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&response_type=code&scope=openid%20profile&code_challenge=<CHALLENGE>&code_challenge_method=S256&state=abc123"
```

The response is a redirect to:

```text
http://localhost:3000/callback?code=<CODE>&state=abc123
```

## Token exchange

```bash
curl -X POST http://localhost:8080/oauth2/token \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode 'client_id=pubauth-client' \
  --data-urlencode 'redirect_uri=http://localhost:3000/callback' \
  --data-urlencode 'code=<CODE>' \
  --data-urlencode 'code_verifier=<VERIFIER>'
```

The response contains a signed access token, signed ID token, token type, expiry, and scope.

## UserInfo

```bash
curl http://localhost:8080/oauth2/userinfo \
  -H 'authorization: Bearer <ACCESS_TOKEN>'
```

The current implementation validates the signed access token and returns the subject plus trusted claims.

## Current limits

- local mode still uses the file-backed bootstrap store
- logout is intentionally minimal
- identity provider brokering is not wired yet

## Next production steps

1. Add provider adapters for Google and Entra.
2. Expand broker callback normalization and state validation.
3. Add HA-backed store adapters for Mongo and Redis deployments.
4. Extend admin APIs for remaining lifecycle operations.
