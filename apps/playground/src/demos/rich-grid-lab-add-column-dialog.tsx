import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nqlib/nqui";
import { LAB_ADD_COLUMN_OPTIONS, type LabAddColumnPreset } from "./rich-grid-lab-types";

type Props = {
  readonly open: boolean;
  readonly side: "left" | "right" | null;
  readonly anchorColumnName: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPick: (preset: LabAddColumnPreset) => void;
};

export function RichGridLabAddColumnDialog({
  open,
  side,
  anchorColumnName,
  onOpenChange,
  onPick,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            {side && anchorColumnName
              ? `Insert a new column to the ${side} of “${anchorColumnName}”.`
              : "Choose a column type for the new field."}
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 py-2">
          {LAB_ADD_COLUMN_OPTIONS.map((opt) => (
            <li key={opt.preset}>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                onClick={() => onPick(opt.preset)}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{opt.hint}</span>
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
