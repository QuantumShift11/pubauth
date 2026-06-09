import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { HttpMethod, HttpRequest, HttpResponse, Route } from './router.js';
import { findRoute } from './router.js';

export interface NodeServerOptions {
  port: number;
  routes: Route[];
}

export function startNodeServer(options: NodeServerOptions) {
  const server = createServer(async (incoming, outgoing) => {
    const request = toHttpRequest(incoming);
    const route = findRoute(options.routes, request.method, request.path);

    if (!route) {
      writeResponse(outgoing, { statusCode: 404, body: { error: 'not_found' } });
      return;
    }

    try {
      const response = await route.handler(request);
      writeResponse(outgoing, response);
    } catch {
      writeResponse(outgoing, { statusCode: 500, body: { error: 'internal_error' } });
    }
  });

  server.listen(options.port);
  return server;
}

function toHttpRequest(incoming: IncomingMessage): HttpRequest {
  const url = new URL(incoming.url ?? '/', 'http://localhost');
  return {
    method: (incoming.method ?? 'GET').toUpperCase() as HttpMethod,
    path: url.pathname,
    headers: Object.fromEntries(
      Object.entries(incoming.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
    ),
  };
}

function writeResponse(outgoing: ServerResponse, response: HttpResponse): void {
  outgoing.statusCode = response.statusCode;
  outgoing.setHeader('content-type', 'application/json');

  for (const [name, value] of Object.entries(response.headers ?? {})) {
    outgoing.setHeader(name, value);
  }

  outgoing.end(JSON.stringify(response.body ?? {}));
}
