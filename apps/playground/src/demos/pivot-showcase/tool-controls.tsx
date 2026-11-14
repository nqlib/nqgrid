import { useId, useState, type ReactNode } from "react";
import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@nqlib/nqui";

/**
 * A button that opens an nqui popover; `children` receives `close`. The headless pivot forms
 * (calculated measure / item, show values as) render inside.
 */
export function ToolPopover({
  label,
  children,
  variant = "outline",
  ariaLabel,
}: {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
  variant?: "outline" | "default" | "ghost" | "secondary";
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variant} aria-label={ariaLabel}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] max-w-[calc(100vw-2rem)] p-3">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** Row of example controls above the table. */
export function ToolRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-3", className)}>{children}</div>;
}

/** A labelled cluster of related controls inside a `ToolRow` (role="group" names it for assistive tech). */
export function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      {children}
    </div>
  );
}

/** Labelled switch (the label is clickable and names the switch). */
export function ToolSwitch({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
    </div>
  );
}

/** Labelled select for longer option lists. */
export function ToolSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
  minWidth = "9rem",
}: {
  label: string;
  value: T;
  options: readonly { readonly value: T; readonly label: string }[];
  onValueChange: (value: T) => void;
  minWidth?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v: string) => onValueChange(v as T)}>
        <SelectTrigger size="sm" minWidth={minWidth} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Labelled single-choice segmented control. */
export function ToolChoice<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: T;
  options: readonly { readonly value: T; readonly label: string }[];
  onValueChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        variant="segmented"
        size="sm"
        value={value}
        aria-label={label}
        onValueChange={(v: string) => {
          if (v) onValueChange(v as T);
        }}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className="px-2.5 text-xs">
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
