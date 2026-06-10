# Development Guide

## Prerequisites

- Node.js 22 or newer
- npm
- Docker, optional for containerized runs

## Install

```bash
npm install
```

## Typecheck

```bash
npm run typecheck
```

## Build

```bash
npm run build
```

## Run API service

```bash
npm run build
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PORT=8080 npm run start:api
```

Health check:

```bash
curl http://localhost:8080/health
```

OIDC discovery:

```bash
curl http://localhost:8080/.well-known/openid-configuration
```

## Run Gateway service

```bash
npm run build
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PORT=8081 npm run start:gateway
```

Health check:

```bash
curl http://localhost:8081/health
```

## Run Worker service

```bash
npm run build
PUBAUTH_ENV=local PUBAUTH_ISSUER=http://localhost:8080 PORT=8082 npm run start:worker
```

## Docker Compose

```bash
docker compose up --build
```

Services:

- API: http://localhost:8080
- Gateway: http://localhost:8081
- Worker: background process

## Current implementation status

This repository has the modular skeleton and protocol contracts.

The core OIDC, admin, and control-plane endpoints are wired. Some lower-level repository adapters remain scaffolding for future external database integration.
