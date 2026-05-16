import { useEffect, useState } from "react";
import type { RichNumberStyle, RichPillVariant } from "@nqlib/nqgrid";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nqlib/nqui";
import type { LabColumn, LabStatusChoice } from "./rich-grid-lab-types";
import { DEFAULT_LAB_PEOPLE_ROSTER, kindLabel, labNumberStyle, slugStatusKey } from "./rich-grid-lab-types";

type Props = {
  readonly open: boolean;
  readonly column: LabColumn | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (column: LabColumn) => void;
};

function cloneColumn(c: LabColumn): LabColumn {
  return {
    ...c,
    numberFormat: c.numberFormat ? { ...c.numberFormat } : undefined,
    statusChoices: c.statusChoices ? c.statusChoices.map((x) => ({ ...x })) : undefined,
    statusMap: c.statusMap ? { ...c.statusMap } : undefined,
    peopleOptions: c.peopleOptions ? c.peopleOptions.map((p) => ({ ...p })) : undefined,
  };
}

const PILL_VARIANTS: readonly RichPillVariant[] = ["outline", "default", "secondary", "destructive"];

function isHex6(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s.trim());
}

function colorWellValue(v: string | undefined): string {
  return v && isHex6(v) ? v.trim() : "#888888";
}

export function RichGridLabColumnSheet({ open, column, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState<LabColumn | null>(null);

  useEffect(() => {
    if (open && column) {
      setDraft(cloneColumn(column));
    }
    if (!open) {
      setDraft(null);
    }
  }, [open, column]);

  if (!draft) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md" />
      </Sheet>
    );
  }

  const patch = (partial: Partial<LabColumn>) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const patchNumber = (partial: NonNullable<LabColumn["numberFormat"]>) => {
    setDraft((prev) =>
      prev ? { ...prev, numberFormat: { ...prev.numberFormat, ...partial } } : prev,
    );
  };

  const numberStyle = draft.kind === "number" ? labNumberStyle(draft) : "decimal";

  const setNumberStyle = (style: RichNumberStyle) => {
    setDraft((prev) => {
      if (!prev || prev.kind !== "number") return prev;
      const base = { ...prev.numberFormat, style };
      if (style === "currency") {
        return {
          ...prev,
          numberFormat: {
            ...base,
            currency: prev.numberFormat?.currency ?? "USD",
            prefix: undefined,
          },
        };
      }
      if (style === "percent") {
        return {
          ...prev,
          numberFormat: {
            ...base,
            percentDisplay: prev.numberFormat?.percentDisplay ?? "plain",
            valueScale: prev.numberFormat?.valueScale ?? "hundred",
            suffix: prev.numberFormat?.suffix ?? "%",
            prefix: undefined,
            currency: undefined,
          },
        };
      }
      return {
        ...prev,
        numberFormat: {
          ...base,
          currency: undefined,
          percentDisplay: undefined,
          valueScale: undefined,
        },
      };
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-4 text-left">
          <SheetTitle className="text-base">Configure column</SheetTitle>
          <p className="text-sm font-normal text-muted-foreground">
            {kindLabel(draft.kind)} · changes apply when you save (avoids table freeze while editing).
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="col-name">Header label</Label>
              <Input
                id="col-name"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="col-width">Width (px)</Label>
              <Input
                id="col-width"
                type="number"
                min={72}
                max={480}
                value={draft.width}
                onChange={(e) => patch({ width: Number(e.target.value) || 120 })}
              />
            </div>

            {draft.kind === "number" && (
              <div className="space-y-2">
                <Label>Align</Label>
                <Select
                  value={draft.align ?? "right"}
                  onValueChange={(v) => patch({ align: v as "left" | "right" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.kind === "number" && (
              <div className="space-y-3 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Number format</p>
                <div className="space-y-2">
                  <Label>Style</Label>
                  <Select value={numberStyle} onValueChange={(v) => setNumberStyle(v as RichNumberStyle)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="decimal">Decimal (prefix / suffix / notation)</SelectItem>
                      <SelectItem value="currency">Currency (Intl)</SelectItem>
                      <SelectItem value="percent">Percent (plain or battery)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {numberStyle === "decimal" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="num-prefix">Prefix</Label>
                      <Input
                        id="num-prefix"
                        placeholder="$"
                        value={draft.numberFormat?.prefix ?? ""}
                        onChange={(e) => patchNumber({ prefix: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="num-suffix">Suffix</Label>
                      <Input
                        id="num-suffix"
                        placeholder=" h"
                        value={draft.numberFormat?.suffix ?? ""}
                        onChange={(e) => patchNumber({ suffix: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="num-min">Min fraction digits</Label>
                      <Input
                        id="num-min"
                        type="number"
                        min={0}
                        max={20}
                        value={draft.numberFormat?.minimumFractionDigits ?? ""}
                        onChange={(e) =>
                          patchNumber({
                            minimumFractionDigits:
                              e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="num-max">Max fraction digits</Label>
                      <Input
                        id="num-max"
                        type="number"
                        min={0}
                        max={20}
                        value={draft.numberFormat?.maximumFractionDigits ?? ""}
                        onChange={(e) =>
                          patchNumber({
                            maximumFractionDigits:
                              e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Notation</Label>
                      <Select
                        value={draft.numberFormat?.notation ?? "standard"}
                        onValueChange={(v) =>
                          patchNumber({
                            notation: v === "standard" ? undefined : (v as "compact" | "scientific"),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">standard</SelectItem>
                          <SelectItem value="compact">compact</SelectItem>
                          <SelectItem value="scientific">scientific</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {draft.numberFormat?.notation === "compact" && (
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Compact display</Label>
                        <Select
                          value={draft.numberFormat?.compactDisplay ?? "short"}
                          onValueChange={(v) => patchNumber({ compactDisplay: v as "short" | "long" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">short</SelectItem>
                            <SelectItem value="long">long</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {numberStyle === "currency" && (
                  <div className="space-y-2">
                    <Label htmlFor="currency-code">Currency code</Label>
                    <Input
                      id="currency-code"
                      value={draft.numberFormat?.currency ?? "USD"}
                      onChange={(e) => patchNumber({ currency: e.target.value.toUpperCase() })}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="cur-min">Min fraction digits</Label>
                        <Input
                          id="cur-min"
                          type="number"
                          min={0}
                          max={20}
                          value={draft.numberFormat?.minimumFractionDigits ?? ""}
                          onChange={(e) =>
                            patchNumber({
                              minimumFractionDigits:
                                e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cur-max">Max fraction digits</Label>
                        <Input
                          id="cur-max"
                          type="number"
                          min={0}
                          max={20}
                          value={draft.numberFormat?.maximumFractionDigits ?? ""}
                          onChange={(e) =>
                            patchNumber({
                              maximumFractionDigits:
                                e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {numberStyle === "percent" && (
                  <>
                    <div className="space-y-2">
                      <Label>Display</Label>
                      <Select
                        value={draft.numberFormat?.percentDisplay ?? "plain"}
                        onValueChange={(v) => patchNumber({ percentDisplay: v as "plain" | "battery" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plain">Plain text</SelectItem>
                          <SelectItem value="battery">Battery bar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Value scale</Label>
                      <Select
                        value={draft.numberFormat?.valueScale ?? "hundred"}
                        onValueChange={(v) => patchNumber({ valueScale: v as "hundred" | "ratio" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hundred">0–100</SelectItem>
                          <SelectItem value="ratio">0–1 ratio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}

            {draft.kind === "people" && (
              <div className="space-y-3 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">People column</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={draft.peopleEditable === true}
                    onChange={(e) => patch({ peopleEditable: e.target.checked ? true : false })}
                  />
                  Combobox picker (nqui in Number formats table)
                </label>
                <div className="space-y-2">
                  <Label htmlFor="people-max">Max people</Label>
                  <Input
                    id="people-max"
                    type="number"
                    min={1}
                    max={12}
                    value={draft.peopleMax ?? 4}
                    onChange={(e) => patch({ peopleMax: Number(e.target.value) || 4 })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Roster is shared demo leads ({DEFAULT_LAB_PEOPLE_ROSTER.length} people). Styling lives in the playground
                  via <span className="font-mono">PlaygroundPeopleComboboxCell</span>.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => patch({ peopleOptions: [...DEFAULT_LAB_PEOPLE_ROSTER] })}
                >
                  Reset roster to defaults
                </Button>
              </div>
            )}

            {draft.kind === "date" && (
              <div className="space-y-2">
                <Label>Date preset</Label>
                <Select
                  value={draft.datePreset ?? "dateShort"}
                  onValueChange={(v) =>
                    patch({ datePreset: v as NonNullable<LabColumn["datePreset"]> })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dateShort">dateShort</SelectItem>
                    <SelectItem value="dateMedium">dateMedium</SelectItem>
                    <SelectItem value="datetimeShort">datetimeShort</SelectItem>
                    <SelectItem value="timeShort">timeShort</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.kind === "status" && (
              <div className="space-y-3 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status choices</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={draft.statusEditable !== false}
                    onChange={(e) => patch({ statusEditable: e.target.checked })}
                  />
                  Dropdown in cell (user can change status)
                </label>
                <ul className="space-y-3">
                  {(draft.statusChoices ?? []).map((choice, index) => (
                    <li
                      key={`${choice.key}-${index}`}
                      className="grid gap-2 rounded-md border border-border/50 bg-muted/20 p-2 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={choice.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            setDraft((prev) => {
                              if (!prev?.statusChoices) return prev;
                              const next = [...prev.statusChoices];
                              next[index] = { ...next[index]!, label };
                              return { ...prev, statusChoices: next };
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Key</Label>
                        <Input
                          value={choice.key}
                          className="font-mono text-xs"
                          onChange={(e) => {
                            const key = e.target.value.trim();
                            setDraft((prev) => {
                              if (!prev?.statusChoices) return prev;
                              const next = [...prev.statusChoices];
                              next[index] = { ...next[index]!, key };
                              return { ...prev, statusChoices: next };
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Style</Label>
                        <Select
                          value={choice.variant ?? "outline"}
                          onValueChange={(v) => {
                            setDraft((prev) => {
                              if (!prev?.statusChoices) return prev;
                              const next = [...prev.statusChoices];
                              next[index] = { ...next[index]!, variant: v as RichPillVariant };
                              return { ...prev, statusChoices: next };
                            });
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PILL_VARIANTS.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground sm:col-span-3">
                        Optional CSS colors override the preset style. Leave blank to use the variant defaults.
                      </p>
                      <div className="space-y-1 sm:col-span-3">
                        <Label className="text-xs">Text color</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="#64748b or oklch(0.5 0.1 250)"
                            className="min-w-0 flex-1 font-mono text-xs"
                            value={choice.color ?? ""}
                            onChange={(e) => {
                              const color = e.target.value;
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                next[index] = { ...next[index]!, color: color || undefined };
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          />
                          <input
                            type="color"
                            aria-label="Pick text color"
                            className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border"
                            value={colorWellValue(choice.color)}
                            onChange={(e) => {
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                next[index] = { ...next[index]!, color: e.target.value };
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-2"
                            onClick={() => {
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                const { color: _c, ...rest } = next[index]!;
                                next[index] = rest;
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <Label className="text-xs">Background</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="#e0f2fe"
                            className="min-w-0 flex-1 font-mono text-xs"
                            value={choice.backgroundColor ?? ""}
                            onChange={(e) => {
                              const backgroundColor = e.target.value;
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                next[index] = { ...next[index]!, backgroundColor: backgroundColor || undefined };
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          />
                          <input
                            type="color"
                            aria-label="Pick background color"
                            className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border"
                            value={colorWellValue(choice.backgroundColor)}
                            onChange={(e) => {
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                next[index] = { ...next[index]!, backgroundColor: e.target.value };
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-2"
                            onClick={() => {
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                const { backgroundColor: _b, ...rest } = next[index]!;
                                next[index] = rest;
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <Label className="text-xs">Border</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="#94a3b8"
                            className="min-w-0 flex-1 font-mono text-xs"
                            value={choice.borderColor ?? ""}
                            onChange={(e) => {
                              const borderColor = e.target.value;
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                next[index] = { ...next[index]!, borderColor: borderColor || undefined };
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          />
                          <input
                            type="color"
                            aria-label="Pick border color"
                            className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border"
                            value={colorWellValue(choice.borderColor)}
                            onChange={(e) => {
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                next[index] = { ...next[index]!, borderColor: e.target.value };
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-2"
                            onClick={() => {
                              setDraft((prev) => {
                                if (!prev?.statusChoices) return prev;
                                const next = [...prev.statusChoices];
                                const { borderColor: _b, ...rest } = next[index]!;
                                next[index] = rest;
                                return { ...prev, statusChoices: next };
                              });
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-end sm:col-span-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={(draft.statusChoices?.length ?? 0) <= 1}
                          onClick={() => {
                            setDraft((prev) => {
                              if (!prev?.statusChoices || prev.statusChoices.length <= 1) return prev;
                              const next = prev.statusChoices.filter((_, i) => i !== index);
                              return { ...prev, statusChoices: next };
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft((prev) => {
                      const existing = prev?.statusChoices ?? [];
                      const label = "New status";
                      const key = slugStatusKey(
                        label,
                        existing.map((c) => c.key),
                      );
                      const next: LabStatusChoice = { key, label, variant: "outline" };
                      return { ...prev!, statusChoices: [...existing, next] };
                    });
                  }}
                >
                  Add choice
                </Button>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t border-border/60 px-6 py-4 sm:flex-row sm:justify-end sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save column
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
