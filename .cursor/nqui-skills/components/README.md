---
name: nqui-components
description: Component implementation guide for nqui. AI skill for implementing nqui components correctly. Use when building UI with @nqlib/nqui or contributing components.
---

# nqui Component Instructions

Implementation guides for each component. **AI Skill:** Optimized for AI/LLM consumption when implementing nqui in apps or extending the library.

**Import:** `import { X } from "@nqlib/nqui"`  
**CSS:** `@import "@nqlib/nqui/styles"` (via `npx @nqlib/nqui init-css`)

---

## Start here (humans)

1. **Building a screen (not looking up one prop)?** Read **`docs/nqui-skills/COMPOSITION.md`** and run the dev app **Recipes** hub (`npm run dev` → `/`).
2. **Know your task?** Open **`docs/nqui-skills/HUMAN_GUIDE.md`** (in the package) or **`node_modules/@nqlib/nqui/docs/nqui-skills/HUMAN_GUIDE.md`** after install — maps *forms, toolbar, dashboard, empty/loading, …* → which doc to open first.
2. **Pick one component** → **`nqui-<kebab-case>.md`** in this folder (e.g. `nqui-combobox.md`). Don’t load every file.
3. **Need “which component?” tables** → scroll to **When to Use (Selection & Action Components)** and **Shared Conventions** below; skip **Prerequisites** until you wire build/CSS.
4. **Deep layout / scroll / sticky** → **Layout & Scroll Patterns** (implementation-heavy; skip if you’re only choosing a component).

---

## Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| **React** | 18+ or 19 | nqui supports React 18 and 19 via `^18.0.0 \|\| ^19.0.0` peer. |
| **Tailwind CSS** | ^4.x | Required. Vite: `@tailwindcss/vite`. Both Vite and Next.js need `@source` for `node_modules/@nqlib/nqui/dist` (Tailwind does not scan node_modules). |
| **tw-animate-css** | — | `@import "tw-animate-css"` in your CSS (added by init-css). |
| **Radix UI** | — | Bundled (Dialog, Select, etc.). |
| **Hugeicons** | @hugeicons/react, @hugeicons/core-free-icons | Required for icon display in components. |

**Optional peers** (per component): `react-day-picker` (Calendar), `sonner` (Toaster), `react-resizable-panels` (Resizable), `@tanstack/react-table` (DataTable). **Code display** (CodeBlock, Snippet, etc.): use `@nqlib/nqcode` with `shiki`, `@shikijs/transformers`.

---

## Shared Conventions (AI Implementation Rules)

- **Control sizes:** `sm`=h-6, `default`=h-7, `lg`=h-8. Button, Toggle, ToggleGroup, Input, Select, Switch, Slider use this scale. See `docs/nqui-skills/nqui-design-system/SKILL.md` (package) or `.cursor/skills/nqui-design-system/SKILL.md` (monorepo copy).
- **CSS vars required:** nqui uses `--primary`, `--background`, `--foreground`, etc. Run `npx @nqlib/nqui init-css`.
- **Enhanced vs Core:** Default exports (`Button`, `Badge`, `Checkbox`, `Select`, etc.) are the polished/3D variants. Implementations live in **`packages/nqui/src/components/ui/*.tsx`** (single file per concern). Use `CoreButton`, `CoreBadge`, `CoreCheckbox`, etc. for base Radix/shadcn-style behavior. Separator: single component with `variant` prop (no CoreSeparator).
- **Grouped controls:** ButtonGroup, ToggleGroup share border; outer container uses **pill** radius (`rounded-full`). ToggleGroup uses item dividers (`border-foreground/20`) or `ToggleGroupSeparator`.
- **Toolbar context:** Always show Toggle/ToggleGroup in realistic context (document toolbar, chart settings, etc.). Reference: `src/pages/ComponentShowcase.tsx`.
- **Style injection:** Some components inject `<style>` once at mount (e.g. **Combobox** input chrome in `ui/combobox.tsx`) → safe for SSR if the component is client-only (`"use client"`).
- **OKLCH:** ColorPicker expects OKLCH strings (`oklch(0.5 0.15 240)`), not hex.
- **SidebarProvider:** Must wrap entire layout (sidebar + content).
- **Z-index:** Use CSS vars from `styles/elevation.css` (e.g. `z-[var(--z-modal)]`). Never hardcode `z-10`, `z-50`, etc.
- **Keyboard:** Use `Keys`, `isMod`, `shouldIgnoreKeyboardShortcut` from `@/lib/keyboard` for custom shortcuts.
- **Bounded content:** Chips, pills, and inline controls should stay inside their box (ellipsis / line-clamp / scroll-by-design). See **Bounded content** in `docs/nqui-skills/nqui-design-system/SKILL.md`. Portals and tooltips are explicit exceptions.

---

## Layout & Scroll Patterns

This section documents the CSS patterns used in the showcase app to ensure proper scroll behavior and prevent sticky element issues.

### Sticky Elements & Momentum Scroll

**The problem:** When using default body scroll, sticky elements can exhibit "momentum push" behavior during fast scrolling - they appear to float or lag before snapping back. This happens because sticky positioning is relative to the viewport, not the scroll container.

**The solution:** Use a custom scroll container instead of body/html scroll.

```tsx
// App layout structure - prevents momentum push on sticky elements
<div className="h-screen overflow-hidden">
  <header className="sticky top-0 z-[var(--z-sticky-page)]">
    {/* Page header */}
  </header>
  <main className="flex-1 min-h-0 overflow-y-auto">
    {/* Scrollable content */}
  </main>
</div>
```

### Z-Index Layering for Sticky Elements

Use the correct z-index variables to prevent sticky element conflicts:

| Element | CSS Variable | Value |
|---------|-------------|-------|
| Page headers, navigation bars | `z-[var(--z-sticky-page)]` | 20 |
| Card headers, table headers | `z-[var(--z-sticky-content)]` | 15 |

**Rule:** Page-level sticky elements (20) must be above container-level sticky elements (15) to prevent scroll conflicts.

### Flex Scroll Pattern

For nested scrolling to work correctly, flex children must have `min-height: 0` (or `min-h-0` in Tailwind):

```tsx
// Correct - flex child can shrink and scroll
<div className="flex flex-col h-screen">
  <header className="flex-shrink-0">...</header>
  <main className="flex-1 min-h-0 overflow-y-auto">
    {/* This will scroll */}
  </main>
</div>

// Wrong - flex child cannot shrink below content height
<div className="flex flex-col h-screen">
  <header>...</header>
  <main className="flex-1 overflow-y-auto">
    {/* May not scroll - overflows instead */}
  </main>
</div>
```

### Body Scroll Prevention

For app-like experiences, disable body/html scroll:

```tsx
useEffect(() => {
  // Disable browser scroll restoration
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  // Prevent body/html from scrolling
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'

  return () => {
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
  }
}, [])
```

### Sliding Indicator Containers

Components with sliding indicators (Tabs, RadioGroup `sliding` variant) need specific container styling:

```tsx
// Required CSS for sliding indicator containers
.sliding-indicator-container {
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.sliding-indicator {
  position: absolute;
  overflow: visible;
  /* transitions for smooth sliding */
}
```

---

## When to Use (Selection & Action Components)

Use these rules to choose the right component. **Selection** = user picks from options. **Action** = user triggers a command.

### App Design Rule: Inline/Toolbar → ToggleGroup

**For toolbars, headers, and inline controls:** Always use ToggleGroup (never RadioGroup). Examples: view mode (List/Grid), scale (Linear/Log), format (Bold/Italic). Use RadioGroup only for form context (settings modal, stacked preference list).

**Context-first design:** Place toolbars in realistic app context (document editor with content area, chart panel with labels). Never show Toggle/ToggleGroup floating alone. Canonical implementation: `src/pages/ComponentShowcase.tsx` → Toggle & ToggleGroup section.

### Single selection (pick one of N)

| If... | Use |
|-------|-----|
| 2–4 options, inline, want primary fill on selected | **ToggleGroup** `type="single" variant="segmented"` |
| 2–5 options, inline, neutral/muted styling | **ToggleGroup** `type="single"` |
| 5+ options OR limited space | **Select** (dropdown) |
| Form context, stacked or horizontal list | **RadioGroup** |
| Need search/filter over options | **Combobox** (single) |

### Multiple selection (pick zero or more)

| If... | Use |
|-------|-----|
| 2–5 options, inline (e.g. bold/italic/underline) | **ToggleGroup** `type="multiple"` |
| Form context, list of options | **Checkbox** (each option) |
| Many options, need search | **Combobox** with `multiple` (see `nqui-combobox.md`) |

### Actions (trigger, not select)

| If... | Use |
|-------|-----|
| Single action (save, submit, etc.) | **Button** |
| Related actions side-by-side (Undo/Redo, align) | **ButtonGroup** |
| On/off state for one thing (bold, mute) | **Toggle** |

### Quick decision

- **ToggleGroup segmented** → 1 selection only, 2–4 options, primary fill on selected. Example: Linear/Log scale.
- **ToggleGroup single** → 1 selection, neutral/muted styling.
- **ToggleGroup multiple** → Multiple selection, e.g. format toolbar.
- **Select** → 1 selection, many options or no space for inline.
- **ButtonGroup** → Actions, not selection. Each item does something (click = action).

---

## Buttons & Actions

| Component | Doc | When to Use |
|-----------|-----|-------------|
| Button | [nqui-button.md](./nqui-button.md) | Single action (submit, cancel, icon). Not for selection. |
| ButtonGroup | [nqui-button-group.md](./nqui-button-group.md) | Related actions side-by-side (toolbar). Each triggers an action. Not for selection. |
| Toggle | [nqui-toggle.md](./nqui-toggle.md) | One on/off state. E.g. bold in editor. Not a group. |
| ToggleGroup | [nqui-toggle-group.md](./nqui-toggle-group.md) | **Single** or **multiple** selection. `type="single"` = 1 of N; `type="multiple"` = 0+ of N. Use `variant="segmented"` for primary fill on selected (e.g. view mode, scale type). |

---

## Forms – When to Use

| If... | Use |
|-------|-----|
| Free text, single line | **Input** |
| Free text, multiple lines | **Textarea** |
| Input with icon/button (search, units) | **InputGroup** |
| Single choice, 5+ options or no space | **Select** |
| Single choice, need search | **Combobox** (single) |
| Single choice, form, small option set | **RadioGroup** |
| Multiple choice, need search | **Combobox** with `multiple` (see `nqui-combobox.md`) |
| One boolean (agree, subscribe) | **Checkbox** |
| On/off setting (dark mode, notifications) | **Switch** |
| Numeric range (volume, opacity) | **Slider** |
| OTP, verification code | **InputOTP** |
| Color from swatches | **ColorPicker** |
| Hue/saturation in color picker | **ColorSlider** |
| Wrap label + error + input | **Field** |

---

## Forms

| Component | Doc | When to Use |
|-----------|-----|-------------|
| Input | [nqui-input.md](./nqui-input.md) | Single-line text. Email, search, name. |
| InputGroup | [nqui-input-group.md](./nqui-input-group.md) | Input + addon (icon, button, unit). |
| Textarea | [nqui-textarea.md](./nqui-textarea.md) | Multi-line text. |
| Select | [nqui-select.md](./nqui-select.md) | **1 selection** from 5+ options. Dropdown. Use when options don't fit inline or space is tight. |
| NativeSelect | [nqui-native-select.md](./nqui-native-select.md) | Native `<select>` – simpler, accessible fallback. |
| Checkbox | [nqui-checkbox.md](./nqui-checkbox.md) | **1 boolean** (agree, subscribe). Or multiple checkboxes for multi-select list. |
| RadioGroup | [nqui-radio-group.md](./nqui-radio-group.md) | **1 selection** from options in form context. Stacked or inline. |
| Switch | [nqui-switch.md](./nqui-switch.md) | On/off setting (not formatting). |
| Slider | [nqui-slider.md](./nqui-slider.md) | Numeric range. |
| Rating | [nqui-rating.md](./nqui-rating.md) | Star/score (1–5). |
| InputOTP | [nqui-input-otp.md](./nqui-input-otp.md) | OTP/verification. |
| Field | [nqui-field.md](./nqui-field.md) | Label + description + error wrapper. |
| Combobox | [nqui-combobox.md](./nqui-combobox.md) | **Searchable** select. Single or `multiple`. Use when user types to filter. |
| ColorPicker | [nqui-color-picker.md](./nqui-color-picker.md) | Color selection. OKLCH. |
| ColorSlider | [nqui-color-slider.md](./nqui-color-slider.md) | Hue/saturation (used in ColorPicker). |
| Label | [nqui-label.md](./nqui-label.md) | Form label. |

---

## Display – When to Use

| If... | Use |
|-------|-----|
| Status, count, tag | **Badge** |
| User/org image | **Avatar** |
| Inline message (info, warn, error) | **Alert** |
| Empty list/table | **Empty** |
| Loading placeholder | **Skeleton** |
| Loading spinner | **Spinner** |
| Progress bar | **Progress** |
| Divider, section split | **Separator** |
| Content container | **Card** |
| List row (avatar + title + actions) | **Item** |
| Show keyboard shortcut | **Kbd** |
| Activity blocks (e.g. heatmap) | **Tracker** |
| Glass effect (blur + tint row; scroll behind) | **FrostedGlass** |

---

## Display

| Component | Doc | When to Use |
|-----------|-----|----------|
| Badge | [nqui-badge.md](./nqui-badge.md) | Status, count, tag. |
| Avatar | [nqui-avatar.md](./nqui-avatar.md) | User/profile image. |
| Alert | [nqui-alert.md](./nqui-alert.md) | Inline message (info, warning, error). |
| Empty | [nqui-empty.md](./nqui-empty.md) | Empty state when no data. |
| Skeleton | [nqui-skeleton.md](./nqui-skeleton.md) | Loading placeholder. |
| Spinner | [nqui-spinner.md](./nqui-spinner.md) | Loading indicator. |
| Progress | [nqui-progress.md](./nqui-progress.md) | Progress bar. |
| Separator | [nqui-separator.md](./nqui-separator.md) | Divider. `variant` for fade, solid, decorative. |
| Card | [nqui-card.md](./nqui-card.md) | Content container. |
| Item | [nqui-item.md](./nqui-item.md) | List row: media + title + description + actions. |
| Kbd | [nqui-kbd.md](./nqui-kbd.md) | Keyboard shortcut display. |
| Tracker | [nqui-tracker.md](./nqui-tracker.md) | Activity blocks (heatmap). |
| FrostedGlass | [nqui-frosted-glass.md](./nqui-frosted-glass.md) | Glass blur; use with second tint row + scroll behind (see doc). |
| NquiLogo | [nqui-logo.md](./nqui-logo.md) | Theme-aware logo. |

---

## Data & Tables – When to Use

| If... | Use |
|-------|-----|
| Static table, no sort/filter | **Table** |
| Table with sort, filter, paginate, select | **DataTable** |
| List of items (avatar + title + actions) | **Item** |

---

## Data & Tables

| Component | Doc | When to Use |
|-----------|-----|-------------|
| Table | [nqui-table.md](./nqui-table.md) | Static table. TableHeader, TableBody, TableRow, TableCell. |
| DataTable | [nqui-data-table.md](./nqui-data-table.md) | Sort, filter, paginate, select, edit. Requires `@tanstack/react-table`. |
| Item | [nqui-item.md](./nqui-item.md) | List row with media, title, description, actions. |

---

## Files & Code Display

| Component | Doc | Use Case |
|-----------|-----|----------|
| CodeBlock | [nqui-code-block.md](./nqui-code-block.md) | From `@nqlib/nqcode`. Syntax-highlighted code, multi-file, copy. Peer: shiki. |
| Snippet | [nqui-snippet.md](./nqui-snippet.md) | From `@nqlib/nqcode`. Tabbed code, copy. |

---

## Navigation – When to Use

| If... | Use |
|-------|-----|
| Breadcrumb path | **Breadcrumb** |
| Tabbed panels | **Tabs** |
| Menu from trigger (avatar, ⋮) | **DropdownMenu** |
| Right-click menu | **ContextMenu** |
| Horizontal app menu | **Menubar** |
| Mega nav / complex nav | **NavigationMenu** |
| Page 1, 2, 3... | **Pagination** |
| Search + command list | **Command** / **CommandPalette** |
| Doc section links | **TableOfContents** |

---

## Navigation & Menus

| Component | Doc | When to Use |
|-----------|-----|----------|
| Breadcrumb | [nqui-breadcrumb.md](./nqui-breadcrumb.md) | Path navigation (Home > Products > Item). |
| Tabs | [nqui-tabs.md](./nqui-tabs.md) | Switch between panels (Settings, Profile). |
| DropdownMenu | [nqui-dropdown-menu.md](./nqui-dropdown-menu.md) | Menu from trigger click (avatar, ⋮). |
| ContextMenu | [nqui-context-menu.md](./nqui-context-menu.md) | Right-click menu. |
| Menubar | [nqui-menubar.md](./nqui-menubar.md) | Horizontal app menu (File, Edit). |
| NavigationMenu | [nqui-navigation-menu.md](./nqui-navigation-menu.md) | Mega menu with sub-panels. |
| Pagination | [nqui-pagination.md](./nqui-pagination.md) | Page 1, 2, 3... navigation. |
| Command | [nqui-command.md](./nqui-command.md) | Searchable command list. |
| CommandPalette | [nqui-command-palette.md](./nqui-command-palette.md) | Full Cmd+K palette. |
| TableOfContents | [nqui-table-of-contents.md](./nqui-table-of-contents.md) | Doc section links from headings. |

**Cmd+K / cmdk row highlight (React 19):** Fixed in **nqui ≥ 0.6.1** (`aria-selected:bg-accent` in `floatingListItemInteractive`). If every row still looks selected on an older version, see [nqui-command-palette.md](./nqui-command-palette.md).

---

## Overlays – When to Use

| If... | Use |
|-------|-----|
| Modal, blocks page, user must respond | **Dialog** |
| Confirm/cancel (delete, leave) | **AlertDialog** |
| Panel from side (mobile-first) | **Sheet** |
| Panel from bottom, mobile | **Drawer** (vaul) |
| Floating content near trigger (picker, menu) | **Popover** |
| Hover to show extra info | **Tooltip** (short) or **HoverCard** (rich) |
| Non-blocking notification | **Toaster** (sonner) |

---

## Overlays & Dialogs

| Component | Doc | When to Use |
|-----------|-----|-------------|
| Dialog | [nqui-dialog.md](./nqui-dialog.md) | Modal. Blocks interaction until dismissed. |
| AlertDialog | [nqui-alert-dialog.md](./nqui-alert-dialog.md) | Confirm/cancel. Delete, leave page. |
| Drawer | [nqui-drawer.md](./nqui-drawer.md) | Slide from bottom. Mobile-friendly. |
| Sheet | [nqui-sheet.md](./nqui-sheet.md) | Panel from side. |
| Popover | [nqui-popover.md](./nqui-popover.md) | Floating content anchored to trigger. |
| HoverCard | [nqui-hover-card.md](./nqui-hover-card.md) | Rich preview on hover. |
| Tooltip | [nqui-tooltip.md](./nqui-tooltip.md) | Short hint on hover. |
| Toaster | [nqui-toaster.md](./nqui-toaster.md) | Toast notifications. Requires `sonner`. |

---

## Layout

| Component | Doc | Use Case |
|-----------|-----|----------|
| Accordion | [nqui-accordion.md](./nqui-accordion.md) | Collapsible sections. |
| Collapsible | [nqui-collapsible.md](./nqui-collapsible.md) | Single collapsible. |
| ScrollArea | [nqui-scroll-area.md](./nqui-scroll-area.md) | Custom scroll with fade mask. |
| AspectRatio | [nqui-aspect-ratio.md](./nqui-aspect-ratio.md) | Fixed aspect container. |
| Carousel | [nqui-carousel.md](./nqui-carousel.md) | Image/content carousel. Requires `embla-carousel-react`. |
| Resizable | [nqui-resizable.md](./nqui-resizable.md) | Resizable panels. Requires `react-resizable-panels`. |
| Sidebar | [nqui-sidebar.md](./nqui-sidebar.md) | App sidebar. `SidebarProvider` wraps layout. |
| Sortable | [nqui-sortable.md](./nqui-sortable.md) | Drag-to-reorder. Import from `@nqlib/nqui/sortable`. |

---

## Advanced

| Component | Doc | Use Case |
|-----------|-----|----------|
| Calendar | [nqui-calendar.md](./nqui-calendar.md) | Date picker. Requires `react-day-picker`, `date-fns`. Import from `@nqlib/nqui/calendar`. |

---

## AI Implementation Checklist

1. **Choose component** – Use "When to Use" tables above. Selection vs action? Single vs multiple? Option count?
2. **Read doc** – Open `nqui-<name>.md` for import and patterns.
3. **Size** – Use `sm`/`default`/`lg` per design system. No custom heights.
4. **Enhanced vs Core** – Prefer default (enhanced); use `Core*` when plain style needed.
5. **Toolbar/context** – Place Toggle/ToggleGroup in realistic context (document toolbar, chart panel). Reference: `src/pages/ComponentShowcase.tsx`.
6. **SSR** – Wrap style-injecting components (Checkbox, Rating, Combobox) in client boundary if SSR.
7. **Z-index** – Use `var(--z-modal)`, `var(--z-popover)`, etc.
8. **Keyboard** – Use `shouldIgnoreKeyboardShortcut` for global listeners.
