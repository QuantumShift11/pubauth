export interface PrincipalContext {
  userId: string;
  workspaceId: string;
  roles: string[];
  groups: string[];
}

export interface ResourceContext {
  productId: string;
  path: string;
  method: string;
}

export interface PolicyRule {
  pathPattern: string;
  methods: string[];
  requiredRoles: string[];
  requiredGroups?: string[];
}

export interface PolicyDecision {
  allowed: boolean;
  reason: 'allowed' | 'no_matching_rule' | 'method_not_allowed' | 'missing_role' | 'missing_group';
}

export function evaluatePolicy(
  principal: PrincipalContext,
  resource: ResourceContext,
  rules: PolicyRule[],
): PolicyDecision {
  const matchingRule = rules.find((rule) => pathMatches(rule.pathPattern, resource.path));

  if (!matchingRule) {
    return { allowed: false, reason: 'no_matching_rule' };
  }

  if (!matchingRule.methods.includes(resource.method.toUpperCase())) {
    return { allowed: false, reason: 'method_not_allowed' };
  }

  const hasRole = matchingRule.requiredRoles.some((role) => principal.roles.includes(role));
  if (!hasRole) {
    return { allowed: false, reason: 'missing_role' };
  }

  if (matchingRule.requiredGroups?.length) {
    const hasGroup = matchingRule.requiredGroups.some((group) => principal.groups.includes(group));
    if (!hasGroup) {
      return { allowed: false, reason: 'missing_group' };
    }
  }

  return { allowed: true, reason: 'allowed' };
}

function pathMatches(pattern: string, path: string): boolean {
  if (pattern.endsWith('/**')) {
    return path.startsWith(pattern.slice(0, -3));
  }
  return pattern === path;
}
