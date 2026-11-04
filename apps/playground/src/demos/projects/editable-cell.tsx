import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@nqlib/nqui";
import { renderCell, type ColumnSchema } from "@nqlib/nqgrid/engine";
import { stopSortableChain } from "../../lib/playground-sortable-utils";
import { Cell } from "./cell";
import { TEAM, pmRegistry, taskValue, type Task } from "./pm-schema";

const sortableShield = {
  onPointerDown: stopSortableChain,
  onMouseDown: stopSortableChain,
  onTouchStart: stopSortableChain,
} as const;

function personOptions() {
  return TEAM.map((p, order) => ({ id: p.id, label: p.name, order, color: p.color }));
}

function isoDateOnly(raw: unknown): string {
  if (typeof raw === "string" && raw.length >= 10) return raw.slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}

export function EditableCell({
  task,
  schema,
  isSelected,
  isEditing,
  editSeed,
  onSelect,
  onStartEdit,
  onCommit,
  onCancelEdit,
  className,
}: {
  task: Task;
  schema: ColumnSchema;
  isSelected: boolean;
  isEditing: boolean;
  /** Replaces cell content when user types to edit (first keystroke). */
  editSeed?: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onCommit: (raw: unknown) => void;
  onCancelEdit: () => void;
  className?: string;
}) {
  const escapeRef = useRef(false);
  const type = pmRegistry.require(schema.type);
  const editor = type.editor(schema);
  const raw = taskValue(task, schema.id);

  if (editor.control === "none") {
    return <Cell task={task} schema={schema} className={className} />;
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 items-center rounded-sm text-left outline-none",
          isSelected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
          className,
        )}
        onClick={(e) => {
          stopSortableChain(e);
          if (isSelected) onStartEdit();
          else onSelect();
        }}
        onDoubleClick={(e) => {
          stopSortableChain(e);
          onStartEdit();
        }}
        onPointerDown={stopSortableChain}
        onMouseDown={(e) => {
          stopSortableChain(e);
          if (isSelected) e.preventDefault();
        }}
        onTouchStart={stopSortableChain}
      >
        <Cell task={task} schema={schema} className="min-w-0 flex-1" />
      </button>
    );
  }

  const textDefault = editSeed ?? String(raw ?? "");

  const finish = (next: unknown) => {
    onCommit(next);
  };

  const cancelKeys = (e: KeyboardEvent, commitValue?: () => void) => {
    if (e.key === "Escape") {
      e.preventDefault();
      escapeRef.current = true;
      onCancelEdit();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (commitValue) commitValue();
      else (e.target as HTMLElement).blur();
    }
  };

  if (editor.control === "text") {
    return (
      <Input
        key={editSeed ? `seed-${editSeed}` : "plain"}
        className="h-7 text-xs"
        defaultValue={textDefault}
        autoFocus
        aria-label={`Edit ${schema.label}`}
        onKeyDown={(e) => {
          stopSortableChain(e);
          cancelKeys(e, () => finish((e.target as HTMLInputElement).value));
        }}
        onBlur={(e) => {
          if (escapeRef.current) {
            escapeRef.current = false;
            return;
          }
          finish(e.target.value);
        }}
        {...sortableShield}
      />
    );
  }

  if (editor.control === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    const numberDefault =
      editSeed ?? (Number.isFinite(n) ? String(n) : "");
    return (
      <Input
        key={editSeed ? `seed-${editSeed}` : "plain"}
        type="number"
        className="h-7 text-xs tabular-nums"
        defaultValue={numberDefault}
        autoFocus
        aria-label={`Edit ${schema.label}`}
        onKeyDown={(e) => {
          stopSortableChain(e);
          cancelKeys(e, () => {
            const parsed = Number((e.target as HTMLInputElement).value);
            finish(Number.isFinite(parsed) ? parsed : raw);
          });
        }}
        onBlur={(e) => {
          if (escapeRef.current) {
            escapeRef.current = false;
            return;
          }
          const parsed = Number(e.target.value);
          finish(Number.isFinite(parsed) ? parsed : raw);
        }}
        {...sortableShield}
      />
    );
  }

  if (editor.control === "date" && schema.type === "dateRange") {
    const range = (raw ?? {}) as { start?: string; end?: string };
    return (
      <div className="flex min-w-0 flex-col gap-1" {...sortableShield}>
        <Input
          type="date"
          className="h-7 text-xs"
          defaultValue={isoDateOnly(range.start)}
          aria-label={`Edit ${schema.label} start`}
          onKeyDown={cancelKeys}
        />
        <Input
          type="date"
          className="h-7 text-xs"
          defaultValue={isoDateOnly(range.end)}
          aria-label={`Edit ${schema.label} end`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              escapeRef.current = true;
              onCancelEdit();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const start = (e.currentTarget.form ?? e.currentTarget.parentElement)
                ?.querySelector<HTMLInputElement>('input[type="date"]:first-of-type')
                ?.value;
              const end = e.currentTarget.value;
              if (start && end) finish({ start, end });
              else onCancelEdit();
            }
          }}
          onBlur={(e) => {
            if (escapeRef.current) {
              escapeRef.current = false;
              return;
            }
            const container = e.currentTarget.parentElement;
            const start = container?.querySelector<HTMLInputElement>('input[type="date"]:first-of-type')?.value;
            const end = e.target.value;
            if (start && end) finish({ start, end });
            else onCancelEdit();
          }}
        />
      </div>
    );
  }

  if (editor.control === "date") {
    return (
      <Input
        type="date"
        className="h-7 text-xs"
        defaultValue={isoDateOnly(raw)}
        autoFocus
        aria-label={`Edit ${schema.label}`}
        onKeyDown={(e) => {
          stopSortableChain(e);
          cancelKeys(e, () => finish((e.target as HTMLInputElement).value));
        }}
        onBlur={(e) => {
          if (escapeRef.current) {
            escapeRef.current = false;
            return;
          }
          finish(e.target.value || raw);
        }}
        {...sortableShield}
      />
    );
  }

  if (editor.control === "select") {
    const options =
      schema.type === "person"
        ? personOptions()
        : [...(editor.options ?? schema.options ?? [])];
    const value = String(raw ?? "");

    return (
      <SelectEditor
        value={value}
        label={schema.label}
        options={options}
        onCommit={finish}
        onCancelEdit={onCancelEdit}
      />
    );
  }

  const { display } = renderCell(raw, type, schema);
  return <span className="text-xs text-muted-foreground">{display || "—"}</span>;
}

/** Defer open so the opening click does not immediately dismiss the menu. */
function SelectEditor({
  value,
  label,
  options,
  onCommit,
  onCancelEdit,
}: {
  value: string;
  label: string;
  options: { id: string | number; label: string }[];
  onCommit: (raw: unknown) => void;
  onCancelEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const committedRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      mountedRef.current = true;
      setOpen(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Select
      open={open}
      value={value}
      onValueChange={(v) => {
        committedRef.current = true;
        onCommit(v);
      }}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && mountedRef.current && !committedRef.current) onCancelEdit();
        if (!next) committedRef.current = false;
      }}
    >
      <SelectTrigger className="h-7 w-full text-xs" aria-label={`Edit ${label}`} {...sortableShield}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(o.id)} value={String(o.id)} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
