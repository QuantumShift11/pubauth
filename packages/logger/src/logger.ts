export interface LogFields {
  requestId?: string;
  actorId?: string;
  workspaceId?: string;
  productId?: string;
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export function createLogger(serviceName: string): Logger {
  function write(level: string, message: string, fields: LogFields = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      level,
      serviceName,
      message,
      ...fields,
    };
    console.log(JSON.stringify(event));
  }

  return {
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}
