export interface JobContext {
  jobId: string;
  startedAt: string;
}

export interface JobResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface JobHandler {
  name: string;
  run(context: JobContext): Promise<JobResult>;
}

export class JobRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  register(handler: JobHandler): void {
    this.handlers.set(handler.name, handler);
  }

  get(name: string): JobHandler | null {
    return this.handlers.get(name) ?? null;
  }

  list(): string[] {
    return [...this.handlers.keys()].sort();
  }
}
