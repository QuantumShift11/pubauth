import { matchPathPattern } from './path-pattern.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  contentType?: string;
  body?: unknown;
}

export type Handler = (request: HttpRequest) => Promise<HttpResponse> | HttpResponse;

export interface Route {
  method: HttpMethod;
  path: string;
  handler: Handler;
}

export function findRoute(routes: Route[], method: HttpMethod, path: string): Route | null {
  return (
    routes.find((route) => route.method === method && route.path === path) ??
    routes.find((route) => route.method === method && routeMatches(route.path, path)) ??
    null
  );
}

function routeMatches(pattern: string, path: string): boolean {
  if (pattern === '*') {
    return true;
  }
  return matchPathPattern(pattern, path);
}
