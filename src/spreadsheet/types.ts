import { COMMAND_IDS } from "./commands";

export type CommandId = (typeof COMMAND_IDS)[keyof typeof COMMAND_IDS];

export interface SpreadsheetCommand {
  id: CommandId;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onExecute?: () => void;
}

export interface MenuItem {
  id: string;
  label: string;
  commandId?: CommandId;
  disabled?: boolean;
}

export interface MenuGroup {
  id: string;
  label: string;
  items: readonly MenuItem[];
}

export interface FormatToolbarConfig {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "start" | "center" | "end";
  verticalAlign?: "top" | "middle" | "bottom";
}
