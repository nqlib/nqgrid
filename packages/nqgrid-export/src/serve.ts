import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { PivotExportError, invalidInput, toPivotExportError } from "./errors";
import { PIVOT_EXPORT_CONTENT_TYPES, PIVOT_EXPORT_EXTENSIONS, createPivotExporter, type PivotExporter } from "./exporter";
import { isPivotExportFormat, parsePivotExportRequest, PIVOT_EXPORT_FORMATS } from "./request";
import { NQGRID_EXPORT_VERSION } from "./version";

export interface PivotExportServerOptions {
  /** Default 8787 (`0` picks a free port). */
  readonly port?: number;
  /** Default `127.0.0.1` — put a reverse proxy or the Docker network in front to expose it. */
  readonly host?: string;
  /** Request body cap in bytes (default 10 MiB). */
  readonly maxBodyBytes?: number;
  /** Concurrent PDF renders (default 4); other requests queue. */
  readonly concurrency?: number;
  /** Launch Chromium at startup (default true). */
  readonly warm?: boolean;
  readonly exporter?: PivotExporter;
  /** One JSON line per request / event (default: none). */
  readonly log?: (line: string) => void;
}

export interface PivotExportServer {
  readonly server: Server;
  readonly url: string;
  readonly exporter: PivotExporter;
  close(): Promise<void>;
}

export const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new PivotExportError("payload_too_large", `request body exceeds ${limit} bytes`));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new PivotExportError("payload_too_large", `request body exceeds ${limit} bytes`));
        req.removeAllListeners("data");
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function semaphore(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

const sendJson = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text), ...headers });
  res.end(text);
};

/**
 * HTTP export service (plain `node:http`) keeping one Chromium warm:
 * - `GET /healthz` → `{ ok, version, browser, formats }`
 * - `POST /export?format=pdf|xlsx|html|model|sheet` with `{ spec, rows, options? }` → the file.
 * Errors are `{ error: { code, message, details? } }` with 400 / 404 / 405 / 413 / 415 / 500.
 */
export async function startPivotExportServer(options: PivotExportServerOptions = {}): Promise<PivotExportServer> {
  const exporter = options.exporter ?? createPivotExporter();
  const maxBody = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const limit = semaphore(Math.max(1, options.concurrency ?? 4));
  const log = options.log ?? (() => {});

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const started = Date.now();
    const url = new URL(req.url ?? "/", "http://localhost");
    let status = 500;
    try {
      if (url.pathname === "/healthz") {
        if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, (status = 405), { error: { code: "method_not_allowed", message: "use GET" } }, { allow: "GET, HEAD" });
        return sendJson(res, (status = 200), { ok: true, version: NQGRID_EXPORT_VERSION, browser: exporter.browserState(), formats: PIVOT_EXPORT_FORMATS });
      }
      if (url.pathname !== "/export") return sendJson(res, (status = 404), { error: { code: "not_found", message: `no route ${url.pathname}` } });
      if (req.method !== "POST") return sendJson(res, (status = 405), { error: { code: "method_not_allowed", message: "use POST" } }, { allow: "POST" });
      const type = req.headers["content-type"] ?? "application/json";
      if (!/^application\/(.+\+)?json\b/i.test(type)) {
        req.resume();
        return sendJson(res, (status = 415), { error: { code: "unsupported_media_type", message: "send application/json" } });
      }
      const body = await readBody(req, maxBody);
      let json: unknown;
      try {
        json = JSON.parse(body.toString("utf8"));
      } catch (error) {
        throw invalidInput(`request body is not valid JSON: ${(error as Error).message}`);
      }
      const queryFormat = url.searchParams.get("format");
      if (queryFormat !== null && !isPivotExportFormat(queryFormat)) throw invalidInput(`format must be one of ${PIVOT_EXPORT_FORMATS.join(", ")}`);
      const request = parsePivotExportRequest(json, queryFormat ?? undefined);
      const run = () => exporter.export(request);
      const result = request.format === "pdf" ? await limit(run) : await run();
      const bytes = typeof result === "string" ? Buffer.from(result, "utf8") : Buffer.from(result.buffer, result.byteOffset, result.byteLength);
      const name = `${(request.spec.id ?? "pivot").replace(/[^\w.-]+/g, "_")}.${PIVOT_EXPORT_EXTENSIONS[request.format]}`;
      status = 200;
      res.writeHead(200, {
        "content-type": PIVOT_EXPORT_CONTENT_TYPES[request.format],
        "content-length": bytes.length,
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      });
      res.end(bytes);
    } catch (error) {
      const e = toPivotExportError(error);
      status = e.status;
      if (!res.headersSent) sendJson(res, status, e.toJSON(), e.code === "payload_too_large" ? { connection: "close" } : {});
      else res.destroy();
      if (e.code === "internal") log(JSON.stringify({ level: "error", message: e.message }));
    } finally {
      log(JSON.stringify({ level: "info", method: req.method, path: url.pathname, format: url.searchParams.get("format"), status, ms: Date.now() - started }));
    }
  };

  const server = createServer((req, res) => {
    void handle(req, res);
  });
  server.requestTimeout = 120_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 8787, options.host ?? "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  const host = address.family === "IPv6" ? `[${address.address}]` : address.address;
  if (options.warm ?? true) {
    exporter.warm().catch((error: unknown) => log(JSON.stringify({ level: "warn", message: `Chromium not available: ${(error as Error).message}` })));
  }
  return {
    server,
    url: `http://${host}:${address.port}`,
    exporter,
    async close() {
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
      if (!options.exporter) await exporter.close();
    },
  };
}
