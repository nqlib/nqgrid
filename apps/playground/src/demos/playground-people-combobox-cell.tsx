import { useMemo, useRef, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  cn,
} from "@nqlib/nqui";
import {
  avatarSrc,
  initials,
  type RichPeoplePickerRenderArgs,
  reconcileRichPeopleWithRoster,
  resolveRichPeopleByOptionKeys,
  richPersonOptionKey,
} from "@nqlib/nqgrid";

const MAX_TRIGGER_AVATARS = 3;

function richOptionKeysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/**
 * Playground-only `renderPeoplePicker` implementation.
 * See `.cursor/rules/nqgrid-rich-people-column.mdc` for engine contract vs UI replication.
 */
export function PlaygroundPeopleComboboxCell<T extends object>({
  value,
  options,
  max,
  empty,
  avatarSizePx,
  onChange,
}: RichPeoplePickerRenderArgs<T>) {
  /**
   * nqui `ComboboxItem` invokes selection from both `onMouseDown` and `onSelect`; the `onSelect` path can run
   * after a microtask and toggles the same item off again. While the menu is open we keep picks in local draft
   * state and only {@link commitKeys} when the popover closes so the double-fire does not hit row data.
   */
  const menuOpenRef = useRef(false);
  const draftKeysRef = useRef<string[]>([]);
  /** Draft keys just before the last strictly larger `onValueChange` (nqui duplicate reverts to this). */
  const preExpandKeysRef = useRef<string[] | null>(null);
  const preExpandAtRef = useRef(0);
  const lastDraftMutationAtRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftKeys, setDraftKeys] = useState<string[]>([]);

  const valueKeySig = value.map((p) => richPersonOptionKey(p)).join("\0");
  const canonical = useMemo(
    () => reconcileRichPeopleWithRoster(value, options),
    [valueKeySig, options],
  );
  const selectedKeys = useMemo(() => canonical.map(richPersonOptionKey), [canonical]);
  const comboboxValue = menuOpen ? draftKeys : selectedKeys;
  const atMax = comboboxValue.length >= max;
  /** Popover only lists people not already assigned (remove via × on avatars). */
  const pickableOptions = useMemo(() => {
    if (atMax) return [];
    const taken = new Set(comboboxValue);
    return options.filter((p) => !taken.has(richPersonOptionKey(p)));
  }, [atMax, comboboxValue, options]);
  const comboboxListItems = useMemo(() => [...pickableOptions], [pickableOptions]);
  const displayCanonical = reconcileRichPeopleWithRoster(
    resolveRichPeopleByOptionKeys(options, comboboxValue),
    options,
  );
  const visible = displayCanonical.slice(0, MAX_TRIGGER_AVATARS);
  const overflow =
    displayCanonical.length > MAX_TRIGGER_AVATARS ? displayCanonical.length - MAX_TRIGGER_AVATARS : 0;
  const size = avatarSizePx;
  const title = displayCanonical.map((p) => p.name).join(", ");

  const commitKeys = (keys: readonly string[]) => {
    const next = resolveRichPeopleByOptionKeys(options, keys).slice(0, max);
    onChange(next);
  };

  const removeKey = (dropKey: string) => {
    const base = menuOpenRef.current ? draftKeysRef.current : selectedKeys;
    const next = base.filter((k) => k !== dropKey);
    if (menuOpenRef.current) {
      draftKeysRef.current = next;
      setDraftKeys(next);
      lastDraftMutationAtRef.current = Date.now();
      preExpandKeysRef.current = null;
    } else {
      commitKeys(next);
    }
  };

  return (
    <Combobox
      multiple
      open={menuOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          const seed = [...selectedKeys];
          lastDraftMutationAtRef.current = Date.now();
          preExpandKeysRef.current = null;
          preExpandAtRef.current = 0;
          draftKeysRef.current = seed;
          setDraftKeys(seed);
          menuOpenRef.current = true;
        } else {
          commitKeys(draftKeysRef.current);
          menuOpenRef.current = false;
        }
        setMenuOpen(nextOpen);
      }}
      items={comboboxListItems}
      value={comboboxValue}
      onValueChange={(v) => {
        const keys = Array.isArray(v) ? v : v ? [v] : [];
        if (menuOpenRef.current) {
          const now = Date.now();
          const prev = draftKeysRef.current;
          const revertMs = 140;
          const preSnap = preExpandKeysRef.current;
          if (
            preSnap != null &&
            keys.length < prev.length &&
            richOptionKeysEqual(keys, preSnap) &&
            now - preExpandAtRef.current < revertMs
          ) {
            return;
          }
          if (keys.length > prev.length) {
            preExpandKeysRef.current = [...prev];
            preExpandAtRef.current = now;
          } else if (!richOptionKeysEqual(keys, prev)) {
            preExpandKeysRef.current = null;
          }
          lastDraftMutationAtRef.current = now;
          draftKeysRef.current = keys;
          setDraftKeys([...keys]);
          return;
        }
        commitKeys(keys);
      }}
    >
      <ComboboxAnchor
        className={cn(
          "flex w-full min-w-0 max-w-full items-center justify-end gap-1 rounded-md py-0.5 pr-0.5 pl-1 outline-none transition-colors",
          "hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {displayCanonical.length === 0 ? (
          <span className="min-w-0 flex-1 truncate text-left text-xs text-muted-foreground tabular-nums">
            {empty ?? "Add people…"}
          </span>
        ) : (
          <span
            className="flex min-w-0 flex-1 -space-x-2 p-0.5"
            role="group"
            aria-label={title || "Selected people"}
          >
            {visible.map((p, i) => {
              const src = avatarSrc(p);
              const label = p.name;
              const optKey = richPersonOptionKey(p);
              return (
                <span
                  key={optKey}
                  className="group/pick relative shrink-0"
                  style={{ zIndex: visible.length - i }}
                >
                  <Avatar
                    className="border-2 border-background bg-muted text-[10px]"
                    style={{ width: size, height: size }}
                    title={label}
                  >
                    {src ? <AvatarImage src={src} alt="" className="object-cover" loading="lazy" /> : null}
                    <AvatarFallback className="text-[10px] font-medium text-muted-foreground">
                      {initials(label)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    className={cn(
                      "absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full border border-border bg-background",
                      "text-[11px] font-semibold leading-none text-muted-foreground opacity-0 shadow-sm transition-opacity",
                      "hover:bg-destructive hover:text-destructive-foreground group-hover/pick:opacity-100",
                    )}
                    aria-label={`Remove ${label}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeKey(optKey);
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            {overflow > 0 ? (
              <span
                className="relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold tabular-nums leading-none text-muted-foreground"
                style={{ width: size, height: size }}
                title={`${overflow} more — open list to edit`}
              >
                …
              </span>
            ) : null}
          </span>
        )}
        <ComboboxTrigger
          type="button"
          variant="icon-addon"
          className="size-7 shrink-0 border-0 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
          aria-label="Open people picker"
        />
      </ComboboxAnchor>
      <ComboboxContent align="end" sideOffset={6} className="w-[min(22rem,calc(100vw-3rem))] p-0">
        <ComboboxList className="max-h-64">
          {pickableOptions.map((p) => {
            const optKey = richPersonOptionKey(p);
            const src = avatarSrc(p);
            return (
              <ComboboxItem key={optKey} value={optKey} keywords={[p.name, optKey]}>
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar
                    className="shrink-0 border border-border bg-muted"
                    style={{ width: avatarSizePx, height: avatarSizePx }}
                  >
                    {src ? <AvatarImage src={src} alt="" className="object-cover" loading="lazy" /> : null}
                    <AvatarFallback className="text-[10px] font-medium text-muted-foreground">
                      {initials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate font-normal">{p.name}</span>
                </span>
              </ComboboxItem>
            );
          })}
          <ComboboxEmpty className="py-6 text-center text-sm text-muted-foreground">
            {atMax
              ? "Maximum assignees for this row."
              : pickableOptions.length === 0
                ? "Everyone in this directory is already assigned."
                : "No matching people."}
          </ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
