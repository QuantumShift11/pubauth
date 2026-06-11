const DEFAULT_REDIRECT_PATH = '/';

export function normalizeBrokerRedirectUri(
  redirectUri: string | undefined,
  allowedAbsoluteOrigins: string[] = readAllowedBrokerRedirectOrigins(),
): string {
  const candidate = (redirectUri ?? DEFAULT_REDIRECT_PATH).trim();
  if (!candidate) {
    return DEFAULT_REDIRECT_PATH;
  }

  return normalizeRedirectCandidate(candidate, allowedAbsoluteOrigins, 0);
}

export function readAllowedBrokerRedirectOrigins(): string[] {
  return (process.env.PUBAUTH_BROKER_ALLOWED_REDIRECT_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRedirectCandidate(
  candidate: string,
  allowedAbsoluteOrigins: string[],
  decodeDepth: number,
): string {
  if (decodeDepth > 1) {
    throw new Error('invalid_redirect_uri');
  }

  const decoded = safeDecode(candidate);
  if (decoded !== candidate) {
    return normalizeRedirectCandidate(decoded, allowedAbsoluteOrigins, decodeDepth + 1);
  }

  if (candidate.startsWith('//') || candidate.startsWith('/\\')) {
    throw new Error('invalid_redirect_uri');
  }

  if (candidate.startsWith('/')) {
    return candidate;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('invalid_redirect_uri');
  }

  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !allowedAbsoluteOrigins.includes(parsed.origin)) {
    throw new Error('invalid_redirect_uri');
  }

  return parsed.toString();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
