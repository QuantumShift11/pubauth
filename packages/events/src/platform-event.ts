export interface PlatformEvent {
  type: string;
  subjectId?: string;
  workspaceId?: string;
  productId?: string;
  requestId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface EventWriter {
  write(event: PlatformEvent): Promise<void>;
}

export function createPlatformEvent(type: string, data: Record<string, unknown> = {}): PlatformEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
}
