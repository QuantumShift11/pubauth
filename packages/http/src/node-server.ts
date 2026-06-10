import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { HttpMethod, HttpRequest, HttpResponse, Route } from './router.js';
import { findRoute } from './router.js';

export interface NodeServerOptions {
  port: number;
  routes: Route[];
}

export function startNodeServer(options: NodeServerOptions) {
  const server = createServer(async (incoming, outgoing) => {
    let request: HttpRequest;

    try {
      request = await toHttpRequest(incoming);
    } catch {
      writeResponse(outgoing, { statusCode: 400, body: { error: 'invalid_request_body' } });
      return;
    }

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

async function toHttpRequest(incoming: IncomingMessage): Promise<HttpRequest> {
  const url = new URL(incoming.url ?? '/', 'http://localhost');
  return {
    method: (incoming.method ?? 'GET').toUpperCase() as HttpMethod,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(
      Object.entries(incoming.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
    ),
    body: await readBody(incoming),
  };
}

async function readBody(incoming: IncomingMessage): Promise<unknown> {
  if (incoming.method === 'GET' || incoming.method === 'HEAD') {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of incoming) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return undefined;
  }

  const contentTypeHeader = incoming.headers['content-type'];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader.join(',') : contentTypeHeader ?? '';

  if (contentType.includes('application/json')) {
    return JSON.parse(raw);
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }

  return raw;
}

function writeResponse(outgoing: ServerResponse, response: HttpResponse): void {
  outgoing.statusCode = response.statusCode;

  for (const [name, value] of Object.entries(response.headers ?? {})) {
    outgoing.setHeader(name, value);
  }

  if (typeof response.body === 'string') {
    outgoing.setHeader('content-type', response.contentType ?? 'text/plain; charset=utf-8');
    outgoing.end(response.body);
    return;
  }

  if (Buffer.isBuffer(response.body) || response.body instanceof Uint8Array) {
    outgoing.setHeader('content-type', response.contentType ?? 'application/octet-stream');
    outgoing.end(response.body);
    return;
  }

  outgoing.setHeader('content-type', response.contentType ?? 'application/json');
  outgoing.end(JSON.stringify(response.body ?? {}));
}
