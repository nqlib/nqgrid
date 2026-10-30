import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPivotExporter } from "../src/exporter";
import { startPivotExportServer, type PivotExportServer } from "../src/serve";
import { chromiumAvailable, pdfPageCount, planningRows, planningSpec } from "./helpers";

let service: PivotExportServer;
const body = JSON.stringify({ spec: planningSpec, rows: planningRows, options: { generatedAt: "2026-01-15 09:30 UTC" } });
const post = (query: string, payload: string = body, headers: Record<string, string> = { "content-type": "application/json" }) =>
  fetch(`${service.url}/export${query}`, { method: "POST", body: payload, headers });

beforeAll(async () => {
  service = await startPivotExportServer({ port: 0, warm: chromiumAvailable, maxBodyBytes: 512 * 1024, exporter: createPivotExporter() });
});
afterAll(async () => {
  await service.close();
  await service.exporter.close();
});

describe("serve mode", () => {
  it("binds to 127.0.0.1 and answers GET /healthz", async () => {
    expect(service.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const res = await fetch(`${service.url}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, formats: ["pdf", "xlsx", "html", "model", "sheet"] });
  });

  it("POST /export?format=html|xlsx returns the file with type and filename", async () => {
    const html = await post("?format=html");
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(html.headers.get("content-disposition")).toBe('attachment; filename="planning-fy26.html"');
    expect(await html.text()).toContain("<title>FY26 Sales Plan</title>");
    const xlsx = await post("?format=xlsx");
    expect(xlsx.headers.get("content-type")).toContain("spreadsheetml");
    expect(Buffer.from(await xlsx.arrayBuffer()).subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("maps errors to JSON with 400 / 404 / 405 / 413 / 415", async () => {
    const bad = await post("?format=html", JSON.stringify({ spec: { version: 1 }, rows: [] }));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe("invalid_input");
    expect((await post("?format=docx")).status).toBe(400);
    expect((await post("?format=html", "{oops")).status).toBe(400);
    expect((await fetch(`${service.url}/nope`)).status).toBe(404);
    expect((await fetch(`${service.url}/export`)).status).toBe(405);
    expect((await post("?format=html", "x".repeat(600 * 1024))).status).toBe(413);
    expect((await post("?format=html", body, { "content-type": "text/plain" })).status).toBe(415);
  });

  it.skipIf(!chromiumAvailable)("POST /export?format=pdf reuses the warm browser", async () => {
    const [a, b] = await Promise.all([post("?format=pdf"), post("?format=pdf")]);
    for (const res of [a, b]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");
      const pdf = new Uint8Array(await res.arrayBuffer());
      expect(Buffer.from(pdf.subarray(0, 4)).toString("latin1")).toBe("%PDF");
      expect(pdfPageCount(pdf)).toBeGreaterThan(0);
    }
    expect(((await (await fetch(`${service.url}/healthz`)).json()) as { browser: string }).browser).toBe("ready");
  });
});
