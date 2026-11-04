import type { ColumnType, SelectOption } from "../contract";
import { typeError } from "../contract";

function findOption(
  id: unknown,
  options: readonly SelectOption[] | undefined,
): SelectOption | undefined {
  if (!options) return undefined;
  // Compare loosely on string form so a numeric id stored as "2" still matches 2.
  const key = String(id);
  return options.find((o) => String(o.id) === key);
}

/**
 * select / status — the canonical type that breaks naive models.
 *  - the cell stores the option **id**, never the label
 *  - format does an id → label table lookup
 *  - style is the color carried by the option (defined once)
 *  - compareKey returns the option **order** → sorts/groups by workflow order,
 *    never alphabetically. Board columns use this same order.
 */
export const selectType: ColumnType<unknown, SelectOption> = {
  name: "select",
  parse(raw, schema) {
    const opt = findOption(raw, schema.options);
    return opt ?? typeError(`unknown option: ${String(raw)}`, raw);
  },
  format(parsed) {
    return parsed.label;
  },
  style(parsed) {
    // The option carries a single accent color. Emit it as the fill + border
    // only; foreground text is left to the consumer, which alone knows the
    // contrast rules for its rendered background. Setting chipColor equal to
    // chipBackground here would paint same-color text on same-color fill.
    return parsed.color
      ? { chipBackground: parsed.color, chipBorder: parsed.color }
      : {};
  },
  compareKey(parsed) {
    return parsed.order;
  },
  editor(schema) {
    return { control: "select", options: schema.options };
  },
};
