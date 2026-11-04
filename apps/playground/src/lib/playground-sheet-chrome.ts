/** Shared SheetContent layout — explicit utilities so Tailwind scans them from app source. */
export const playgroundSheetContentClass =
  "flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl";

/** Scroll body inside playground sheets (header/footer stay fixed). */
export const playgroundSheetScrollClass = "min-h-0 flex-1";
