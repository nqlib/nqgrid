import { useEffect, useState } from "react";
import {
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nqlib/nqui";
import {
  changeColumnType,
  setBoardGroup,
  type PmColumnModel,
} from "./pm-column-model";
import { normalizeStatusOrders } from "./pm-schema";
import { ProjectsColumnFieldEditor } from "./projects-column-editor";

function cloneModel(m: PmColumnModel): PmColumnModel {
  return {
    ...m,
    format: m.format ? { ...m.format } : undefined,
    options: m.options?.map((o) => ({ ...o })),
  };
}

export function ProjectsColumnSheet({
  open,
  model,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  model: PmColumnModel | null;
  onOpenChange: (open: boolean) => void;
  onSave: (model: PmColumnModel) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<PmColumnModel | null>(null);

  useEffect(() => {
    if (open && model) setDraft(cloneModel(model));
    if (!open) setDraft(null);
  }, [open, model]);

  const handleSave = () => {
    if (!draft) return;
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{draft?.label ?? "Configure field"}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 pr-3">
          {draft ? (
            <ProjectsColumnFieldEditor
              model={draft}
              onChange={(p) => {
                setDraft((prev) => {
                  if (!prev) return prev;
                  if (p.options) {
                    return { ...prev, options: normalizeStatusOrders([...p.options]) };
                  }
                  return { ...prev, ...p };
                });
              }}
              onTypeChange={(typeId) => {
                setDraft((prev) => {
                  if (!prev) return prev;
                  return changeColumnType([prev], prev.id, typeId)[0]!;
                });
              }}
              onDelete={
                draft.locked
                  ? undefined
                  : () => {
                      onDelete(draft.id);
                      onOpenChange(false);
                    }
              }
            />
          ) : null}
        </ScrollArea>
        <SheetFooter className="flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!draft}>
            Save field
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function saveColumnModel(models: PmColumnModel[], saved: PmColumnModel): PmColumnModel[] {
  let next = models.map((m) => (m.id === saved.id ? saved : m));
  if (saved.boardGroup) next = setBoardGroup(next, saved.id);
  return next;
}
