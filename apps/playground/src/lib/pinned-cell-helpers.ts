import { useCallback, useState, type CSSProperties, type UIEvent } from "react";

export const PINNED_STICKY_LAYER: CSSProperties = {
  willChange: "transform",
  transform: "translateZ(0)",
};

export const PINNED_EDGE_SHADOW = "6px 0 8px -6px rgba(0,0,0,0.45)";

export function mergePinnedCellStyle(
  pinStyle: CSSProperties | undefined,
  lastPinned: boolean,
  scrolledX: boolean,
): CSSProperties | undefined {
  if (!pinStyle) return undefined;
  // Row-freeze cells set `top`; compositing via transform breaks vertical sticky
  // when `left` is also set (corner cells scroll away in the pinned column band).
  const rowFreeze = pinStyle.top != null;
  return {
    ...pinStyle,
    ...(rowFreeze ? {} : PINNED_STICKY_LAYER),
    ...(lastPinned && scrolledX ? { boxShadow: PINNED_EDGE_SHADOW } : {}),
  };
}

export function useScrollDivider() {
  const [scrolledX, setScrolledX] = useState(false);
  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrolledX(e.currentTarget.scrollLeft > 0);
  }, []);
  return { scrolledX, onScroll };
}
