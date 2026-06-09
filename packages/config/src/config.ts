export interface AppConfig {
  serviceName: string;
  environment: 'local' | 'dev' | 'qa' | 'prod';
  publicIssuer: string;
  port: number;
}

export function loadConfig(serviceName: string): AppConfig {
  return {
    serviceName,
    environment: readEnvironment(process.env.PUBAUTH_ENV),
    publicIssuer: process.env.PUBAUTH_ISSUER ?? 'http://localhost:8080',
    port: Number(process.env.PORT ?? '8080'),
  };
}

function readEnvironment(value: string | undefined): AppConfig['environment'] {
  if (value === 'dev' || value === 'qa' || value === 'prod') {
    return value;
  }
  return 'local';
}
