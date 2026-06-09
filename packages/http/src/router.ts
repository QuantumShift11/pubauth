export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export type Handler = (request: HttpRequest) => Promise<HttpResponse> | HttpResponse;

export interface Route {
  method: HttpMethod;
  path: string;
  handler: Handler;
}

export function findRoute(routes: Route[], method: HttpMethod, path: string): Route | null {
  return routes.find((route) => route.method === method && route.path === path) ?? null;
}
