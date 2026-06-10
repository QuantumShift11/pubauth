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
  const rule = rules.find((item) => pathMatches(item.pathPattern, path));

  if (!rule) {
    return { matched: false, reason: 'no_route_rule' };
  }

  if (!rule.methods.includes(method.toUpperCase())) {
    return { matched: false, reason: 'method_not_allowed' };
  }

  return { matched: true, appId: rule.appId, upstreamUrl: rule.upstreamUrl, reason: 'matched' };
}

function pathMatches(pattern: string, path: string): boolean {
  if (pattern.endsWith('/**')) {
    return path.startsWith(pattern.slice(0, -3));
  }
  return pattern === path;
}
