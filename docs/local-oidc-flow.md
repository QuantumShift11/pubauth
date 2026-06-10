# Local OIDC Flow

This document describes the current local-only development flow.

The implementation is intentionally in-memory and not production-ready yet.

## Dev client

The API service registers one in-memory client:

```text
client_id: dev-client
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
curl -i "http://localhost:8080/oauth2/authorize?client_id=dev-client&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&response_type=code&scope=openid%20profile&code_challenge=<CHALLENGE>&code_challenge_method=S256&state=abc123"
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
  --data-urlencode 'client_id=dev-client' \
  --data-urlencode 'redirect_uri=http://localhost:3000/callback' \
  --data-urlencode 'code=<CODE>' \
  --data-urlencode 'code_verifier=<VERIFIER>'
```

The response contains a development access token, ID token placeholder, refresh token placeholder, token type, expiry, and scope.

## UserInfo

```bash
curl http://localhost:8080/oauth2/userinfo \
  -H 'authorization: Bearer <ACCESS_TOKEN>'
```

The current dev implementation resolves the in-memory access token and returns the subject plus development claims.

## Current limitations

- tokens are development placeholders
- JWKS returns an empty key set
- logout is not implemented yet
- client registration is in-memory only
- storage is not durable
- identity provider brokering is not wired yet
- UserInfo works only for in-memory development tokens

## Next production steps

1. Add durable product/client/session/code/token stores.
2. Add signing key management.
3. Replace dev token placeholders with signed ID tokens and verifiable access tokens.
4. Expand UserInfo from durable identity and claim stores.
5. Add provider adapters for Google and Entra.
6. Add Admin APIs for products, workspaces, clients, and route policies.
