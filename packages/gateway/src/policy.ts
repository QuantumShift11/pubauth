import { matchPathPattern, normalizeRequestPath } from '../../http/src/path-pattern.js';

export interface GatewayRouteRule {
  appId: string;
  upstreamUrl: string;
  pathPattern: string;
  methods: string[];
  requiredRoles: string[];
}

export interface GatewayRouteDecision {
  matched: boolean;
  appId?: string;
  upstreamUrl?: string;
  reason: string;
}

export function resolveGatewayRoute(
  path: string,
  method: string,
  rules: GatewayRouteRule[],
): GatewayRouteDecision {
  if (!normalizeRequestPath(path)) {
    return { matched: false, reason: 'invalid_path' };
  }

  const rule = rules.find((item) => matchPathPattern(item.pathPattern, path));

  if (!rule) {
    return { matched: false, reason: 'no_route_rule' };
  }

  if (!rule.methods.includes(method.toUpperCase())) {
    return { matched: false, reason: 'method_not_allowed' };
  }

  return { matched: true, appId: rule.appId, upstreamUrl: rule.upstreamUrl, reason: 'matched' };
}
