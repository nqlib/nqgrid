import { Card, CardFooter, ScrollArea, cn } from "@nqlib/nqui";
import {
  tableScrollAreaEdgeClass,
  tableScrollAreaContentClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellLayoutClass,
  type PlaygroundDataTableShellProps,
} from "./nqui-table-shell";

/** nqui Card + ScrollArea shell for TanStack tables (layout only; Table* supplies look). */
export function PlaygroundDataTableShell({
  children,
  footer,
  className,
  footerClassName,
  edgeToEdge = true,
  viewportRef,
}: PlaygroundDataTableShellProps) {
  return (
    <Card className={cn(tableShellLayoutClass, className)}>
      <ScrollArea
        orientation="both"
        fadeMask={false}
        className={tableScrollAreaRootClass}
        viewportStyle={tableScrollViewportStyle}
        viewportRef={viewportRef}
      >
        <div className={edgeToEdge ? tableScrollAreaEdgeClass : tableScrollAreaContentClass}>
          {children}
        </div>
      </ScrollArea>
      {footer ? (
        <CardFooter
          className={cn(
            "shrink-0 flex-col gap-3 border-t sm:flex-row sm:items-center sm:justify-between",
            footerClassName,
          )}
        >
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
