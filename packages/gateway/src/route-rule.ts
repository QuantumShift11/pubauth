export interface RouteRule {
  id: string;
  appId: string;
  pathPattern: string;
  methods: string[];
  requiredRoles: string[];
  priority: number;
  state: 'active' | 'disabled';
}

export function sortRouteRules(rules: RouteRule[]): RouteRule[] {
  return [...rules].sort((left, right) => right.priority - left.priority);
}

export function isRouteRuleActive(rule: RouteRule): boolean {
  return rule.state === 'active';
}
