import type { ReactNode } from "react";
import { cn } from "@nqlib/nqui";

/** Small on-diagram label pointing at a table region. */
export function RegionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-10 max-w-[9rem] truncate rounded-md border border-primary/35 bg-background/95 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
