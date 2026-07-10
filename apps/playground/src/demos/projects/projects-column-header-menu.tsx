import { HugeiconsIcon } from "@hugeicons/react";
import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@nqlib/nqui";
import type { Header } from "@tanstack/react-table";
import { sortableNestedControlProps, stopSortableChain } from "../../lib/playground-sortable-utils";
import type { Task } from "./pm-schema";
import type { PmColumnModel } from "./pm-column-model";

const triggerClass =
  "size-7 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity " +
  "focus-visible:opacity-100 data-[state=open]:opacity-100 group-hover/col:opacity-100";

export function ProjectsColumnHeaderMenu({
  header,
  model,
  onConfigure,
  onHide,
  onDelete,
}: {
  header: Header<Task, unknown>;
  model: PmColumnModel;
  onConfigure: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const column = header.column;
  const sorted = column.getIsSorted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={triggerClass}
          aria-label={`${model.label} column options`}
          {...sortableNestedControlProps}
        >
          <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={onConfigure}>Configure field…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => column.toggleSorting(false)} disabled={sorted === "asc"}>
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => column.toggleSorting(true)} disabled={sorted === "desc"}>
          Sort descending
        </DropdownMenuItem>
        {sorted ? (
          <DropdownMenuItem onClick={() => column.clearSorting()}>Clear sort</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={model.locked} onSelect={onHide}>
          Hide column
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={model.locked}
          className="text-destructive focus:text-destructive"
          onSelect={onDelete}
        >
          Delete field
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Header label + sort affordance + ⋯ menu. */
export function ProjectsColumnHeader({
  header,
  model,
  onConfigure,
  onHide,
  onDelete,
}: {
  header: Header<Task, unknown>;
  model: PmColumnModel;
  onConfigure: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const column = header.column;
  const sorted = column.getIsSorted();

  return (
    <div className={cn("group/col flex w-full min-w-0 items-center gap-0.5")}>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 truncate text-left text-xs font-medium uppercase tracking-wide"
        onClick={(e) => {
          stopSortableChain(e);
          column.getToggleSortingHandler()?.(e);
        }}
        onPointerDown={stopSortableChain}
        onMouseDown={stopSortableChain}
        onTouchStart={stopSortableChain}
      >
        <span className="truncate">{model.label}</span>
        {sorted === "asc" ? <span className="text-muted-foreground">↑</span> : null}
        {sorted === "desc" ? <span className="text-muted-foreground">↓</span> : null}
      </button>
      <ProjectsColumnHeaderMenu
        header={header}
        model={model}
        onConfigure={onConfigure}
        onHide={onHide}
        onDelete={onDelete}
      />
    </div>
  );
}
