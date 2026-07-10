"use client";

import {
  createContext,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChartPart } from "./parts/types";

type PartRegistryContextValue = {
  partsMapRef: React.RefObject<Map<string, ChartPart>>;
  version: number;
  registerSync: (part: ChartPart) => void;
  unregister: (id: string) => void;
};

const PartRegistryContext = createContext<PartRegistryContextValue | null>(null);

function serializePart(part: ChartPart): string {
  return JSON.stringify(part, (_key, value) => (typeof value === "function" ? 0 : value));
}

function partsEqual(a: ChartPart, b: ChartPart): boolean {
  return serializePart(a) === serializePart(b);
}

export function PartRegistryProvider({ children }: { children: ReactNode }) {
  const partsMapRef = useRef(new Map<string, ChartPart>());
  const [version, setVersion] = useState(0);
  const dirtyRef = useRef(false);

  const registerSync = useCallback((part: ChartPart) => {
    const existing = partsMapRef.current.get(part.id);
    if (existing && partsEqual(existing, part)) return;
    partsMapRef.current.set(part.id, part);
    dirtyRef.current = true;
  }, []);

  const unregister = useCallback((id: string) => {
    if (!partsMapRef.current.has(id)) return;
    partsMapRef.current.delete(id);
    dirtyRef.current = true;
  }, []);

  useLayoutEffect(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setVersion((v) => v + 1);
  });

  const value = useMemo(
    () => ({
      partsMapRef,
      version,
      registerSync,
      unregister,
    }),
    [version, registerSync, unregister],
  );

  return <PartRegistryContext value={value}>{children}</PartRegistryContext>;
}

export function usePartRegistry() {
  const ctx = use(PartRegistryContext);
  if (!ctx) {
    throw new Error("usePartRegistry must be used within PartRegistryProvider");
  }
  return ctx;
}

/** Reads the live part map — siblings registered earlier in the same render are included. */
export function usePartsSnapshot(): ChartPart[] {
  const { partsMapRef, version } = usePartRegistry();
  // Intentional render-time read of the live map: parts register during render
  // (see useRegisterPart) so a snapshot must reflect siblings added earlier this
  // render. `version` bumps on every mutation, so the memo recomputes correctly.
  // eslint-disable-next-line react-hooks/refs
  return useMemo(() => Array.from(partsMapRef.current.values()), [partsMapRef, version]);
}

export function useRegisterPart(part: ChartPart) {
  const { registerSync, unregister } = usePartRegistry();
  const partRef = useRef(part);
  const partKey = serializePart(part);

  // Register synchronously during render so sibling parts are visible to
  // usePartsSnapshot in the same render pass (deliberate; see that hook).
  registerSync(part);

  // Keep the latest part in a ref without making it a dependency (a fresh
  // object every render would defeat the partKey gating). Written post-render.
  useLayoutEffect(() => {
    partRef.current = part;
  });

  // Re-register only when the part's structural identity (partKey) changes,
  // using the latest captured part.
  useLayoutEffect(() => {
    registerSync(partRef.current);
  }, [partKey, registerSync]);

  useLayoutEffect(() => {
    const id = part.id;
    return () => unregister(id);
  }, [part.id, unregister]);
}

export function usePartId() {
  return useId().replace(/:/g, "");
}
