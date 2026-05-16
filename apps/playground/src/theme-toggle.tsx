import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ToggleGroup, ToggleGroupItem } from "@nqlib/nqui";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="inline-flex h-8 w-[7.25rem] shrink-0 rounded-md border border-border bg-muted/40"
        aria-hidden
      />
    );
  }

  const value = theme === "dark" ? "dark" : "light";

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => {
        if (next) setTheme(next);
      }}
      className="shrink-0"
      aria-label="Color theme"
    >
      <ToggleGroupItem value="light" aria-label="Light mode" className="gap-1.5 px-2.5">
        <HugeiconsIcon icon={Sun01Icon} className="size-4" aria-hidden />
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark mode" className="gap-1.5 px-2.5">
        <HugeiconsIcon icon={Moon01Icon} className="size-4" aria-hidden />
        Dark
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
