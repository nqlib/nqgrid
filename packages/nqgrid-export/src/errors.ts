/** `invalid_input` → CLI exit 2 / HTTP 400; `internal` → exit 1 / HTTP 500. */
export type PivotExportErrorCode = "invalid_input" | "payload_too_large" | "internal";

export class PivotExportError extends Error {
  readonly code: PivotExportErrorCode;
  readonly details: readonly string[];

  constructor(code: PivotExportErrorCode, message: string, details: readonly string[] = []) {
    super(message);
    this.name = "PivotExportError";
    this.code = code;
    this.details = details;
  }

  /** CLI exit code. */
  get exitCode(): 1 | 2 {
    return this.code === "internal" ? 1 : 2;
  }

  /** HTTP status for serve mode. */
  get status(): 400 | 413 | 500 {
    return this.code === "invalid_input" ? 400 : this.code === "payload_too_large" ? 413 : 500;
  }

  toJSON(): { error: { code: PivotExportErrorCode; message: string; details?: readonly string[] } } {
    return { error: { code: this.code, message: this.message, ...(this.details.length ? { details: this.details } : {}) } };
  }
}

export const invalidInput = (message: string, details: readonly string[] = []) =>
  new PivotExportError("invalid_input", message, details);

/** Wrap anything thrown into a `PivotExportError` (unknown errors are internal). */
export function toPivotExportError(error: unknown): PivotExportError {
  if (error instanceof PivotExportError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new PivotExportError("internal", message);
}
