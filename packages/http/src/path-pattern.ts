export interface NormalizedPathPattern {
  normalizedPath: string;
  segments: string[];
  recursive: boolean;
}

export function normalizeRequestPath(path: string): string | null {
  return normalizePathValue(path, false)?.normalizedPath ?? null;
}

export function matchPathPattern(pattern: string, path: string): boolean {
  const normalizedPattern = normalizePathValue(pattern, true);
  const normalizedPath = normalizePathValue(path, false);
  if (!normalizedPattern || !normalizedPath) {
    return false;
  }

  if (normalizedPattern.recursive) {
    if (normalizedPattern.segments.length === 0) {
      return true;
    }

    return normalizedPattern.segments.every((segment, index) => normalizedPath.segments[index] === segment);
  }

  if (normalizedPattern.segments.length !== normalizedPath.segments.length) {
    return false;
  }

  return normalizedPattern.segments.every((segment, index) => normalizedPath.segments[index] === segment);
}

function normalizePathValue(path: string, allowRecursiveWildcard: boolean): NormalizedPathPattern | null {
  if (!path) {
    return null;
  }

  const candidate = path.startsWith('/') ? path : `/${path}`;
  const rawPath = candidate.split('?')[0] ?? candidate;
  if (rawPath.includes('\\') || /%2f|%5c/iu.test(rawPath)) {
    return null;
  }

  const recursive = allowRecursiveWildcard && (rawPath === '/**' || rawPath.endsWith('/**'));
  const basePath = recursive && rawPath !== '/**' ? rawPath.slice(0, -3) : recursive ? '/' : rawPath;
  const rawSegments = basePath.split('/').filter(Boolean);
  const segments = rawSegments.map((segment) => decodeSegment(segment));
  if (segments.some((segment) => segment === null)) {
    return null;
  }

  const normalizedPath = `/${segments.join('/')}`;
  return {
    normalizedPath: normalizedPath === '/' ? '/' : normalizedPath.replace(/\/+/gu, '/'),
    segments: segments as string[],
    recursive,
  };
}

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    if (!decoded || decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
