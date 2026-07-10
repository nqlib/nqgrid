# nqui ScrollArea

> Default export is **EnhancedScrollArea** (fade mask, orientation). Underlying primitive: **`CoreScrollArea`** / `ScrollBar` from **`ui/scroll-area`**. Core scrollbar uses a **thinner** track/thumb (drawer-like).

## Import

```tsx
import { ScrollArea, ScrollBar } from "@nqlib/nqui"
```

## Basic

```tsx
<ScrollArea className="h-[200px]">
  <div>Content</div>
  <ScrollBar orientation="vertical" />
</ScrollArea>
```

## Horizontal

```tsx
<ScrollArea orientation="horizontal">
  <div className="flex gap-4 min-w-max">...</div>
</ScrollArea>
```

## fadeMask

```tsx
<ScrollArea fadeMask>...</ScrollArea>
```

## `viewportRef`

Pass **`viewportRef`** when you need a ref to the scrollable viewport (programmatic `scrollTop`, `ResizeObserver`, etc.).

```tsx
const viewportRef = useRef<HTMLDivElement>(null);

<ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1">
  …
</ScrollArea>
```

---

## Layout pitfalls (read before shipping)

Radix Scroll Area wraps content in a **viewport** plus an **inner wrapper** whose default layout can interact badly with **flex**, **wide content**, and **`pre` / monospace**. Follow the checks below to avoid: **no vertical scroll**, **content growing off-screen to the right**, or **nested scroll bugs**.

### 0. Symptom routing (Card, Sheet, sidebar, any flex shell)

The same flex/CSS issues appear **outside** data tables — any **bounded** panel with **`ScrollArea`** or **`overflow-auto`**.

| What you see | What usually broke | What to try first |
|----------------|--------------------|-------------------|
| **Scroll stuck** — wheel does nothing | Flex child never got a **finite** height (`min-height: auto` blow-through) | **`min-h-0`** on ancestors; scroll slot **`min-h-0 flex-1`**; if still stuck, **`h-0 max-h-full min-h-0 flex-1 overflow-hidden`** on `ScrollArea` root |
| **Footer / toolbar covered** | Viewport or body grew to **full content** height | Footer **`shrink-0`** **sibling** of `ScrollArea`, not inside scrollport; **`viewportStyle`** absolute **`inset: 0`**, **`minHeight: 0`** (§6) |
| **Bleeds past Card radius** | Clip on wrong node; **Card** stays **`overflow-visible`** | **Inner** wrapper **`overflow-hidden`** + scroll **inside** — do not rely on Card alone |
| **Double scrollbar** | Page + panel both scroll | Outer **`min-h-0 flex-1 overflow-hidden`**; **one** primary vertical scroller |
| **`h-full` / `%` useless** | Parent height **indefinite** | **`h-full min-h-0`** chain, or **`max-h-*`**, or **`flex-1`** with **`min-h-0`** up the tree |
| **Need horizontal scroll** but only vertical works | Default **`orientation="vertical"`** → viewport **`overflow-x-hidden`** | **`orientation="both"`** for wide grids/tables (§6); prose: wrap (§2) |

**Generic column shell:** `flex flex-col min-h-0 overflow-hidden` (+ optional **`max-h-[…]`**) → header **`shrink-0`** → **`ScrollArea`** **`flex-1 min-h-0`** → footer **`shrink-0`**. Same pattern inside **Sheet body**, **Drawer**, **sidebar**, **resizable** panes.

### 1. Flex / resizable panels — height chain

In a **flex column**, children default to `min-height: auto`, so a `flex-1` scroll region can **expand with content** and **never scroll**.

- Put **`min-h-0`** (and usually **`min-w-0`**) on **every** flex ancestor between the root and `ScrollArea`.
- On **`ScrollArea` root**, use something like **`min-h-0 flex-1`** (and **`h-full`** only when the parent’s height is well-defined).

```tsx
<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
  <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
    …
  </ScrollArea>
</div>
```

### 2. Prose, chat, markdown — width and wrapping

The viewport’s **inner wrapper** (Radix) often behaves like a **shrink-to-fit** width. Long **URLs**, **unbroken strings**, or **table layout** can make the inner column **wider than the panel**, so users lose content off the **right** even though vertical scroll “works”.

**Do:**

- On **`ScrollArea` root** (or the viewport via arbitrary selectors), ensure:
  - **`overflow-x: hidden`** on the **viewport** so the column does not pan sideways at the transcript level.
  - On the **inner content wrapper** (Radix’s direct child of the viewport): **`display: block`**, **`min-width: 0`**, **`max-width: 100%`**, **`width: 100%`**, and **`break-words`** / **`overflow-wrap: anywhere`** so body text **wraps downward** instead of widening the scroll area.

**Avoid:**

- Blindly forcing **`display: block`** on the inner wrapper **without** `min-w-0` / `max-w-full` / wrapping — that can **break vertical scroll measurement** in some trees. Prefer a **documented, tested** combination (height + width) for your shell (e.g. chat transcript vs. simple list).

**Consumer pattern (example):** apps may ship a shared class for “chat transcript” `ScrollArea` that sets viewport `overflow-x-hidden` and targets `[data-radix-scroll-area-viewport] > div` with block + `min-w-0` + `max-w-full` + `break-words`. Reuse one class per product so behavior stays consistent.

### 3. `<pre>`, fenced code, `white-space: pre`

**Do not** rely on `ScrollArea` as the only clip for **fenced code** or **`white-space: pre`** blocks. Radix’s structure often **fails to clip** tall/wide `pre` content predictably.

**Prefer:** a plain element with **`max-height`**, **`overflow-auto`**, and optional thin scrollbar styling (e.g. a utility class in app CSS). Keep **one** main column `ScrollArea` for the page/panel; use **native overflow** inside message bodies for code.

### 4. Nested `ScrollArea`

Avoid **nested** `ScrollArea` for small regions (reasoning previews, inline panels). Prefer **one** outer scroll for the column + **native `overflow-auto`** for inner blocks. Nested Radix scroll roots multiply width/height bugs.

### 5. Sidebar lists vs. chat transcript

A pattern that fixes **wide titles** in a list (e.g. forcing inner `display: block`) may **break** vertical scrolling in a **chat transcript**. Do not reuse one global class for both without verifying **both** behaviors; split constants (e.g. “sidebar list” vs. “chat transcript”) when needed.

### 6. Data tables, TanStack, and wide native `<table>` (repeat failures)

These issues show up **often** together: **no vertical scroll**, **footer covered**, or **no horizontal scroll** for wide grids.

#### `orientation="both"` when the grid is wider than the card

Enhanced `ScrollArea` uses **`orientation="vertical"`** by default and applies **`overflow-x-hidden`** on the viewport so wide content does not “pan” sideways at the panel level.

That is correct for **chat / prose**, but it **breaks** a **`min-w-[1200px]`** (or similar) **`<table>`**: columns disappear to the right with **no** horizontal scrollbar.

**→ Use `orientation="both"`** for dashboard tables, TanStack layouts, or any region that must scroll **vertically and horizontally**.

#### Flex column: give the scroll slot a **finite** height

In a **flex column**, `flex-1` + **`min-height: auto`** (default) lets the scroll child **grow with content** → no scrollport, or the viewport **matches full table height** and overlaps content below (e.g. a footer **outside** `ScrollArea`).

**→ Typical bounded card:**

- Outer shell: **`flex flex-col overflow-hidden`** + **`max-h-[min(…dvh,…)]`** + sensible **`min-h-*`** so the card has a real budget.
- **`ScrollArea` root:** **`h-0 max-h-full min-h-0 min-w-0 flex-1 overflow-hidden w-full`** — the **`h-0` + `flex-1`** pair is the usual “fill remaining main-axis space” fix in column flex.
- **Footer / actions:** sibling **below** `ScrollArea`, **`shrink-0`**, still inside the shell — not inside the scrollport.

#### `viewportStyle`: do not rely on `%` height alone in deep flex trees

`height: 100%` / `maxHeight: 100%` on the Radix **viewport** often **does not resolve** when ancestors are flex-sized. Symptom: **`viewport.clientHeight` equals full content height** (hundreds/thousands of px) while the ScrollArea **root** is only ~40–60% of that → **no vertical scroll** (`scrollHeight === clientHeight`), footer overlap.

**→ Pin the viewport** to the enhanced root (it is **`position: relative`**):

```ts
import type { CSSProperties } from "react";

export const dataTableViewportStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  minHeight: 0,
  minWidth: 0,
  overscrollBehavior: "contain",
};
```

Pass as **`viewportStyle={dataTableViewportStyle}`** (or merge with your own styles).

#### Other knobs

- **`fadeMask={false}`** on dense grids so edge masks do not sit on top of cells.
- **`viewportRef`:** use the **viewport element** as **`IntersectionObserver` `root`** when loading more rows at the bottom of a table.

**Full copy-paste shell, sticky header, paging vs infinite scroll:** **`docs/nqui-skills/nqui-data-tables/SKILL.md`**.

---

## Checklist (copy for PRs)

- [ ] **Card / Sheet / panel:** inner column **`min-h-0 overflow-hidden`** owns clip; not only outer **Card** (see §0).
- [ ] **Single primary scroll** per axis — no accidental **page + panel** double scroll (§0).
- [ ] Flex ancestors use **`min-h-0`** where the scroll area must shrink.
- [ ] `ScrollArea` root uses **`min-h-0`** (+ **`flex-1`** / **`h-full`** as appropriate).
- [ ] **Wide tables / TanStack grids:** **`orientation="both"`** (not default vertical-only).
- [ ] **Bounded data panels:** column shell has **`max-h-*`**; scroll root uses **`h-0 flex-1 min-h-0`** pattern where flex blow-through happened before.
- [ ] **Viewport pinned** when `%` height failed: **`viewportStyle`** with **`position: "absolute"`, `inset: 0`, `minHeight: 0`** (see §6).
- [ ] Long **text** wraps: **`min-w-0`**, **`max-w-full`**, **`break-words`** / **`overflow-wrap: anywhere`**, viewport **`overflow-x-hidden`** if prose lives inside.
- [ ] **Code / `pre`**: **`max-height` + native `overflow-auto`**, not nested `ScrollArea`.
- [ ] **No unnecessary nested** `ScrollArea` for small inner regions.
- [ ] **`ScrollBar`** included where a visible scrollbar is desired (see Basic example).
