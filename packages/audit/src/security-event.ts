export type SecurityEventType =
  | 'login_started'
  | 'login_completed'
  | 'login_failed'
  | 'token_issued'
  | 'policy_allowed'
  | 'policy_denied'
  | 'admin_config_changed'
  | 'client_secret_rotated';

export interface SecurityEvent {
  eventType: SecurityEventType;
  actorId?: string;
  workspaceId?: string;
  productId?: string;
  requestId?: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface SecurityEventSink {
  write(event: SecurityEvent): Promise<void>;
}

export function createSecurityEvent(
  eventType: SecurityEventType,
  metadata: Record<string, unknown> = {},
): SecurityEvent {
  return {
    eventType,
    occurredAt: new Date().toISOString(),
    metadata,
  };
}
