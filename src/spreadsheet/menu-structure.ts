import { COMMAND_IDS } from "./commands";
import type { MenuGroup } from "./types";

export const DEFAULT_MENU_GROUPS: readonly MenuGroup[] = [
  {
    id: "file",
    label: "File",
    items: [
      { id: "export-csv", label: "Export CSV", commandId: COMMAND_IDS.EXPORT_CSV },
      { id: "export-pdf", label: "Export PDF", commandId: COMMAND_IDS.EXPORT_PDF },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { id: "copy", label: "Copy", commandId: COMMAND_IDS.COPY },
      { id: "paste", label: "Paste", commandId: COMMAND_IDS.PASTE },
    ],
  },
];
