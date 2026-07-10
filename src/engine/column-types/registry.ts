import type { ColumnType } from "./contract";
import { textType } from "./types/text";
import { numberType } from "./types/number";
import { selectType } from "./types/select";
import { dateType } from "./types/date";
import { dateRangeType } from "./types/date-range";

/**
 * The type registry — `Map<string, ColumnType>` behind a thin guard. The engine
 * reaches into plugins through this; no plugin reaches back into the engine, and no
 * engine code branches on a concrete type name.
 */
export class TypeRegistry {
  private readonly map = new Map<string, ColumnType<unknown, unknown>>();

  register<TRaw, TParsed>(type: ColumnType<TRaw, TParsed>): this {
    this.map.set(type.name, type as unknown as ColumnType<unknown, unknown>);
    return this;
  }

  get(name: string): ColumnType<unknown, unknown> | undefined {
    return this.map.get(name);
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  /** Throws if the type is not registered — use when a missing type is a bug. */
  require(name: string): ColumnType<unknown, unknown> {
    const type = this.map.get(name);
    if (!type) throw new Error(`nqgrid: no column type registered for "${name}"`);
    return type;
  }

  names(): string[] {
    return [...this.map.keys()];
  }
}

/** The core plugins every app gets for free. Add app-specific types on top. */
export function createDefaultRegistry(): TypeRegistry {
  return new TypeRegistry()
    .register(textType)
    .register(numberType)
    .register(selectType)
    .register(dateType)
    .register(dateRangeType);
}
