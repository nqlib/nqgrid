import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";

import { PivotExportError, invalidInput, toPivotExportError } from "./errors";
import { createPivotExporter } from "./exporter";
import { isPivotExportFormat, parsePivotExportRequest, PIVOT_EXPORT_FORMATS, type PivotExportFormat } from "./request";
import { DEFAULT_MAX_BODY_BYTES, startPivotExportServer } from "./serve";
import { NQGRID_EXPORT_VERSION } from "./version";

export interface CliIo {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
  /** Serve mode resolves when this signal aborts (default: SIGINT / SIGTERM). */
  readonly signal?: AbortSignal;
}

export const CLI_USAGE = `nqgrid-export ${NQGRID_EXPORT_VERSION} — export nqgrid pivots to PDF, XLSX or HTML

Usage
  nqgrid-export --input <request.json|-> --format <pdf|xlsx|html|model|sheet> [--out <file|->]
  nqgrid-export --spec <spec.json> --rows <rows.json> [--options <options.json>] --format <…> [--out <file|->]
  nqgrid-export serve [--port 8787] [--host 127.0.0.1] [--max-body-mb 10] [--concurrency 4]

Request JSON: { "spec": PivotSpec, "rows": [ … ], "options"?: { theme, page, title, generatedAt, … } }

Options (override request.options)
  --theme light|dark        --page-size A4|A3|Letter|Legal|Tabloid   --orientation landscape|portrait
  --title <text>            --generated-at <text>                     --max-columns <n>
  --format defaults to the --out extension (.pdf, .xlsx, .html). --out defaults to stdout.

Exit codes: 0 ok · 2 invalid input (JSON error on stderr) · 1 internal error`;

const readText = async (path: string, io: CliIo, what: string): Promise<string> => {
  if (path === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of io.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
    return Buffer.concat(chunks).toString("utf8");
  }
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw invalidInput(`cannot read ${what} ${path}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}`);
  }
};

const readJson = async (path: string, io: CliIo, what: string): Promise<unknown> => {
  const text = await readText(path, io, what);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw invalidInput(`${what} ${path === "-" ? "(stdin)" : path} is not valid JSON: ${(error as Error).message}`);
  }
};

const write = (stream: NodeJS.WritableStream, data: string | Uint8Array) =>
  new Promise<void>((resolve, reject) => {
    stream.write(data, (error?: Error | null) => (error ? reject(error) : resolve()));
  });

const reportError = async (io: CliIo, error: unknown): Promise<number> => {
  const e = toPivotExportError(error);
  await write(io.stderr, `${JSON.stringify(e.toJSON())}\n`);
  return e.exitCode;
};

/** `parseArgs` with usage errors reported as invalid input (exit 2). */
function parseCliArgs<const T extends ParseArgsConfig>(config: T): ReturnType<typeof parseArgs<T>> {
  try {
    return parseArgs(config);
  } catch (error) {
    throw invalidInput((error as Error).message);
  }
}

async function runServe(args: string[], io: CliIo): Promise<number> {
  const { values } = parseCliArgs({
    args,
    options: {
      port: { type: "string", default: "8787" },
      host: { type: "string", default: "127.0.0.1" },
      "max-body-mb": { type: "string" },
      concurrency: { type: "string" },
      "no-warm": { type: "boolean" },
    },
    strict: true,
  });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw invalidInput("--port must be an integer 0–65535");
  const maxBodyBytes = values["max-body-mb"] === undefined ? DEFAULT_MAX_BODY_BYTES : Math.round(Number(values["max-body-mb"]) * 1024 * 1024);
  if (!(maxBodyBytes > 0)) throw invalidInput("--max-body-mb must be a positive number");
  const concurrency = values.concurrency === undefined ? undefined : Number(values.concurrency);
  if (concurrency !== undefined && !(Number.isInteger(concurrency) && concurrency > 0)) throw invalidInput("--concurrency must be a positive integer");

  const log = (line: string) => void write(io.stderr, `${line}\n`);
  const service = await startPivotExportServer({ port, host: values.host, maxBodyBytes, concurrency, warm: !values["no-warm"], log });
  log(JSON.stringify({ level: "info", message: `nqgrid-export listening on ${service.url}`, url: service.url }));

  const signal = io.signal ?? signalFromProcess();
  await new Promise<void>((resolve) => (signal.aborted ? resolve() : signal.addEventListener("abort", () => resolve(), { once: true })));
  await service.close();
  return 0;
}

function signalFromProcess(): AbortSignal {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return controller.signal;
}

async function runExport(args: string[], io: CliIo): Promise<number> {
  const parsed = parseCliArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      spec: { type: "string" },
      rows: { type: "string" },
      options: { type: "string" },
      format: { type: "string", short: "f" },
      out: { type: "string", short: "o", default: "-" },
      theme: { type: "string" },
      "page-size": { type: "string" },
      orientation: { type: "string" },
      title: { type: "string" },
      "generated-at": { type: "string" },
      "max-columns": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const v = parsed.values;
  if (v.input && (v.spec || v.rows)) throw invalidInput("use either --input or --spec/--rows");
  if (!v.input && !(v.spec && v.rows)) throw invalidInput("missing input: pass --input <file|-> or --spec <file> --rows <file>");

  const outExt = v.out && v.out !== "-" ? extname(v.out).slice(1).toLowerCase() : "";
  const format: unknown = v.format ?? (isPivotExportFormat(outExt) ? outExt : undefined);
  if (format === undefined) throw invalidInput(`missing --format (${PIVOT_EXPORT_FORMATS.join(" | ")})`);
  if (!isPivotExportFormat(format)) throw invalidInput(`--format must be one of ${PIVOT_EXPORT_FORMATS.join(", ")} (got "${String(format)}")`);

  const request: Record<string, unknown> = v.input
    ? ((await readJson(v.input, io, "--input")) as Record<string, unknown>)
    : {
        spec: await readJson(v.spec!, io, "--spec"),
        rows: await readJson(v.rows!, io, "--rows"),
        ...(v.options ? { options: await readJson(v.options, io, "--options") } : {}),
      };
  if (typeof request !== "object" || request === null || Array.isArray(request)) throw invalidInput("request must be a JSON object { spec, rows, options? }");

  const base = request.options;
  const overrides: Record<string, unknown> = {};
  if (v.theme !== undefined) overrides.theme = v.theme;
  if (v.title !== undefined) overrides.title = v.title;
  if (v["generated-at"] !== undefined) overrides.generatedAt = v["generated-at"];
  if (v["max-columns"] !== undefined) overrides.maxColumnsPerPage = Number(v["max-columns"]);
  if (v["page-size"] !== undefined || v.orientation !== undefined) {
    const page = typeof base === "object" && base !== null && "page" in base ? (base as { page?: object }).page : undefined;
    overrides.page = { ...page, ...(v["page-size"] ? { size: v["page-size"] } : {}), ...(v.orientation ? { orientation: v.orientation } : {}) };
  }
  const merged = Object.keys(overrides).length
    ? { ...request, options: { ...(typeof base === "object" && base !== null ? base : {}), ...overrides } }
    : request;

  const req = parsePivotExportRequest(merged, format as PivotExportFormat);
  const exporter = createPivotExporter();
  let result: string | Uint8Array;
  try {
    result = await exporter.export(req);
  } finally {
    await exporter.close();
  }
  try {
    if (v.out === "-" || v.out === undefined) await write(io.stdout, result);
    else await writeFile(v.out, result);
  } catch (error) {
    throw new PivotExportError("internal", `cannot write ${v.out}: ${(error as Error).message}`);
  }
  return 0;
}

/** CLI entry: resolves with the exit code (never throws). */
export async function main(argv: readonly string[], io: CliIo): Promise<number> {
  const args = [...argv];
  try {
    if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
      await write(io.stdout, `${CLI_USAGE}\n`);
      return 0;
    }
    if (args[0] === "--version" || args[0] === "-v") {
      await write(io.stdout, `${NQGRID_EXPORT_VERSION}\n`);
      return 0;
    }
    if (args[0] === "serve") return await runServe(args.slice(1), io);
    if (args[0] === "export") args.shift();
    if (args.length === 0) {
      await write(io.stderr, `${CLI_USAGE}\n`);
      return 2;
    }
    return await runExport(args, io);
  } catch (error) {
    return reportError(io, error);
  }
}
