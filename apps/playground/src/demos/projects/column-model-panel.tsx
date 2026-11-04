/**
 * Linear / Jira-style project field model — one editor per column, full type catalog,
 * engine capability matrix with "Coming soon" for gaps.
 */
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  KanbanIcon,
} from "@hugeicons/core-free-icons";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  cn,
} from "@nqlib/nqui";
import type { SelectOption } from "@nqlib/nqgrid/engine";
import {
  COLUMN_TYPE_CATALOG,
  ENGINE_CAPABILITIES,
  catalogEntry,
  type ColumnTypeCatalogEntry,
} from "./column-model-catalog";
import {
  changeColumnType,
  createColumnModel,
  moveColumnModel,
  removeColumnModel,
  setBoardGroup,
  updateSelectOptions,
  type PmColumnModel,
} from "./pm-column-model";
import { normalizeStatusOrders } from "./pm-schema";

function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-4 px-1.5 text-[9px] font-medium uppercase", className)}>
      Coming soon
    </Badge>
  );
}

function CapabilityRow({
  label,
  description,
  ready,
  applies,
}: {
  label: string;
  description: string;
  ready: boolean;
  applies: boolean;
}) {
  if (!applies) return null;
  return (
    <li className="flex items-start justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="font-mono text-[11px]">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      {ready ? (
        <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px]">
          Engine
        </Badge>
      ) : (
        <ComingSoonBadge />
      )}
    </li>
  );
}

function SelectOptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}) {
  const update = (index: number, patch: Partial<SelectOption>) => {
    onChange(normalizeStatusOrders(options.map((o, i) => (i === index ? { ...o, ...patch } : o))));
  };

  const add = () => {
    let n = options.length + 1;
    let id = `opt_${n}`;
    while (options.some((o) => String(o.id) === id)) {
      n += 1;
      id = `opt_${n}`;
    }
    onChange(
      normalizeStatusOrders([
        ...options,
        { id, label: `Option ${options.length + 1}`, order: options.length, color: "#64748b" },
      ]),
    );
  };

  const remove = (index: number) => {
    if (options.length <= 1) return;
    onChange(normalizeStatusOrders(options.filter((_, i) => i !== index)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Options</Label>
        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={add}>
          Add option
        </Button>
      </div>
      <ul className="space-y-2">
        {options.map((opt, index) => (
          <li key={String(opt.id)} className="space-y-1.5 rounded border border-border p-2">
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={opt.color ?? "#94a3b8"}
                onChange={(e) => update(index, { color: e.target.value })}
                className="size-6 shrink-0 cursor-pointer rounded border border-border"
                aria-label={`Color for ${opt.label}`}
              />
              <Input
                value={opt.label}
                onChange={(e) => update(index, { label: e.target.value })}
                className="h-7 flex-1 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                disabled={options.length <= 1}
                onClick={() => remove(index)}
                aria-label={`Remove ${opt.label}`}
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">id: {String(opt.id)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NumberFormatEditor({
  model,
  onChange,
}: {
  model: PmColumnModel;
  onChange: (patch: Partial<PmColumnModel>) => void;
}) {
  const format = (model.format ?? {}) as Record<string, unknown>;
  const style = (format.style as string) ?? "decimal";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Number style</Label>
        <Select
          value={style}
          onValueChange={(v) =>
            onChange({
              format: {
                ...format,
                style: v,
                ...(v === "currency" ? { currency: format.currency ?? "USD" } : {}),
                ...(v === "percent" ? { valueScale: format.valueScale ?? "hundred" } : {}),
              },
            })
          }
        >
          <SelectTrigger size="sm" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="decimal" className="text-xs">
              Decimal
            </SelectItem>
            <SelectItem value="currency" className="text-xs">
              Currency
            </SelectItem>
            <SelectItem value="percent" className="text-xs">
              Percent
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {style === "currency" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Currency code</Label>
          <Input
            value={String(format.currency ?? "USD")}
            onChange={(e) => onChange({ format: { ...format, currency: e.target.value } })}
            className="h-8 text-xs"
          />
        </div>
      ) : null}
      {style === "decimal" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Prefix</Label>
            <Input
              value={String(format.prefix ?? "")}
              onChange={(e) => onChange({ format: { ...format, prefix: e.target.value } })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Suffix</Label>
            <Input
              value={String(format.suffix ?? "")}
              onChange={(e) => onChange({ format: { ...format, suffix: e.target.value } })}
              className="h-8 text-xs"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DateFormatEditor({
  model,
  onChange,
}: {
  model: PmColumnModel;
  onChange: (patch: Partial<PmColumnModel>) => void;
}) {
  const format = (model.format ?? {}) as Record<string, unknown>;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Date preset</Label>
      <Select
        value={String(format.preset ?? "dateMedium")}
        onValueChange={(v) => onChange({ format: { ...format, preset: v } })}
      >
        <SelectTrigger size="sm" className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dateShort" className="text-xs">
            Short
          </SelectItem>
          <SelectItem value="dateMedium" className="text-xs">
            Medium
          </SelectItem>
          <SelectItem value="datetimeShort" className="text-xs">
            Date + time
          </SelectItem>
          <SelectItem value="timeShort" className="text-xs">
            Time only
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldTypeEditor({
  model,
  onChange,
}: {
  model: PmColumnModel;
  onChange: (patch: Partial<PmColumnModel>) => void;
}) {
  if (model.type === "select") {
    return (
      <SelectOptionsEditor
        options={[...(model.options ?? [])]}
        onChange={(options) => onChange({ options })}
      />
    );
  }
  if (model.type === "number") {
    return <NumberFormatEditor model={model} onChange={onChange} />;
  }
  if (model.type === "date" || model.type === "dateRange") {
    return <DateFormatEditor model={model} onChange={onChange} />;
  }
  if (model.type === "person") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Person roster is demo-static (Ava, Ben, Cleo, Dane). Custom rosters:{" "}
        <ComingSoonBadge className="ml-1 inline-flex align-middle" />
      </p>
    );
  }
  return (
    <p className="text-[11px] text-muted-foreground">
      No extra settings for text fields. Validation rules: <ComingSoonBadge className="ml-1 inline-flex" />
    </p>
  );
}

function FieldEditor({
  model,
  onPatch,
  onTypeChange,
  onDelete,
}: {
  model: PmColumnModel;
  onPatch: (patch: Partial<PmColumnModel>) => void;
  onTypeChange: (typeId: string) => void;
  onDelete: () => void;
}) {
  const entry = catalogEntry(model.type);
  const typeAvailable = entry?.available ?? false;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Field name</Label>
        <Input
          value={model.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          className="h-8 text-sm"
          disabled={model.locked}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Field type</Label>
        <Select
          value={model.type}
          onValueChange={(v) => {
            if (catalogEntry(v)?.available) onTypeChange(v);
          }}
          disabled={model.locked}
        >
          <SelectTrigger size="sm" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COLUMN_TYPE_CATALOG.map((t) => (
              <SelectItem
                key={t.id}
                value={t.id}
                disabled={!t.available}
                className="text-xs"
              >
                <span className="flex items-center gap-2">
                  {t.label}
                  {!t.available ? <ComingSoonBadge /> : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!typeAvailable ? (
          <p className="text-[11px] text-destructive">This type is not registered in the engine yet.</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">{entry?.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs">Visible in views</Label>
          <p className="text-[10px] text-muted-foreground">Table and list columns</p>
        </div>
        <Switch
          checked={model.visible}
          disabled={model.locked}
          onCheckedChange={(visible) => onPatch({ visible })}
          aria-label={`Toggle visibility for ${model.label}`}
        />
      </div>

      {model.type === "select" ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-xs">Board grouping column</Label>
            <p className="text-[10px] text-muted-foreground">Kanban columns follow option order</p>
          </div>
          <Switch
            checked={!!model.boardGroup}
            onCheckedChange={(on) => onPatch({ boardGroup: on || undefined })}
            aria-label={`Use ${model.label} for board grouping`}
          />
        </div>
      ) : null}

      <Separator />

      <FieldTypeEditor model={model} onChange={onPatch} />

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Engine coverage</p>
        <ul className="divide-y divide-border/60 rounded-md border border-border px-2">
          {ENGINE_CAPABILITIES.map((cap) => (
            <CapabilityRow
              key={cap.id}
              label={cap.label}
              description={cap.description}
              ready={cap.engineReady}
              applies={cap.applies(model.type)}
            />
          ))}
        </ul>
      </div>

      {!model.locked ? (
        <Button type="button" variant="destructive" size="sm" className="w-full" onClick={onDelete}>
          Delete field
        </Button>
      ) : null}
    </div>
  );
}

function AddFieldMenu({ onAdd }: { onAdd: (entry: ColumnTypeCatalogEntry) => void }) {
  const groups = ["basic", "people", "advanced"] as const;
  const labels: Record<(typeof groups)[number], string> = {
    basic: "Basic",
    people: "People",
    advanced: "Advanced",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          Add field
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {groups.map((group, gi) => (
          <DropdownMenuGroup key={group}>
            {gi > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-[10px] uppercase">{labels[group]}</DropdownMenuLabel>
            {COLUMN_TYPE_CATALOG.filter((e) => e.group === group).map((entry) => (
              <DropdownMenuItem
                key={entry.id}
                disabled={!entry.available}
                className="text-xs"
                onSelect={() => entry.available && onAdd(entry)}
              >
                <span className="flex flex-1 items-center justify-between gap-2">
                  <span>{entry.label}</span>
                  {!entry.available ? <ComingSoonBadge /> : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ColumnModelPanelProps {
  models: PmColumnModel[];
  onChange: (models: PmColumnModel[]) => void;
  className?: string;
}

export function ColumnModelPanel({ models, onChange, className }: ColumnModelPanelProps) {
  const [selectedId, setSelectedId] = useState<string>("status");

  const selected = useMemo(
    () => models.find((m) => m.id === selectedId) ?? models[0],
    [models, selectedId],
  );

  const patchSelected = (patch: Partial<PmColumnModel>) => {
    if (!selected) return;
    let next = models.map((m) => (m.id === selected.id ? { ...m, ...patch } : m));
    if (patch.boardGroup) next = setBoardGroup(next, selected.id);
    onChange(next);
  };

  return (
    <aside
      className={cn("flex w-[22rem] shrink-0 flex-col border-l border-border bg-muted/30", className)}
      aria-label="Project field model"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <h3 className="text-xs font-semibold">Project fields</h3>
          <p className="text-[10px] text-muted-foreground">{models.length} fields · column-types + grid</p>
        </div>
        <AddFieldMenu
          onAdd={(entry) => {
            const created = createColumnModel(entry.id, models);
            const next = [...models, created];
            onChange(next);
            setSelectedId(created.id);
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <ul className="shrink-0 overflow-y-auto border-b border-border" style={{ maxHeight: "40%" }}>
          {models.map((m, index) => {
            const active = m.id === selected?.id;
            const typeLabel = catalogEntry(m.type)?.label ?? m.type;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                    active ? "bg-background" : "hover:bg-background/60",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 font-medium">
                      {m.label}
                      {!m.visible ? (
                        <span className="text-[9px] text-muted-foreground">(hidden)</span>
                      ) : null}
                      {m.boardGroup ? (
                        <HugeiconsIcon icon={KanbanIcon} className="size-3 text-muted-foreground" />
                      ) : null}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={index === 0 || m.locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(moveColumnModel(models, m.id, "up"));
                      }}
                      aria-label={`Move ${m.label} up`}
                    >
                      <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={index === models.length - 1 || m.locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(moveColumnModel(models, m.id, "down"));
                      }}
                      aria-label={`Move ${m.label} down`}
                    >
                      <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                    </Button>
                  </span>
                </button>
              </li>
            );
          })}
          <li className="flex items-center justify-center gap-2 px-3 py-2">
            <ComingSoonBadge />
            <span className="text-[10px] text-muted-foreground">Drag reorder</span>
          </li>
        </ul>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {selected ? (
            <FieldEditor
              key={selected.id}
              model={selected}
              onTypeChange={(typeId) => onChange(changeColumnType(models, selected.id, typeId))}
              onPatch={(patch) => {
                if (patch.options) {
                  onChange(updateSelectOptions(models, selected.id, [...patch.options]));
                  return;
                }
                patchSelected(patch);
              }}
              onDelete={() => {
                const next = removeColumnModel(models, selected.id);
                onChange(next);
                setSelectedId(next[0]?.id ?? "");
              }}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
