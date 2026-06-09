export interface GatewayRequestContext {
  appId: string;
  path: string;
  method: string;
  sessionId?: string;
}

export interface GatewayDecision {
  allowed: boolean;
  statusCode: number;
  reason: string;
  upstreamUrl?: string;
}

export function deny(statusCode: number, reason: string): GatewayDecision {
  return { allowed: false, statusCode, reason };
}

export function allow(upstreamUrl: string): GatewayDecision {
  return { allowed: true, statusCode: 200, reason: 'allowed', upstreamUrl };
}
