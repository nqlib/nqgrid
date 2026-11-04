# nqui FrostedGlass

> Apple-style frosted glass using `backdrop-filter`, extended backdrop, and masks. **Do not use `FrostedGlass` alone** in headers—pair it with a second row that carries the tint and controls stacking.

**Background:** [Josh Comeau — `backdrop-filter`](https://www.joshwcomeau.com/css/backdrop-filter/)

## Import

```tsx
import { FrostedGlass } from "@nqlib/nqui"
```

## Props

| Prop | Type | Default | Notes |
|------|------|---------|--------|
| `blur` | `number` | `16` | Blur radius in pixels (`backdrop-filter`). |
| `borderRadius` | `number` | `0` | Pixels. `> 0` enables an SVG corner mask; `0` uses a linear gradient mask (flat header edge). |
| `className` | `string` | — | Extra classes on the backdrop layer (e.g. z-index). |

There is **no `opacity` prop**—tint comes from the sibling bar (see below). The backdrop layer uses a very light `bg-background/3` internally so the blur reads clearly.

## Why two layers?

`FrostedGlass` renders an **absolute** backdrop layer (`pointer-events-none`, extended height for sampling). Your **toolbar/title row** must be a **sibling** on top with:

- `relative z-[var(--z-content)]`
- A semi-opaque surface, e.g. `bg-background/40` (tint + readability)
- Optional `border-b`, transitions, flex layout

Without that second row, you only get blur with almost no “glass” read and no interactive chrome.

## Z-index (elevation)

Use variables from `styles/elevation.css` (never raw `z-10` / `z-50`).

| Layer | Typical class | Role |
|-------|----------------|------|
| Sticky container | `z-[var(--z-sticky-page)]` or `z-[var(--z-sticky-content)]` | Page header vs sticky **inside** a card/panel. |
| `FrostedGlass` | `className="z-[var(--z-background)]"` | Blur sits **below** the bar content. |
| Bar / controls | `relative z-[var(--z-content)]` | Text, buttons, borders. |

**Rule:** `--z-sticky-content` (15) &lt; `--z-sticky-page` (20). Use `--z-sticky-page` for app chrome; `--z-sticky-content` for a **Card** with `stickyHeader` so page nav stays above card headers.

## Scroll requirement

`backdrop-filter` blurs **what is painted behind** the element. For a sticky header:

1. Put the header and the main content in the **same scroll container** (or ensure content scrolls under the sticky region).
2. Content must **move behind** the header while scrolling. If nothing scrolls behind the bar, you will see a flat tint with little or no visible blur.

Reference: `AppLayout` wraps header + main in `overflow-y-auto` so the main area scrolls under the sticky header.

## Page sticky header (canonical)

Same structure as `packages/nqui/src/components/AppLayout.tsx`:

```tsx
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
  <header className="sticky top-0 z-[var(--z-sticky-page)] flex-shrink-0 relative">
    <FrostedGlass blur={16} borderRadius={0} className="z-[var(--z-background)]" />
    <div className="relative z-[var(--z-content)] border-b bg-background/40 flex h-12 items-center gap-2 px-4">
      {/* title, nav, actions */}
    </div>
  </header>
  <main>{/* scrolls behind header */}</main>
</div>
```

- Outer `header`: `sticky` + `relative` + page-level z-index.
- `FrostedGlass`: `borderRadius={0}` for a straight top edge; increase if the header has rounded corners.
- Inner bar: `bg-background/40` (adjust opacity to taste).

## Card with sticky header

**Card** `stickyHeader` wires this pattern for you: `FrostedGlass` with `borderRadius={8}` under **CardHeader**, scrollable **CardContent** below. See `ComponentShowcase` and `packages/nqui/src/components/ui/card.tsx`.

Use `--z-sticky-content` on the sticky region when the glass sits inside a card, not the full page.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Solid bar, almost no blur | No content scrolling behind the sticky region, or header not in the scrolling ancestor. |
| Blur but unreadable text | Add / raise `bg-background/40` (or similar) on the **content row**, not only on `FrostedGlass`. |
| Wrong stacking vs sidebar/modals | Check elevation: floating sidebars use `--z-floating`; modals/popovers sit above—see `elevation.css`. |
| Rounded header corners | Set `borderRadius` to match; `> 0` switches to the SVG mask path. |

## Vite / Tailwind

Consumer apps must import nqui styles **and** add Tailwind `@source` for the library (see **INSTALLATION.md** §2c). Missing sources can strip utilities used around the header (`bg-background/40`, z-index arbitrary values, etc.).

## Related

- **AppLayout** — full app shell with frosted page header.
- **Card** `stickyHeader` — frosted sticky card header.
- **Select** — popover row uses the same backdrop layering pattern.
