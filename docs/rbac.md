# RBAC Model

PubAuth RBAC is split into gateway-level authorization and product-level authorization.

## Gateway-level RBAC

Gateway-level RBAC can be enforced without product backend code.

Examples:

- Can the user access this app?
- Can the user access this workspace?
- Can the user call this route?
- Can the user use this HTTP method?
- Does the user have the required role or group?

## Product-level authorization

Product-level authorization usually stays in the product backend.

Examples:

- Can the user edit this exact ticket?
- Can the user approve this exact finding?
- Can the user access this exact project?
- Can the user modify this record in its current workflow state?

## Role model

Roles should be scoped.

Recommended shape:

```json
{
  "roleId": "role_123",
  "name": "admin",
  "scope": "workspace",
  "workspaceId": "workspace_123",
  "productId": "product_123",
  "permissions": [
    "reports:read",
    "actions:create",
    "admin:manage"
  ]
}
```

## Policy decision

A policy decision should return both result and reason.

```json
{
  "allowed": false,
  "reason": "missing_required_role",
  "required": ["admin"],
  "actual": ["viewer"]
}
```

## Deny by default

If no policy matches, deny.

If workspace is missing, deny.

If role state cannot be resolved, deny.

If route rule is ambiguous, deny.

## Policy inputs

The RBAC engine should receive a normalized authorization context:

```json
{
  "subject": {
    "userId": "user_123",
    "email": "user@example.com",
    "roles": ["viewer"],
    "groups": ["security"]
  },
  "resource": {
    "productId": "product_123",
    "workspaceId": "workspace_123",
    "path": "/api/reports/summary",
    "method": "GET"
  },
  "environment": "prod"
}
```

## Future ABAC support

RBAC should not block attribute-based authorization later.

The policy engine should be designed so ABAC conditions can be added later:

- department
- location
- device posture
- risk score
- time window
- IP range
- data classification
