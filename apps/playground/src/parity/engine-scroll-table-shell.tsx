import type { ReactNode } from "react";
import { cn } from "@nqlib/nqui";
import { NeutralTableShell } from "../lib/playground-neutral-table";

export interface EngineScrollTableShellProps {
  children: ReactNode;
  className?: string;
  viewportRef?: (el: HTMLDivElement | null) => void;
  edgeToEdge?: boolean;
  footer?: ReactNode;
}

/** Bounded scroll shell — uses neutral table SSOT (virtual-data reference). */
export function EngineScrollTableShell({
  children,
  className,
  viewportRef,
  footer,
}: EngineScrollTableShellProps) {
  return (
    <NeutralTableShell
      viewportRef={viewportRef}
      className={cn("min-h-[16rem] max-h-[min(60dvh,480px)]", className)}
      footer={footer}
    >
      {children}
    </NeutralTableShell>
  );
}

export { useEngineScrollViewport } from "./use-engine-scroll-viewport";
