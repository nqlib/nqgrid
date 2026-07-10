import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

/**
 * Keyboard "move mode" for row reorder — the a11y equivalent of press-hold drag.
 *
 * Flow: focus a row's grip, press Enter/Space to grab, Arrow Up/Down to move,
 * Enter/Space to drop, Escape to cancel. Renderer-agnostic: returns state +
 * handlers, never a className. Pair with {@link moveRowUp}/{@link moveRowDown}.
 *
 * `getGripProps` has a **stable identity** and reads the live grab state from a
 * ref, so consumers can build column defs in a `useMemo([])` without the cell
 * closure going stale when the grabbed row changes.
 */
export interface UseRowKeyboardReorderOptions {
  enabled?: boolean;
  /** Total navigable row count (for clamping move bounds). */
  rowCount: number;
  /** Commit a single-step move. `dir` is -1 (up) or +1 (down). */
  onMove: (ctx: { id: string; index: number; dir: -1 | 1 }) => void;
  /** Resolve a row id's current index (post-commit ordering). */
  indexOf: (id: string) => number;
  /** Fired when a grab begins (announce via aria-live in the host). */
  onGrab?: (id: string) => void;
  /** Fired when a grab ends — `committed` is false on Escape. */
  onDrop?: (ctx: { id: string; committed: boolean }) => void;
}

export interface RowKeyboardReorderProps {
  role: "button";
  tabIndex: 0;
  "aria-grabbed": boolean;
  "aria-keyshortcuts": string;
  onKeyDown: (e: KeyboardEvent) => void;
}

export interface UseRowKeyboardReorderResult {
  grabbedId: string | null;
  isGrabbed: (id: string) => boolean;
  /** Stable-identity props factory for a row's grip element. */
  getGripProps: (id: string) => RowKeyboardReorderProps;
  /** Imperatively end any active grab without committing. */
  cancel: () => void;
}

export function useRowKeyboardReorder(
  options: UseRowKeyboardReorderOptions,
): UseRowKeyboardReorderResult {
  const { enabled = true, rowCount, onMove, indexOf, onGrab, onDrop } = options;
  const [grabbedId, setGrabbedIdState] = useState<string | null>(null);

  // Mirror state into a ref so the stable getGripProps reads the live value.
  const grabbedIdRef = useRef<string | null>(null);
  const setGrabbedId = useCallback((next: string | null) => {
    grabbedIdRef.current = next;
    setGrabbedIdState(next);
  }, []);

  // Keep latest config in refs so getGripProps never needs to change identity.
  const cfg = useRef({ enabled, rowCount, onMove, indexOf, onGrab, onDrop });
  cfg.current = { enabled, rowCount, onMove, indexOf, onGrab, onDrop };

  const cancel = useCallback(() => {
    const cur = grabbedIdRef.current;
    if (cur != null) cfg.current.onDrop?.({ id: cur, committed: false });
    setGrabbedId(null);
  }, [setGrabbedId]);

  const getGripProps = useCallback(
    (id: string): RowKeyboardReorderProps => ({
      role: "button",
      tabIndex: 0,
      "aria-grabbed": grabbedIdRef.current === id,
      "aria-keyshortcuts": "Enter Space ArrowUp ArrowDown Escape",
      onKeyDown: (e: KeyboardEvent) => {
        const { enabled: on, rowCount: count, onMove: move, indexOf: idx, onGrab: grab, onDrop: drop } =
          cfg.current;
        if (!on) return;
        const grabbed = grabbedIdRef.current === id;

        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          if (grabbed) {
            setGrabbedId(null);
            drop?.({ id, committed: true });
          } else {
            setGrabbedId(id);
            grab?.(id);
          }
          return;
        }

        if (e.key === "Escape") {
          if (!grabbed) return;
          e.preventDefault();
          setGrabbedId(null);
          drop?.({ id, committed: false });
          return;
        }

        if (!grabbed) return;

        if (e.key === "ArrowUp") {
          e.preventDefault();
          const index = idx(id);
          if (index <= 0) return;
          move({ id, index, dir: -1 });
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          const index = idx(id);
          if (index < 0 || index >= count - 1) return;
          move({ id, index, dir: 1 });
        }
      },
    }),
    [setGrabbedId],
  );

  return {
    grabbedId,
    isGrabbed: useCallback((id: string) => grabbedId === id, [grabbedId]),
    getGripProps,
    cancel,
  };
}
